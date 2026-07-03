import {
  parse,
  format,
  addMinutes,
  startOfDay,
  endOfDay,
  isBefore,
  isEqual,
  getDay,
} from 'date-fns';
import prisma from '@/lib/prisma';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Generate all possible time slots for a doctor on a given date.
 * @param {object} doctorProfile - The doctor profile record (with workingHours and slotDurationMinutes)
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Array<{start: Date, end: Date, startTime: string, endTime: string}>}
 */
export function generateSlots(doctorProfile, dateString) {
  const date = parse(dateString, 'yyyy-MM-dd', new Date());
  const dayOfWeek = DAY_NAMES[getDay(date)];

  let workingHours;
  try {
    workingHours =
      typeof doctorProfile.workingHours === 'string'
        ? JSON.parse(doctorProfile.workingHours)
        : doctorProfile.workingHours;
  } catch {
    return [];
  }

  const daySchedule = workingHours[dayOfWeek];
  if (!daySchedule || !daySchedule.start || !daySchedule.end) {
    return [];
  }

  const slotDuration = doctorProfile.slotDurationMinutes || 30;

  // Parse start and end times for the day
  const dayStart = parse(
    `${dateString} ${daySchedule.start}`,
    'yyyy-MM-dd HH:mm',
    new Date()
  );
  const dayEnd = parse(
    `${dateString} ${daySchedule.end}`,
    'yyyy-MM-dd HH:mm',
    new Date()
  );

  const slots = [];
  let current = dayStart;

  while (isBefore(current, dayEnd) || isEqual(current, dayEnd)) {
    const slotEnd = addMinutes(current, slotDuration);
    // Only add if the slot ends within or at the day's end time
    if (isBefore(slotEnd, dayEnd) || isEqual(slotEnd, dayEnd)) {
      slots.push({
        start: current,
        end: slotEnd,
        startTime: format(current, 'HH:mm'),
        endTime: format(slotEnd, 'HH:mm'),
      });
    }
    current = slotEnd;
  }

  return slots;
}

/**
 * Get available (unbooked) slots for a doctor on a given date.
 * @param {string} doctorProfileId - The doctor profile ID
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} Available slot objects
 */
export async function getAvailableSlots(doctorProfileId, dateString) {
  // 1. Get doctor profile
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
  });

  if (!doctorProfile || !doctorProfile.isActive) {
    return [];
  }

  // 2. Check if the date is a leave day
  const dateObj = parse(dateString, 'yyyy-MM-dd', new Date());
  const leaveDay = await prisma.doctorLeave.findFirst({
    where: {
      doctorProfileId,
      leaveDate: dateObj,
    },
  });

  if (leaveDay) {
    return [];
  }

  // 3. Generate all possible slots
  const allSlots = generateSlots(doctorProfile, dateString);

  if (allSlots.length === 0) {
    return [];
  }

  // 4. Query existing appointments that block slots
  const dayStartDate = startOfDay(dateObj);
  const dayEndDate = endOfDay(dateObj);
  const now = new Date();

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorProfileId,
      slotStart: {
        gte: dayStartDate,
        lte: dayEndDate,
      },
      OR: [
        { status: 'CONFIRMED' },
        {
          status: 'PENDING',
          holdExpiresAt: {
            gt: now,
          },
        },
      ],
    },
    select: {
      slotStart: true,
      slotEnd: true,
    },
  });

  // 5. Filter out booked slots
  const bookedStartTimes = new Set(
    existingAppointments.map((apt) => apt.slotStart.getTime())
  );

  const availableSlots = allSlots.filter(
    (slot) => !bookedStartTimes.has(slot.start.getTime())
  );

  return availableSlots;
}
