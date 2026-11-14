const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/reminders
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('medication_reminders')
    .select('*')
    .order('reminder_time', { ascending: true });

  if (req.user.role === 'patient') {
    query = query.eq('patient_id', req.user.id);
  } else if (req.query.patient_id) {
    query = query.eq('patient_id', req.query.patient_id);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ reminders: data || [] });
});

// POST /api/reminders - Create a medication reminder from an E-Prescription item or manual form
router.post('/', async (req, res) => {
  const {
    patient_id,
    record_id,
    medication_name,
    dosage,
    frequency,
    start_date,
    end_date,
    reminder_time,
    instructions
  } = req.body;

  const targetPatientId =
    req.user.role === 'patient' ? req.user.id : patient_id || req.user.id;

  if (!medication_name || !dosage || !frequency || !start_date || !reminder_time) {
    return res.status(400).json({
      error: 'medication_name, dosage, frequency, start_date, and reminder_time are required.'
    });
  }

  const { data, error } = await supabaseAdmin
    .from('medication_reminders')
    .insert({
      patient_id: targetPatientId,
      record_id: record_id || null,
      medication_name: medication_name.trim(),
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      start_date,
      end_date: end_date || null,
      reminder_time,
      instructions: instructions || null,
      active: true
    })
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ reminder: data });
});

// PATCH /api/reminders/:id - Toggle active status or edit timing
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { active, medication_name, dosage, frequency, start_date, end_date, reminder_time } = req.body;

  const updates = {};
  if (active !== undefined) updates.active = Boolean(active);
  if (medication_name !== undefined) updates.medication_name = medication_name;
  if (dosage !== undefined) updates.dosage = dosage;
  if (frequency !== undefined) updates.frequency = frequency;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date || null;
  if (reminder_time !== undefined) updates.reminder_time = reminder_time;

  const { data, error } = await supabaseAdmin
    .from('medication_reminders')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ reminder: data });
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('medication_reminders')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

module.exports = router;
