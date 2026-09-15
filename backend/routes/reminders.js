const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

// GET /api/reminders
// Patients see their own reminders; doctors/admins can view a patient's via ?patient_id=
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('medication_reminders')
    .select('*')
    .order('reminder_time', { ascending: true });

  if (req.user.role === 'patient') {
    query = query.eq('patient_id', req.user.id);
  } else if (req.query.patient_id) {
    query = query.eq('patient_id', req.query.patient_id);
  } else {
    return res.status(400).json({ error: 'patient_id query parameter is required for staff.' });
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ reminders: data });
});

// POST /api/reminders - patient creates their own medication reminder
router.post('/', requireRole('patient'), async (req, res) => {
  const { medication_name, dosage, frequency, start_date, end_date, reminder_time } = req.body;

  if (!medication_name || !dosage || !frequency || !start_date || !reminder_time) {
    return res.status(400).json({
      error: 'medication_name, dosage, frequency, start_date, and reminder_time are required.'
    });
  }

  const { data, error } = await supabaseAdmin
    .from('medication_reminders')
    .insert({
      patient_id: req.user.id,
      medication_name,
      dosage,
      frequency,
      start_date,
      end_date: end_date || null,
      reminder_time,
      active: true
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ reminder: data });
});

// PATCH /api/reminders/:id - patient updates or deactivates their own reminder
router.patch('/:id', requireRole('patient'), async (req, res) => {
  const { id } = req.params;
  const { medication_name, dosage, frequency, start_date, end_date, reminder_time, active } = req.body;

  const updates = {};
  if (medication_name !== undefined) updates.medication_name = medication_name;
  if (dosage !== undefined) updates.dosage = dosage;
  if (frequency !== undefined) updates.frequency = frequency;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (reminder_time !== undefined) updates.reminder_time = reminder_time;
  if (active !== undefined) updates.active = active;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  const { data, error } = await supabaseAdmin
    .from('medication_reminders')
    .update(updates)
    .eq('id', id)
    .eq('patient_id', req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Reminder not found.' });
  }

  res.json({ reminder: data });
});

// DELETE /api/reminders/:id
router.delete('/:id', requireRole('patient'), async (req, res) => {
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('medication_reminders')
    .delete()
    .eq('id', id)
    .eq('patient_id', req.user.id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(204).send();
});

module.exports = router;
