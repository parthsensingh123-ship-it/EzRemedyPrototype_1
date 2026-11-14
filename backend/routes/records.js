const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const RECORD_SELECT = `
  id,
  diagnosis,
  prescription,
  notes,
  file_url,
  file_name,
  record_type,
  blood_pressure,
  heart_rate,
  temperature,
  weight_kg,
  created_at,
  patient:patient_id ( id, full_name, phone ),
  doctor:doctor_id ( id, full_name, specialization )
`;

// GET /api/records
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('medical_records')
    .select(RECORD_SELECT)
    .order('created_at', { ascending: false });

  if (req.query.patient_id) {
    query = query.eq('patient_id', req.query.patient_id);
  } else if (req.user.role === 'patient') {
    query = query.eq('patient_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ records: data || [] });
});

// POST /api/records
router.post('/', async (req, res) => {
  const {
    patient_id,
    doctor_id,
    appointment_id,
    diagnosis,
    prescription,
    notes,
    file_url,
    file_name,
    record_type,
    blood_pressure,
    heart_rate,
    temperature,
    weight_kg
  } = req.body;

  if (!patient_id || !diagnosis) {
    return res.status(400).json({ error: 'patient_id and diagnosis are required.' });
  }

  const targetDoctorId = doctor_id || (req.user.role === 'doctor' ? req.user.id : null);

  const { data, error } = await supabaseAdmin
    .from('medical_records')
    .insert({
      patient_id,
      doctor_id: targetDoctorId,
      appointment_id: appointment_id || null,
      diagnosis,
      prescription: prescription || null,
      notes: notes || null,
      file_url: file_url || null,
      file_name: file_name || null,
      record_type: record_type || (req.user.role === 'patient' ? 'patient_upload' : 'clinical_note'),
      blood_pressure: blood_pressure || null,
      heart_rate: heart_rate ? Number(heart_rate) : null,
      temperature: temperature ? Number(temperature) : null,
      weight_kg: weight_kg ? Number(weight_kg) : null
    })
    .select(RECORD_SELECT)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ record: data });
});

module.exports = router;
