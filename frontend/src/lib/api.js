import axios from 'axios';
import { supabase } from './supabaseClient';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL, timeout: 4000 });

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session ? data.session.access_token : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function withFallback(apiCall, supabaseFallback) {
  try {
    return await apiCall();
  } catch (err) {
    const isNetworkOrServerDown =
      !err.response ||
      err.code === 'ECONNABORTED' ||
      err.message?.includes('Network Error') ||
      err.response?.status >= 500 ||
      err.response?.status === 404;

    if (isNetworkOrServerDown && supabaseFallback) {
      return await supabaseFallback();
    }
    const message =
      err.response?.data?.error || err.message || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
}

export const TRIAGE_KNOWLEDGE_BASE = [
  {
    specialty: 'Cardiologist',
    urgency: 'High Priority · Cardiac Evaluation',
    urgencyColor: 'bg-status-cancelledBg text-status-cancelled border-status-cancelled',
    keywords: [
      'chest pain', 'chest tightness', 'palpitation', 'heart', 'blood pressure',
      'hypertension', 'bp', 'shortness of breath', 'breathless', 'cholesterol',
      'left arm pain', 'fast heartbeat', 'tachycardia', 'dizzy when standing'
    ],
    advice: 'Symptoms suggest cardiovascular or blood pressure involvement. A Cardiologist evaluation (including ECG/lipid screening) is recommended.'
  },
  {
    specialty: 'Neurologist',
    urgency: 'Moderate-High Priority · Neurological Consult',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'migraine', 'headache', 'blurred vision', 'seizure', 'numbness', 'tingling',
      'vertigo', 'dizziness', 'memory', 'tremor', 'nerve', 'paralysis', 'fainting',
      'blackout', 'head spinning', 'brain', 'sciatica'
    ],
    advice: 'Headaches paired with visual changes, dizziness, or nerve tingling warrant a specialist Neurological assessment.'
  },
  {
    specialty: 'Dermatologist',
    urgency: 'Routine Priority · Dermatology Care',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'acne', 'rash', 'itching', 'eczema', 'skin', 'hair loss', 'hairfall',
      'dandruff', 'pigmentation', 'pimple', 'psoriasis', 'fungal', 'allergy',
      'hives', 'mole', 'sunburn', 'dry skin'
    ],
    advice: 'Cutaneous, hair, or allergic skin symptoms are best diagnosed via targeted Dermatological inspection.'
  },
  {
    specialty: 'Orthopedic Surgeon',
    urgency: 'Moderate Priority · Musculoskeletal Care',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'knee pain', 'back pain', 'joint', 'fracture', 'sprain', 'ligament',
      'shoulder', 'arthritis', 'bone', 'neck pain', 'sports injury', 'muscle tear',
      'ankle', 'wrist', 'stiffness', 'slip disc', 'posture'
    ],
    advice: 'Joint, bone, spine, or ligament discomfort should be evaluated by an Orthopedic specialist for mobility and imaging.'
  },
  {
    specialty: 'Gastroenterologist',
    urgency: 'Moderate Priority · Digestive Health',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'stomach', 'acidity', 'acid reflux', 'heartburn', 'bloating', 'gas',
      'constipation', 'diarrhea', 'vomiting', 'nausea', 'liver', 'ibs',
      'indigestion', 'ulcer', 'abdominal pain', 'cramps', 'jaundice', 'fatty liver'
    ],
    advice: 'Persistent gastrointestinal, gastric reflux, or abdominal symptoms align with a Gastroenterologist consultation.'
  },
  {
    specialty: 'ENT Specialist',
    urgency: 'Routine-Moderate · Ear, Nose & Throat',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'ear pain', 'sore throat', 'tonsil', 'sinus', 'blocked nose', 'runny nose',
      'hearing', 'ringing in ear', 'tinnitus', 'snoring', 'voice', 'hoarse',
      'throat infection', 'difficulty swallowing', 'nasal'
    ],
    advice: 'Upper respiratory tract, sinus, ear, or throat complaints are directly managed by an ENT Specialist.'
  },
  {
    specialty: 'Psychiatrist',
    urgency: 'Supportive Care · Mental Health & Sleep',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'anxiety', 'stress', 'insomnia', 'sleep', 'depression', 'panic',
      'overthinking', 'mood', 'focus', 'adhd', 'burnout', 'restless', 'sadness',
      'mental health', 'nightmare'
    ],
    advice: 'Sleep disturbances, anxiety, or cognitive fatigue respond well to structured Psychiatric and behavioral care.'
  },
  {
    specialty: 'Gynecologist & OB-GYN',
    urgency: 'Routine-Moderate · Women’s Health',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'period', 'pcos', 'pcod', 'menstrual', 'pregnancy', 'prenatal',
      'irregular cycle', 'pelvic pain', 'hormonal', 'gynec', 'fertility'
    ],
    advice: 'Menstrual, hormonal, PCOS, or prenatal health inquiries are best addressed by a Gynecologist & OB-GYN.'
  },
  {
    specialty: 'Pediatrician',
    urgency: 'Moderate Priority · Child Healthcare',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'child', 'baby', 'infant', 'toddler', 'vaccination', 'immunization',
      'newborn', 'kid', 'growth', 'pediatric'
    ],
    advice: 'For infants, children, or vaccination schedules, a Pediatrician provides age-specific clinical care.'
  },
  {
    specialty: 'General Physician',
    urgency: 'Routine Priority · Primary Internal Medicine',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'fever', 'cold', 'cough', 'flu', 'viral', 'weakness', 'fatigue',
      'body ache', 'diabetes', 'sugar', 'thyroid', 'checkup', 'infection', 'chills'
    ],
    advice: 'Systemic symptoms like viral fever, cough, fatigue, or metabolic checkups should start with a General Physician.'
  }
];

export function parseMedicationsFromRecord(rec) {
  if (!rec) return [];
  if (Array.isArray(rec.medications) && rec.medications.length > 0) {
    return rec.medications;
  }
  if (!rec.prescription || typeof rec.prescription !== 'string') return [];

  const lines = rec.prescription
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed = [];
  for (const line of lines) {
    const clean = line.replace(/^\d+\.\s*/, '');
    if (clean.includes(' | ')) {
      const [name, timing, frequency, duration, instructions] = clean.split(' | ').map((s) => s.trim());
      if (name) {
        parsed.push({
          name,
          timing: timing || 'Morning & Night (1-0-1)',
          frequency: frequency || 'Twice daily',
          duration: duration || '5 days',
          instructions: instructions || 'After meals'
        });
      }
    }
  }
  return parsed;
}

export const triageApi = {
  analyze: (symptoms, availableSpecializations = []) =>
    withFallback(
      () => api.post('/triage', { symptoms }).then((r) => r.data.triage),
      async () => {
        const cleanText = String(symptoms || '').trim();
        const lower = cleanText.toLowerCase();
        let bestMatch = null;
        let highestScore = 0;
        let matchedKeywords = [];

        for (const rule of TRIAGE_KNOWLEDGE_BASE) {
          const hits = rule.keywords.filter((kw) => lower.includes(kw));
          if (hits.length > highestScore) {
            highestScore = hits.length;
            bestMatch = rule;
            matchedKeywords = hits;
          }
        }

        if (!bestMatch) {
          bestMatch =
            TRIAGE_KNOWLEDGE_BASE.find((r) => r.specialty === 'General Physician') ||
            TRIAGE_KNOWLEDGE_BASE[0];
          matchedKeywords = ['general symptom evaluation'];
        }

        const matchedDatabaseSpecialty =
          availableSpecializations.find(
            (s) =>
              s !== 'all' &&
              (s.toLowerCase() === bestMatch.specialty.toLowerCase() ||
                s.toLowerCase().includes(bestMatch.specialty.toLowerCase().split(' ')[0]) ||
                bestMatch.specialty.toLowerCase().includes(s.toLowerCase().split(' ')[0]))
          ) || 'all';

        const confidence = highestScore >= 2 ? 96 : highestScore === 1 ? 89 : 78;

        // Log triage check directly to Supabase `symptom_triage_logs` table
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        if (uid) {
          await supabase.from('symptom_triage_logs').insert({
            patient_id: uid,
            symptoms_text: cleanText,
            recommended_specialty: bestMatch.specialty,
            urgency: bestMatch.urgency,
            confidence,
            matched_keywords: matchedKeywords,
            advice: bestMatch.advice
          });
        }

        return {
          input: cleanText,
          recommendedSpecialty: bestMatch.specialty,
          matchedDatabaseSpecialty,
          urgency: bestMatch.urgency,
          urgencyColor: bestMatch.urgencyColor,
          advice: bestMatch.advice,
          matchedKeywords,
          confidence
        };
      }
    ),

  history: () =>
    withFallback(
      () => api.get('/triage/history').then((r) => r.data.logs),
      async () => {
        const { data, error } = await supabase
          .from('symptom_triage_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        if (error) return [];
        return data || [];
      }
    )
};

export const profileApi = {
  get: () =>
    withFallback(
      () => api.get('/profile').then((r) => r.data.profile),
      async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        if (!uid) return null;
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single();
        if (error) throw error;
        return data;
      }
    ),

  update: (payload) =>
    withFallback(
      () => api.patch('/profile', payload).then((r) => r.data.profile),
      async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        const { data, error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', uid)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    )
};

export const doctorsApi = {
  list: () =>
    withFallback(
      () => api.get('/doctors').then((r) => r.data.doctors),
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'doctor')
          .order('full_name', { ascending: true });
        if (error) throw error;
        return data || [];
      }
    ),

  get: (id) =>
    withFallback(
      () => api.get(`/doctors/${id}`).then((r) => r.data.doctor),
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .eq('role', 'doctor')
          .single();
        if (error) throw error;
        return data;
      }
    )
};

export const appointmentsApi = {
  list: (params = {}) =>
    withFallback(
      () => api.get('/appointments', { params }).then((r) => r.data.appointments),
      async () => {
        let query = supabase
          .from('appointments')
          .select(`
            *,
            patient:profiles!appointments_patient_id_fkey(id, full_name, phone),
            doctor:profiles!appointments_doctor_id_fkey(id, full_name, specialization, phone, consultation_fee, hospital_branch)
          `)
          .order('appointment_date', { ascending: true });

        if (params.status) query = query.eq('status', params.status);
        if (params.doctor_id) query = query.eq('doctor_id', params.doctor_id);
        if (params.patient_id) query = query.eq('patient_id', params.patient_id);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }
    ),

  get: (id) =>
    withFallback(
      () => api.get(`/appointments/${id}`).then((r) => r.data.appointment),
      async () => {
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            *,
            patient:profiles!appointments_patient_id_fkey(id, full_name, phone),
            doctor:profiles!appointments_doctor_id_fkey(id, full_name, specialization, phone, consultation_fee, hospital_branch)
          `)
          .eq('id', id)
          .single();
        if (error) throw error;
        return data;
      }
    ),

  create: (payload) =>
    withFallback(
      () => api.post('/appointments', payload).then((r) => r.data.appointment),
      async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        const meetingLink =
          payload.consultation_type === 'video'
            ? `https://meet.jit.si/EzRemedy-${uid?.slice(0, 6)}-${Date.now().toString().slice(-4)}`
            : null;

        const { data, error } = await supabase
          .from('appointments')
          .insert({
            patient_id: uid,
            doctor_id: payload.doctor_id,
            appointment_date: payload.appointment_date,
            reason: payload.reason || null,
            notes: payload.notes || null,
            consultation_type: payload.consultation_type || 'in_person',
            meeting_link: meetingLink,
            payment_status: payload.payment_status || 'paid'
          })
          .select(`
            *,
            patient:profiles!appointments_patient_id_fkey(id, full_name, phone),
            doctor:profiles!appointments_doctor_id_fkey(id, full_name, specialization, phone)
          `)
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new Error('This time slot is already booked for this doctor. Please choose another time.');
          }
          throw error;
        }
        return data;
      }
    ),

  update: (id, payload) =>
    withFallback(
      () => api.patch(`/appointments/${id}`, payload).then((r) => r.data.appointment),
      async () => {
        const { data, error } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', id)
          .select(`
            *,
            patient:profiles!appointments_patient_id_fkey(id, full_name, phone),
            doctor:profiles!appointments_doctor_id_fkey(id, full_name, specialization, phone)
          `)
          .single();
        if (error) throw error;
        return data;
      }
    )
};

export const recordsApi = {
  list: (params = {}) =>
    withFallback(
      () => api.get('/records', { params }).then((r) => r.data.records),
      async () => {
        let query = supabase
          .from('medical_records')
          .select(`
            *,
            patient:profiles!medical_records_patient_id_fkey(id, full_name, phone),
            doctor:profiles!medical_records_doctor_id_fkey(id, full_name, specialization)
          `)
          .order('created_at', { ascending: false });

        if (params.patient_id) query = query.eq('patient_id', params.patient_id);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }
    ),

  get: (id) =>
    withFallback(
      () => api.get(`/records/${id}`).then((r) => r.data.record),
      async () => {
        const { data, error } = await supabase
          .from('medical_records')
          .select(`
            *,
            patient:profiles!medical_records_patient_id_fkey(id, full_name, phone),
            doctor:profiles!medical_records_doctor_id_fkey(id, full_name, specialization)
          `)
          .eq('id', id)
          .single();
        if (error) throw error;
        return data;
      }
    ),

  create: (payload) =>
    withFallback(
      () => api.post('/records', payload).then((r) => r.data.record),
      async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        const insertPayload = {
          ...payload,
          doctor_id:
            payload.record_type === 'patient_upload'
              ? payload.doctor_id || null
              : payload.doctor_id || uid
        };

        let { data, error } = await supabase
          .from('medical_records')
          .insert(insertPayload)
          .select(`
            *,
            patient:profiles!medical_records_patient_id_fkey(id, full_name, phone),
            doctor:profiles!medical_records_doctor_id_fkey(id, full_name, specialization)
          `)
          .single();

        if (error && insertPayload.medications !== undefined) {
          const { medications, ...fallbackPayload } = insertPayload;
          const retry = await supabase
            .from('medical_records')
            .insert(fallbackPayload)
            .select(`
              *,
              patient:profiles!medical_records_patient_id_fkey(id, full_name, phone),
              doctor:profiles!medical_records_doctor_id_fkey(id, full_name, specialization)
            `)
            .single();
          if (retry.error) throw retry.error;
          return { ...retry.data, medications };
        }

        if (error) throw error;
        return data;
      }
    ),

  uploadPatientDocument: async ({ file, title, notes, appointment_id, doctor_id }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) throw new Error('You must be logged in to upload documents.');

    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${uid}/${Date.now()}_${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from('medical-documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('medical-documents')
      .getPublicUrl(filePath);

    const { data, error } = await supabase
      .from('medical_records')
      .insert({
        patient_id: uid,
        doctor_id: doctor_id || null,
        appointment_id: appointment_id || null,
        diagnosis: title || file.name,
        notes: notes || 'Uploaded by patient',
        file_url: urlData.publicUrl,
        file_name: file.name,
        record_type: 'patient_upload'
      })
      .select(`
        *,
        patient:profiles!medical_records_patient_id_fkey(id, full_name, phone),
        doctor:profiles!medical_records_doctor_id_fkey(id, full_name, specialization)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  getSignedFileUrl: async (fileUrl, patientId) => {
    if (fileUrl) {
      const marker = '/medical-documents/';
      const idx = fileUrl.indexOf(marker);
      if (idx !== -1) {
        const storagePath = decodeURIComponent(fileUrl.slice(idx + marker.length));
        const { data, error } = await supabase.storage
          .from('medical-documents')
          .createSignedUrl(storagePath, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
      }
      return fileUrl;
    }

    if (patientId) {
      const { data: files } = await supabase.storage
        .from('medical-documents')
        .list(patientId, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });

      if (files && files.length > 0) {
        const fallbackPath = `${patientId}/${files[0].name}`;
        const { data: signed } = await supabase.storage
          .from('medical-documents')
          .createSignedUrl(fallbackPath, 3600);
        if (signed?.signedUrl) return signed.signedUrl;
      }
    }
    return null;
  },

  remove: async (id) => {
    const { error } = await supabase.from('medical_records').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  update: (id, payload) =>
    withFallback(
      () => api.patch(`/records/${id}`, payload).then((r) => r.data.record),
      async () => {
        const { data, error } = await supabase
          .from('medical_records')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    )
};

export const remindersApi = {
  list: (params = {}) =>
    withFallback(
      () => api.get('/reminders', { params }).then((r) => r.data.reminders),
      async () => {
        let query = supabase
          .from('medication_reminders')
          .select('*')
          .order('reminder_time', { ascending: true });
        if (params.patient_id) query = query.eq('patient_id', params.patient_id);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }
    ),

  create: (payload) =>
    withFallback(
      () => api.post('/reminders', payload).then((r) => r.data.reminder),
      async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        const { data, error } = await supabase
          .from('medication_reminders')
          .insert({ ...payload, patient_id: payload.patient_id || uid })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    ),

  update: (id, payload) =>
    withFallback(
      () => api.patch(`/reminders/${id}`, payload).then((r) => r.data.reminder),
      async () => {
        const { data, error } = await supabase
          .from('medication_reminders')
          .update(payload)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    ),

  remove: (id) =>
    withFallback(
      () => api.delete(`/reminders/${id}`),
      async () => {
        const { error } = await supabase.from('medication_reminders').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      }
    )
};

export const adminApi = {
  patients: () =>
    withFallback(
      () => api.get('/admin/patients').then((r) => r.data.patients),
      async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'patient')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    ),

  overview: () =>
    withFallback(
      () => api.get('/admin/overview').then((r) => r.data),
      async () => {
        const [patientsRes, doctorsRes, appointmentsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'patient'),
          supabase.from('profiles').select('id, full_name, specialization').eq('role', 'doctor'),
          supabase.from('appointments').select('id, status, doctor_id')
        ]);
        const doctors = doctorsRes.data || [];
        const appts = appointmentsRes.data || [];

        const status_counts = {
          pending: appts.filter((a) => a.status === 'pending').length,
          approved: appts.filter((a) => a.status === 'approved').length,
          rescheduled: appts.filter((a) => a.status === 'rescheduled').length,
          completed: appts.filter((a) => a.status === 'completed').length,
          cancelled: appts.filter((a) => a.status === 'cancelled').length
        };

        const doctor_load = doctors.map((d) => ({
          doctor_id: d.id,
          full_name: d.full_name,
          specialization: d.specialization,
          appointment_count: appts.filter((a) => a.doctor_id === d.id && a.status !== 'cancelled').length
        }));

        return {
          total_doctors: doctors.length,
          total_patients: patientsRes.count || 0,
          status_counts,
          doctor_load
        };
      }
    )
};

export const chatApi = {
  list: (appointmentId) =>
    withFallback(
      () => api.get(`/chat/${appointmentId}`).then((r) => r.data.messages),
      async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, role)')
          .eq('appointment_id', appointmentId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      }
    ),

  send: (appointmentId, content, receiverId) =>
    withFallback(
      () => api.post(`/chat/${appointmentId}`, { content }).then((r) => r.data.message),
      async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData?.session?.user?.id;
        const { data, error } = await supabase
          .from('messages')
          .insert({
            appointment_id: appointmentId,
            sender_id: uid,
            receiver_id: receiverId,
            content: content.trim()
          })
          .select('*, sender:profiles!messages_sender_id_fkey(id, full_name, role)')
          .single();
        if (error) throw error;
        return data;
      }
    )
};

export const billingApi = {
  list: () =>
    withFallback(
      () => api.get('/billing').then((r) => r.data.invoices),
      async () => {
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            *,
            appointment:appointment_id ( id, appointment_date, status, consultation_type ),
            patient:patient_id ( id, full_name, phone ),
            doctor:doctor_id ( id, full_name, specialization )
          `)
          .order('issued_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    ),

  getByAppointment: (appointment) =>
    withFallback(
      () => api.get(`/billing/appointment/${appointment.id}`).then((r) => r.data.invoice),
      async () => {
        const { data: existing } = await supabase
          .from('invoices')
          .select(`
            *,
            patient:patient_id ( id, full_name, phone ),
            doctor:doctor_id ( id, full_name, specialization )
          `)
          .eq('appointment_id', appointment.id)
          .maybeSingle();

        if (existing) return existing;

        const consultFee = Number(appointment.doctor?.consultation_fee || 500);
        const platformFee = 49.0;
        const taxAmount = Number(((consultFee + platformFee) * 0.05).toFixed(2));
        const totalAmount = Number((consultFee + platformFee + taxAmount).toFixed(2));

        const { data: created, error } = await supabase
          .from('invoices')
          .insert({
            appointment_id: appointment.id,
            patient_id: appointment.patient_id || appointment.patient?.id,
            doctor_id: appointment.doctor_id || appointment.doctor?.id,
            consultation_fee: consultFee,
            platform_fee: platformFee,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_method: 'UPI',
            payment_status: 'paid'
          })
          .select(`
            *,
            patient:patient_id ( id, full_name, phone ),
            doctor:doctor_id ( id, full_name, specialization )
          `)
          .single();

        if (error) throw error;
        return created;
      }
    )
};

export default api;
