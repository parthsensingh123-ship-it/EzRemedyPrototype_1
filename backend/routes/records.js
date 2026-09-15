const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

const RECORD_SELECT = `
  id,
  diagnosis,
  prescription,
  notes,
  created_at,
  updated_at,
  patient:patient_id ( id, full_name, phone ),
  doctor:doctor_id ( id, full_name, specialization )
`;

// GET /api/records
// Patients see only their own records; doctors/admins see all,
// or filter by ?patient_id= when reviewing a specific patient.
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('medical_records')
    .select(RECORD_SELECT)
    .order('created_at', { ascending: false });

  if (req.user.role === 'patient') {
    query = query.eq('patient_id', req.user.id);
  } else if (req.query.patient_id) {
    query = query.eq('patient_id', req.query.patient_id);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ records: data });
});

// GET /api/records/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('medical_records')
    .select(RECORD_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (req.user.role === 'patient' && data.patient.id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.json({ record: data });
});

// POST /api/records - doctor/admin creates a record for a patient
router.post('/', requireRole('doctor', 'admin'), async (req, res) => {
  const { patient_id, diagnosis, prescription, notes } = req.body;

  if (!patient_id || !diagnosis) {
    return res.status(400).json({ error: 'patient_id and diagnosis are required.' });
  }

  const { data: patient, error: patientError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', patient_id)
    .eq('role', 'patient')
    .single();

  if (patientError || !patient) {
    return res.status(404).json({ error: 'Patient does not exist.' });
  }

  const { data, error } = await supabaseAdmin
    .from('medical_records')
    .insert({
      patient_id,
      doctor_id: req.user.id,
      diagnosis,
      prescription: prescription || null,
      notes: notes || null
    })
    .select(RECORD_SELECT)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ record: data });
});

// PATCH /api/records/:id - doctor/admin updates a record
router.patch('/:id', requireRole('doctor', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { diagnosis, prescription, notes } = req.body;

  const updates = {};
  if (diagnosis !== undefined) updates.diagnosis = diagnosis;
  if (prescription !== undefined) updates.prescription = prescription;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  const { data, error } = await supabaseAdmin
    .from('medical_records')
    .update(updates)
    .eq('id', id)
    .select(RECORD_SELECT)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  res.json({ record: data });
});

module.exports = router;
