const { parse, getDay, addMinutes, format, isBefore, isEqual } = require('date-fns');

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const dateString = '2026-07-06';
const date = parse(dateString, 'yyyy-MM-dd', new Date());
const dayOfWeek = DAY_NAMES[getDay(date)];

console.log('Date object:', date);
console.log('Day of week index:', getDay(date));
console.log('Day of week string:', dayOfWeek);

const workingHours = {
  mon: { start: '10:00', end: '18:00' },
  tue: { start: '10:00', end: '18:00' },
  wed: { start: '10:00', end: '18:00' },
  thu: { start: '10:00', end: '18:00' },
  fri: { start: '10:00', end: '16:00' },
  sat: { start: '10:00', end: '13:00' },
  sun: null
};

const daySchedule = workingHours[dayOfWeek];
console.log('Day schedule:', daySchedule);

if (!daySchedule) {
    console.log('No slots (daySchedule is null)');
    process.exit(0);
}

const slotDuration = 45;

const dayStart = parse(`${dateString} ${daySchedule.start}`, 'yyyy-MM-dd HH:mm', new Date());
const dayEnd = parse(`${dateString} ${daySchedule.end}`, 'yyyy-MM-dd HH:mm', new Date());

console.log('Day Start:', dayStart);
console.log('Day End:', dayEnd);

const slots = [];
let current = dayStart;

while (isBefore(current, dayEnd) || isEqual(current, dayEnd)) {
  const slotEnd = addMinutes(current, slotDuration);
  if (isBefore(slotEnd, dayEnd) || isEqual(slotEnd, dayEnd)) {
    slots.push({
      start: format(current, 'HH:mm'),
      end: format(slotEnd, 'HH:mm'),
    });
  }
  current = slotEnd;
}

console.log('Generated slots:', slots);
