import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  doctorsApi,
  appointmentsApi,
  recordsApi,
  remindersApi,
  profileApi,
  parseMedicationsFromRecord
} from '../lib/api';
import DoctorCard from '../components/DoctorCard';
import AppointmentRow from '../components/AppointmentRow';
import RecordRow from '../components/RecordRow';
import ReminderRow from '../components/ReminderRow';
import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import ConsultationSuiteModal from '../components/ConsultationSuiteModal';

const TABS = [
  { id: 'book', label: 'Find a doctor' },
  { id: 'appointments', label: 'My appointments' },
  { id: 'records', label: 'Medical records & Rx' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'profile', label: 'My profile' }
];

const TIME_SLOTS = [
  '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00', '16:00', '16:30', '17:00'
];

export default function PatientDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('book');

  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [records, setRecords] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Search & Filter states for Find a Doctor
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');

  // Booking Modal states
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('10:00');
  const [consultationType, setConsultationType] = useState('in_person');
  const [bookingReason, setBookingReason] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Consultation Suite Modal (Live Chat, Video Call & Billing Receipt)
  const [suiteModal, setSuiteModal] = useState({ appointment: null, tab: 'chat' });

  // Printable Prescription Modal
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  // Upload Medical Document Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadAppointmentId, setUploadAppointmentId] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Reminder Modal states
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

  // Profile Update states
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    bio: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        bio: profile.bio || ''
      });
    }
  }, [profile]);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live Supabase Realtime Subscription for instant status & prescription updates
  useEffect(() => {
    if (!profile?.id) return undefined;

    const channel = supabase
      .channel(`patient-live-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `patient_id=eq.${profile.id}` },
        () => {
          loadAll(true);
          setNotice('Live update: Your appointment status was updated by the clinic.');
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medical_records', filter: `patient_id=eq.${profile.id}` },
        () => {
          loadAll(true);
          setNotice('New digital e-prescription added by your doctor!');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadAll]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const specializations = useMemo(() => {
    const specs = new Set(
      doctors.map((d) => d.specialization || 'General Practice').filter(Boolean)
    );
    return ['all', ...Array.from(specs)];
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchesSearch =
        doc.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.bio?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpec =
        selectedSpecialty === 'all' ||
        (doc.specialization || 'General Practice') === selectedSpecialty;
      return matchesSearch && matchesSpec;
    });
  }, [doctors, searchQuery, selectedSpecialty]);

  const stats = useMemo(() => {
    const upcoming = appointments.filter(
      (a) => ['pending', 'approved', 'rescheduled'].includes(a.status) && new Date(a.appointment_date) >= new Date()
    ).length;
    const activeMeds = reminders.filter((r) => r.active).length;
    return {
      upcoming,
      totalRecords: records.length,
      activeMeds
    };
  }, [appointments, records, reminders]);

  const openBooking = (doctor) => {
    setBookingDoctor(doctor);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setSelectedDay(tomorrow);
    setSelectedSlot('10:00');
    setConsultationType('in_person');
    setBookingReason('');
  };

  const submitBooking = async (e) => {
    e.preventDefault();
    if (!selectedDay || !selectedSlot) return;
    setBookingSubmitting(true);
    setError('');
    try {
      const combinedIso = new Date(`${selectedDay}T${selectedSlot}:00`).toISOString();
      const created = await appointmentsApi.create({
        doctor_id: bookingDoctor.id,
        appointment_date: combinedIso,
        consultation_type: consultationType,
        reason: bookingReason
          ? `[${consultationType === 'video' ? 'Video Consult' : 'In-Clinic'}] ${bookingReason}`
          : `[${consultationType === 'video' ? 'Video Consult' : 'In-Clinic'} Consultation]`
      });
      setAppointments((prev) =>
        [...prev, created].sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
      );
      setBookingDoctor(null);
      setNotice('Appointment requested! You will receive live updates once approved.');
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

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadingDoc(true);
    setError('');
    try {
      const selectedAppt = appointments.find((a) => a.id === uploadAppointmentId);
      const created = await recordsApi.uploadPatientDocument({
        file: uploadFile,
        title: uploadTitle || uploadFile.name,
        notes: uploadNotes,
        appointment_id: uploadAppointmentId || null,
        doctor_id: selectedAppt?.doctor_id || selectedAppt?.doctor?.id || null
      });
      setRecords((prev) => [created, ...prev]);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadNotes('');
      setUploadAppointmentId('');
      setNotice('Medical document uploaded! Your doctor can now view it in your appointment details.');
    } catch (err) {
      setError(err.message || 'Could not upload document.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const deleteUploadedDoc = async (recId) => {
    try {
      await recordsApi.remove(recId);
      setRecords((prev) => prev.filter((r) => r.id !== recId));
      setNotice('Uploaded document removed.');
    } catch (err) {
      setError(err.message || 'Could not delete document.');
    }
  };

  // Pre-fills the Reminder Modal from a specific prescribed medicine row
  const createReminderFromMedItem = (med, record) => {
    const daysMatch = med.duration?.match(/(\d+)/);
    const numDays = daysMatch ? parseInt(daysMatch[1], 10) : 5;
    const startObj = new Date();
    const endObj = new Date(startObj.getTime() + numDays * 86400000);

    let defaultTime = '09:00';
    if (med.timing?.includes('0-1-0')) defaultTime = '14:00';
    else if (med.timing?.includes('0-0-1')) defaultTime = '21:00';

    setReminderForm({
      medication_name: med.name,
      dosage: `${med.timing} (${med.instructions || 'After meals'})`,
      frequency: med.frequency || 'Twice daily',
      start_date: startObj.toISOString().split('T')[0],
      end_date: record?.follow_up_date || endObj.toISOString().split('T')[0],
      reminder_time: defaultTime
    });
    setShowReminderForm(true);
  };

  const createReminderFromPrescription = (record) => {
    const parsedMeds = parseMedicationsFromRecord(record);
    if (parsedMeds.length > 0) {
      createReminderFromMedItem(parsedMeds[0], record);
      return;
    }
    setReminderForm({
      medication_name: record.prescription || record.diagnosis || '',
      dosage: 'As prescribed',
      frequency: 'Twice daily (After meals)',
      start_date: new Date().toISOString().split('T')[0],
      end_date: record.follow_up_date || '',
      reminder_time: '09:00'
    });
    setShowReminderForm(true);
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
      setNotice('Medication reminder scheduled.');
      setActiveTab('reminders');
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

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await profileApi.update(profileForm);
      await refreshProfile();
      setNotice('Profile details updated.');
    } catch (err) {
      setError(err.message || 'Could not update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const printPrescription = () => {
    window.print();
  };

  return (
    <div className="max-w-content mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-status-approved animate-pulse" />
            <p className="text-sm text-faint">Patient health portal · Live sync active</p>
          </div>
          <h1 className="font-display text-3xl text-ink">
            Welcome{profile ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-panel border border-hairline rounded px-3.5 py-2 text-xs">
            <span className="text-muted block">Upcoming visits</span>
            <span className="font-display text-lg text-ink font-semibold">{stats.upcoming}</span>
          </div>
          <div className="bg-panel border border-hairline rounded px-3.5 py-2 text-xs">
            <span className="text-muted block">Medical records</span>
            <span className="font-display text-lg text-ink font-semibold">{stats.totalRecords}</span>
          </div>
          <div className="bg-panel border border-hairline rounded px-3.5 py-2 text-xs">
            <span className="text-muted block">Active meds</span>
            <span className="font-display text-lg text-ink font-semibold">{stats.activeMeds}</span>
          </div>
        </div>
      </div>

      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 border border-status-approved text-status-approved bg-status-approvedBg rounded px-4 py-3 text-sm flex items-center justify-between"
        >
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs underline ml-4">Dismiss</button>
        </motion.div>
      )}
      {error && (
        <div role="alert" className="mb-6 border border-status-cancelled text-status-cancelled bg-status-cancelledBg rounded px-4 py-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs underline ml-4">Dismiss</button>
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
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Search doctors by name, specialty, or condition…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="field-input flex-1"
                />
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="field-input sm:w-64"
                >
                  {specializations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec === 'all' ? 'All specializations' : spec}
                    </option>
                  ))}
                </select>
              </div>

              {filteredDoctors.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center panel">
                  No doctors match your search filter. Try clearing the search bar.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredDoctors.map((doc) => (
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
                  <div key={appt.id} className="border-b border-hairline last:border-b-0">
                    <AppointmentRow
                      appointment={appt}
                      viewerRole="patient"
                      onCancel={cancelAppointment}
                    />
                    {appt.status !== 'cancelled' && (
                      <div className="pb-4 flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => setSuiteModal({ appointment: appt, tab: 'chat' })}
                          className="btn-secondary text-xs py-1 px-2.5"
                        >
                          Chat with Doctor
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
                        <button
                          onClick={() => {
                            setUploadAppointmentId(appt.id);
                            setShowUploadModal(true);
                          }}
                          className="text-xs font-medium text-accent hover:underline ml-1"
                        >
                          + Attach Lab Report
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <p className="text-sm text-muted">
                  Your doctor e-prescriptions, itemized medication schedules, and uploaded lab reports.
                </p>
                <button
                  onClick={() => {
                    setUploadAppointmentId('');
                    setShowUploadModal(true);
                  }}
                  className="btn-primary text-sm"
                >
                  + Upload Medical Document (PDF / Image)
                </button>
              </div>

              <div className="panel px-6">
                {records.length === 0 ? (
                  <p className="text-sm text-muted py-6">
                    No records yet. Upload past lab reports or prescriptions above so your doctor can review them before your visit.
                  </p>
                ) : (
                  records.map((rec) => {
                    const parsedMeds = parseMedicationsFromRecord(rec);

                    return (
                      <div key={rec.id} className="border-b border-hairline last:border-b-0 pb-4">
                        <RecordRow record={rec} viewerRole="patient" />

                        {/* Itemized Medication Schedule Table for Patient */}
                        {parsedMeds.length > 0 && (
                          <div className="mt-2 mb-3 bg-paper border border-hairline rounded overflow-hidden">
                            <div className="px-3.5 py-2 bg-panel border-b border-hairline flex items-center justify-between">
                              <span className="text-xs font-semibold text-ink">
                                ℞ Prescribed Medicines & Dosage Timings ({parsedMeds.length})
                              </span>
                              <span className="text-[11px] text-muted">
                                Click "+ Set reminder" to add to your daily pill tracker
                              </span>
                            </div>
                            <div className="divide-y divide-hairline">
                              {parsedMeds.map((med, idx) => (
                                <div
                                  key={idx}
                                  className="px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <div>
                                    <p className="font-semibold text-ink text-sm">{med.name}</p>
                                    <p className="text-muted mt-0.5">
                                      Instruction: <strong className="text-ink">{med.instructions}</strong> · Duration:{' '}
                                      <strong className="text-ink">{med.duration}</strong>
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2.5 py-1 rounded bg-panel border border-hairline text-ink font-medium">
                                      {med.timing}
                                    </span>
                                    <span className="px-2.5 py-1 rounded bg-status-approvedBg text-status-approved font-medium">
                                      {med.frequency}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => createReminderFromMedItem(med, rec)}
                                      className="btn-secondary text-xs py-1 px-2.5 border-accent text-accent font-medium"
                                    >
                                      + Set pill reminder
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            {rec.record_type === 'patient_upload' && (
                              <span className="px-2 py-0.5 bg-status-pendingBg text-status-pending border border-hairline rounded font-medium">
                                Patient Uploaded File
                              </span>
                            )}
                            {rec.blood_pressure && (
                              <span className="px-2 py-0.5 bg-paper border border-hairline rounded">
                                BP: {rec.blood_pressure}
                              </span>
                            )}
                            {rec.heart_rate && (
                              <span className="px-2 py-0.5 bg-paper border border-hairline rounded">
                                HR: {rec.heart_rate} bpm
                              </span>
                            )}
                            {rec.temperature && (
                              <span className="px-2 py-0.5 bg-paper border border-hairline rounded">
                                Temp: {rec.temperature} °F
                              </span>
                            )}
                            {rec.weight_kg && (
                              <span className="px-2 py-0.5 bg-paper border border-hairline rounded">
                                Weight: {rec.weight_kg} kg
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5">
                            {rec.file_url && (
                              <a
                                href={rec.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-primary text-xs py-1 px-2.5"
                              >
                                View Uploaded File ({rec.file_name || 'Document'}) ↗
                              </a>
                            )}
                            {rec.prescription && parsedMeds.length === 0 && (
                              <button
                                onClick={() => createReminderFromPrescription(rec)}
                                className="text-xs text-accent hover:underline font-medium"
                              >
                                + Set pill reminder
                              </button>
                            )}
                            {rec.record_type !== 'patient_upload' && (
                              <button
                                onClick={() => setSelectedPrescription(rec)}
                                className="btn-secondary text-xs py-1 px-2.5"
                              >
                                View / Print Official E-Prescription
                              </button>
                            )}
                            {rec.record_type === 'patient_upload' && (
                              <button
                                onClick={() => deleteUploadedDoc(rec.id)}
                                className="text-xs text-status-cancelled hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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

          {activeTab === 'profile' && (
            <div className="panel p-6 max-w-xl">
              <h2 className="font-display text-xl text-ink mb-4">Patient profile & contact details</h2>
              <form onSubmit={saveProfile}>
                <div className="mb-4">
                  <label className="field-label" htmlFor="profName">Full name</label>
                  <input
                    id="profName"
                    required
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, full_name: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div className="mb-4">
                  <label className="field-label" htmlFor="profPhone">Phone number</label>
                  <input
                    id="profPhone"
                    placeholder="+91 98765 43210"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                    className="field-input"
                  />
                </div>
                <div className="mb-6">
                  <label className="field-label" htmlFor="profBio">Allergies, blood group & medical history notes</label>
                  <textarea
                    id="profBio"
                    rows={3}
                    placeholder="e.g. Blood Group O+, No known drug allergies"
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                    className="field-input resize-none"
                  />
                </div>
                <button type="submit" disabled={profileSaving} className="btn-primary">
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* Upload Medical Document Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Medical Document / Lab Report"
      >
        <form onSubmit={handleDocumentUpload}>
          <div className="mb-4">
            <label className="field-label" htmlFor="docTitle">Document title</label>
            <input
              id="docTitle"
              required
              placeholder="e.g. Complete Blood Count (CBC) Report, Chest X-Ray"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="field-input"
            />
          </div>

          <div className="mb-4">
            <label className="field-label" htmlFor="docAppt">Link to appointment (optional)</label>
            <select
              id="docAppt"
              value={uploadAppointmentId}
              onChange={(e) => setUploadAppointmentId(e.target.value)}
              className="field-input"
            >
              <option value="">General medical file (visible to your doctors)</option>
              {appointments
                .filter((a) => a.status !== 'cancelled')
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    Dr. {a.doctor?.full_name} · {new Date(a.appointment_date).toLocaleDateString('en-IN')} ({a.status})
                  </option>
                ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="field-label" htmlFor="docFile">Select PDF, JPG, or PNG file</label>
            <input
              id="docFile"
              type="file"
              required
              accept=".pdf,image/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="field-input py-2"
            />
          </div>

          <div className="mb-6">
            <label className="field-label" htmlFor="docNotes">Notes for the doctor (optional)</label>
            <textarea
              id="docNotes"
              rows={2}
              placeholder="e.g. Lab test done yesterday morning fasting"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              className="field-input resize-none"
            />
          </div>

          <button type="submit" disabled={uploadingDoc || !uploadFile} className="btn-primary w-full">
            {uploadingDoc ? 'Uploading to secure vault…' : 'Upload & Share with Doctor'}
          </button>
        </form>
      </Modal>

      {/* Enhanced Clinical Slot Booking Modal */}
      <Modal open={Boolean(bookingDoctor)} onClose={() => setBookingDoctor(null)} title="Book appointment">
        {bookingDoctor && (
          <form onSubmit={submitBooking}>
            <div className="bg-panel border border-hairline rounded p-3 mb-5">
              <p className="text-sm font-medium text-ink">Dr. {bookingDoctor.full_name}</p>
              <p className="text-xs text-muted">
                {bookingDoctor.specialization || 'General Practice'} · Consultation Fee: ₹{bookingDoctor.consultation_fee || 500}
              </p>
            </div>

            <div className="mb-4">
              <label className="field-label">Consultation mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConsultationType('in_person')}
                  className={`py-2 px-3 text-xs font-medium rounded border text-center transition-colors ${
                    consultationType === 'in_person'
                      ? 'bg-accent text-paper border-accent'
                      : 'bg-paper text-ink border-hairline'
                  }`}
                >
                  In-Clinic Visit
                </button>
                <button
                  type="button"
                  onClick={() => setConsultationType('video')}
                  className={`py-2 px-3 text-xs font-medium rounded border text-center transition-colors ${
                    consultationType === 'video'
                      ? 'bg-accent text-paper border-accent'
                      : 'bg-paper text-ink border-hairline'
                  }`}
                >
                  Video Teleconsultation
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="bookingDay" className="field-label">Select date</label>
              <input
                id="bookingDay"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="field-input"
              />
            </div>

            <div className="mb-5">
              <label className="field-label">Available time slots</label>
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-1.5 text-xs rounded border transition-colors ${
                      selectedSlot === slot
                        ? 'bg-accent text-paper border-accent font-medium'
                        : 'bg-paper text-ink border-hairline hover:border-accent'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="bookingReason" className="field-label">Symptoms / reason for visit</label>
              <textarea
                id="bookingReason"
                rows={3}
                placeholder="Briefly describe your symptoms, duration, or questions…"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                className="field-input resize-none"
              />
            </div>
            <button type="submit" disabled={bookingSubmitting} className="btn-primary w-full">
              {bookingSubmitting ? 'Requesting slot…' : `Confirm booking (${selectedSlot})`}
            </button>
          </form>
        )}
      </Modal>

      {/* Printable Official E-Prescription Modal with Itemized Table */}
      <Modal
        open={Boolean(selectedPrescription)}
        onClose={() => setSelectedPrescription(null)}
        title="Official Digital E-Prescription"
      >
        {selectedPrescription && (
          <div>
            <div className="border border-hairline bg-paper p-5 rounded mb-5">
              <div className="flex justify-between items-start border-b border-hairline pb-3 mb-4">
                <div>
                  <h3 className="font-display text-lg text-ink font-semibold">EzRemedy Healthcare Clinic</h3>
                  <p className="text-xs text-muted">
                    Dr. {selectedPrescription.doctor?.full_name || 'Attending Physician'} ·{' '}
                    {selectedPrescription.doctor?.specialization || 'General Medicine'}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>Date: {new Date(selectedPrescription.created_at).toLocaleDateString('en-IN')}</p>
                  <p>Rx ID: #{selectedPrescription.id?.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div className="mb-4 text-xs text-muted">
                <p><strong className="text-ink">Patient:</strong> {profile?.full_name}</p>
                {(selectedPrescription.blood_pressure || selectedPrescription.temperature || selectedPrescription.weight_kg) && (
                  <p className="mt-1">
                    <strong className="text-ink">Recorded Vitals:</strong>{' '}
                    {selectedPrescription.blood_pressure ? `BP ${selectedPrescription.blood_pressure} ` : ''}
                    {selectedPrescription.heart_rate ? `| HR ${selectedPrescription.heart_rate} bpm ` : ''}
                    {selectedPrescription.temperature ? `| Temp ${selectedPrescription.temperature}°F ` : ''}
                    {selectedPrescription.weight_kg ? `| Weight ${selectedPrescription.weight_kg}kg` : ''}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider text-faint mb-1">Diagnosis</p>
                <p className="text-sm font-medium text-ink">{selectedPrescription.diagnosis}</p>
              </div>

              <div className="mb-4">
                <p className="text-xs uppercase tracking-wider text-faint mb-2">℞ Prescribed Medication Schedule</p>
                {parseMedicationsFromRecord(selectedPrescription).length > 0 ? (
                  <div className="border border-hairline rounded overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-panel border-b border-hairline text-muted">
                        <tr>
                          <th className="py-2 px-2.5">Medicine</th>
                          <th className="py-2 px-2.5">Timing</th>
                          <th className="py-2 px-2.5">Frequency</th>
                          <th className="py-2 px-2.5">Duration</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {parseMedicationsFromRecord(selectedPrescription).map((m, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-2.5 font-medium text-ink">
                              {m.name}
                              <span className="block text-[11px] text-muted font-normal">{m.instructions}</span>
                            </td>
                            <td className="py-2 px-2.5 text-ink">{m.timing}</td>
                            <td className="py-2 px-2.5 text-ink">{m.frequency}</td>
                            <td className="py-2 px-2.5 text-ink">{m.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-ink whitespace-pre-line bg-panel p-3 rounded border border-hairline">
                    {selectedPrescription.prescription || 'General supportive care advised.'}
                  </p>
                )}
              </div>

              {selectedPrescription.notes && (
                <div className="mb-2">
                  <p className="text-xs uppercase tracking-wider text-faint mb-1">Clinical Advice & Instructions</p>
                  <p className="text-xs text-muted whitespace-pre-line">{selectedPrescription.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={printPrescription} className="btn-primary flex-1">
                Print / Save as PDF
              </button>
              <button onClick={() => setSelectedPrescription(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
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
              <label htmlFor="dosage" className="field-label">Dosage & timing</label>
              <input
                id="dosage"
                required
                placeholder="e.g. Morning & Night (1-0-1)"
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
            <label htmlFor="reminderTime" className="field-label">Reminder alarm time</label>
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

      <ConsultationSuiteModal
        appointment={suiteModal.appointment}
        currentUser={profile}
        initialTab={suiteModal.tab}
        onClose={() => setSuiteModal({ appointment: null, tab: 'chat' })}
      />
    </div>
  );
}
