import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// GET /api/appointments - List appointments (role-filtered)
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stats = searchParams.get('stats');
    const limit = parseInt(searchParams.get('limit')) || undefined;

    const userId = session.user.id;
    const role = session.user.role;

    // Build where clause based on role
    let where = {};
    if (role === 'PATIENT') {
      where.patientId = userId;
    } else if (role === 'DOCTOR') {
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId },
      });
      if (!doctorProfile) {
        return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
      }
      where.doctorProfileId = doctorProfile.id;
    }
    // ADMIN sees all

    if (status) {
      where.status = status;
    }

    // Return stats if requested
    if (stats === 'true') {
      const [total, confirmed, completed, cancelled, pending] = await Promise.all([
        prisma.appointment.count({ where }),
        prisma.appointment.count({ where: { ...where, status: 'CONFIRMED' } }),
        prisma.appointment.count({ where: { ...where, status: 'COMPLETED' } }),
        prisma.appointment.count({ where: { ...where, status: 'CANCELLED' } }),
        prisma.appointment.count({ where: { ...where, status: 'PENDING' } }),
      ]);

      // Get upcoming appointments
      const upcoming = await prisma.appointment.findMany({
        where: {
          ...where,
          status: { in: ['CONFIRMED', 'PENDING'] },
          slotStart: { gte: new Date() },
        },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          doctorProfile: {
            include: { user: { select: { name: true, email: true } } },
          },
          preVisitSummary: { select: { urgencyLevel: true } },
        },
        orderBy: { slotStart: 'asc' },
        take: limit || 5,
      });

      return NextResponse.json({
        stats: { total, confirmed, completed, cancelled, pending, upcoming: confirmed + pending },
        upcoming,
      });
    }

    // Regular list
    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctorProfile: {
          include: { user: { select: { name: true, email: true } } },
        },
        symptomForm: true,
        preVisitSummary: true,
        postVisitNote: true,
        postVisitSummary: true,
      },
      orderBy: { slotStart: 'desc' },
      take: limit,
    });

    return NextResponse.json({ appointments });
  } catch (error) {
    console.error('GET /api/appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/appointments - Create appointment with slot hold
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { doctorProfileId, slotStart } = body;

    if (!doctorProfileId || !slotStart) {
      return NextResponse.json(
        { error: 'doctorProfileId and slotStart are required' },
        { status: 400 }
      );
    }

    const slotStartDate = new Date(slotStart);
    if (slotStartDate < new Date()) {
      return NextResponse.json({ error: 'Cannot book slots in the past' }, { status: 400 });
    }

    // Get doctor profile
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorProfileId },
    });

    if (!doctorProfile || !doctorProfile.isActive) {
      return NextResponse.json({ error: 'Doctor not found or inactive' }, { status: 404 });
    }

    const slotEndDate = new Date(slotStartDate.getTime() + doctorProfile.slotDurationMinutes * 60000);

    // Check for double booking using transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if slot is already taken
      const existingAppointment = await tx.appointment.findFirst({
        where: {
          doctorProfileId,
          slotStart: slotStartDate,
          OR: [
            { status: 'CONFIRMED' },
            {
              status: 'PENDING',
              holdExpiresAt: { gt: new Date() },
            },
          ],
        },
      });

      if (existingAppointment) {
        throw new Error('SLOT_TAKEN');
      }

      // Check for leave
      const leaveDay = await tx.doctorLeave.findFirst({
        where: {
          doctorProfileId,
          leaveDate: {
            gte: new Date(slotStartDate.toISOString().split('T')[0]),
            lt: new Date(new Date(slotStartDate.toISOString().split('T')[0]).getTime() + 86400000),
          },
        },
      });

      if (leaveDay) {
        throw new Error('DOCTOR_ON_LEAVE');
      }

      // Create appointment with hold
      const holdToken = uuidv4();
      const holdExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const appointment = await tx.appointment.create({
        data: {
          patientId: session.user.id,
          doctorProfileId,
          slotStart: slotStartDate,
          slotEnd: slotEndDate,
          status: 'CONFIRMED',
          holdToken,
          holdExpiresAt,
        },
        include: {
          doctorProfile: {
            include: { user: { select: { name: true, email: true } } },
          },
          patient: { select: { name: true, email: true } },
        },
      });

      return appointment;
    });

    return NextResponse.json({ appointment: result }, { status: 201 });
  } catch (error) {
    if (error.message === 'SLOT_TAKEN') {
      return NextResponse.json(
        { error: 'This slot is no longer available. Please choose another time.' },
        { status: 409 }
      );
    }
    if (error.message === 'DOCTOR_ON_LEAVE') {
      return NextResponse.json(
        { error: 'Doctor is on leave on this date.' },
        { status: 409 }
      );
    }
    console.error('POST /api/appointments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
