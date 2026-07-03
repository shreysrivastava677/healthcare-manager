'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

const TABS = ['Today', 'Upcoming', 'Past'];

export default function DoctorAppointments() {
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Today');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  async function fetchAppointments() {
    try {
      const res = await fetch('/api/appointments');
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : data.appointments || []);
      }
    } catch (err) {
      toast.error('Error', 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const isFuture = (dateStr) => {
    return new Date(dateStr) > new Date();
  };

  const isPast = (dateStr) => {
    return new Date(dateStr) < new Date() && !isToday(dateStr);
  };

  const filteredAppointments = appointments.filter((appt) => {
    // Date filter
    if (dateFilter) {
      const apptDate = new Date(appt.slotStart).toISOString().split('T')[0];
      if (apptDate !== dateFilter) return false;
    }

    if (activeTab === 'Today') return isToday(appt.slotStart);
    if (activeTab === 'Upcoming') return isFuture(appt.slotStart) && !isToday(appt.slotStart);
    if (activeTab === 'Past') return isPast(appt.slotStart);
    return true;
  });

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const map = {
      CONFIRMED: 'badge-success',
      PENDING: 'badge-warning',
      CANCELLED: 'badge-danger',
      COMPLETED: 'badge-info',
    };
    return map[status] || 'badge-neutral';
  };

  const getUrgencyBadge = (level) => {
    const map = {
      HIGH: 'badge-danger',
      MEDIUM: 'badge-warning',
      LOW: 'badge-success',
    };
    return map[level] || 'badge-neutral';
  };

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
        <h1 className="page-title">Appointments</h1>
        <p className="page-subtitle">View and manage your patient appointments.</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => { setActiveTab(tab); setDateFilter(''); }}
              id={`tab-${tab.toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <input
          type="date"
          className="form-input"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{ maxWidth: '180px' }}
          id="date-filter"
        />
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="empty-state card-static">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No appointments found</div>
          <div className="empty-state-text">
            No {activeTab.toLowerCase()} appointments{dateFilter ? ` on ${dateFilter}` : ''}.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          {filteredAppointments.map((appt, idx) => (
            <Link
              key={appt.id}
              href={`/doctor/appointments/${appt.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className={`card animate-fade-in stagger-${(idx % 6) + 1}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div className="avatar">
                      {(appt.patient?.name || 'P').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {appt.patient?.name || 'Unknown Patient'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                          {formatDate(appt.slotStart)} · {formatTime(appt.slotStart)} – {formatTime(appt.slotEnd)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    {appt.preVisitSummary?.urgencyLevel && (
                      <span className={`badge ${getUrgencyBadge(appt.preVisitSummary.urgencyLevel)}`}>
                        {appt.preVisitSummary.urgencyLevel}
                      </span>
                    )}
                    <span className={`badge ${getStatusBadge(appt.status)}`}>{appt.status}</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)' }}>Review →</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
