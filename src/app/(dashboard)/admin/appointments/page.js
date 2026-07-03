'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function AdminAppointments() {
  const toast = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  async function fetchAppointments() {
    try {
      const res = await fetch('/api/appointments');
      if (res.ok) {
        const data = await res.json();
        setAppointments(data.appointments || []);
      }
    } catch (err) {
      toast.error('Error', 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }

  const filtered = appointments.filter(appt => {
    if (statusFilter && appt.status !== statusFilter) return false;
    if (dateFilter) {
      const apptDate = new Date(appt.slotStart).toISOString().split('T')[0];
      if (apptDate !== dateFilter) return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    const map = { CONFIRMED: 'badge-success', PENDING: 'badge-warning', CANCELLED: 'badge-danger', COMPLETED: 'badge-info' };
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
        <h1 className="page-title">All Appointments</h1>
        <p className="page-subtitle">{appointments.length} total appointment(s)</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-input form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: '180px' }} id="status-filter">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <input type="date" className="form-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ maxWidth: '180px' }} id="date-filter" />
        {(statusFilter || dateFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setStatusFilter(''); setDateFilter(''); }}>Clear Filters</button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card-static">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No appointments found</div>
          <div className="empty-state-text">Try adjusting your filters.</div>
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
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(appt => (
                <tr key={appt.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{appt.patient?.name || 'Unknown'}</td>
                  <td>{appt.doctorProfile?.user?.name || 'Unknown'}</td>
                  <td>
                    {new Date(appt.slotStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                    {new Date(appt.slotStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td><span className={`badge ${getStatusBadge(appt.status)}`}>{appt.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    {new Date(appt.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
