import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'patient',
    specialization: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.role === 'doctor' && !form.specialization.trim()) {
      setError('Please provide a specialization for a doctor account.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: form.role,
        phone: form.phone,
        specialization: form.specialization
      });

      if (result.session) {
        navigate('/');
      } else {
        setRegistered(true);
      }
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (registered) {
    return (
      <div className="max-w-content mx-auto px-6 py-20 flex justify-center">
        <motion.div
          className="w-full max-w-sm text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="font-display text-2xl text-ink mb-3">Check your email</h1>
          <p className="text-sm text-muted leading-relaxed mb-8">
            We sent a confirmation link to {form.email}. Confirm your address, then sign in to
            continue.
          </p>
          <Link to="/login" className="btn-primary">
            Go to sign in
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-6 py-16 flex justify-center">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="font-display text-3xl text-ink mb-2">Create an account</h1>
        <p className="text-sm text-muted mb-8">
          Register as a patient, or as a doctor if a hospital administrator has asked you to
          self-enroll.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="mb-6">
            <legend className="field-label">I am registering as a</legend>
            <div className="flex gap-3">
              {['patient', 'doctor'].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setForm((f) => ({ ...f, role: r }))}
                  aria-pressed={form.role === r}
                  className={`flex-1 border rounded px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
                    form.role === r
                      ? 'border-accent text-accent bg-accent/5'
                      : 'border-hairline text-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mb-5">
            <label htmlFor="fullName" className="field-label">Full name</label>
            <input
              id="fullName"
              required
              value={form.fullName}
              onChange={update('fullName')}
              className="field-input"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="email" className="field-label">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              className="field-input"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="phone" className="field-label">Phone (optional)</label>
            <input id="phone" value={form.phone} onChange={update('phone')} className="field-input" />
          </div>

          {form.role === 'doctor' && (
            <div className="mb-5">
              <label htmlFor="specialization" className="field-label">Specialization</label>
              <input
                id="specialization"
                required
                value={form.specialization}
                onChange={update('specialization')}
                className="field-input"
                placeholder="e.g. Cardiology"
              />
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="password" className="field-label">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              className="field-input"
            />
            <p className="text-xs text-faint mt-1.5">At least 8 characters.</p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-status-cancelled mb-5">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-muted mt-8">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-accent-dark font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
