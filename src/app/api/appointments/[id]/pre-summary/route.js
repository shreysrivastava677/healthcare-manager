import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/appointments/[id]/pre-summary - Get pre-visit summary
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        preVisitSummary: true,
        doctorProfile: { select: { userId: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Verify access
    const role = session.user.role;
    const userId = session.user.id;
    if (role === 'PATIENT' && appointment.patientId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (role === 'DOCTOR' && appointment.doctorProfile.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!appointment.preVisitSummary) {
      return NextResponse.json({ preVisitSummary: null, status: 'pending' });
    }

    const summary = appointment.preVisitSummary;
    return NextResponse.json({
      preVisitSummary: {
        ...summary,
        suggestedQuestions: summary.suggestedQuestions ? JSON.parse(summary.suggestedQuestions) : [],
        isGenerated: !!summary.generatedAt,
      },
    });
  } catch (error) {
    console.error('GET /api/appointments/[id]/pre-summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
