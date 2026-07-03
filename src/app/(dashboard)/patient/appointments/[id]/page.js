'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function AppointmentDetail() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Symptom form state
  const [symptoms, setSymptoms] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submittingSymptoms, setSubmittingSymptoms] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchAppointment();
  }, [params.id]);

  async function fetchAppointment() {
    try {
      const res = await fetch(`/api/appointments/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setAppointment(data.appointment);
      } else {
        toast.error('Error', 'Appointment not found');
        router.push('/patient/appointments');
      }
    } catch (err) {
      toast.error('Error', 'Failed to load appointment');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmitSymptoms = async (e) => {
    e.preventDefault();
    if (!symptoms.trim()) {
      toast.warning('Required', 'Please describe your symptoms');
      return;
    }

    setSubmittingSymptoms(true);
    try {
      const res = await fetch(`/api/appointments/${params.id}/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms, additionalNotes }),
      });

      if (res.ok) {
        toast.success('Submitted', 'Your symptom form has been submitted. An AI pre-visit summary will be generated shortly.');
        fetchAppointment();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Error', errData.error || 'Failed to submit symptom form');
      }
    } catch (err) {
      toast.error('Error', 'Something went wrong');
    } finally {
      setSubmittingSymptoms(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });

      if (res.ok) {
        toast.success('Cancelled', 'Appointment has been cancelled');
        fetchAppointment();
      } else {
        toast.error('Error', 'Failed to cancel appointment');
      }
    } catch (err) {
      toast.error('Error', 'Something went wrong');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
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

  const getUrgencyBadge = (level) => {
    const map = {
      HIGH: 'badge-danger',
      MEDIUM: 'badge-warning',
      LOW: 'badge-success',
    };
    return map[level] || 'badge-neutral';
  };

  const parseSafe = (jsonStr) => {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!appointment) return null;

  const hasSymptomForm = !!appointment.symptomForm;
  const hasPreVisitSummary = !!appointment.preVisitSummary?.chiefComplaint;
  const hasPostVisitSummary = !!appointment.postVisitSummary?.patientFriendlySummary;
  const isActive = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';

  return (
    <div className="page-container animate-fade-in">
      {/* Back Link */}
      <Link href="/patient/appointments" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
        ← Back to Appointments
      </Link>

      <div className="page-header">
        <h1 className="page-title">Appointment Details</h1>
      </div>

      {/* Appointment Info Card */}
      <div className="card-static animate-fade-in stagger-1" style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
          <div className="avatar avatar-lg">
            {(appointment.doctorProfile?.user?.name || 'D').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', marginBottom: '0.25rem' }}>
              Dr. {appointment.doctorProfile?.user?.name || 'Unknown'}
            </div>
            <span className="badge badge-accent" style={{ marginRight: 'var(--space-sm)' }}>
              {appointment.doctorProfile?.specialisation || 'General'}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              {formatDate(appointment.slotStart)}
            </div>
            <div style={{ fontWeight: 600 }}>
              {formatTime(appointment.slotStart)} – {formatTime(appointment.slotEnd)}
            </div>
            <span className={`badge ${getStatusBadge(appointment.status)}`} style={{ marginTop: 'var(--space-sm)' }}>
              {appointment.status}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {isActive && (
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-primary)' }}>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleCancel}
              disabled={cancelling}
              id="btn-cancel-appointment"
            >
              {cancelling ? <><Spinner size="sm" /> Cancelling...</> : '❌ Cancel Appointment'}
            </button>
          </div>
        )}
      </div>

      {/* Symptom Form — Show form if active and no form submitted yet */}
      {isActive && !hasSymptomForm && (
        <div className="summary-card animate-fade-in stagger-2" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="summary-header">
            <div className="summary-header-title">📝 Symptom Form</div>
          </div>
          <div className="summary-body">
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
              Please describe your symptoms before the appointment. This helps the doctor prepare for your visit.
            </p>
            <form onSubmit={handleSubmitSymptoms}>
              <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label className="form-label" htmlFor="symptoms">Symptoms *</label>
                <textarea
                  id="symptoms"
                  className="form-input form-textarea"
                  placeholder="Describe your symptoms in detail..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="form-label" htmlFor="additional-notes">Additional Notes</label>
                <textarea
                  id="additional-notes"
                  className="form-input form-textarea"
                  placeholder="Any additional information (allergies, current medications, etc.)..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingSymptoms}
                id="btn-submit-symptoms"
              >
                {submittingSymptoms ? <><Spinner size="sm" /> Submitting...</> : '✓ Submit Symptoms'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Submitted Symptom Form — Read-only */}
      {hasSymptomForm && (
        <div className="summary-card animate-fade-in stagger-2" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="summary-header">
            <div className="summary-header-title">📝 Your Symptom Form</div>
            <span className="badge badge-success">Submitted</span>
          </div>
          <div className="summary-body">
            <div className="summary-section">
              <div className="summary-section-title">Symptoms</div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {appointment.symptomForm.symptoms}
              </p>
            </div>
            {appointment.symptomForm.additionalNotes && (
              <div className="summary-section">
                <div className="summary-section-title">Additional Notes</div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {appointment.symptomForm.additionalNotes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-Visit Summary */}
      {hasPreVisitSummary && (
        <div className="summary-card animate-fade-in stagger-3" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="summary-header">
            <div className="summary-header-title">🤖 AI Pre-Visit Summary</div>
            {appointment.preVisitSummary.urgencyLevel && (
              <span className={`badge ${getUrgencyBadge(appointment.preVisitSummary.urgencyLevel)}`}>
                {appointment.preVisitSummary.urgencyLevel} Urgency
              </span>
            )}
          </div>
          <div className="summary-body">
            <div className="summary-section">
              <div className="summary-section-title">Chief Complaint</div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {appointment.preVisitSummary.chiefComplaint}
              </p>
            </div>

            {appointment.preVisitSummary.suggestedQuestions && (
              <div className="summary-section">
                <div className="summary-section-title">Suggested Questions for Your Doctor</div>
                <ol style={{ paddingLeft: 'var(--space-lg)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {parseSafe(appointment.preVisitSummary.suggestedQuestions).map((q, i) => (
                    <li key={i} style={{ lineHeight: 1.6 }}>{q}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-Visit Summary */}
      {hasPostVisitSummary && (
        <div className="summary-card animate-fade-in stagger-4" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="summary-header">
            <div className="summary-header-title">📋 Post-Visit Summary</div>
          </div>
          <div className="summary-body">
            <div className="summary-section">
              <div className="summary-section-title">Summary</div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {appointment.postVisitSummary.patientFriendlySummary}
              </p>
            </div>

            {/* Medication Table */}
            {appointment.postVisitSummary.medicationSchedule && (
              <div className="summary-section">
                <div className="summary-section-title">Medication Schedule</div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Medication</th>
                        <th>Dosage</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseSafe(appointment.postVisitSummary.medicationSchedule).map((med, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{med.name || med.medication}</td>
                          <td>{med.dosage}</td>
                          <td>{med.frequency}</td>
                          <td>{med.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Follow-up Steps */}
            {appointment.postVisitSummary.followUpSteps && (
              <div className="summary-section">
                <div className="summary-section-title">Follow-up Steps</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  {parseSafe(appointment.postVisitSummary.followUpSteps).map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
                      <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>☐</span>
                      <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
