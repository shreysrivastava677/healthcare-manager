import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/appointments/[id] - Get appointment details
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
        patient: { select: { id: true, name: true, email: true, phone: true } },
        doctorProfile: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        symptomForm: true,
        preVisitSummary: true,
        postVisitNote: true,
        postVisitSummary: true,
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

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error('GET /api/appointments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/appointments/[id] - Update appointment status
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, cancelReason } = body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { name: true, email: true } },
        doctorProfile: {
          include: { user: { select: { name: true, email: true } } },
        },
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

    // Validate status transitions
    const validTransitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED'],
    };

    if (!validTransitions[appointment.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${appointment.status} to ${status}` },
        { status: 400 }
      );
    }

    // For confirmation, verify hold hasn't expired
    if (status === 'CONFIRMED' && appointment.status === 'PENDING') {
      if (appointment.holdExpiresAt && appointment.holdExpiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Booking hold has expired. Please rebook.' },
          { status: 410 }
        );
      }
    }

    const updateData = {
      status,
      ...(cancelReason && { cancelReason }),
      ...(status === 'CONFIRMED' && { holdToken: null, holdExpiresAt: null }),
    };

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: { select: { name: true, email: true } },
        doctorProfile: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    // Queue email notifications asynchronously
    try {
      if (status === 'CONFIRMED') {
        await prisma.emailLog.create({
          data: {
            userId: appointment.patientId,
            toEmail: appointment.patient.email,
            subject: 'Appointment Confirmed',
            body: `Your appointment with Dr. ${appointment.doctorProfile.user.name} on ${new Date(appointment.slotStart).toLocaleString()} has been confirmed.`,
            type: 'BOOKING_CONFIRM',
            status: 'PENDING',
          },
        });
      } else if (status === 'CANCELLED') {
        await prisma.emailLog.create({
          data: {
            userId: appointment.patientId,
            toEmail: appointment.patient.email,
            subject: 'Appointment Cancelled',
            body: `Your appointment with Dr. ${appointment.doctorProfile.user.name} on ${new Date(appointment.slotStart).toLocaleString()} has been cancelled. ${cancelReason ? `Reason: ${cancelReason}` : ''}`,
            type: 'CANCELLATION',
            status: 'PENDING',
          },
        });
      }
    } catch (emailError) {
      console.error('Failed to queue email:', emailError);
      // Don't fail the appointment update due to email issues
    }

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error('PATCH /api/appointments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/appointments/[id] - Cancel appointment
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      return NextResponse.json(
        { error: 'Only pending or confirmed appointments can be cancelled' },
        { status: 400 }
      );
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: 'Cancelled by user',
      },
    });

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error('DELETE /api/appointments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
