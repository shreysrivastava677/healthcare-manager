import Link from 'next/link';

const features = [
  {
    icon: '🏥',
    title: 'Smart Booking',
    description:
      'Book appointments with your preferred specialist in just a few clicks. Real-time slot availability ensures you never double-book.',
  },
  {
    icon: '🤖',
    title: 'AI Summaries',
    description:
      'Get AI-powered pre and post visit summaries that help doctors prepare and patients understand their care plan.',
  },
  {
    icon: '📧',
    title: 'Email Alerts',
    description:
      'Automated email confirmations and reminders keep everyone informed about upcoming appointments and changes.',
  },
  {
    icon: '📅',
    title: 'Calendar Sync',
    description:
      'Google Calendar integration for both patients and doctors ensures appointments are always in sync across devices.',
  },
  {
    icon: '💊',
    title: 'Med Reminders',
    description:
      'Automated medication reminders generated from doctor prescriptions help patients stay on track with their treatment.',
  },
  {
    icon: '🔒',
    title: 'Secure Access',
    description:
      'Role-based portals for patients, doctors, and admins with secure authentication and data protection built in.',
  },
];

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">
            <span>✨</span>
            <span>Next-Gen Healthcare Platform</span>
          </div>

          <h1 className="landing-title">
            Healthcare
            <br />
            <span className="landing-title-gradient">Simplified</span>
          </h1>

          <p className="landing-subtitle">
            Streamline appointments, leverage AI-powered insights, and deliver
            exceptional patient care — all from one unified platform designed
            for the modern healthcare experience.
          </p>

          <div className="landing-cta">
            <Link href="/register" className="btn btn-primary btn-lg" id="cta-get-started">
              Get Started
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg" id="cta-sign-in">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <div className="landing-features-grid">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`feature-card animate-fade-in-up stagger-${index + 1}`}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
