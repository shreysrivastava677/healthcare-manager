import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST /api/appointments/[id]/post-notes - Doctor submits post-visit notes
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { clinicalNotes, prescription } = body;

    if (!clinicalNotes || clinicalNotes.trim().length < 10) {
      return NextResponse.json(
        { error: 'Clinical notes must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (!prescription || prescription.trim().length < 5) {
      return NextResponse.json(
        { error: 'Prescription must be at least 5 characters' },
        { status: 400 }
      );
    }

    // Verify appointment belongs to this doctor
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        doctorProfile: { select: { userId: true } },
        postVisitNote: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (appointment.doctorProfile.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (appointment.postVisitNote) {
      return NextResponse.json({ error: 'Post-visit notes already submitted' }, { status: 409 });
    }

    // Create post-visit note and mark appointment as completed
    const [postVisitNote] = await prisma.$transaction([
      prisma.postVisitNote.create({
        data: {
          appointmentId: id,
          clinicalNotes: clinicalNotes.trim(),
          prescription: prescription.trim(),
        },
      }),
      prisma.appointment.update({
        where: { id },
        data: { status: 'COMPLETED' },
      }),
    ]);

    // Trigger LLM post-visit summary generation (await it)
    await generatePostVisitSummary(id, clinicalNotes, prescription, appointment.patientId).catch(err => {
      console.error('Post-visit summary generation error:', err);
    });

    return NextResponse.json({ postVisitNote }, { status: 201 });
  } catch (error) {
    console.error('POST /api/appointments/[id]/post-notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generatePostVisitSummary(appointmentId, clinicalNotes, prescription, patientId) {
  try {
    const { generatePostVisitSummary: llmGenerate } = await import('@/lib/llm');
    
    const result = await llmGenerate(clinicalNotes, prescription);

    if (result) {
      const postVisitSummary = await prisma.postVisitSummary.create({
        data: {
          appointmentId,
          patientFriendlySummary: result.patientFriendlySummary || null,
          medicationSchedule: JSON.stringify(result.medicationSchedule || []),
          followUpSteps: JSON.stringify(result.followUpSteps || []),
          rawLlmResponse: JSON.stringify(result),
          generatedAt: new Date(),
        },
      });

      // Create medication reminders from the schedule
      if (result.medicationSchedule && Array.isArray(result.medicationSchedule)) {
        const today = new Date();
        const reminders = result.medicationSchedule.map(med => ({
          postVisitSummaryId: postVisitSummary.id,
          patientId,
          medicationName: med.name || 'Unknown',
          dosage: med.dosage || 'As prescribed',
          frequency: med.frequency || 'Daily',
          startDate: today,
          endDate: new Date(today.getTime() + parseDuration(med.duration)),
          nextReminderAt: getNextReminderTime(med.frequency),
          isActive: true,
        }));

        if (reminders.length > 0) {
          await prisma.medicationReminder.createMany({ data: reminders });
        }
      }
    } else {
      await prisma.postVisitSummary.create({
        data: {
          appointmentId,
          rawLlmResponse: null,
          generatedAt: null,
          retryCount: 0,
        },
      });
    }
  } catch (error) {
    console.error('LLM post-visit summary error:', error);
    try {
      await prisma.postVisitSummary.create({
        data: {
          appointmentId,
          rawLlmResponse: null,
          generatedAt: null,
          retryCount: 0,
        },
      });
    } catch (dbError) {
      console.error('Failed to create placeholder:', dbError);
    }
  }
}

function parseDuration(duration) {
  if (!duration) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  const str = duration.toLowerCase();
  const num = parseInt(str) || 7;
  if (str.includes('week')) return num * 7 * 24 * 60 * 60 * 1000;
  if (str.includes('month')) return num * 30 * 24 * 60 * 60 * 1000;
  return num * 24 * 60 * 60 * 1000; // Default: days
}

function getNextReminderTime(frequency) {
  const now = new Date();
  const freq = (frequency || 'daily').toLowerCase();
  if (freq.includes('twice') || freq.includes('2')) {
    // Next 8 AM or 8 PM
    const next = new Date(now);
    next.setHours(next.getHours() < 8 ? 8 : 20, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
  // Daily - next 9 AM
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}
