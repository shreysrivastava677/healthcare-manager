'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function ManageDoctors() {
  const toast = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDoctors();
  }, []);

  async function fetchDoctors() {
    try {
      const res = await fetch('/api/doctors?all=true');
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors || []);
      }
    } catch (err) {
      toast.error('Error', 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(doctorId, currentState) {
    try {
      const res = await fetch(`/api/doctors/${doctorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentState }),
      });
      if (res.ok) {
        toast.success('Updated', `Doctor ${!currentState ? 'activated' : 'deactivated'}`);
        fetchDoctors();
      }
    } catch (err) {
      toast.error('Error', 'Failed to update doctor');
    }
  }

  const filtered = doctors.filter(d => {
    const name = d.user?.name?.toLowerCase() || '';
    const spec = d.specialisation?.toLowerCase() || '';
    const q = search.toLowerCase();
    return name.includes(q) || spec.includes(q);
  });

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
        <div>
          <h1 className="page-title">Manage Doctors</h1>
          <p className="page-subtitle">{doctors.length} doctor(s) registered</p>
        </div>
        <Link href="/admin/doctors/new" className="btn btn-primary">+ Add Doctor</Link>
      </div>

      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by name or specialisation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '400px' }}
          id="doctor-search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state card-static">
          <div className="empty-state-icon">👨‍⚕️</div>
          <div className="empty-state-title">No doctors found</div>
          <div className="empty-state-text">Add your first doctor to get started.</div>
          <Link href="/admin/doctors/new" className="btn btn-primary">Add Doctor</Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Specialisation</th>
                <th>Slot Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => (
                <tr key={doc.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <div className="avatar avatar-sm">
                        {(doc.user?.name || 'D').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      {doc.user?.name}
                    </div>
                  </td>
                  <td>{doc.user?.email}</td>
                  <td><span className="badge badge-accent">{doc.specialisation}</span></td>
                  <td>{doc.slotDurationMinutes} min</td>
                  <td>
                    <span className={`badge ${doc.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {doc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                      <Link href={`/admin/doctors/${doc.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                      <button
                        className={`btn btn-sm ${doc.isActive ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => toggleActive(doc.id, doc.isActive)}
                      >
                        {doc.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
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
