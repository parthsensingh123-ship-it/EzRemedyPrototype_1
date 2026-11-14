import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { appointmentsApi, recordsApi, adminApi, profileApi } from '../lib/api';
import AppointmentRow from '../components/AppointmentRow';
import RecordRow from '../components/RecordRow';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import ConsultationSuiteModal from '../components/ConsultationSuiteModal';

export default function StaffPortal() {
  const { profile, refreshProfile } = useAuth();
  const isAdmin = profile && profile.role === 'admin';

  const tabs = useMemo(
    () => [
      ...(isAdmin ? [{ id: 'overview', label: 'Resource overview' }] : []),
      { id: 'appointments', label: 'Appointments queue' },
      { id: 'records', label: 'Patient records & Rx' },
      { id: 'settings', label: 'Clinic profile' }
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

  // Queue filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Consultation Suite Modal (Live Chat, Video Call & Billing Receipt)
  const [suiteModal, setSuiteModal] = useState({ appointment: null, tab: 'chat' });

  // Patient Medical Documents & History Drawer Modal (triggered from any Appointment row)
  const [inspectAppt, setInspectAppt] = useState(null);

  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Enhanced Clinical Record & Vitals Modal
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [linkedAppointmentId, setLinkedAppointmentId] = useState(null);
  const [recordForm, setRecordForm] = useState({
    patient_id: '',
    diagnosis: '',
    prescription: '',
    notes: '',
    blood_pressure: '',
    heart_rate: '',
    temperature: '',
    weight_kg: ''
  });
  const [recordSubmitting, setRecordSubmitting] = useState(false);

  // Doctor Profile Settings
  const [docSettings, setDocSettings] = useState({
    full_name: '',
    specialization: '',
    phone: '',
    bio: '',
    years_experience: 5,
    consultation_fee: 500
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (profile) {
      setDocSettings({
        full_name: profile.full_name || '',
        specialization: profile.specialization || 'General Practice',
        phone: profile.phone || '',
        bio: profile.bio || '',
        years_experience: profile.years_experience || 5,
        consultation_fee: profile.consultation_fee || 500
      });
    }
  }, [profile]);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
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
        if (!silent) setLoading(false);
      }
    },
    [isAdmin]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live Supabase Realtime listener for new incoming bookings & patient document uploads
  useEffect(() => {
    if (!profile?.id) return undefined;

    const channel = supabase
      .channel('staff-live-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadAll(true);
        setNotice('Live queue updated: New appointment activity detected.');
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'medical_records' }, () => {
        loadAll(true);
        setNotice('New medical document or record uploaded.');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadAll]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
      const matchesSearch =
        !searchQuery ||
        appt.patient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appt.doctor?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        appt.reason?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [appointments, statusFilter, searchQuery]);

  // Records belonging to the patient whose appointment the doctor clicked to inspect
  const inspectedPatientRecords = useMemo(() => {
    if (!inspectAppt) return [];
    const targetPatientId = inspectAppt.patient_id || inspectAppt.patient?.id;
    return records.filter((r) => (r.patient_id || r.patient?.id) === targetPatientId);
  }, [inspectAppt, records]);

  const queueMetrics = useMemo(() => {
    return {
      pending: appointments.filter((a) => a.status === 'pending').length,
      approved: appointments.filter((a) => a.status === 'approved').length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      totalPatients: patients.length
    };
  }, [appointments, patients]);

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

  const startConsultationRx = (appointment) => {
    setLinkedAppointmentId(appointment.id);
    setRecordForm({
      patient_id: appointment.patient_id || appointment.patient?.id || '',
      diagnosis: '',
      prescription: '',
      notes: appointment.reason ? `Chief complaint: ${appointment.reason}` : '',
      blood_pressure: '120/80',
      heart_rate: '72',
      temperature: '98.6',
      weight_kg: ''
    });
    setShowRecordForm(true);
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
      const payload = {
        patient_id: recordForm.patient_id,
        diagnosis: recordForm.diagnosis,
        prescription: recordForm.prescription || null,
        notes: recordForm.notes || null,
        blood_pressure: recordForm.blood_pressure || undefined,
        heart_rate: recordForm.heart_rate ? Number(recordForm.heart_rate) : undefined,
        temperature: recordForm.temperature ? Number(recordForm.temperature) : undefined,
        weight_kg: recordForm.weight_kg ? Number(recordForm.weight_kg) : undefined
      };
      const created = await recordsApi.create(payload);
      setRecords((prev) => [created, ...prev]);

      if (linkedAppointmentId) {
        const updatedAppt = await appointmentsApi.update(linkedAppointmentId, { status: 'completed' });
        updateAppointmentInList(updatedAppt);
      }

      setShowRecordForm(false);
      setLinkedAppointmentId(null);
      setRecordForm({
        patient_id: '',
        diagnosis: '',
        prescription: '',
        notes: '',
        blood_pressure: '',
        heart_rate: '',
        temperature: '',
        weight_kg: ''
      });
      setNotice('Clinical record & e-prescription saved.');
    } catch (err) {
      setError(err.message || 'Could not save this record.');
    } finally {
      setRecordSubmitting(false);
    }
  };

  const saveDoctorSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await profileApi.update({
        full_name: docSettings.full_name,
        specialization: docSettings.specialization,
        phone: docSettings.phone,
        bio: docSettings.bio,
        years_experience: Number(docSettings.years_experience) || 5,
        consultation_fee: Number(docSettings.consultation_fee) || 500
      });
      await refreshProfile();
      setNotice('Doctor profile updated.');
    } catch (err) {
      setError(err.message || 'Could not update profile settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="max-w-content mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-status-approved animate-pulse" />
            <p className="text-sm text-faint">
              {isAdmin ? 'Administrator command center' : 'Doctor clinical workstation'} · Live queue
            </p>
          </div>
          <h1 className="font-display text-3xl text-ink">
            Welcome{profile ? `, Dr. ${profile.full_name.replace(/^Dr\.?\s*/i, '')}` : ''}
          </h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-status-pendingBg border border-hairline rounded px-3.5 py-2 text-xs">
            <span className="text-status-pending block">Pending requests</span>
            <span className="font-display text-lg text-ink font-semibold">{queueMetrics.pending}</span>
          </div>
          <div className="bg-status-approvedBg border border-hairline rounded px-3.5 py-2 text-xs">
            <span className="text-status-approved block">Approved today</span>
            <span className="font-display text-lg text-ink font-semibold">{queueMetrics.approved}</span>
          </div>
          <div className="bg-panel border border-hairline rounded px-3.5 py-2 text-xs">
            <span className="text-muted block">Completed</span>
            <span className="font-display text-lg text-ink font-semibold">{queueMetrics.completed}</span>
          </div>
        </div>
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
                <StatCard label="Pending requests" value={overview.status_counts?.pending || 0} delay={0.1} />
                <StatCard label="Approved" value={overview.status_counts?.approved || 0} delay={0.15} />
                <StatCard label="Completed" value={overview.status_counts?.completed || 0} delay={0.2} />
              </div>

              <h2 className="font-display text-xl text-ink mb-4">Load by doctor</h2>
              <div className="panel px-6">
                {!overview.doctor_load || overview.doctor_load.length === 0 ? (
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
            <div>
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                  type="text"
                  placeholder="Search queue by patient name or reason…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="field-input flex-1"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="field-input sm:w-52"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending approval</option>
                  <option value="approved">Approved</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="panel px-6">
                {filteredAppointments.length === 0 ? (
                  <p className="text-sm text-muted py-6">No appointments match the current filter.</p>
                ) : (
                  filteredAppointments.map((appt) => {
                    const patientId = appt.patient_id || appt.patient?.id;
                    const patientDocsCount = records.filter(
                      (r) => (r.patient_id || r.patient?.id) === patientId
                    ).length;

                    return (
                      <div key={appt.id} className="border-b border-hairline last:border-b-0">
                        <AppointmentRow
                          appointment={appt}
                          viewerRole={profile.role}
                          onCancel={cancelAppointment}
                          onApprove={approveAppointment}
                          onComplete={completeAppointment}
                          onReschedule={openReschedule}
                        />
                        {/* Quick Clinical, Patient Uploaded Files & Consultation Suite Actions */}
                        {appt.status !== 'cancelled' && (
                          <div className="pb-4 flex flex-wrap items-center gap-2.5">
                            <button
                              onClick={() => setInspectAppt(appt)}
                              className="btn-secondary text-xs py-1 px-2.5 border-accent text-accent font-medium"
                            >
                              Patient Records & Uploaded Files ({patientDocsCount})
                            </button>
                            <button
                              onClick={() => startConsultationRx(appt)}
                              className="btn-primary text-xs py-1 px-3"
                            >
                              + Write Clinical Note & Rx
                            </button>
                            <button
                              onClick={() => setSuiteModal({ appointment: appt, tab: 'chat' })}
                              className="btn-secondary text-xs py-1 px-2.5"
                            >
                              Chat with {appt.patient?.full_name?.split(' ')[0] || 'Patient'}
                            </button>
                            <button
                              onClick={() => setSuiteModal({ appointment: appt, tab: 'video' })}
                              className="btn-secondary text-xs py-1 px-2.5"
                            >
                              Video Call
                            </button>
                            <button
                              onClick={() => setSuiteModal({ appointment: appt, tab: 'receipt' })}
                              className="btn-secondary text-xs py-1 px-2.5"
                            >
                              Billing Receipt
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'records' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-muted">Diagnoses, vitals, patient uploads, and e-prescriptions on file.</p>
                <button
                  onClick={() => {
                    setLinkedAppointmentId(null);
                    setShowRecordForm(true);
                  }}
                  className="btn-secondary text-sm"
                >
                  Add clinical record
                </button>
              </div>
              <div className="panel px-6">
                {records.length === 0 ? (
                  <p className="text-sm text-muted py-6">No records yet.</p>
                ) : (
                  records.map((rec) => (
                    <div key={rec.id} className="border-b border-hairline last:border-b-0 pb-3">
                      <RecordRow record={rec} viewerRole={profile.role} />
                      {rec.file_url && (
                        <div className="pb-2">
                          <a
                            href={rec.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded bg-accent text-paper hover:bg-accent-dark"
                          >
                            Open Patient Attachment: {rec.file_name || 'Medical Document'} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="panel p-6 max-w-xl">
              <h2 className="font-display text-xl text-ink mb-4">Doctor & clinic profile</h2>
              <form onSubmit={saveDoctorSettings}>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="field-label">Full name</label>
                    <input
                      required
                      value={docSettings.full_name}
                      onChange={(e) => setDocSettings((s) => ({ ...s, full_name: e.target.value }))}
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">Specialization</label>
                    <input
                      required
                      placeholder="e.g. Cardiologist, Dermatologist"
                      value={docSettings.specialization}
                      onChange={(e) => setDocSettings((s) => ({ ...s, specialization: e.target.value }))}
                      className="field-input"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="field-label">Experience (yrs)</label>
                    <input
                      type="number"
                      min="0"
                      value={docSettings.years_experience}
                      onChange={(e) => setDocSettings((s) => ({ ...s, years_experience: e.target.value }))}
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">Consult Fee (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={docSettings.consultation_fee}
                      onChange={(e) => setDocSettings((s) => ({ ...s, consultation_fee: e.target.value }))}
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">Contact phone</label>
                    <input
                      value={docSettings.phone}
                      onChange={(e) => setDocSettings((s) => ({ ...s, phone: e.target.value }))}
                      className="field-input"
                    />
                  </div>
                </div>
                <div className="mb-6">
                  <label className="field-label">Professional bio & qualifications</label>
                  <textarea
                    rows={3}
                    placeholder="MBBS, MD · Fellowship details, languages spoken, and clinical focus…"
                    value={docSettings.bio}
                    onChange={(e) => setDocSettings((s) => ({ ...s, bio: e.target.value }))}
                    className="field-input resize-none"
                  />
                </div>
                <button type="submit" disabled={savingSettings} className="btn-primary">
                  {savingSettings ? 'Saving…' : 'Save clinic settings'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* Inspect Patient's Uploaded Documents & Medical Records Modal (Triggered from Appointments Queue) */}
      <Modal
        open={Boolean(inspectAppt)}
        onClose={() => setInspectAppt(null)}
        title={`Medical File · ${inspectAppt?.patient?.full_name || 'Patient'}`}
      >
        {inspectAppt && (
          <div>
            <div className="bg-panel border border-hairline rounded p-3 mb-4 text-xs">
              <p className="text-ink font-medium">
                Appointment: {new Date(inspectAppt.appointment_date).toLocaleString('en-IN')} ({inspectAppt.status})
              </p>
              {inspectAppt.reason && <p className="text-muted mt-1">Reason: {inspectAppt.reason}</p>}
            </div>

            {inspectedPatientRecords.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center border border-hairline rounded bg-paper mb-4">
                This patient has not uploaded any lab reports or documents yet.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3 mb-4">
                {inspectedPatientRecords.map((rec) => (
                  <div key={rec.id} className="border border-hairline bg-paper rounded p-3.5 text-xs">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="font-medium text-sm text-ink block">{rec.diagnosis}</span>
                        <span className="text-faint">
                          {new Date(rec.created_at).toLocaleDateString('en-IN')} ·{' '}
                          {rec.record_type === 'patient_upload' ? 'Uploaded by Patient' : 'Clinical Record'}
                        </span>
                      </div>
                      {rec.file_url && (
                        <a
                          href={rec.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-primary text-xs py-1 px-2.5 shrink-0"
                        >
                          View Document ↗
                        </a>
                      )}
                    </div>
                    {rec.prescription && (
                      <p className="text-ink mt-1.5 bg-panel p-2 rounded">Rx: {rec.prescription}</p>
                    )}
                    {rec.notes && <p className="text-muted mt-1">{rec.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const target = inspectAppt;
                  setInspectAppt(null);
                  startConsultationRx(target);
                }}
                className="btn-primary flex-1 text-xs"
              >
                + Write Clinical Note & Rx
              </button>
              <button onClick={() => setInspectAppt(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(rescheduleTarget)} onClose={() => setRescheduleTarget(null)} title="Reschedule appointment">
        {rescheduleTarget && (
          <form onSubmit={submitReschedule}>
            <p className="text-sm text-muted mb-5">
              {rescheduleTarget.patient?.full_name} with Dr. {rescheduleTarget.doctor?.full_name}
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

      <Modal
        open={showRecordForm}
        onClose={() => setShowRecordForm(false)}
        title="Add clinical record & e-prescription"
      >
        <form onSubmit={submitRecord}>
          <div className="mb-4">
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

          <div className="grid grid-cols-4 gap-2 mb-4">
            <div>
              <label className="field-label text-xs">BP (mmHg)</label>
              <input
                placeholder="120/80"
                value={recordForm.blood_pressure}
                onChange={(e) => setRecordForm((f) => ({ ...f, blood_pressure: e.target.value }))}
                className="field-input text-xs"
              />
            </div>
            <div>
              <label className="field-label text-xs">Pulse (bpm)</label>
              <input
                type="number"
                placeholder="72"
                value={recordForm.heart_rate}
                onChange={(e) => setRecordForm((f) => ({ ...f, heart_rate: e.target.value }))}
                className="field-input text-xs"
              />
            </div>
            <div>
              <label className="field-label text-xs">Temp (°F)</label>
              <input
                type="number"
                step="0.1"
                placeholder="98.6"
                value={recordForm.temperature}
                onChange={(e) => setRecordForm((f) => ({ ...f, temperature: e.target.value }))}
                className="field-input text-xs"
              />
            </div>
            <div>
              <label className="field-label text-xs">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder="70"
                value={recordForm.weight_kg}
                onChange={(e) => setRecordForm((f) => ({ ...f, weight_kg: e.target.value }))}
                className="field-input text-xs"
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="diagnosis" className="field-label">Diagnosis</label>
            <input
              id="diagnosis"
              required
              placeholder="e.g. Acute Viral Pharyngitis"
              value={recordForm.diagnosis}
              onChange={(e) => setRecordForm((f) => ({ ...f, diagnosis: e.target.value }))}
              className="field-input"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="prescription" className="field-label">℞ Prescription (Medications, Dosage & Duration)</label>
            <textarea
              id="prescription"
              rows={3}
              placeholder="1. Tab Paracetamol 650mg — 1-0-1 (After meals) x 3 days&#10;2. Warm saline gargles thrice daily"
              value={recordForm.prescription}
              onChange={(e) => setRecordForm((f) => ({ ...f, prescription: e.target.value }))}
              className="field-input resize-none"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="recordNotes" className="field-label">Clinical notes & follow-up instructions</label>
            <textarea
              id="recordNotes"
              rows={2}
              value={recordForm.notes}
              onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
              className="field-input resize-none"
            />
          </div>
          <button type="submit" disabled={recordSubmitting} className="btn-primary w-full">
            {recordSubmitting
              ? 'Saving…'
              : linkedAppointmentId
              ? 'Save Rx & Mark Appointment Completed'
              : 'Save clinical record'}
          </button>
        </form>
      </Modal>

      <ConsultationSuiteModal
        appointment={suiteModal.appointment}
        currentUser={profile}
        initialTab={suiteModal.tab}
        onClose={() => setSuiteModal({ appointment: null, tab: 'chat' })}
      />
    </div>
  );
}
