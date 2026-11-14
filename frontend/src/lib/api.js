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

// Helper: tries Express API first; if offline (e.g. on Netlify static host), runs Supabase query directly
async function withFallback(apiCall, supabaseFallback) {
  try {
    return await apiCall();
  } catch (err) {
    const isNetworkOrServerDown =
      !err.response ||
      err.code === 'ECONNABORTED' ||
      err.message?.includes('Network Error') ||
      err.response?.status >= 500;

    if (isNetworkOrServerDown && supabaseFallback) {
      return await supabaseFallback();
    }
    const message =
      err.response?.data?.error || err.message || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
}

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
        const { data, error } = await supabase
          .from('medical_records')
          .insert({
            ...payload,
            doctor_id: payload.doctor_id || uid
          })
          .select(`
            *,
            patient:profiles!medical_records_patient_id_fkey(id, full_name, phone),
            doctor:profiles!medical_records_doctor_id_fkey(id, full_name, specialization)
          `)
          .single();
        if (error) throw error;
        return data;
      }
    ),

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
        const [patientsRes, doctorsRes, appointmentsRes, recordsRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'patient'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'doctor'),
          supabase.from('appointments').select('id, status'),
          supabase.from('medical_records').select('id', { count: 'exact', head: true })
        ]);
        const appts = appointmentsRes.data || [];
        return {
          totalPatients: patientsRes.count || 0,
          totalDoctors: doctorsRes.count || 0,
          totalAppointments: appts.length,
          pendingAppointments: appts.filter((a) => a.status === 'pending').length,
          approvedAppointments: appts.filter((a) => a.status === 'approved').length,
          completedAppointments: appts.filter((a) => a.status === 'completed').length,
          totalRecords: recordsRes.count || 0
        };
      }
    )
};

export default api;
