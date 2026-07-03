import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const doctorProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  specialisation: z.string().min(1, 'Specialisation is required'),
  slotDurationMinutes: z
    .number()
    .min(10, 'Slot duration must be at least 10 minutes')
    .max(120, 'Slot duration cannot exceed 120 minutes')
    .default(30),
  workingHours: z.object({}).passthrough(), // flexible JSON object for day-wise hours
  phone: z.string().optional(),
});

export const appointmentSchema = z.object({
  doctorProfileId: z.string().min(1, 'Doctor profile ID is required'),
  slotStart: z.string().datetime({ message: 'Invalid datetime string for slot start' }),
});

export const symptomFormSchema = z.object({
  symptoms: z.string().min(10, 'Symptoms must be at least 10 characters'),
  additionalNotes: z.string().optional(),
});

export const postVisitNoteSchema = z.object({
  clinicalNotes: z.string().min(10, 'Clinical notes must be at least 10 characters'),
  prescription: z.string().min(5, 'Prescription must be at least 5 characters'),
});

export const leaveSchema = z.object({
  leaveDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Invalid date string' }
  ),
  reason: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED'], {
    errorMap: () => ({ message: 'Status must be CONFIRMED, CANCELLED, or COMPLETED' }),
  }),
});
