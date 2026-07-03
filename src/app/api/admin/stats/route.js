import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalDoctors, activeDoctors, totalPatients, todayAppointments, recentAppointments] = await Promise.all([
      prisma.user.count({ where: { role: 'DOCTOR' } }),
      prisma.doctorProfile.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'PATIENT' } }),
      prisma.appointment.count({
        where: {
          slotStart: { gte: today, lt: tomorrow },
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
      }),
      prisma.appointment.findMany({
        include: {
          patient: { select: { name: true, email: true } },
          doctorProfile: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return NextResponse.json({
      totalDoctors,
      activeDoctors,
      totalPatients,
      todayAppointments,
      recentAppointments,
    });
  } catch (error) {
    console.error('GET /api/admin/stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
