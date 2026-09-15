import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { appointmentsApi, recordsApi, adminApi } from '../lib/api';
import AppointmentRow from '../components/AppointmentRow';
import RecordRow from '../components/RecordRow';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';

export default function StaffPortal() {
  const { profile } = useAuth();
  const isAdmin = profile && profile.role === 'admin';

  const tabs = useMemo(
    () => [
      ...(isAdmin ? [{ id: 'overview', label: 'Resource overview' }] : []),
      { id: 'appointments', label: 'Appointments' },
      { id: 'records', label: 'Patient records' }
    ],
    [isAdmin]
  );

  const [activeTab, setActiveTab] = useState(isAdmin ? 'overview' : 'appointments');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [overview, setOverview] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);

  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState({
    patient_id: '',
    diagnosis: '',
    prescription: '',
    notes: ''
  });
  const [recordSubmitting, setRecordSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const calls = [appointmentsApi.list(), recordsApi.list(), adminApi.patients()];
      if (isAdmin) calls.push(adminApi.overview());
      const results = await Promise.all(calls);
      setAppointments(results[0]);
      setRecords(results[1]);
      setPatients(results[2]);
      if (isAdmin) setOverview(results[3]);
    } catch (err) {
      setError(err.message || 'Could not load the portal.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const updateAppointmentInList = (updated) => {
    setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const approveAppointment = async (appointment) => {
    try {
      const updated = await appointmentsApi.update(appointment.id, { status: 'approved' });
      updateAppointmentInList(updated);
      setNotice('Appointment approved.');
    } catch (err) {
      setError(err.message || 'Could not approve this appointment.');
    }
  };

  const completeAppointment = async (appointment) => {
    try {
      const updated = await appointmentsApi.update(appointment.id, { status: 'completed' });
      updateAppointmentInList(updated);
      setNotice('Appointment marked complete.');
    } catch (err) {
      setError(err.message || 'Could not update this appointment.');
    }
  };

  const cancelAppointment = async (appointment) => {
    try {
      const updated = await appointmentsApi.update(appointment.id, { status: 'cancelled' });
      updateAppointmentInList(updated);
      setNotice('Appointment cancelled.');
    } catch (err) {
      setError(err.message || 'Could not cancel this appointment.');
    }
  };

  const openReschedule = (appointment) => {
    setRescheduleTarget(appointment);
    setRescheduleDate('');
  };

  const submitReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleDate) return;
    setRescheduleSubmitting(true);
    try {
      const updated = await appointmentsApi.update(rescheduleTarget.id, {
        appointment_date: new Date(rescheduleDate).toISOString(),
        status: 'rescheduled'
      });
      updateAppointmentInList(updated);
      setRescheduleTarget(null);
      setNotice('Appointment rescheduled.');
    } catch (err) {
      setError(err.message || 'Could not reschedule this appointment.');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const submitRecord = async (e) => {
    e.preventDefault();
    setRecordSubmitting(true);
    try {
      const created = await recordsApi.create(recordForm);
      setRecords((prev) => [created, ...prev]);
      setShowRecordForm(false);
      setRecordForm({ patient_id: '', diagnosis: '', prescription: '', notes: '' });
      setNotice('Record added.');
    } catch (err) {
      setError(err.message || 'Could not save this record.');
    } finally {
      setRecordSubmitting(false);
    }
  };

  return (
    <div className="max-w-content mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-sm text-faint mb-1">{isAdmin ? 'Administrator portal' : 'Doctor portal'}</p>
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

      <div role="tablist" aria-label="Portal sections" className="flex flex-wrap gap-2 border-b border-hairline mb-8">
        {tabs.map((tab) => (
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
        <Spinner label="Loading the portal" />
      ) : (
        <>
          {activeTab === 'overview' && overview && (
            <div>
              <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
                <StatCard label="Total doctors" value={overview.total_doctors} delay={0} />
                <StatCard label="Total patients" value={overview.total_patients} delay={0.05} />
                <StatCard label="Pending requests" value={overview.status_counts.pending} delay={0.1} />
                <StatCard label="Approved" value={overview.status_counts.approved} delay={0.15} />
                <StatCard label="Completed" value={overview.status_counts.completed} delay={0.2} />
              </div>

              <h2 className="font-display text-xl text-ink mb-4">Load by doctor</h2>
              <div className="panel px-6">
                {overview.doctor_load.length === 0 ? (
                  <p className="text-sm text-muted py-6">No appointments recorded yet.</p>
                ) : (
                  overview.doctor_load.map((d) => (
                    <div
                      key={d.doctor_id}
                      className="flex items-center justify-between py-4 border-b border-hairline last:border-b-0"
                    >
                      <div>
                        <p className="text-[15px] text-ink font-medium">{d.full_name}</p>
                        <p className="text-sm text-muted">{d.specialization || 'General practice'}</p>
                      </div>
                      <p className="text-sm text-faint">{d.appointment_count} appointments</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="panel px-6">
              {appointments.length === 0 ? (
                <p className="text-sm text-muted py-6">No appointments in the system yet.</p>
              ) : (
                appointments.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appointment={appt}
                    viewerRole={profile.role}
                    onCancel={cancelAppointment}
                    onApprove={approveAppointment}
                    onComplete={completeAppointment}
                    onReschedule={openReschedule}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-muted">Diagnoses and prescriptions on file.</p>
                <button onClick={() => setShowRecordForm(true)} className="btn-secondary text-sm">
                  Add record
                </button>
              </div>
              <div className="panel px-6">
                {records.length === 0 ? (
                  <p className="text-sm text-muted py-6">No records yet.</p>
                ) : (
                  records.map((rec) => (
                    <RecordRow key={rec.id} record={rec} viewerRole={profile.role} />
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={Boolean(rescheduleTarget)} onClose={() => setRescheduleTarget(null)} title="Reschedule appointment">
        {rescheduleTarget && (
          <form onSubmit={submitReschedule}>
            <p className="text-sm text-muted mb-5">
              {rescheduleTarget.patient.full_name} with Dr. {rescheduleTarget.doctor.full_name}
            </p>
            <div className="mb-6">
              <label htmlFor="newDate" className="field-label">New date and time</label>
              <input
                id="newDate"
                type="datetime-local"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="field-input"
              />
            </div>
            <button type="submit" disabled={rescheduleSubmitting} className="btn-primary w-full">
              {rescheduleSubmitting ? 'Saving…' : 'Confirm new time'}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={showRecordForm} onClose={() => setShowRecordForm(false)} title="Add medical record">
        <form onSubmit={submitRecord}>
          <div className="mb-5">
            <label htmlFor="patientSelect" className="field-label">Patient</label>
            <select
              id="patientSelect"
              required
              value={recordForm.patient_id}
              onChange={(e) => setRecordForm((f) => ({ ...f, patient_id: e.target.value }))}
              className="field-input"
            >
              <option value="" disabled>
                Select a patient
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-5">
            <label htmlFor="diagnosis" className="field-label">Diagnosis</label>
            <input
              id="diagnosis"
              required
              value={recordForm.diagnosis}
              onChange={(e) => setRecordForm((f) => ({ ...f, diagnosis: e.target.value }))}
              className="field-input"
            />
          </div>
          <div className="mb-5">
            <label htmlFor="prescription" className="field-label">Prescription (optional)</label>
            <input
              id="prescription"
              value={recordForm.prescription}
              onChange={(e) => setRecordForm((f) => ({ ...f, prescription: e.target.value }))}
              className="field-input"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="recordNotes" className="field-label">Notes (optional)</label>
            <textarea
              id="recordNotes"
              rows={3}
              value={recordForm.notes}
              onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
              className="field-input resize-none"
            />
          </div>
          <button type="submit" disabled={recordSubmitting} className="btn-primary w-full">
            {recordSubmitting ? 'Saving…' : 'Save record'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
