import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SectionReveal from '../components/SectionReveal';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    title: 'Book with the right doctor',
    body: 'Browse specializations and availability, then request an appointment in a few taps. No phone tag.'
  },
  {
    title: 'Records in one place',
    body: 'Diagnoses, prescriptions, and visit notes stay attached to your history, visible whenever you need them.'
  },
  {
    title: 'Medication reminders',
    body: 'Set a schedule once. EzRemedy keeps track of dosage and timing so nothing gets missed.'
  }
];

const STEPS = [
  { title: 'Register', body: 'Create a patient account in under a minute.' },
  { title: 'Book', body: 'Choose a doctor and a time that works for you.' },
  { title: 'Get care', body: 'Attend your visit; your record updates automatically.' },
  { title: 'Follow through', body: 'Reminders keep your treatment on schedule.' }
];

export default function LandingPage() {
  const { isAuthenticated, role } = useAuth();
  const primaryHref = isAuthenticated ? (role === 'patient' ? '/dashboard' : '/portal') : '/register';

  return (
    <div>
      <section className="max-w-content mx-auto px-6 pt-20 pb-24">
        <motion.p
          className="text-sm text-accent font-medium mb-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          A calmer way to coordinate care
        </motion.p>
        <motion.h1
          className="font-display text-4xl sm:text-5xl text-ink max-w-2xl leading-[1.1]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          Appointments, records, and reminders, without the back-and-forth.
        </motion.h1>
        <motion.p
          className="text-lg text-muted max-w-xl mt-6 leading-relaxed"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          EzRemedy connects patients with doctors and hospital staff in a single, uncluttered
          system. Book a visit, review your history, and keep your medication on track.
        </motion.p>
        <motion.div
          className="flex flex-wrap items-center gap-4 mt-9"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to={primaryHref} className="btn-primary">
            {isAuthenticated ? 'Go to your dashboard' : 'Create a patient account'}
          </Link>
          {!isAuthenticated && (
            <Link to="/login" className="btn-secondary">
              Sign in
            </Link>
          )}
        </motion.div>
      </section>

      <section className="border-t border-hairline bg-panel">
        <div className="max-w-content mx-auto px-6 py-20">
          <SectionReveal>
            <h2 className="font-display text-2xl text-ink mb-10 max-w-lg">
              Everything a visit needs, kept in order.
            </h2>
          </SectionReveal>
          <div className="grid sm:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => (
              <SectionReveal key={f.title} delay={i * 0.08}>
                <div className="border-t border-ink pt-4">
                  <h3 className="font-display text-lg text-ink mb-2">{f.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.body}</p>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline">
        <div className="max-w-content mx-auto px-6 py-20">
          <SectionReveal>
            <h2 className="font-display text-2xl text-ink mb-10 max-w-lg">How it works</h2>
          </SectionReveal>
          <div className="grid sm:grid-cols-4 gap-8">
            {STEPS.map((s, i) => (
              <SectionReveal key={s.title} delay={i * 0.08}>
                <div>
                  <p className="text-sm text-faint mb-2">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="text-[15px] text-ink font-medium mb-1.5">{s.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{s.body}</p>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline bg-accent text-paper">
        <div className="max-w-content mx-auto px-6 py-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <h2 className="font-display text-2xl max-w-md">
            Set up your account and book your first visit today.
          </h2>
          <Link
            to={primaryHref}
            className="inline-flex items-center justify-center bg-paper text-ink rounded px-5 py-2.5 text-[15px] font-medium hover:bg-panel transition-colors duration-150"
          >
            {isAuthenticated ? 'Go to your dashboard' : 'Get started'}
          </Link>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="max-w-content mx-auto px-6 py-8 flex items-center justify-between text-sm text-faint">
          <span>EzRemedy</span>
          <span>Manipal University Jaipur — B.Tech evaluation project</span>
        </div>
      </footer>
    </div>
  );
}
