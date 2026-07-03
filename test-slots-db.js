const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { parse, getDay, addMinutes, format, isBefore, isEqual, startOfDay, endOfDay } = require('date-fns');

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function generateSlots(doctorProfile, dateString) {
  const date = parse(dateString, 'yyyy-MM-dd', new Date());
  const dayOfWeek = DAY_NAMES[getDay(date)];
  let workingHours = typeof doctorProfile.workingHours === 'string'
        ? JSON.parse(doctorProfile.workingHours)
        : doctorProfile.workingHours;
  const daySchedule = workingHours[dayOfWeek];
  if (!daySchedule || !daySchedule.start || !daySchedule.end) return [];
  const slotDuration = doctorProfile.slotDurationMinutes || 30;
  const dayStart = parse(`${dateString} ${daySchedule.start}`, 'yyyy-MM-dd HH:mm', new Date());
  const dayEnd = parse(`${dateString} ${daySchedule.end}`, 'yyyy-MM-dd HH:mm', new Date());
  const slots = [];
  let current = dayStart;
  while (isBefore(current, dayEnd) || isEqual(current, dayEnd)) {
    const slotEnd = addMinutes(current, slotDuration);
    if (isBefore(slotEnd, dayEnd) || isEqual(slotEnd, dayEnd)) {
      slots.push({ start: current, end: slotEnd });
    }
    current = slotEnd;
  }
  return slots;
}

async function getAvailableSlots(doctorProfileId, dateString) {
  const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } });
  if (!doctorProfile || !doctorProfile.isActive) return { error: 'No profile' };
  
  const dateObj = parse(dateString, 'yyyy-MM-dd', new Date());
  const leaveDay = await prisma.doctorLeave.findFirst({
    where: { doctorProfileId, leaveDate: dateObj },
  });
  if (leaveDay) return { error: 'On leave' };
  
  const allSlots = generateSlots(doctorProfile, dateString);
  if (allSlots.length === 0) return { error: 'No slots generated' };
  
  const dayStartDate = startOfDay(dateObj);
  const dayEndDate = endOfDay(dateObj);
  
  console.log('dayStart:', dayStartDate);
  console.log('dayEnd:', dayEndDate);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorProfileId,
      slotStart: { gte: dayStartDate, lte: dayEndDate },
      OR: [
        { status: 'CONFIRMED' },
        { status: 'PENDING', holdExpiresAt: { gt: new Date() } },
      ],
    },
    select: { slotStart: true },
  });
  
  const bookedStartTimes = new Set(existingAppointments.map((apt) => apt.slotStart.getTime()));
  const availableSlots = allSlots.filter((slot) => !bookedStartTimes.has(slot.start.getTime()));
  return availableSlots;
}

async function test() {
  const docs = await prisma.doctorProfile.findMany({ include: { user: true } });
  const patel = docs.find(d => d.user.name.includes('Patel'));
  console.log('Doctor:', patel.user.name, 'Profile ID:', patel.id);
  const slots = await getAvailableSlots(patel.id, '2026-07-06');
  console.log('Available slots length:', slots.length);
  if (slots.error) console.log('Error:', slots.error);
  await prisma.$disconnect();
}
test();
