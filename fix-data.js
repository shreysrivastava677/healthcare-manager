const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generatePreVisitSummary, generatePostVisitSummary } = require('./src/lib/llm.js');

async function fix() {
  console.log('Fixing PENDING appointments...');
  await prisma.appointment.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'CONFIRMED' }
  });
  console.log('Appointments confirmed.');

  console.log('Generating missing pre-visit summaries...');
  const missingPre = await prisma.preVisitSummary.findMany({
    where: { generatedAt: null },
    include: { appointment: { include: { symptomForm: true } } }
  });

  for (const sum of missingPre) {
    if (sum.appointment?.symptomForm?.symptoms) {
      console.log('Generating for appointment:', sum.appointment.id);
      const res = await generatePreVisitSummary(sum.appointment.symptomForm.symptoms);
      if (res) {
        await prisma.preVisitSummary.update({
          where: { id: sum.id },
          data: {
            urgencyLevel: res.urgencyLevel,
            chiefComplaint: res.chiefComplaint,
            suggestedQuestions: JSON.stringify(res.suggestedQuestions),
            rawLlmResponse: JSON.stringify(res),
            generatedAt: new Date()
          }
        });
        console.log('Successfully generated pre-visit summary.');
      }
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

fix();
