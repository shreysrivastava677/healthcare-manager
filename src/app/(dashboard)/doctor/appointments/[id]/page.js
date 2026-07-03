'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function DoctorAppointmentDetail() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useToast();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescription, setPrescription] = useState('');

  useEffect(() => {
    fetchAppointment();
  }, [id]);

  async function fetchAppointment() {
    try {
      const res = await fetch(`/api/appointments/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAppointment(data.appointment);
      } else {
        toast.error('Error', 'Failed to load appointment');
      }
    } catch (err) {
      toast.error('Error', 'Failed to load appointment');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitNotes(e) {
    e.preventDefault();
    if (clinicalNotes.trim().length < 10) {
      toast.warning('Validation', 'Clinical notes must be at least 10 characters');
      return;
    }
    if (prescription.trim().length < 5) {
      toast.warning('Validation', 'Prescription must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${id}/post-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicalNotes, prescription }),
      });

      if (res.ok) {
        toast.success('Success', 'Post-visit notes submitted. AI summary is being generated.');
        fetchAppointment();
      } else {
        const data = await res.json();
        toast.error('Error', data.error || 'Failed to submit notes');
      }
    } catch (err) {
      toast.error('Error', 'Failed to submit notes');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkCompleted() {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      if (res.ok) {
        toast.success('Success', 'Appointment marked as completed');
        fetchAppointment();
      }
    } catch (err) {
      toast.error('Error', 'Failed to update status');
    }
  }

  const formatDateTime = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const map = { CONFIRMED: 'badge-success', PENDING: 'badge-warning', CANCELLED: 'badge-danger', COMPLETED: 'badge-info' };
    return map[status] || 'badge-neutral';
  };

  const getUrgencyClass = (level) => {
    const map = { HIGH: 'urgency-high', MEDIUM: 'urgency-medium', LOW: 'urgency-low' };
    return map[level] || '';
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="page-container">
        <div className="empty-state card-static">
          <div className="empty-state-icon">❌</div>
          <div className="empty-state-title">Appointment not found</div>
          <button className="btn btn-primary" onClick={() => router.push('/doctor/appointments')}>Back to Appointments</button>
        </div>
      </div>
    );
  }

  const suggestedQuestions = appointment.preVisitSummary?.suggestedQuestions
    ? (typeof appointment.preVisitSummary.suggestedQuestions === 'string'
        ? JSON.parse(appointment.preVisitSummary.suggestedQuestions)
        : appointment.preVisitSummary.suggestedQuestions)
    : [];

  const medSchedule = appointment.postVisitSummary?.medicationSchedule
    ? (typeof appointment.postVisitSummary.medicationSchedule === 'string'
        ? JSON.parse(appointment.postVisitSummary.medicationSchedule)
        : appointment.postVisitSummary.medicationSchedule)
    : [];

  const followUpSteps = appointment.postVisitSummary?.followUpSteps
    ? (typeof appointment.postVisitSummary.followUpSteps === 'string'
        ? JSON.parse(appointment.postVisitSummary.followUpSteps)
        : appointment.postVisitSummary.followUpSteps)
    : [];

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/doctor/appointments')} style={{ marginBottom: 'var(--space-md)' }}>
          ← Back to Appointments
        </button>
        <h1 className="page-title">Appointment Review</h1>
      </div>

      {/* Appointment Info */}
      <div className="card-static" style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div className="avatar avatar-lg">
              {(appointment.patient?.name || 'P').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>{appointment.patient?.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{appointment.patient?.email}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{formatDateTime(appointment.slotStart)}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
            <span className={`badge ${getStatusBadge(appointment.status)}`}>{appointment.status}</span>
            {appointment.status === 'CONFIRMED' && !appointment.postVisitNote && (
              <button className="btn btn-primary btn-sm" onClick={handleMarkCompleted}>Mark Completed</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-xl)' }}>
        {/* Left Column: Patient Info */}
        <div>
          {/* Symptom Form */}
          {appointment.symptomForm && (
            <div className="summary-card animate-fade-in stagger-1" style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="summary-header">
                <div className="summary-header-title">📝 Patient Symptoms</div>
              </div>
              <div className="summary-body">
                <div className="summary-section">
                  <div className="summary-section-title">Reported Symptoms</div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{appointment.symptomForm.symptoms}</p>
                </div>
                {appointment.symptomForm.additionalNotes && (
                  <div className="summary-section">
                    <div className="summary-section-title">Additional Notes</div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{appointment.symptomForm.additionalNotes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Pre-Visit Summary */}
          {appointment.preVisitSummary && appointment.preVisitSummary.generatedAt && (
            <div className="summary-card animate-fade-in stagger-2" style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="summary-header">
                <div className="summary-header-title">🤖 AI Pre-Visit Summary</div>
                {appointment.preVisitSummary.urgencyLevel && (
                  <span className={`badge ${appointment.preVisitSummary.urgencyLevel === 'HIGH' ? 'badge-danger' : appointment.preVisitSummary.urgencyLevel === 'MEDIUM' ? 'badge-warning' : 'badge-success'}`}>
                    {appointment.preVisitSummary.urgencyLevel} URGENCY
                  </span>
                )}
              </div>
              <div className="summary-body">
                {appointment.preVisitSummary.chiefComplaint && (
                  <div className="summary-section">
                    <div className="summary-section-title">Chief Complaint</div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{appointment.preVisitSummary.chiefComplaint}</p>
                  </div>
                )}
                {suggestedQuestions.length > 0 && (
                  <div className="summary-section">
                    <div className="summary-section-title">Suggested Questions</div>
                    <ol style={{ paddingLeft: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                      {suggestedQuestions.map((q, i) => (
                        <li key={i} style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{q}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}

          {appointment.preVisitSummary && !appointment.preVisitSummary.generatedAt && (
            <div className="card-static animate-fade-in stagger-2" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center', padding: 'var(--space-xl)' }}>
              <Spinner />
              <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
                AI summary is being generated...
              </p>
              <button className="btn btn-ghost btn-sm" onClick={fetchAppointment} style={{ marginTop: 'var(--space-sm)' }}>
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Doctor Actions */}
        <div>
          {/* Post-Visit Note Form */}
          {(appointment.status === 'CONFIRMED' || appointment.status === 'COMPLETED') && !appointment.postVisitNote && (
            <div className="summary-card animate-fade-in stagger-3" style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="summary-header">
                <div className="summary-header-title">✍️ Post-Visit Notes</div>
              </div>
              <div className="summary-body">
                <form onSubmit={handleSubmitNotes} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="clinical-notes">Clinical Notes *</label>
                    <textarea
                      id="clinical-notes"
                      className="form-input form-textarea"
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Enter your clinical observations, diagnosis, and findings..."
                      rows={5}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="prescription">Prescription *</label>
                    <textarea
                      id="prescription"
                      className="form-input form-textarea"
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      placeholder="Enter prescribed medications, dosages, and instructions..."
                      rows={4}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting} id="submit-notes-btn">
                    {submitting ? <><Spinner size="sm" /> Submitting...</> : 'Submit Notes & Complete Visit'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Existing Post-Visit Notes */}
          {appointment.postVisitNote && (
            <div className="summary-card animate-fade-in stagger-3" style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="summary-header">
                <div className="summary-header-title">📋 Post-Visit Notes</div>
                <span className="badge badge-success">Submitted</span>
              </div>
              <div className="summary-body">
                <div className="summary-section">
                  <div className="summary-section-title">Clinical Notes</div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{appointment.postVisitNote.clinicalNotes}</p>
                </div>
                <div className="summary-section">
                  <div className="summary-section-title">Prescription</div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{appointment.postVisitNote.prescription}</p>
                </div>
              </div>
            </div>
          )}

          {/* Post-Visit Summary */}
          {appointment.postVisitSummary && appointment.postVisitSummary.generatedAt && (
            <div className="summary-card animate-fade-in stagger-4">
              <div className="summary-header">
                <div className="summary-header-title">🤖 AI Post-Visit Summary</div>
                <span className="badge badge-accent">AI Generated</span>
              </div>
              <div className="summary-body">
                {appointment.postVisitSummary.patientFriendlySummary && (
                  <div className="summary-section">
                    <div className="summary-section-title">Patient Summary</div>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{appointment.postVisitSummary.patientFriendlySummary}</p>
                  </div>
                )}
                {medSchedule.length > 0 && (
                  <div className="summary-section">
                    <div className="summary-section-title">Medication Schedule</div>
                    <div className="table-container">
                      <table className="table">
                        <thead><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
                        <tbody>
                          {medSchedule.map((med, i) => (
                            <tr key={i}><td>{med.name}</td><td>{med.dosage}</td><td>{med.frequency}</td><td>{med.duration}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {followUpSteps.length > 0 && (
                  <div className="summary-section">
                    <div className="summary-section-title">Follow-Up Steps</div>
                    <ul style={{ paddingLeft: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                      {followUpSteps.map((step, i) => (
                        <li key={i} style={{ color: 'var(--text-secondary)' }}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
