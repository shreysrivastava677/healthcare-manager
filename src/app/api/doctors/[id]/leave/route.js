import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { leaveSchema } from '@/lib/validators';
import { format, parse, startOfDay, endOfDay } from 'date-fns';
import { logAndSendEmail, leaveNotificationEmail } from '@/lib/email';

/**
 * GET /api/doctors/[id]/leave
 * List leave days for a doctor.
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const leaveDays = await prisma.doctorLeave.findMany({
      where: { doctorProfileId: id },
      orderBy: { leaveDate: 'asc' },
    });

    return NextResponse.json({ leaveDays }, { status: 200 });
  } catch (error) {
    console.error('GET /api/doctors/[id]/leave error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave days' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/doctors/[id]/leave
 * Doctor or admin. Add a leave day.
 * If there are confirmed appointments on that date, cancel them and notify patients.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify the doctor profile exists and get user info
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    // Authorization: only the doctor themselves or an admin
    const isOwner = session.user.id === doctorProfile.userId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only the doctor or an admin can add leave' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = leaveSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { leaveDate, reason } = validation.data;
    const leaveDateObj = parse(leaveDate, 'yyyy-MM-dd', new Date());

    // Check for duplicate leave entry
    const existingLeave = await prisma.doctorLeave.findFirst({
      where: {
        doctorProfileId: id,
        leaveDate: leaveDateObj,
      },
    });

    if (existingLeave) {
      return NextResponse.json(
        { error: 'Leave already exists for this date' },
        { status: 409 }
      );
    }

    // Find confirmed appointments on the leave date
    const confirmedAppointments = await prisma.appointment.findMany({
      where: {
        doctorProfileId: id,
        slotStart: {
          gte: startOfDay(leaveDateObj),
          lte: endOfDay(leaveDateObj),
        },
        status: 'CONFIRMED',
      },
      include: {
        patient: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Use a transaction to create leave and cancel appointments
    await prisma.$transaction(async (tx) => {
      // Create leave entry
      await tx.doctorLeave.create({
        data: {
          doctorProfileId: id,
          leaveDate: leaveDateObj,
          reason: reason || null,
        },
      });

      // Cancel all confirmed appointments on that date
      if (confirmedAppointments.length > 0) {
        await tx.appointment.updateMany({
          where: {
            id: { in: confirmedAppointments.map((a) => a.id) },
          },
          data: {
            status: 'CANCELLED',
            cancelReason: `Doctor on leave: ${reason || 'No reason provided'}`,
          },
        });
      }
    });

    // Send notification emails to affected patients (outside transaction)
    const formattedDate = format(leaveDateObj, 'MMMM d, yyyy');
    for (const appointment of confirmedAppointments) {
      const { subject, html } = leaveNotificationEmail(
        appointment.patient.name,
        doctorProfile.user.name,
        formattedDate
      );

      // Fire and forget — don't block the response
      logAndSendEmail({
        userId: appointment.patient.id,
        toEmail: appointment.patient.email,
        subject,
        body: html,
        type: 'LEAVE_NOTIFY',
      }).catch((err) => console.error('Failed to send leave notification:', err));
    }

    return NextResponse.json(
      {
        message: 'Leave added successfully',
        cancelledAppointments: confirmedAppointments.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/doctors/[id]/leave error:', error);
    return NextResponse.json(
      { error: 'Failed to add leave' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/doctors/[id]/leave?date=YYYY-MM-DD
 * Doctor or admin. Remove a leave day.
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify the doctor profile exists
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id },
    });

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    // Authorization: only the doctor themselves or an admin
    const isOwner = session.user.id === doctorProfile.userId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only the doctor or an admin can remove leave' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'Missing required query parameter: date (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const leaveDateObj = parse(date, 'yyyy-MM-dd', new Date());

    const leaveEntry = await prisma.doctorLeave.findFirst({
      where: {
        doctorProfileId: id,
        leaveDate: leaveDateObj,
      },
    });

    if (!leaveEntry) {
      return NextResponse.json(
        { error: 'No leave found for this date' },
        { status: 404 }
      );
    }

    await prisma.doctorLeave.delete({
      where: { id: leaveEntry.id },
    });

    return NextResponse.json(
      { message: 'Leave removed successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE /api/doctors/[id]/leave error:', error);
    return NextResponse.json(
      { error: 'Failed to remove leave' },
      { status: 500 }
    );
  }
}
