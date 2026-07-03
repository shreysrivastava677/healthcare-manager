'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

const TABS = ['All', 'Upcoming', 'Completed', 'Cancelled'];

export default function PatientAppointments() {
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [cancelling, setCancelling] = useState(null);

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

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    setCancelling(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });

      if (res.ok) {
        toast.success('Cancelled', 'Appointment has been cancelled');
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: 'CANCELLED' } : a))
        );
      } else {
        toast.error('Error', 'Failed to cancel appointment');
      }
    } catch (err) {
      toast.error('Error', 'Something went wrong');
    } finally {
      setCancelling(null);
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Upcoming') return appt.status === 'PENDING' || appt.status === 'CONFIRMED';
    if (activeTab === 'Completed') return appt.status === 'COMPLETED';
    if (activeTab === 'Cancelled') return appt.status === 'CANCELLED';
    return true;
  });

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

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Appointments</h1>
        <p className="page-subtitle">View and manage all your appointments.</p>
      </div>

      {/* Tab Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab(tab)}
            id={`tab-${tab.toLowerCase()}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="empty-state card-static">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No appointments found</div>
          <div className="empty-state-text">
            {activeTab === 'All'
              ? 'You have no appointments yet. Book one to get started!'
              : `No ${activeTab.toLowerCase()} appointments.`}
          </div>
          {activeTab === 'All' && (
            <Link href="/patient/book" className="btn btn-primary">
              Book Appointment
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          {filteredAppointments.map((appt, idx) => (
            <div key={appt.id} className={`card animate-fade-in stagger-${(idx % 6) + 1}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                  <div className="avatar">
                    {(appt.doctorProfile?.user?.name || 'D').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      Dr. {appt.doctorProfile?.user?.name || 'Unknown'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                      <span className="badge badge-accent">
                        {appt.doctorProfile?.specialisation || 'General'}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        {formatDate(appt.slotStart)} · {formatTime(appt.slotStart)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className={`badge ${getStatusBadge(appt.status)}`}>{appt.status}</span>
                  <Link
                    href={`/patient/appointments/${appt.id}`}
                    className="btn btn-secondary btn-sm"
                    id={`btn-view-${appt.id}`}
                  >
                    View Details
                  </Link>
                  {(appt.status === 'PENDING' || appt.status === 'CONFIRMED') && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleCancel(appt.id)}
                      disabled={cancelling === appt.id}
                      id={`btn-cancel-${appt.id}`}
                    >
                      {cancelling === appt.id ? <Spinner size="sm" /> : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
