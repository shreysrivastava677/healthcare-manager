'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';

export default function BookAppointment() {
  const router = useRouter();
  const toast = useToast();

  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Booking state
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    async function fetchDoctors() {
      try {
        const res = await fetch('/api/doctors');
        if (res.ok) {
          const data = await res.json();
          setDoctors(Array.isArray(data) ? data : data.doctors || []);
        }
      } catch (err) {
        toast.error('Error', 'Failed to load doctors');
      } finally {
        setLoading(false);
      }
    }
    fetchDoctors();
  }, []);

  const filteredDoctors = doctors.filter((doc) => {
    const name = (doc.user?.name || '').toLowerCase();
    const spec = (doc.specialisation || '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || spec.includes(q);
  });

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlot(null);
  };

  const handleDateChange = async (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlots([]);

    if (!date || !selectedDoctor) return;

    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/doctors/${selectedDoctor.id}/slots?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(Array.isArray(data) ? data : data.availableSlots || data.slots || []);
      } else {
        toast.error('Error', 'Failed to load available slots');
      }
    } catch (err) {
      toast.error('Error', 'Failed to load available slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedDoctor || !selectedSlot) return;

    setBooking(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorProfileId: selectedDoctor.id,
          slotStart: selectedSlot.start,
          slotEnd: selectedSlot.end,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Booked!', 'Your appointment has been booked successfully.');
        const appointmentId = data.id || data.appointment?.id;
        router.push(`/patient/appointments/${appointmentId}`);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Booking Failed', errData.error || 'Could not book appointment');
      }
    } catch (err) {
      toast.error('Error', 'Something went wrong while booking');
    } finally {
      setBooking(false);
    }
  };

  const getInitials = (name) => {
    return (name || 'D')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const today = new Date().toISOString().split('T')[0];

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
        <h1 className="page-title">Book Appointment</h1>
        <p className="page-subtitle">Search for a doctor and schedule your appointment.</p>
      </div>

      {/* Search Bar */}
      <div className="form-group" style={{ marginBottom: 'var(--space-xl)', maxWidth: '500px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search by doctor name or specialisation..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          id="search-doctors"
        />
      </div>

      {/* Doctor Grid */}
      {!selectedDoctor ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
          {filteredDoctors.length === 0 ? (
            <div className="empty-state card-static" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-title">No doctors found</div>
              <div className="empty-state-text">Try adjusting your search query.</div>
            </div>
          ) : (
            filteredDoctors.map((doc, idx) => (
              <div key={doc.id} className={`card animate-fade-in stagger-${(idx % 6) + 1}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <div className="avatar avatar-lg">{getInitials(doc.user?.name)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>
                      Dr. {doc.user?.name || 'Unknown'}
                    </div>
                    <span className="badge badge-accent">{doc.specialisation}</span>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                  ⏱️ {doc.slotDurationMinutes || 30} min slots
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => handleSelectDoctor(doc)}
                  id={`btn-book-${doc.id}`}
                >
                  Book
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Booking Section */
        <div className="card-static animate-scale-in" style={{ maxWidth: '600px' }}>
          {/* Selected Doctor Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)', paddingBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-primary)' }}>
            <div className="avatar avatar-lg">{getInitials(selectedDoctor.user?.name)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>
                Dr. {selectedDoctor.user?.name || 'Unknown'}
              </div>
              <span className="badge badge-accent">{selectedDoctor.specialisation}</span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedDoctor(null)}
              id="btn-change-doctor"
            >
              ← Change
            </button>
          </div>

          {/* Date Picker */}
          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label" htmlFor="date-picker">Select Date</label>
            <input
              type="date"
              id="date-picker"
              className="form-input"
              min={today}
              value={selectedDate}
              onChange={handleDateChange}
            />
          </div>

          {/* Slots */}
          {loadingSlots && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-lg)' }}>
              <Spinner />
            </div>
          )}

          {selectedDate && !loadingSlots && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label" style={{ marginBottom: 'var(--space-sm)', display: 'block' }}>
                Available Slots
              </label>
              {slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--text-muted)' }}>
                  No available slots for this date.
                </div>
              ) : (
                <div className="slots-grid">
                  {slots.map((slot, idx) => (
                    <button
                      key={idx}
                      className={`slot-btn ${selectedSlot?.start === slot.start ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(slot)}
                      disabled={slot.booked}
                      id={`slot-${idx}`}
                    >
                      {new Date(slot.start).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Confirm Booking */}
          {selectedSlot && (
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={handleBooking}
              disabled={booking}
              id="btn-confirm-booking"
            >
              {booking ? <><Spinner size="sm" /> Booking...</> : '✓ Confirm Booking'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
