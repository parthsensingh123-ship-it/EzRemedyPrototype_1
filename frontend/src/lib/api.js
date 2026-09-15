import axios from 'axios';
import { supabase } from './supabaseClient';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL });

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session ? data.session.access_token : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      (error.response && error.response.data && error.response.data.error) ||
      error.message ||
      'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export const profileApi = {
  get: () => api.get('/profile').then((r) => r.data.profile),
  update: (payload) => api.patch('/profile', payload).then((r) => r.data.profile)
};

export const doctorsApi = {
  list: () => api.get('/doctors').then((r) => r.data.doctors),
  get: (id) => api.get(`/doctors/${id}`).then((r) => r.data.doctor)
};

export const appointmentsApi = {
  list: (params) => api.get('/appointments', { params }).then((r) => r.data.appointments),
  get: (id) => api.get(`/appointments/${id}`).then((r) => r.data.appointment),
  create: (payload) => api.post('/appointments', payload).then((r) => r.data.appointment),
  update: (id, payload) => api.patch(`/appointments/${id}`, payload).then((r) => r.data.appointment)
};

export const recordsApi = {
  list: (params) => api.get('/records', { params }).then((r) => r.data.records),
  get: (id) => api.get(`/records/${id}`).then((r) => r.data.record),
  create: (payload) => api.post('/records', payload).then((r) => r.data.record),
  update: (id, payload) => api.patch(`/records/${id}`, payload).then((r) => r.data.record)
};

export const remindersApi = {
  list: (params) => api.get('/reminders', { params }).then((r) => r.data.reminders),
  create: (payload) => api.post('/reminders', payload).then((r) => r.data.reminder),
  update: (id, payload) => api.patch(`/reminders/${id}`, payload).then((r) => r.data.reminder),
  remove: (id) => api.delete(`/reminders/${id}`)
};

export const adminApi = {
  patients: () => api.get('/admin/patients').then((r) => r.data.patients),
  overview: () => api.get('/admin/overview').then((r) => r.data)
};

export default api;
