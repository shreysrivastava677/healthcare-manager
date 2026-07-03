'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

const WEEKDAYS = [
  { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' }, { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export default function EditDoctorPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ specialisation: '', slotDurationMinutes: 30, isActive: true });
  const [workingHours, setWorkingHours] = useState({});
  const [doctorName, setDoctorName] = useState('');

  useEffect(() => {
    fetchDoctor();
  }, [id]);

  async function fetchDoctor() {
    try {
      const res = await fetch(`/api/doctors/${id}`);
      if (res.ok) {
        const data = await res.json();
        const doc = data.doctor;
        setDoctorName(doc.user?.name || '');
        setForm({
          specialisation: doc.specialisation || '',
          slotDurationMinutes: doc.slotDurationMinutes || 30,
          isActive: doc.isActive,
        });

        // Parse working hours
        let hours = {};
        try {
          hours = typeof doc.workingHours === 'string' ? JSON.parse(doc.workingHours) : doc.workingHours;
        } catch { hours = {}; }

        const parsed = {};
        WEEKDAYS.forEach(d => {
          if (hours[d.key]) {
            parsed[d.key] = { enabled: true, start: hours[d.key].start || '09:00', end: hours[d.key].end || '17:00' };
          } else {
            parsed[d.key] = { enabled: false, start: '09:00', end: '17:00' };
          }
        });
        setWorkingHours(parsed);
      } else {
        toast.error('Error', 'Doctor not found');
        router.push('/admin/doctors');
      }
    } catch (err) {
      toast.error('Error', 'Failed to load doctor');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const hours = {};
      Object.entries(workingHours).forEach(([day, config]) => {
        hours[day] = config.enabled ? { start: config.start, end: config.end } : null;
      });

      const res = await fetch(`/api/doctors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialisation: form.specialisation,
          slotDurationMinutes: parseInt(form.slotDurationMinutes),
          workingHours: hours,
          isActive: form.isActive,
        }),
      });

      if (res.ok) {
        toast.success('Success', 'Doctor profile updated');
        router.push('/admin/doctors');
      } else {
        const data = await res.json();
        toast.error('Error', data.error || 'Failed to update');
      }
    } catch (err) {
      toast.error('Error', 'Failed to update doctor');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/doctors')} style={{ marginBottom: 'var(--space-md)' }}>← Back to Doctors</button>
        <h1 className="page-title">Edit Doctor: {doctorName}</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '700px' }}>
        <div className="card-static" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Professional Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Specialisation</label>
              <input className="form-input" type="text" value={form.specialisation} onChange={e => setForm(prev => ({ ...prev, specialisation: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Slot Duration (min)</label>
              <input className="form-input" type="number" min={10} max={120} value={form.slotDurationMinutes} onChange={e => setForm(prev => ({ ...prev, slotDurationMinutes: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))} style={{ accentColor: 'var(--accent-primary)' }} />
              <span className="form-label" style={{ margin: 0 }}>Active</span>
            </label>
          </div>
        </div>

        <div className="card-static" style={{ marginBottom: 'var(--space-xl)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Working Hours</h3>
          {WEEKDAYS.map(day => (
            <div key={day.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-primary)', flexWrap: 'wrap' }}>
              <label style={{ width: '120px', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={workingHours[day.key]?.enabled || false} onChange={e => setWorkingHours(prev => ({ ...prev, [day.key]: { ...prev[day.key], enabled: e.target.checked } }))} style={{ accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{day.label}</span>
              </label>
              {workingHours[day.key]?.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <input type="time" className="form-input" value={workingHours[day.key]?.start || '09:00'} onChange={e => setWorkingHours(prev => ({ ...prev, [day.key]: { ...prev[day.key], start: e.target.value } }))} style={{ width: '130px' }} />
                  <span style={{ color: 'var(--text-muted)' }}>to</span>
                  <input type="time" className="form-input" value={workingHours[day.key]?.end || '17:00'} onChange={e => setWorkingHours(prev => ({ ...prev, [day.key]: { ...prev[day.key], end: e.target.value } }))} style={{ width: '130px' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? <><Spinner size="sm" /> Saving...</> : 'Save Changes'}
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => router.push('/admin/doctors')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
