import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { doctorsApi, appointmentsApi, recordsApi, remindersApi } from '../lib/api';
import DoctorCard from '../components/DoctorCard';
import AppointmentRow from '../components/AppointmentRow';
import RecordRow from '../components/RecordRow';
import ReminderRow from '../components/ReminderRow';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';

const TABS = [
  { id: 'book', label: 'Find a doctor' },
  { id: 'appointments', label: 'My appointments' },
  { id: 'records', label: 'Medical records' },
  { id: 'reminders', label: 'Reminders' }
];

export default function PatientDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('book');

  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    medication_name: '',
    dosage: '',
    frequency: '',
    start_date: '',
    end_date: '',
    reminder_time: ''
  });
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [d, a, r, m] = await Promise.all([
        doctorsApi.list(),
        appointmentsApi.list(),
        recordsApi.list(),
        remindersApi.list()
      ]);
      setDoctors(d);
      setAppointments(a);
      setRecords(r);
      setReminders(m);
    } catch (err) {
      setError(err.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const openBooking = (doctor) => {
    setBookingDoctor(doctor);
    setBookingDate('');
    setBookingReason('');
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!bookingDate) return;
    setBookingSubmitting(true);
    try {
      const created = await appointmentsApi.create({
        doctor_id: bookingDoctor.id,
        appointment_date: new Date(bookingDate).toISOString(),
        reason: bookingReason || undefined
      });
      setAppointments((prev) => [...prev, created].sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date)));
      setBookingDoctor(null);
      setNotice('Appointment requested. You will see its status update once the clinic responds.');
      setActiveTab('appointments');
    } catch (err) {
      setError(err.message || 'Could not book this appointment.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const cancelAppointment = async (appointment) => {
    try {
      const updated = await appointmentsApi.update(appointment.id, { status: 'cancelled' });
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotice('Appointment cancelled.');
    } catch (err) {
      setError(err.message || 'Could not cancel this appointment.');
    }
  };

  const submitReminder = async (e) => {
    e.preventDefault();
    setReminderSubmitting(true);
    try {
      const created = await remindersApi.create(reminderForm);
      setReminders((prev) => [...prev, created]);
      setShowReminderForm(false);
      setReminderForm({
        medication_name: '',
        dosage: '',
        frequency: '',
        start_date: '',
        end_date: '',
        reminder_time: ''
      });
      setNotice('Reminder added.');
    } catch (err) {
      setError(err.message || 'Could not save this reminder.');
    } finally {
      setReminderSubmitting(false);
    }
  };

  const toggleReminder = async (reminder) => {
    try {
      const updated = await remindersApi.update(reminder.id, { active: !reminder.active });
      setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err.message || 'Could not update this reminder.');
    }
  };

  const deleteReminder = async (reminder) => {
    try {
      await remindersApi.remove(reminder.id);
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
      setNotice('Reminder removed.');
    } catch (err) {
      setError(err.message || 'Could not remove this reminder.');
    }
  };

  return (
    <div className="max-w-content mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-sm text-faint mb-1">Patient dashboard</p>
        <h1 className="font-display text-3xl text-ink">
          Welcome{profile ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
      </div>

      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 border border-status-approved text-status-approved bg-status-approvedBg rounded px-4 py-3 text-sm"
        >
          {notice}
        </motion.div>
      )}
      {error && (
        <div role="alert" className="mb-6 border border-status-cancelled text-status-cancelled bg-status-cancelledBg rounded px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div role="tablist" aria-label="Dashboard sections" className="flex flex-wrap gap-2 border-b border-hairline mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-[15px] font-medium border-b-2 -mb-px transition-colors duration-150 ${
              activeTab === tab.id
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading your dashboard" />
      ) : (
        <>
          {activeTab === 'book' && (
            <div>
              {doctors.length === 0 ? (
                <p className="text-sm text-muted">No doctors are available to book right now.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {doctors.map((doc) => (
                    <DoctorCard key={doc.id} doctor={doc} onBook={openBooking} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="panel px-6">
              {appointments.length === 0 ? (
                <p className="text-sm text-muted py-6">
                  You have no appointments yet. Book one from "Find a doctor".
                </p>
              ) : (
                appointments.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appointment={appt}
                    viewerRole="patient"
                    onCancel={cancelAppointment}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div className="panel px-6">
              {records.length === 0 ? (
                <p className="text-sm text-muted py-6">
                  Your medical records will appear here after your first visit.
                </p>
              ) : (
                records.map((rec) => <RecordRow key={rec.id} record={rec} viewerRole="patient" />)
              )}
            </div>
          )}

          {activeTab === 'reminders' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-muted">Medication reminders you have set up.</p>
                <button onClick={() => setShowReminderForm(true)} className="btn-secondary text-sm">
                  Add reminder
                </button>
              </div>
              <div className="panel px-6">
                {reminders.length === 0 ? (
                  <p className="text-sm text-muted py-6">No reminders yet.</p>
                ) : (
                  reminders.map((rem) => (
                    <ReminderRow
                      key={rem.id}
                      reminder={rem}
                      onToggle={toggleReminder}
                      onDelete={deleteReminder}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={Boolean(bookingDoctor)} onClose={() => setBookingDoctor(null)} title="Book appointment">
        {bookingDoctor && (
          <form onSubmit={submitBooking}>
            <p className="text-sm text-muted mb-5">
              With Dr. {bookingDoctor.full_name}
              {bookingDoctor.specialization ? ` · ${bookingDoctor.specialization}` : ''}
            </p>
            <div className="mb-5">
              <label htmlFor="bookingDate" className="field-label">Date and time</label>
              <input
                id="bookingDate"
                type="datetime-local"
                required
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="field-input"
              />
            </div>
            <div className="mb-6">
              <label htmlFor="bookingReason" className="field-label">Reason for visit (optional)</label>
              <textarea
                id="bookingReason"
                rows={3}
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                className="field-input resize-none"
              />
            </div>
            <button type="submit" disabled={bookingSubmitting} className="btn-primary w-full">
              {bookingSubmitting ? 'Requesting…' : 'Request appointment'}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={showReminderForm} onClose={() => setShowReminderForm(false)} title="Add medication reminder">
        <form onSubmit={submitReminder}>
          <div className="mb-5">
            <label htmlFor="medName" className="field-label">Medication name</label>
            <input
              id="medName"
              required
              value={reminderForm.medication_name}
              onChange={(e) => setReminderForm((f) => ({ ...f, medication_name: e.target.value }))}
              className="field-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label htmlFor="dosage" className="field-label">Dosage</label>
              <input
                id="dosage"
                required
                placeholder="e.g. 500mg"
                value={reminderForm.dosage}
                onChange={(e) => setReminderForm((f) => ({ ...f, dosage: e.target.value }))}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="frequency" className="field-label">Frequency</label>
              <input
                id="frequency"
                required
                placeholder="e.g. Twice daily"
                value={reminderForm.frequency}
                onChange={(e) => setReminderForm((f) => ({ ...f, frequency: e.target.value }))}
                className="field-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label htmlFor="startDate" className="field-label">Start date</label>
              <input
                id="startDate"
                type="date"
                required
                value={reminderForm.start_date}
                onChange={(e) => setReminderForm((f) => ({ ...f, start_date: e.target.value }))}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="field-label">End date (optional)</label>
              <input
                id="endDate"
                type="date"
                value={reminderForm.end_date}
                onChange={(e) => setReminderForm((f) => ({ ...f, end_date: e.target.value }))}
                className="field-input"
              />
            </div>
          </div>
          <div className="mb-6">
            <label htmlFor="reminderTime" className="field-label">Reminder time</label>
            <input
              id="reminderTime"
              type="time"
              required
              value={reminderForm.reminder_time}
              onChange={(e) => setReminderForm((f) => ({ ...f, reminder_time: e.target.value }))}
              className="field-input"
            />
          </div>
          <button type="submit" disabled={reminderSubmitting} className="btn-primary w-full">
            {reminderSubmitting ? 'Saving…' : 'Save reminder'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
