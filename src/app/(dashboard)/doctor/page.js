'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function DoctorDashboard() {
  const { data: session } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, todayRes] = await Promise.all([
          fetch('/api/appointments?stats=true'),
          fetch('/api/appointments?date=today'),
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }

        if (todayRes.ok) {
          const data = await todayRes.json();
          setTodayAppts(Array.isArray(data) ? data : data.appointments || []);
        }
      } catch (err) {
        toast.error('Error', 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
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

  const userName = session?.user?.name || 'Doctor';

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Welcome, {userName} 👋</h1>
        <p className="page-subtitle">Here&apos;s your schedule and activity overview for today.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card animate-fade-in stagger-1" id="stat-today">
          <div className="stat-icon stat-icon-teal">📅</div>
          <div>
            <div className="stat-value">{stats?.todayCount || todayAppts.length}</div>
            <div className="stat-label">Today&apos;s Appointments</div>
          </div>
        </div>

        <div className="stat-card animate-fade-in stagger-2" id="stat-patients">
          <div className="stat-icon stat-icon-blue">👥</div>
          <div>
            <div className="stat-value">{stats?.totalPatients || 0}</div>
            <div className="stat-label">Total Patients</div>
          </div>
        </div>

        <div className="stat-card animate-fade-in stagger-3" id="stat-pending">
          <div className="stat-icon stat-icon-amber">📋</div>
          <div>
            <div className="stat-value">{stats?.pendingReviews || 0}</div>
            <div className="stat-label">Pending Reviews</div>
          </div>
        </div>

        <div className="stat-card animate-fade-in stagger-4" id="stat-leave">
          <div className="stat-icon stat-icon-purple">🏖️</div>
          <div>
            <div className="stat-value">{stats?.leaveDays || 0}</div>
            <div className="stat-label">Leave Days</div>
          </div>
        </div>
      </div>

      {/* Today's Appointments */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>Today&apos;s Schedule</h2>
          <Link href="/doctor/leave" className="btn btn-secondary btn-sm" id="btn-manage-leave">
            🏖️ Manage Leave
          </Link>
        </div>

        {todayAppts.length === 0 ? (
          <div className="empty-state card-static">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No appointments today</div>
            <div className="empty-state-text">Enjoy your free day or manage your schedule.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            {todayAppts.map((appt, idx) => (
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
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.125rem' }}>
                          {appt.patient?.name || 'Unknown Patient'}
                        </div>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                          {formatTime(appt.slotStart)} – {formatTime(appt.slotEnd)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      {appt.preVisitSummary?.urgencyLevel && (
                        <span className={`badge ${getUrgencyBadge(appt.preVisitSummary.urgencyLevel)}`}>
                          {appt.preVisitSummary.urgencyLevel}
                        </span>
                      )}
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)' }}>Review →</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
