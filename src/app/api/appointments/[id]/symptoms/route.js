import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST /api/appointments/[id]/symptoms - Submit symptom form
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { symptoms, additionalNotes } = body;

    if (!symptoms || symptoms.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please describe your symptoms (at least 10 characters)' },
        { status: 400 }
      );
    }

    // Verify appointment belongs to patient
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { symptomForm: true },
    });

    if (!appointment || appointment.patientId !== session.user.id) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (appointment.symptomForm) {
      return NextResponse.json({ error: 'Symptom form already submitted' }, { status: 409 });
    }

    // Create symptom form
    const symptomForm = await prisma.symptomForm.create({
      data: {
        appointmentId: id,
        symptoms: symptoms.trim(),
        additionalNotes: additionalNotes?.trim() || null,
      },
    });

    // Trigger LLM pre-visit summary generation (wait for it to finish)
    await generatePreVisitSummary(id, symptoms).catch(err => {
      console.error('Pre-visit summary generation error:', err);
    });

    return NextResponse.json({ symptomForm }, { status: 201 });
  } catch (error) {
    console.error('POST /api/appointments/[id]/symptoms error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generatePreVisitSummary(appointmentId, symptoms) {
  try {
    // Dynamic import to avoid loading LLM module if not needed
    const { generatePreVisitSummary: llmGenerate } = await import('@/lib/llm');
    
    const result = await llmGenerate(symptoms);

    if (result) {
      await prisma.preVisitSummary.create({
        data: {
          appointmentId,
          urgencyLevel: result.urgencyLevel || null,
          chiefComplaint: result.chiefComplaint || null,
          suggestedQuestions: JSON.stringify(result.suggestedQuestions || []),
          rawLlmResponse: JSON.stringify(result),
          generatedAt: new Date(),
        },
      });
    } else {
      // Create a placeholder for retry
      await prisma.preVisitSummary.create({
        data: {
          appointmentId,
          rawLlmResponse: null,
          generatedAt: null,
          retryCount: 0,
        },
      });
    }
  } catch (error) {
    console.error('LLM pre-visit summary error:', error);
    // Create placeholder for retry
    try {
      await prisma.preVisitSummary.create({
        data: {
          appointmentId,
          rawLlmResponse: null,
          generatedAt: null,
          retryCount: 0,
        },
      });
    } catch (dbError) {
      // Might already exist
      console.error('Failed to create placeholder:', dbError);
    }
  }
}
