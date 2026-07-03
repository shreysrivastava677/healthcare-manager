'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      toast.error('Error', 'Failed to load stats');
    } finally {
      setLoading(false);
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
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Welcome back, {session?.user?.name}. Here&apos;s your system overview.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card animate-fade-in stagger-1">
          <div className="stat-icon stat-icon-teal">👨‍⚕️</div>
          <div>
            <div className="stat-value">{stats?.totalDoctors || 0}</div>
            <div className="stat-label">Total Doctors</div>
          </div>
        </div>
        <div className="stat-card animate-fade-in stagger-2">
          <div className="stat-icon stat-icon-blue">👥</div>
          <div>
            <div className="stat-value">{stats?.totalPatients || 0}</div>
            <div className="stat-label">Total Patients</div>
          </div>
        </div>
        <div className="stat-card animate-fade-in stagger-3">
          <div className="stat-icon stat-icon-green">📅</div>
          <div>
            <div className="stat-value">{stats?.todayAppointments || 0}</div>
            <div className="stat-label">Today&apos;s Appointments</div>
          </div>
        </div>
        <div className="stat-card animate-fade-in stagger-4">
          <div className="stat-icon stat-icon-purple">✅</div>
          <div>
            <div className="stat-value">{stats?.activeDoctors || 0}</div>
            <div className="stat-label">Active Doctors</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
        <Link href="/admin/doctors/new" className="btn btn-primary">+ Add New Doctor</Link>
        <Link href="/admin/doctors" className="btn btn-secondary">Manage Doctors</Link>
        <Link href="/admin/appointments" className="btn btn-secondary">View All Appointments</Link>
      </div>

      {/* Recent Appointments */}
      <div className="card-static">
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Recent Appointments</h3>
        {!stats?.recentAppointments?.length ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No appointments yet</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAppointments.map(appt => (
                  <tr key={appt.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{appt.patient?.name}</td>
                    <td>{appt.doctorProfile?.user?.name}</td>
                    <td>{new Date(appt.slotStart).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className={`badge ${appt.status === 'CONFIRMED' ? 'badge-success' : appt.status === 'PENDING' ? 'badge-warning' : appt.status === 'CANCELLED' ? 'badge-danger' : 'badge-info'}`}>
                        {appt.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
