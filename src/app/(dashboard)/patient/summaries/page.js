'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function VisitSummaries() {
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummaries() {
      try {
        const res = await fetch('/api/appointments?status=COMPLETED');
        if (res.ok) {
          const data = await res.json();
          const appts = Array.isArray(data) ? data : data.appointments || [];
          // Filter to only those with post-visit summaries
          setAppointments(appts.filter((a) => a.postVisitSummary));
        }
      } catch (err) {
        toast.error('Error', 'Failed to load visit summaries');
      } finally {
        setLoading(false);
      }
    }
    fetchSummaries();
  }, []);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
        <h1 className="page-title">Visit Summaries</h1>
        <p className="page-subtitle">View summaries from your completed appointments.</p>
      </div>

      {appointments.length === 0 ? (
        <div className="empty-state card-static">
          <div className="empty-state-icon">📄</div>
          <div className="empty-state-title">No visit summaries yet</div>
          <div className="empty-state-text">
            Summaries will appear here after your completed appointments.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-lg)' }}>
          {appointments.map((appt, idx) => (
            <Link
              key={appt.id}
              href={`/patient/appointments/${appt.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div className={`card animate-fade-in stagger-${(idx % 6) + 1}`} style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <div className="avatar">
                    {(appt.doctorProfile?.user?.name || 'D').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Dr. {appt.doctorProfile?.user?.name || 'Unknown'}
                    </div>
                    <span className="badge badge-accent" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {appt.doctorProfile?.specialisation}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-sm)' }}>
                  📅 {formatDate(appt.slotStart)}
                </div>

                {appt.postVisitSummary?.patientFriendlySummary && (
                  <p style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {appt.postVisitSummary.patientFriendlySummary}
                  </p>
                )}

                <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)', fontWeight: 500 }}>
                  View Full Summary →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
