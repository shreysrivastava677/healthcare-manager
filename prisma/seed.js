const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@healthcare.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'System Admin';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`✅ Admin user already exists: ${adminEmail}`);
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const admin = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`✅ Admin user created: ${admin.email}`);
  }

  // Create sample doctor
  const doctorEmail = 'dr.smith@healthcare.com';
  const existingDoctor = await prisma.user.findUnique({
    where: { email: doctorEmail },
  });

  if (existingDoctor) {
    console.log(`✅ Sample doctor already exists: ${doctorEmail}`);
  } else {
    const hashedPassword = await bcrypt.hash('doctor123', 10);
    const doctor = await prisma.user.create({
      data: {
        name: 'Dr. Sarah Smith',
        email: doctorEmail,
        passwordHash: hashedPassword,
        role: 'DOCTOR',
        phone: '+1234567890',
        doctorProfile: {
          create: {
            specialisation: 'General Medicine',
            slotDurationMinutes: 30,
            workingHours: JSON.stringify({
              mon: { start: '09:00', end: '17:00' },
              tue: { start: '09:00', end: '17:00' },
              wed: { start: '09:00', end: '17:00' },
              thu: { start: '09:00', end: '17:00' },
              fri: { start: '09:00', end: '15:00' },
              sat: null,
              sun: null,
            }),
            isActive: true,
          },
        },
      },
    });
    console.log(`✅ Sample doctor created: ${doctor.email}`);
  }

  // Create another sample doctor
  const doctor2Email = 'dr.patel@healthcare.com';
  const existingDoctor2 = await prisma.user.findUnique({
    where: { email: doctor2Email },
  });

  if (existingDoctor2) {
    console.log(`✅ Sample doctor already exists: ${doctor2Email}`);
  } else {
    const hashedPassword = await bcrypt.hash('doctor123', 10);
    const doctor2 = await prisma.user.create({
      data: {
        name: 'Dr. Raj Patel',
        email: doctor2Email,
        passwordHash: hashedPassword,
        role: 'DOCTOR',
        phone: '+1234567891',
        doctorProfile: {
          create: {
            specialisation: 'Cardiology',
            slotDurationMinutes: 45,
            workingHours: JSON.stringify({
              mon: { start: '10:00', end: '18:00' },
              tue: { start: '10:00', end: '18:00' },
              wed: { start: '10:00', end: '18:00' },
              thu: { start: '10:00', end: '18:00' },
              fri: { start: '10:00', end: '16:00' },
              sat: { start: '10:00', end: '13:00' },
              sun: null,
            }),
            isActive: true,
          },
        },
      },
    });
    console.log(`✅ Sample doctor created: ${doctor2.email}`);
  }

  // Create sample patient
  const patientEmail = 'patient@example.com';
  const existingPatient = await prisma.user.findUnique({
    where: { email: patientEmail },
  });

  if (existingPatient) {
    console.log(`✅ Sample patient already exists: ${patientEmail}`);
  } else {
    const hashedPassword = await bcrypt.hash('patient123', 10);
    const patient = await prisma.user.create({
      data: {
        name: 'John Doe',
        email: patientEmail,
        passwordHash: hashedPassword,
        role: 'PATIENT',
        phone: '+1987654321',
      },
    });
    console.log(`✅ Sample patient created: ${patient.email}`);
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Test credentials:');
  console.log(`   Admin:   ${adminEmail} / ${adminPassword}`);
  console.log(`   Doctor:  ${doctorEmail} / doctor123`);
  console.log(`   Doctor:  ${doctor2Email} / doctor123`);
  console.log(`   Patient: ${patientEmail} / patient123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
