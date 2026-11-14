const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const RECORD_SELECT = `
  id,
  appointment_id,
  diagnosis,
  prescription,
  medications,
  notes,
  file_url,
  file_name,
  record_type,
  blood_pressure,
  heart_rate,
  temperature,
  weight_kg,
  follow_up_date,
  created_at,
  patient:patient_id ( id, full_name, phone ),
  doctor:doctor_id ( id, full_name, specialization )
`;

// Helper: normalizes and validates each medication row sent from the Doctor Portal
function sanitizeMedications(medications) {
  if (!Array.isArray(medications)) return [];
  return medications
    .map((m) => ({
      name: String(m.name || '').trim(),
      timing: String(m.timing || 'Morning & Night (1-0-1)').trim(),
      frequency: String(m.frequency || 'Twice daily').trim(),
      duration: String(m.duration || '5 days').trim(),
      instructions: String(m.instructions || 'After meals').trim()
    }))
    .filter((m) => m.name.length > 0);
}

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

// GET /api/records/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('medical_records')
    .select(RECORD_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Medical record not found.' });
  }

  if (req.user.role === 'patient' && data.patient?.id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.json({ record: data });
});

// POST /api/records - Doctor creates structured E-Prescription (or Patient uploads document)
router.post('/', async (req, res) => {
  const {
    patient_id,
    doctor_id,
    appointment_id,
    diagnosis,
    prescription,
    medications,
    notes,
    file_url,
    file_name,
    record_type,
    blood_pressure,
    heart_rate,
    temperature,
    weight_kg,
    follow_up_date
  } = req.body;

  const targetPatientId = patient_id || (req.user.role === 'patient' ? req.user.id : null);

  if (!targetPatientId || !diagnosis) {
    return res.status(400).json({ error: 'patient_id and diagnosis are required.' });
  }

  const targetDoctorId =
    record_type === 'patient_upload'
      ? doctor_id || null
      : doctor_id || (req.user.role === 'doctor' ? req.user.id : null);

  const cleanMeds = sanitizeMedications(medications);

  // Auto-build formatted prescription string if structured medications were provided
  const computedPrescription =
    prescription ||
    (cleanMeds.length > 0
      ? cleanMeds
          .map(
            (m, idx) =>
              `${idx + 1}. ${m.name} | ${m.timing} | ${m.frequency} | ${m.duration} | ${m.instructions}`
          )
          .join('\n')
      : null);

  const insertPayload = {
    patient_id: targetPatientId,
    doctor_id: targetDoctorId,
    appointment_id: appointment_id || null,
    diagnosis: diagnosis.trim(),
    prescription: computedPrescription,
    medications: cleanMeds,
    notes: notes || null,
    file_url: file_url || null,
    file_name: file_name || null,
    record_type: record_type || (req.user.role === 'patient' ? 'patient_upload' : 'clinical_note'),
    blood_pressure: blood_pressure || null,
    heart_rate: heart_rate ? Number(heart_rate) : null,
    temperature: temperature ? Number(temperature) : null,
    weight_kg: weight_kg ? Number(weight_kg) : null,
    follow_up_date: follow_up_date || null
  };

  const { data, error } = await supabaseAdmin
    .from('medical_records')
    .insert(insertPayload)
    .select(RECORD_SELECT)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ record: data });
});

// PATCH /api/records/:id - Update an existing clinical record or prescription
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    diagnosis,
    prescription,
    medications,
    notes,
    blood_pressure,
    heart_rate,
    temperature,
    weight_kg,
    follow_up_date
  } = req.body;

  const updates = {};
  if (diagnosis !== undefined) updates.diagnosis = diagnosis;
  if (notes !== undefined) updates.notes = notes;
  if (blood_pressure !== undefined) updates.blood_pressure = blood_pressure;
  if (heart_rate !== undefined) updates.heart_rate = heart_rate ? Number(heart_rate) : null;
  if (temperature !== undefined) updates.temperature = temperature ? Number(temperature) : null;
  if (weight_kg !== undefined) updates.weight_kg = weight_kg ? Number(weight_kg) : null;
  if (follow_up_date !== undefined) updates.follow_up_date = follow_up_date || null;

  if (medications !== undefined) {
    const cleanMeds = sanitizeMedications(medications);
    updates.medications = cleanMeds;
    updates.prescription =
      cleanMeds.length > 0
        ? cleanMeds
            .map(
              (m, idx) =>
                `${idx + 1}. ${m.name} | ${m.timing} | ${m.frequency} | ${m.duration} | ${m.instructions}`
            )
            .join('\n')
        : prescription || null;
  } else if (prescription !== undefined) {
    updates.prescription = prescription;
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

  res.json({ record: data });
});

// DELETE /api/records/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { data: existing, error: findErr } = await supabaseAdmin
    .from('medical_records')
    .select('id, patient_id, doctor_id, record_type')
    .eq('id', id)
    .single();

  if (findErr || !existing) {
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (
    req.user.role === 'patient' &&
    (existing.patient_id !== req.user.id || existing.record_type !== 'patient_upload')
  ) {
    return res.status(403).json({ error: 'Patients may only delete their own uploaded files.' });
  }

  const { error } = await supabaseAdmin.from('medical_records').delete().eq('id', id);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

module.exports = router;
