import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  sendEmail,
  bookingConfirmationEmail,
  appointmentReminderEmail,
  medicationReminderEmail,
} from '@/lib/email';

// POST /api/cron - Run background jobs
// Secured by CRON_SECRET header
export async function POST(request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {};

    // Job 1: Expire stale holds
    results.expiredHolds = await expireStaleHolds();

    // Job 2: Send appointment reminders (24h before)
    results.reminders = await sendAppointmentReminders();

    // Job 3: Send medication reminders
    results.medicationReminders = await sendMedicationReminders();

    // Job 4: Retry failed emails
    results.retriedEmails = await retryFailedEmails();

    // Job 5: Retry failed LLM summaries
    results.retriedSummaries = await retryFailedSummaries();

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

// Also support GET for Vercel Cron
export async function GET(request) {
  return POST(request);
}

// ─── Job 1: Expire Stale Holds ───────────────────────────────

async function expireStaleHolds() {
  const result = await prisma.appointment.deleteMany({
    where: {
      status: 'PENDING',
      holdExpiresAt: { lt: new Date() },
    },
  });
  return { expired: result.count };
}

// ─── Job 2: Send Appointment Reminders ───────────────────────

async function sendAppointmentReminders() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  // Find appointments 23-24 hours from now that haven't had a reminder sent
  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      slotStart: {
        gte: in23Hours,
        lte: in24Hours,
      },
    },
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctorProfile: {
        include: { user: { select: { name: true } } },
      },
    },
  });

  let sent = 0;
  for (const appt of upcomingAppointments) {
    // Check if reminder already sent
    const existingReminder = await prisma.emailLog.findFirst({
      where: {
        userId: appt.patientId,
        type: 'REMINDER',
        createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) }, // within last hour
      },
    });

    if (!existingReminder) {
      const dateTime = new Date(appt.slotStart).toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
      const template = appointmentReminderEmail(
        appt.patient.name,
        appt.doctorProfile.user.name,
        dateTime
      );

      await prisma.emailLog.create({
        data: {
          userId: appt.patientId,
          toEmail: appt.patient.email,
          subject: template.subject,
          body: template.html,
          type: 'REMINDER',
          status: 'PENDING',
        },
      });

      const result = await sendEmail(appt.patient.email, template.subject, template.html);
      await prisma.emailLog.updateMany({
        where: { userId: appt.patientId, type: 'REMINDER', status: 'PENDING' },
        data: { status: result.success ? 'SENT' : 'FAILED', sentAt: result.success ? new Date() : null },
      });

      sent++;
    }
  }

  return { sent };
}

// ─── Job 3: Medication Reminders ─────────────────────────────

async function sendMedicationReminders() {
  const now = new Date();

  const dueReminders = await prisma.medicationReminder.findMany({
    where: {
      isActive: true,
      nextReminderAt: { lte: now },
    },
    include: {
      patient: { select: { id: true, name: true, email: true } },
    },
    take: 50,
  });

  let sent = 0;
  for (const reminder of dueReminders) {
    // Check if end date passed
    if (new Date(reminder.endDate) < now) {
      await prisma.medicationReminder.update({
        where: { id: reminder.id },
        data: { isActive: false },
      });
      continue;
    }

    const template = medicationReminderEmail(
      reminder.patient.name,
      reminder.medicationName,
      reminder.dosage
    );

    const result = await sendEmail(reminder.patient.email, template.subject, template.html);

    // Calculate next reminder time
    const freq = (reminder.frequency || 'daily').toLowerCase();
    let nextMs = 24 * 60 * 60 * 1000; // default: daily
    if (freq.includes('twice') || freq.includes('2x')) nextMs = 12 * 60 * 60 * 1000;
    if (freq.includes('thrice') || freq.includes('3x')) nextMs = 8 * 60 * 60 * 1000;

    await prisma.medicationReminder.update({
      where: { id: reminder.id },
      data: { nextReminderAt: new Date(now.getTime() + nextMs) },
    });

    if (result.success) sent++;
  }

  return { sent, total: dueReminders.length };
}

// ─── Job 4: Retry Failed Emails ─────────────────────────────

async function retryFailedEmails() {
  const failedEmails = await prisma.emailLog.findMany({
    where: {
      status: 'FAILED',
      retryCount: { lt: 3 },
    },
    take: 20,
  });

  let retried = 0;
  for (const email of failedEmails) {
    const result = await sendEmail(email.toEmail, email.subject, email.body);

    await prisma.emailLog.update({
      where: { id: email.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        retryCount: email.retryCount + 1,
        errorMessage: result.error || null,
      },
    });

    if (result.success) retried++;
  }

  return { retried, total: failedEmails.length };
}

// ─── Job 5: Retry Failed LLM Summaries ──────────────────────

async function retryFailedSummaries() {
  let retried = 0;

  // Retry pre-visit summaries
  const failedPreVisit = await prisma.preVisitSummary.findMany({
    where: {
      generatedAt: null,
      retryCount: { lt: 3 },
    },
    include: {
      appointment: {
        include: { symptomForm: true },
      },
    },
    take: 10,
  });

  for (const summary of failedPreVisit) {
    if (!summary.appointment?.symptomForm?.symptoms) continue;

    try {
      const { generatePreVisitSummary } = await import('@/lib/llm');
      const result = await generatePreVisitSummary(summary.appointment.symptomForm.symptoms);

      if (result) {
        await prisma.preVisitSummary.update({
          where: { id: summary.id },
          data: {
            urgencyLevel: result.urgencyLevel || null,
            chiefComplaint: result.chiefComplaint || null,
            suggestedQuestions: JSON.stringify(result.suggestedQuestions || []),
            rawLlmResponse: JSON.stringify(result),
            generatedAt: new Date(),
            retryCount: summary.retryCount + 1,
          },
        });
        retried++;
      } else {
        await prisma.preVisitSummary.update({
          where: { id: summary.id },
          data: { retryCount: summary.retryCount + 1 },
        });
      }
    } catch (err) {
      await prisma.preVisitSummary.update({
        where: { id: summary.id },
        data: { retryCount: summary.retryCount + 1 },
      });
    }
  }

  // Retry post-visit summaries
  const failedPostVisit = await prisma.postVisitSummary.findMany({
    where: {
      generatedAt: null,
      retryCount: { lt: 3 },
    },
    include: {
      appointment: {
        include: { postVisitNote: true },
      },
    },
    take: 10,
  });

  for (const summary of failedPostVisit) {
    if (!summary.appointment?.postVisitNote) continue;

    try {
      const { generatePostVisitSummary } = await import('@/lib/llm');
      const result = await generatePostVisitSummary(
        summary.appointment.postVisitNote.clinicalNotes,
        summary.appointment.postVisitNote.prescription
      );

      if (result) {
        await prisma.postVisitSummary.update({
          where: { id: summary.id },
          data: {
            patientFriendlySummary: result.patientFriendlySummary || null,
            medicationSchedule: JSON.stringify(result.medicationSchedule || []),
            followUpSteps: JSON.stringify(result.followUpSteps || []),
            rawLlmResponse: JSON.stringify(result),
            generatedAt: new Date(),
            retryCount: summary.retryCount + 1,
          },
        });
        retried++;
      } else {
        await prisma.postVisitSummary.update({
          where: { id: summary.id },
          data: { retryCount: summary.retryCount + 1 },
        });
      }
    } catch (err) {
      await prisma.postVisitSummary.update({
        where: { id: summary.id },
        data: { retryCount: summary.retryCount + 1 },
      });
    }
  }

  return { retried };
}
