# Healthcare Appointment & Follow-up Manager

A comprehensive healthcare platform with separate portals for patients, doctors, and administrators. This system enables advanced scheduling, AI-powered symptom analysis, patient-friendly post-visit summaries, medication reminders, and real-time Google Calendar synchronization.

## Features

- **Role-Based Portals:** Secure dashboards for Patients, Doctors, and Admins.
- **AI Pre-Visit Summaries:** Generates doctor-focused summaries with urgency levels based on patient symptom forms.
- **AI Post-Visit Summaries:** Translates clinical notes into patient-friendly plain text with structured medication schedules.
- **Automated Notifications:** Sends booking confirmations, reminders, cancellations, and medication reminders via Email (Resend).
- **Google Calendar Sync:** Automatically creates and syncs appointments to both patient and doctor Google Calendars via OAuth 2.0.
- **Conflict Prevention:** Uses a robust slot hold mechanism and double-booking prevention.
- **Leave Management:** When a doctor is marked on leave, the system automatically cancels existing bookings on that date and notifies patients.

## Setup Guide

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Google Cloud Platform Account (for Calendar API)
- Resend Account (for Email)
- Google Gemini API Key

### Installation

1. **Clone and Install**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Rename `.env.example` to `.env.local` and populate the required keys:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/healthcare"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   GEMINI_API_KEY="your-gemini-key"
   SMTP_HOST="smtp.resend.com"
   SMTP_PORT=465
   SMTP_USER="resend"
   SMTP_PASS="your-resend-api-key"
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   CRON_SECRET="optional-cron-secret-for-background-jobs"
   ```

3. **Database Setup**
   Push the schema to your database and seed it:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

4. **Run the Application**
   ```bash
   npm run dev
   ```

### Google Calendar Setup
1. Create a project in Google Cloud Console.
2. Enable the **Google Calendar API**.
3. Create an **OAuth Client ID** for a "Web application".
4. Add `http://localhost:3000/api/auth/callback/google` to the Authorized redirect URIs.
5. Copy the Client ID and Secret to your `.env.local`.

## API Documentation

- `GET /api/appointments`: Fetch appointments (supports `status`, `stats`, `limit`).
- `POST /api/appointments`: Create an appointment (requires hold token).
- `PATCH /api/appointments/[id]`: Cancel or update an appointment.
- `POST /api/appointments/[id]/symptoms`: Submit pre-visit symptoms (Triggers Gemini AI).
- `POST /api/appointments/[id]/post-notes`: Submit clinical notes (Triggers Gemini AI).
- `POST /api/cron`: Trigger background jobs (Reminders, retry failed emails/LLM generations).
- `POST /api/doctors/[id]/leave`: Add a leave day and cancel conflicting appointments.

## Database Schema Highlights

- **User**: Base model containing credentials, roles (`PATIENT`, `DOCTOR`, `ADMIN`), and OAuth links.
- **DoctorProfile**: Links to a User, defines specialization, fee, and slot duration.
- **Appointment**: Links Patient and Doctor. Tracks status (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`), slots, and hold tokens.
- **SymptomForm / PreVisitSummary / PostVisitNote / PostVisitSummary**: 1-to-1 relations mapping the visit lifecycle and AI-generated content.
- **MedicationReminder**: Tracks specific prescriptions and calculates next notification time.
- **EmailLog**: Stores outbound emails with retry counts.

## LLM Prompts

**Pre-visit Summary:**
> You are a medical AI assistant. Analyze these patient symptoms and return a JSON object with: urgencyLevel (Low, Medium, High), chiefComplaint (short string), and suggestedQuestions (array of 3 questions for the doctor to ask). Symptoms: <symptoms>

**Post-visit Summary:**
> You are a medical AI assistant. Convert these clinical notes into a patient-friendly summary. Return ONLY a valid JSON object with: patientFriendlySummary (plain language explanation), medicationSchedule (array of {name, dosage, frequency, duration}), followUpSteps (array of action items). Clinical Notes: <notes> Prescription: <prescription>
