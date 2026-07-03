'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

const navItems = {
  PATIENT: [
    { section: 'Overview', items: [
      { href: '/patient', label: 'Dashboard', icon: '📊' },
    ]},
    { section: 'Appointments', items: [
      { href: '/patient/book', label: 'Book Appointment', icon: '📅' },
      { href: '/patient/appointments', label: 'My Appointments', icon: '📋' },
    ]},
    { section: 'Health', items: [
      { href: '/patient/summaries', label: 'Visit Summaries', icon: '📄' },
    ]},
  ],
  DOCTOR: [
    { section: 'Overview', items: [
      { href: '/doctor', label: 'Dashboard', icon: '📊' },
    ]},
    { section: 'Appointments', items: [
      { href: '/doctor/appointments', label: 'Appointments', icon: '📋' },
    ]},
    { section: 'Schedule', items: [
      { href: '/doctor/leave', label: 'Leave Management', icon: '🏖️' },
    ]},
  ],
  ADMIN: [
    { section: 'Overview', items: [
      { href: '/admin', label: 'Dashboard', icon: '📊' },
    ]},
    { section: 'Management', items: [
      { href: '/admin/doctors', label: 'Manage Doctors', icon: '👨‍⚕️' },
      { href: '/admin/appointments', label: 'All Appointments', icon: '📋' },
    ]},
  ],
};

export default function DashboardShell({ children }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = session?.user?.role || 'PATIENT';
  const sections = navItems[role] || [];
  const userName = session?.user?.name || 'User';
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">❤️‍🩹</div>
          <span className="sidebar-brand">HealthCare</span>
        </div>

        <nav className="sidebar-nav">
          {sections.map((section, idx) => (
            <div key={idx} className="sidebar-section">
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => signOut({ callbackUrl: '/login' })}>
            <div className="avatar avatar-sm">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">{role.toLowerCase()}</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>↗</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sign Out
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
