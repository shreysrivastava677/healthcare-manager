import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/doctors/[id]
 * Get a doctor profile by doctorProfile ID, including user details.
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            createdAt: true,
          },
        },
      },
    });

    if (!doctorProfile) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    return NextResponse.json({ doctorProfile }, { status: 200 });
  } catch (error) {
    console.error('GET /api/doctors/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch doctor' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/doctors/[id]
 * Admin only. Update doctor profile fields.
 */
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingProfile = await prisma.doctorProfile.findUnique({
      where: { id },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    const updateData = {};

    if (body.specialisation !== undefined) {
      updateData.specialisation = body.specialisation;
    }
    if (body.slotDurationMinutes !== undefined) {
      if (body.slotDurationMinutes < 10 || body.slotDurationMinutes > 120) {
        return NextResponse.json(
          { error: 'Slot duration must be between 10 and 120 minutes' },
          { status: 400 }
        );
      }
      updateData.slotDurationMinutes = body.slotDurationMinutes;
    }
    if (body.workingHours !== undefined) {
      updateData.workingHours = JSON.stringify(body.workingHours);
    }
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    const updatedProfile = await prisma.doctorProfile.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json(
      { message: 'Doctor profile updated', doctorProfile: updatedProfile },
      { status: 200 }
    );
  } catch (error) {
    console.error('PUT /api/doctors/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update doctor profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/doctors/[id]
 * Admin only. Soft delete — sets isActive to false.
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const existingProfile = await prisma.doctorProfile.findUnique({
      where: { id },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    await prisma.doctorProfile.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(
      { message: 'Doctor deactivated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('DELETE /api/doctors/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate doctor' },
      { status: 500 }
    );
  }
}
