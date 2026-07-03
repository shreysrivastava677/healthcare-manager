# System Design: Healthcare Appointment & Follow-up Manager

## Overview
This platform connects patients, doctors, and administrators through a unified portal, enhancing standard scheduling with AI-powered insights, robust leave management, and automated background synchronization. The architecture relies on Next.js (App Router), Prisma ORM, PostgreSQL, and Gemini AI.

## Conflict Prevention & Booking Mechanics
### Slot Hold Mechanism
To prevent double-booking in a highly concurrent environment, the system utilizes a two-step booking process with temporary database holds.
1. **Initiation:** When a patient selects a slot, the system generates a unique `holdToken` and inserts an appointment record with a `PENDING` status and a `holdExpiresAt` timestamp (usually 10 minutes in the future).
2. **Confirmation:** The patient completes the symptom form. The final confirmation request must include the original `holdToken`. If valid and unexpired, the status updates to `CONFIRMED`.
3. **Cleanup:** A background cron job periodically sweeps and deletes `PENDING` appointments whose `holdExpiresAt` time has passed, freeing up the slots.

### Doctor Leave Conflict Handling
When an administrator or doctor adds a leave day, the system checks for any existing confirmed appointments on that date.
1. The leave creation and appointment cancellations are executed inside a single **Prisma Database Transaction** to ensure atomicity (all succeed or none do).
2. The cancelled appointments receive a system-generated cancellation reason indicating the doctor is on leave.
3. Once the transaction commits, asynchronous email notifications are dispatched to all affected patients urging them to reschedule.

## Background Jobs & Notification Reliability
The system implements a centralized `/api/cron` endpoint (secured via a `CRON_SECRET`) designed to be triggered periodically by a cron scheduler (e.g., Vercel Cron or GitHub Actions). 

### Email Reliability
Instead of blocking HTTP requests and risking timeouts during email dispatch, the system utilizes an `EmailLog` table.
1. When an email needs to be sent, a `PENDING` record is created in the `EmailLog`.
2. The system attempts an immediate send. If it fails due to network issues or API rate limits, the record is marked as `FAILED`.
3. The cron job sweeps for `FAILED` emails with a retry count less than 3, attempting to resend them. This guarantees delivery even if the SMTP provider experiences temporary downtime.

### LLM Failure Handling
Interacting with third-party Large Language Models (LLMs) is inherently volatile due to quota limits and latency.
1. Pre-visit and Post-visit summary generations run asynchronously and do not block the primary HTTP responses for submitting symptoms or notes.
2. If the LLM call throws an error or returns malformed JSON, the failure is caught gracefully, and the database record is left without a `generatedAt` timestamp.
3. The cron job acts as a self-healing mechanism, sweeping the database for incomplete summaries and re-triggering the LLM generation up to three times.

### Medication Reminders
The AI parses clinical prescriptions and structures them into a database table (`MedicationReminder`). The cron job polls this table every hour. When `nextReminderAt` is reached, an email is logged/sent, and the next interval is calculated based on the parsed frequency (e.g., daily, twice a day) until the prescription duration expires.

## Conclusion
By isolating volatile third-party interactions (Email, LLM) behind asynchronous queues and employing strict database transactions for scheduling, the system remains highly responsive, reliable, and resistant to edge-case failures like race conditions or API timeouts.
