'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DoctorLeavePage() {
  const { data: session } = useSession();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [doctorProfileId, setDoctorProfileId] = useState(null);
  const [leaveDays, setLeaveDays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  async function fetchDoctorProfile() {
    try {
      const res = await fetch('/api/doctors?me=true');
      if (res.ok) {
        const data = await res.json();
        const profile = data.doctors?.[0] || data.doctor;
        if (profile) {
          setDoctorProfileId(profile.id || profile.doctorProfile?.id);
          await fetchLeaveDays(profile.id || profile.doctorProfile?.id);
        }
      }
    } catch (err) {
      toast.error('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeaveDays(profileId) {
    try {
      const res = await fetch(`/api/doctors/${profileId}/leave`);
      if (res.ok) {
        const data = await res.json();
        setLeaveDays(data.leaveDays || []);
      }
    } catch (err) {
      console.error('Failed to fetch leave days:', err);
    }
  }

  const isLeaveDay = useCallback((date) => {
    const dateStr = date.toISOString().split('T')[0];
    return leaveDays.some(l => {
      const ld = new Date(l.leaveDate).toISOString().split('T')[0];
      return ld === dateStr;
    });
  }, [leaveDays]);

  async function toggleLeave(date) {
    if (!doctorProfileId || processing) return;
    const dateStr = date.toISOString().split('T')[0];

    setProcessing(true);
    try {
      if (isLeaveDay(date)) {
        // Remove leave
        const res = await fetch(`/api/doctors/${doctorProfileId}/leave?date=${dateStr}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          toast.success('Leave Removed', `Leave on ${dateStr} has been removed.`);
          await fetchLeaveDays(doctorProfileId);
        } else {
          const data = await res.json();
          toast.error('Error', data.error || 'Failed to remove leave');
        }
      } else {
        // Add leave
        const res = await fetch(`/api/doctors/${doctorProfileId}/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leaveDate: dateStr }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.cancelledAppointments > 0) {
            toast.warning('Leave Added', `Leave on ${dateStr} added. ${data.cancelledAppointments} appointment(s) were cancelled and patients notified.`);
          } else {
            toast.success('Leave Added', `Leave on ${dateStr} has been added.`);
          }
          await fetchLeaveDays(doctorProfileId);
        } else {
          const data = await res.json();
          toast.error('Error', data.error || 'Failed to add leave');
        }
      }
    } catch (err) {
      toast.error('Error', 'Failed to update leave');
    } finally {
      setProcessing(false);
    }
  }

  // Calendar generation
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const calendarDays = [];
  // Previous month padding
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -startDow + i + 1);
    calendarDays.push({ date: d, otherMonth: true });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ date: new Date(year, month, i), otherMonth: false });
  }
  // Next month padding
  const remaining = 7 - (calendarDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({ date: new Date(year, month + 1, i), otherMonth: true });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthName = currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

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
        <h1 className="page-title">Leave Management</h1>
        <p className="page-subtitle">Click on a date to mark or remove leave days. Existing appointments on leave days will be automatically cancelled.</p>
      </div>

      <div style={{ maxWidth: '600px' }}>
        <div className="calendar">
          <div className="calendar-header">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
            >
              ← Prev
            </button>
            <span className="calendar-title">{monthName}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            >
              Next →
            </button>
          </div>

          <div className="calendar-grid">
            {DAY_LABELS.map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}

            {calendarDays.map((item, idx) => {
              const d = item.date;
              const isOtherMonth = item.otherMonth;
              const isToday = d.getTime() === today.getTime();
              const isPast = d < today;
              const isLeave = !isOtherMonth && isLeaveDay(d);

              let className = 'calendar-day';
              if (isOtherMonth) className += ' other-month';
              if (isToday) className += ' today';
              if (isLeave) className += ' leave';
              if (isPast && !isToday) className += ' disabled';

              return (
                <div
                  key={idx}
                  className={className}
                  onClick={() => {
                    if (!isOtherMonth && !isPast) toggleLeave(d);
                  }}
                  style={{ cursor: isOtherMonth || isPast ? 'default' : 'pointer' }}
                  title={isLeave ? 'Leave day - click to remove' : 'Click to mark leave'}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave days list */}
        <div style={{ marginTop: 'var(--space-xl)' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
            Upcoming Leave Days ({leaveDays.filter(l => new Date(l.leaveDate) >= today).length})
          </h3>
          {leaveDays.filter(l => new Date(l.leaveDate) >= today).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No upcoming leave days.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {leaveDays
                .filter(l => new Date(l.leaveDate) >= today)
                .sort((a, b) => new Date(a.leaveDate) - new Date(b.leaveDate))
                .map(l => (
                  <div key={l.id} className="card-static" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-md)' }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>
                        {new Date(l.leaveDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                      {l.reason && <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-sm)' }}>— {l.reason}</span>}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => toggleLeave(new Date(l.leaveDate))}
                      disabled={processing}
                    >
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
