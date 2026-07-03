'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

const WEEKDAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const DEFAULT_HOURS = {
  mon: { enabled: true, start: '09:00', end: '17:00' },
  tue: { enabled: true, start: '09:00', end: '17:00' },
  wed: { enabled: true, start: '09:00', end: '17:00' },
  thu: { enabled: true, start: '09:00', end: '17:00' },
  fri: { enabled: true, start: '09:00', end: '15:00' },
  sat: { enabled: false, start: '10:00', end: '13:00' },
  sun: { enabled: false, start: '10:00', end: '13:00' },
};

export default function NewDoctorPage() {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    specialisation: '', slotDurationMinutes: 30,
  });
  const [workingHours, setWorkingHours] = useState(DEFAULT_HOURS);
  const [errors, setErrors] = useState({});

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  }

  function updateWorkingHours(day, field, value) {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.password || form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (!form.specialisation.trim()) errs.specialisation = 'Specialisation is required';
    if (form.slotDurationMinutes < 10 || form.slotDurationMinutes > 120) errs.slotDurationMinutes = 'Must be 10-120 minutes';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Convert working hours to API format
      const hours = {};
      Object.entries(workingHours).forEach(([day, config]) => {
        hours[day] = config.enabled ? { start: config.start, end: config.end } : null;
      });

      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          slotDurationMinutes: parseInt(form.slotDurationMinutes),
          workingHours: hours,
        }),
      });

      if (res.ok) {
        toast.success('Success', 'Doctor created successfully');
        router.push('/admin/doctors');
      } else {
        const data = await res.json();
        toast.error('Error', data.error || 'Failed to create doctor');
      }
    } catch (err) {
      toast.error('Error', 'Failed to create doctor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/doctors')} style={{ marginBottom: 'var(--space-md)' }}>
          ← Back to Doctors
        </button>
        <h1 className="page-title">Add New Doctor</h1>
        <p className="page-subtitle">Create a new doctor account with their schedule.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '700px' }}>
        {/* Personal Info */}
        <div className="card-static" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Personal Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name *</label>
              <input id="name" className="form-input" type="text" value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Dr. Jane Smith" />
              {errors.name && <div className="form-error">{errors.name}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email *</label>
              <input id="email" className="form-input" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="doctor@clinic.com" />
              {errors.email && <div className="form-error">{errors.email}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password *</label>
              <input id="password" className="form-input" type="password" value={form.password} onChange={e => updateForm('password', e.target.value)} placeholder="Minimum 6 characters" />
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone</label>
              <input id="phone" className="form-input" type="tel" value={form.phone} onChange={e => updateForm('phone', e.target.value)} placeholder="+1234567890" />
            </div>
          </div>
        </div>

        {/* Professional Info */}
        <div className="card-static" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Professional Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="specialisation">Specialisation *</label>
              <input id="specialisation" className="form-input" type="text" value={form.specialisation} onChange={e => updateForm('specialisation', e.target.value)} placeholder="e.g., Cardiology, General Medicine" />
              {errors.specialisation && <div className="form-error">{errors.specialisation}</div>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="slotDuration">Slot Duration (minutes) *</label>
              <input id="slotDuration" className="form-input" type="number" min={10} max={120} value={form.slotDurationMinutes} onChange={e => updateForm('slotDurationMinutes', e.target.value)} />
              {errors.slotDurationMinutes && <div className="form-error">{errors.slotDurationMinutes}</div>}
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="card-static" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Working Hours</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {WEEKDAYS.map(day => (
              <div key={day.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-primary)' }}>
                <label style={{ width: '120px', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={workingHours[day.key].enabled}
                    onChange={e => updateWorkingHours(day.key, 'enabled', e.target.checked)}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)', color: workingHours[day.key].enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {day.label}
                  </span>
                </label>
                {workingHours[day.key].enabled && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <input
                      type="time"
                      className="form-input"
                      value={workingHours[day.key].start}
                      onChange={e => updateWorkingHours(day.key, 'start', e.target.value)}
                      style={{ width: '130px' }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>to</span>
                    <input
                      type="time"
                      className="form-input"
                      value={workingHours[day.key].end}
                      onChange={e => updateWorkingHours(day.key, 'end', e.target.value)}
                      style={{ width: '130px' }}
                    />
                  </div>
                )}
                {!workingHours[day.key].enabled && (
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Day off</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} id="create-doctor-btn">
            {submitting ? <><Spinner size="sm" /> Creating...</> : 'Create Doctor'}
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => router.push('/admin/doctors')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
