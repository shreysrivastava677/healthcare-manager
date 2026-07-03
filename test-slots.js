const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAvailableSlots } = require('./src/lib/slots.js');

async function test() {
  const docs = await prisma.doctorProfile.findMany({ include: { user: true } });
  const patel = docs.find(d => d.user.name.includes('Patel'));
  if (!patel) {
    console.log('Patel not found');
    return;
  }
  console.log('Doctor:', patel.user.name, 'Profile ID:', patel.id);
  const slots = await getAvailableSlots(patel.id, '2026-07-06');
  console.log('Slots:', slots);
  await prisma.$disconnect();
}

test();
