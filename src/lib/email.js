import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email via the SMTP transporter.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML body
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"HealthCare Manager" <noreply@healthcare.com>',
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Log the email to the database and attempt sending.
 * @param {object} params
 * @param {string} params.userId - The user ID (optional)
 * @param {string} params.toEmail - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.body - HTML body
 * @param {string} params.type - EmailType enum value
 * @returns {Promise<{success: boolean, emailLogId: string}>}
 */
export async function logAndSendEmail({ userId, toEmail, subject, body, type }) {
  // Create the email log entry
  const emailLog = await prisma.emailLog.create({
    data: {
      userId: userId || null,
      toEmail,
      subject,
      body,
      type,
      status: 'PENDING',
    },
  });

  // Attempt to send
  const result = await sendEmail(toEmail, subject, body);

  // Update the log with the result
  await prisma.emailLog.update({
    where: { id: emailLog.id },
    data: {
      status: result.success ? 'SENT' : 'FAILED',
      sentAt: result.success ? new Date() : null,
      errorMessage: result.error || null,
    },
  });

  return { success: result.success, emailLogId: emailLog.id };
}

// ─── Email Template Wrapper ────────────────────────────────────

function wrapInTemplate(title, contentHtml) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background-color:#f4f7fa;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <div style="background:#2563eb;padding:24px 32px;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">HealthCare Manager</h1>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#1e293b;margin:0 0 16px 0;font-size:18px;">${title}</h2>
          ${contentHtml}
        </div>
        <div style="background:#f8fafc;padding:16px 32px;text-align:center;color:#94a3b8;font-size:12px;">
          <p style="margin:0;">This is an automated message from HealthCare Manager.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ─── Template Functions ────────────────────────────────────────

/**
 * Booking confirmation email.
 */
export function bookingConfirmationEmail(patientName, doctorName, dateTime) {
  const html = wrapInTemplate(
    'Appointment Confirmed',
    `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        Hello <strong>${patientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        Your appointment has been successfully booked.
      </p>
      <div style="background:#f0f9ff;border-left:4px solid #2563eb;padding:16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0 0 8px 0;color:#1e40af;font-weight:600;">Appointment Details</p>
        <p style="margin:0;color:#475569;">Doctor: <strong>Dr. ${doctorName}</strong></p>
        <p style="margin:0;color:#475569;">Date & Time: <strong>${dateTime}</strong></p>
      </div>
      <p style="color:#475569;line-height:1.6;margin:16px 0 0 0;">
        Please arrive 10 minutes before your scheduled time. Don't forget to fill in your symptom form beforehand.
      </p>
    `
  );

  return {
    subject: `Appointment Confirmed with Dr. ${doctorName}`,
    html,
  };
}

/**
 * Appointment cancelled email.
 */
export function appointmentCancelledEmail(name, doctorName, dateTime, reason) {
  const reasonHtml = reason
    ? `<p style="margin:0;color:#475569;">Reason: <strong>${reason}</strong></p>`
    : '';

  const html = wrapInTemplate(
    'Appointment Cancelled',
    `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        Hello <strong>${name}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        We regret to inform you that your appointment has been cancelled.
      </p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0 0 8px 0;color:#991b1b;font-weight:600;">Cancelled Appointment</p>
        <p style="margin:0;color:#475569;">Doctor: <strong>Dr. ${doctorName}</strong></p>
        <p style="margin:0;color:#475569;">Date & Time: <strong>${dateTime}</strong></p>
        ${reasonHtml}
      </div>
      <p style="color:#475569;line-height:1.6;margin:16px 0 0 0;">
        Please visit our portal to reschedule your appointment at your convenience.
      </p>
    `
  );

  return {
    subject: `Appointment Cancelled with Dr. ${doctorName}`,
    html,
  };
}

/**
 * Appointment reminder email.
 */
export function appointmentReminderEmail(name, doctorName, dateTime) {
  const html = wrapInTemplate(
    'Appointment Reminder',
    `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        Hello <strong>${name}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        This is a friendly reminder about your upcoming appointment.
      </p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0 0 8px 0;color:#92400e;font-weight:600;">Upcoming Appointment</p>
        <p style="margin:0;color:#475569;">Doctor: <strong>Dr. ${doctorName}</strong></p>
        <p style="margin:0;color:#475569;">Date & Time: <strong>${dateTime}</strong></p>
      </div>
      <p style="color:#475569;line-height:1.6;margin:16px 0 0 0;">
        Please ensure you have completed your symptom form and arrive 10 minutes early.
      </p>
    `
  );

  return {
    subject: `Reminder: Appointment with Dr. ${doctorName}`,
    html,
  };
}

/**
 * Leave notification email (when a doctor takes leave and patient appointments are affected).
 */
export function leaveNotificationEmail(patientName, doctorName, date) {
  const html = wrapInTemplate(
    'Doctor Leave Notification',
    `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        Hello <strong>${patientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        We want to inform you that <strong>Dr. ${doctorName}</strong> will be on leave on <strong>${date}</strong>.
      </p>
      <div style="background:#fef3c7;border-left:4px solid #d97706;padding:16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0;color:#92400e;font-weight:600;">
          Your appointment on this date has been cancelled. Please reschedule at your convenience.
        </p>
      </div>
      <p style="color:#475569;line-height:1.6;margin:16px 0 0 0;">
        We apologize for the inconvenience. Please visit our portal to book a new appointment.
      </p>
    `
  );

  return {
    subject: `Appointment Cancelled – Dr. ${doctorName} on Leave (${date})`,
    html,
  };
}

/**
 * Medication reminder email.
 */
export function medicationReminderEmail(patientName, medicationName, dosage) {
  const html = wrapInTemplate(
    'Medication Reminder',
    `
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        Hello <strong>${patientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;margin:0 0 16px 0;">
        This is your medication reminder.
      </p>
      <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px;border-radius:4px;margin:16px 0;">
        <p style="margin:0 0 8px 0;color:#065f46;font-weight:600;">Medication Details</p>
        <p style="margin:0;color:#475569;">Medication: <strong>${medicationName}</strong></p>
        <p style="margin:0;color:#475569;">Dosage: <strong>${dosage}</strong></p>
      </div>
      <p style="color:#475569;line-height:1.6;margin:16px 0 0 0;">
        Please take your medication as prescribed. If you have any questions, contact your doctor.
      </p>
    `
  );

  return {
    subject: `Medication Reminder: ${medicationName}`,
    html,
  };
}
