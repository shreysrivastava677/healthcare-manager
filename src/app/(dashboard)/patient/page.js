'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function PatientDashboard() {
  const { data: session } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, apptRes] = await Promise.all([
          fetch('/api/appointments?stats=true'),
          fetch('/api/appointments?status=PENDING,CONFIRMED&limit=3'),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData.stats);
        }

        if (apptRes.ok) {
          const apptData = await apptRes.json();
          setUpcoming(Array.isArray(apptData) ? apptData : apptData.appointments || []);
        }
      } catch (err) {
        toast.error('Error', 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const userName = session?.user?.name || 'Patient';

  return (
    <div className="page-container animate-fade-in">
      {/* Welcome Header */}
      <div className="page-header">
        <h1 className="page-title">Welcome back, {userName} 👋</h1>
        <p className="page-subtitle">Here&apos;s an overview of your appointments and health activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card animate-fade-in stagger-1" id="stat-total">
          <div className="stat-icon stat-icon-teal">📅</div>
          <div>
            <div className="stat-value">{stats?.total || 0}</div>
            <div className="stat-label">Total Appointments</div>
          </div>
        </div>

        <div className="stat-card animate-fade-in stagger-2" id="stat-upcoming">
          <div className="stat-icon stat-icon-blue">🕐</div>
          <div>
            <div className="stat-value">{stats?.upcoming || 0}</div>
            <div className="stat-label">Upcoming</div>
          </div>
        </div>

        <div className="stat-card animate-fade-in stagger-3" id="stat-completed">
          <div className="stat-icon stat-icon-green">✅</div>
          <div>
            <div className="stat-value">{stats?.completed || 0}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        <div className="stat-card animate-fade-in stagger-4" id="stat-cancelled">
          <div className="stat-icon stat-icon-red">❌</div>
          <div>
            <div className="stat-value">{stats?.cancelled || 0}</div>
            <div className="stat-label">Cancelled</div>
          </div>
        </div>
      </div>

      {/* Upcoming Appointments */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>Upcoming Appointments</h2>
          <Link href="/patient/book" className="btn btn-primary" id="btn-book-new">
            📅 Book New Appointment
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="empty-state card-static">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No upcoming appointments</div>
            <div className="empty-state-text">Book an appointment with a doctor to get started.</div>
            <Link href="/patient/book" className="btn btn-primary">
              Book Appointment
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            {upcoming.slice(0, 3).map((appt, idx) => (
              <div key={appt.id} className={`card animate-fade-in stagger-${idx + 1}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div className="avatar">
                      {(appt.doctorProfile?.user?.name || 'D').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>
                        Dr. {appt.doctorProfile?.user?.name || 'Unknown'}
                      </div>
                      <span className="badge badge-accent" style={{ marginRight: 'var(--space-sm)' }}>
                        {appt.doctorProfile?.specialisation || 'General'}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        {formatDate(appt.slotStart)} at {formatTime(appt.slotStart)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span className={`badge ${getStatusBadge(appt.status)}`}>{appt.status}</span>
                    <Link href={`/patient/appointments/${appt.id}`} className="btn btn-secondary btn-sm" id={`btn-view-${appt.id}`}>
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
