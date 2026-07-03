import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { doctorProfileSchema } from '@/lib/validators';
import bcrypt from 'bcryptjs';

/**
 * GET /api/doctors
 * List doctors with optional filtering by specialisation and name search.
 * Non-admin users only see active doctors.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const specialisation = searchParams.get('specialisation');
    const search = searchParams.get('search');

    const where = {};

    // Non-admin users can only see active doctors
    if (session.user.role !== 'ADMIN') {
      where.isActive = true;
    }

    if (specialisation) {
      where.specialisation = {
        equals: specialisation,
        mode: 'insensitive',
      };
    }

    if (search) {
      where.user = {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      };
    }

    const doctors = await prisma.doctorProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ doctors }, { status: 200 });
  } catch (error) {
    console.error('GET /api/doctors error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch doctors' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/doctors
 * Admin only. Create a new doctor user + profile in a transaction.
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const validation = doctorProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, specialisation, slotDurationMinutes, workingHours, phone } =
      validation.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user and doctor profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          phone: phone || null,
          role: 'DOCTOR',
        },
      });

      const doctorProfile = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          specialisation,
          slotDurationMinutes: slotDurationMinutes || 30,
          workingHours: JSON.stringify(workingHours),
        },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        doctorProfile,
      };
    });

    return NextResponse.json(
      { message: 'Doctor created successfully', ...result },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/doctors error:', error);
    return NextResponse.json(
      { error: 'Failed to create doctor' },
      { status: 500 }
    );
  }
}
