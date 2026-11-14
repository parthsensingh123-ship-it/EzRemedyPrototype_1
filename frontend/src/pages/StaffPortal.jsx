import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  appointmentsApi,
  recordsApi,
  adminApi,
  profileApi,
  parseMedicationsFromRecord
} from '../lib/api';
import AppointmentRow from '../components/AppointmentRow';
import RecordRow from '../components/RecordRow';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import ConsultationSuiteModal from '../components/ConsultationSuiteModal';

const TIMING_OPTIONS = [
  'Morning & Night (1-0-1)',
  'Morning, Afternoon & Night (1-1-1)',
  'Morning Only (1-0-0)',
  'Afternoon Only (0-1-0)',
  'Night / Bedtime Only (0-0-1)',
  'Morning & Afternoon (1-1-0)',
  'SOS (When required)'
];

const FREQUENCY_OPTIONS = [
  'Twice daily',
  'Thrice daily',
  'Once a day',
  'Every 6 hours',
  'Weekly once',
  'As needed (SOS)'
];

const DURATION_OPTIONS = [
  '3 days',
  '5 days',
  '7 days',
  '10 days',
  '14 days',
  '30 days'
];

const INSTRUCTION_OPTIONS = [
  'After meals (With water)',
  'Before meals (Empty stomach)',
  'Take with warm water',
  'Before sleep at night',
  'Avoid dairy / cold water'
];

const createEmptyMedRow = () => ({
  name: '',
  timing: 'Morning & Night (1-0-1)',
  frequency: 'Twice daily',
  duration: '5 days',
  instructions: 'After meals (With water)'
});

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

  // In-App PDF / Image Document Viewer Modal
  const [previewDoc, setPreviewDoc] = useState(null);

  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Enhanced Clinical Record, Vitals & Structured Medication Builder Modal
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [linkedAppointmentId, setLinkedAppointmentId] = useState(null);
  const [recordForm, setRecordForm] = useState({
    patient_id: '',
    diagnosis: '',
    notes: '',
    blood_pressure: '',
    heart_rate: '',
    temperature: '',
    weight_kg: '',
    follow_up_date: ''
  });
  const [medRows, setMedRows] = useState([createEmptyMedRow()]);
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
        setNotice('New medical document or clinical record synced.');
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

  const openPatientDocument = async (rec) => {
    const patientId = rec.patient_id || rec.patient?.id;
    const signedUrl = await recordsApi.getSignedFileUrl(rec.file_url, patientId);
    if (!signedUrl) {
      setError('No file found inside this patient’s storage folder yet.');
      return;
    }
    setPreviewDoc({
      title: rec.diagnosis || rec.file_name || 'Patient Medical Document',
      fileName: rec.file_name || 'document',
      url: signedUrl
    });
  };

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
      notes: appointment.reason ? `Chief complaint: ${appointment.reason}` : '',
      blood_pressure: '120/80',
      heart_rate: '72',
      temperature: '98.6',
      weight_kg: '',
      follow_up_date: ''
    });
    setMedRows([createEmptyMedRow()]);
    setShowRecordForm(true);
  };

  const addMedRow = () => {
    setMedRows((prev) => [...prev, createEmptyMedRow()]);
  };

  const removeMedRow = (idx) => {
    setMedRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const updateMedRow = (idx, field, value) => {
    setMedRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, [field]: value };
        // Auto-sync frequency when timing slot changes
        if (field === 'timing') {
          if (value.includes('1-1-1')) updated.frequency = 'Thrice daily';
          else if (value.includes('1-0-1') || value.includes('1-1-0')) updated.frequency = 'Twice daily';
          else if (value.includes('1-0-0') || value.includes('0-1-0') || value.includes('0-0-1'))
            updated.frequency = 'Once a day';
          else if (value.includes('SOS')) updated.frequency = 'As needed (SOS)';
        }
        return updated;
      })
    );
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
    setError('');
    try {
      const validMeds = medRows
        .map((m) => ({ ...m, name: m.name.trim() }))
        .filter((m) => m.name.length > 0);

      // Build structured text summary for backwards-compatibility + parser fallback
      const formattedPrescriptionText =
        validMeds.length > 0
          ? validMeds
              .map(
                (m, idx) =>
                  `${idx + 1}. ${m.name} | ${m.timing} | ${m.frequency} | ${m.duration} | ${m.instructions}`
              )
              .join('\n')
          : null;

      const payload = {
        patient_id: recordForm.patient_id,
        diagnosis: recordForm.diagnosis,
        prescription: formattedPrescriptionText,
        medications: validMeds,
        notes: recordForm.notes || null,
        blood_pressure: recordForm.blood_pressure || undefined,
        heart_rate: recordForm.heart_rate ? Number(recordForm.heart_rate) : undefined,
        temperature: recordForm.temperature ? Number(recordForm.temperature) : undefined,
        weight_kg: recordForm.weight_kg ? Number(recordForm.weight_kg) : undefined,
        follow_up_date: recordForm.follow_up_date || undefined
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
        notes: '',
        blood_pressure: '',
        heart_rate: '',
        temperature: '',
        weight_kg: '',
        follow_up_date: ''
      });
      setMedRows([createEmptyMedRow()]);
      setNotice('Digital e-prescription & medication schedule published to patient portal.');
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
        <div role="alert" className="mb-6 border border-status-cancelled text-status-cancelled bg-status-cancelledBg rounded px-4 py-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline ml-4">Dismiss</button>
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
                <p className="text-sm text-muted">Diagnoses, vitals, patient uploads, and structured e-prescriptions on file.</p>
                <button
                  onClick={() => {
                    setLinkedAppointmentId(null);
                    setMedRows([createEmptyMedRow()]);
                    setShowRecordForm(true);
                  }}
                  className="btn-primary text-sm"
                >
                  + Write Clinical Note & E-Prescription
                </button>
              </div>
              <div className="panel px-6">
                {records.length === 0 ? (
                  <p className="text-sm text-muted py-6">No records yet.</p>
                ) : (
                  records.map((rec) => {
                    const parsedMeds = parseMedicationsFromRecord(rec);
                    return (
                      <div key={rec.id} className="border-b border-hairline last:border-b-0 pb-4">
                        <RecordRow record={rec} viewerRole={profile.role} />

                        {/* Structured Medication Schedule Table on Doctor View */}
                        {parsedMeds.length > 0 && (
                          <div className="mt-2 mb-3 bg-paper border border-hairline rounded overflow-hidden">
                            <div className="px-3 py-1.5 bg-panel border-b border-hairline text-[11px] font-semibold uppercase tracking-wider text-muted">
                              ℞ Prescribed Medication Schedule ({parsedMeds.length})
                            </div>
                            <div className="divide-y divide-hairline">
                              {parsedMeds.map((m, idx) => (
                                <div
                                  key={idx}
                                  className="px-3 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                                >
                                  <div>
                                    <span className="font-semibold text-ink">{m.name}</span>
                                    <span className="text-muted ml-2">· {m.instructions}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2 py-0.5 rounded bg-panel border border-hairline text-ink font-medium">
                                      {m.timing}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-status-approvedBg text-status-approved font-medium">
                                      {m.frequency}
                                    </span>
                                    <span className="text-muted font-medium">for {m.duration}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(rec.file_url || rec.record_type === 'patient_upload' || rec.notes?.includes('Uploaded by patient')) && (
                          <div className="pb-1 flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => openPatientDocument(rec)}
                              className="btn-primary text-xs py-1 px-3"
                            >
                              View Uploaded Document ({rec.file_name || rec.diagnosis || 'File'})
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

      {/* Inspect Patient's Uploaded Documents & Medical Records Modal */}
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
                      <button
                        type="button"
                        onClick={() => openPatientDocument(rec)}
                        className="btn-primary text-xs py-1 px-2.5 shrink-0"
                      >
                        View Document
                      </button>
                    </div>
                    {rec.prescription && (
                      <p className="text-ink mt-1.5 bg-panel p-2 rounded whitespace-pre-line">Rx: {rec.prescription}</p>
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

      {/* In-App PDF / Image Document Viewer Modal */}
      <Modal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || 'Patient Medical Document'}
      >
        {previewDoc && (
          <div>
            <div className="w-full h-96 border border-hairline rounded overflow-hidden bg-paper mb-4">
              <iframe
                title={previewDoc.title}
                src={previewDoc.url}
                className="w-full h-full border-0"
              />
            </div>
            <div className="flex gap-3">
              <a
                href={previewDoc.url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex-1 text-center text-xs"
              >
                Open Full Screen / Download ↗
              </a>
              <button onClick={() => setPreviewDoc(null)} className="btn-secondary text-xs">
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

      {/* Digital Prescription & Medication Schedule Builder Modal */}
      <Modal
        open={showRecordForm}
        onClose={() => setShowRecordForm(false)}
        title="Digital E-Prescription & Medication Schedule Builder"
      >
        <form onSubmit={submitRecord} className="max-h-[78vh] overflow-y-auto pr-1">
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label htmlFor="patientSelect" className="field-label">Patient</label>
              <select
                id="patientSelect"
                required
                value={recordForm.patient_id}
                onChange={(e) => setRecordForm((f) => ({ ...f, patient_id: e.target.value }))}
                className="field-input text-xs"
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
            <div>
              <label htmlFor="diagnosis" className="field-label">Primary Diagnosis</label>
              <input
                id="diagnosis"
                required
                placeholder="e.g. Acute Viral Pharyngitis"
                value={recordForm.diagnosis}
                onChange={(e) => setRecordForm((f) => ({ ...f, diagnosis: e.target.value }))}
                className="field-input text-xs"
              />
            </div>
          </div>

          {/* Patient Vitals Row */}
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

          {/* Dynamic Multi-Row Medication Schedule Builder */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="field-label mb-0">℞ Prescribed Medicines & Dosage Schedule</label>
              <button
                type="button"
                onClick={addMedRow}
                className="text-xs font-semibold text-accent hover:underline"
              >
                + Add Another Medicine
              </button>
            </div>

            <div className="space-y-3">
              {medRows.map((med, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded border border-hairline bg-paper space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Medicine #{idx + 1}
                    </span>
                    {medRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMedRow(idx)}
                        className="text-xs text-status-cancelled hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      required={idx === 0}
                      placeholder="Medicine Name & Strength (e.g. Tab. Paracetamol 650mg, Cap. Amoxicillin 500mg)"
                      value={med.name}
                      onChange={(e) => updateMedRow(idx, 'name', e.target.value)}
                      className="field-input text-xs"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Dosage / Timing Slot</label>
                      <select
                        value={med.timing}
                        onChange={(e) => updateMedRow(idx, 'timing', e.target.value)}
                        className="field-input text-xs py-1.5"
                      >
                        {TIMING_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-1">Frequency</label>
                      <select
                        value={med.frequency}
                        onChange={(e) => updateMedRow(idx, 'frequency', e.target.value)}
                        className="field-input text-xs py-1.5"
                      >
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted mb-1">Duration / Days</label>
                      <select
                        value={med.duration}
                        onChange={(e) => updateMedRow(idx, 'duration', e.target.value)}
                        className="field-input text-xs py-1.5"
                      >
                        {DURATION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted mb-1">Meal / Special Instructions</label>
                      <select
                        value={med.instructions}
                        onChange={(e) => updateMedRow(idx, 'instructions', e.target.value)}
                        className="field-input text-xs py-1.5"
                      >
                        {INSTRUCTION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <div className="sm:col-span-2">
              <label htmlFor="recordNotes" className="field-label">Clinical notes & dietary advice</label>
              <textarea
                id="recordNotes"
                rows={2}
                placeholder="Drink plenty of warm fluids, rest for 48 hours…"
                value={recordForm.notes}
                onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                className="field-input resize-none text-xs"
              />
            </div>
            <div>
              <label htmlFor="followUpDate" className="field-label">Follow-up date</label>
              <input
                id="followUpDate"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={recordForm.follow_up_date}
                onChange={(e) => setRecordForm((f) => ({ ...f, follow_up_date: e.target.value }))}
                className="field-input text-xs"
              />
            </div>
          </div>

          <button type="submit" disabled={recordSubmitting} className="btn-primary w-full">
            {recordSubmitting
              ? 'Publishing E-Prescription…'
              : linkedAppointmentId
              ? 'Publish E-Prescription & Complete Appointment'
              : 'Save Clinical Record & E-Prescription'}
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
