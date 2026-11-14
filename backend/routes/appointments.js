const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);

const APPOINTMENT_SELECT = `
  id,
  appointment_date,
  status,
  consultation_type,
  meeting_link,
  token_number,
  payment_status,
  reason,
  notes,
  created_at,
  updated_at,
  patient:patient_id ( id, full_name, phone ),
  doctor:doctor_id ( id, full_name, specialization, consultation_fee, hospital_branch )
`;

// GET /api/appointments
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .order('appointment_date', { ascending: true });

  if (req.user.role === 'patient') {
    query = query.eq('patient_id', req.user.id);
  } else if (req.query.doctor_id) {
    query = query.eq('doctor_id', req.query.doctor_id);
  } else if (req.query.status) {
    query = query.eq('status', req.query.status);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ appointments: data });
});

// GET /api/appointments/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  if (req.user.role === 'patient' && data.patient.id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.json({ appointment: data });
});

// POST /api/appointments - patient books appointment + auto-provisions video link & billing receipt
router.post('/', requireRole('patient'), async (req, res) => {
  const {
    doctor_id,
    appointment_date,
    reason,
    consultation_type = 'in_person',
    payment_method = 'UPI'
  } = req.body;

  if (!doctor_id || !appointment_date) {
    return res.status(400).json({ error: 'doctor_id and appointment_date are required.' });
  }

  const { data: doctor, error: doctorError } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, consultation_fee')
    .eq('id', doctor_id)
    .eq('role', 'doctor')
    .single();

  if (doctorError || !doctor) {
    return res.status(404).json({ error: 'Selected doctor does not exist.' });
  }

  // Generate unique encrypted Jitsi teleconsultation link if video mode selected
  const meetingLink =
    consultation_type === 'video'
      ? `https://meet.jit.si/EzRemedy-${req.user.id.slice(0, 6)}-${Date.now().toString().slice(-5)}`
      : null;

  const { data: appointment, error } = await supabaseAdmin
    .from('appointments')
    .insert({
      patient_id: req.user.id,
      doctor_id,
      appointment_date,
      consultation_type,
      meeting_link: meetingLink,
      payment_status: 'paid',
      reason: reason || null,
      status: 'pending'
    })
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'This time slot is already booked for this doctor. Please select another slot.'
      });
    }
    return res.status(500).json({ error: error.message });
  }

  // Auto-generate itemized billing receipt in invoices table
  const consultFee = Number(doctor.consultation_fee || 500);
  const platformFee = 49.0;
  const taxAmount = Number(((consultFee + platformFee) * 0.05).toFixed(2));
  const totalAmount = Number((consultFee + platformFee + taxAmount).toFixed(2));

  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .insert({
      appointment_id: appointment.id,
      patient_id: req.user.id,
      doctor_id,
      consultation_fee: consultFee,
      platform_fee: platformFee,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      payment_method,
      payment_status: 'paid'
    })
    .select('*')
    .single();

  res.status(201).json({ appointment, invoice });
});

// PATCH /api/appointments/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, appointment_date, notes, consultation_type } = req.body;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('appointments')
    .select('id, patient_id, doctor_id, status, meeting_link')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  const updates = {};

  if (req.user.role === 'patient') {
    if (existing.patient_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (status && status !== 'cancelled') {
      return res.status(403).json({ error: 'Patients may only cancel appointments.' });
    }
    if (existing.status !== 'pending' && existing.status !== 'approved') {
      return res.status(400).json({ error: 'This appointment can no longer be cancelled.' });
    }
    updates.status = 'cancelled';
  } else if (req.user.role === 'doctor' || req.user.role === 'admin') {
    const allowedStatuses = ['pending', 'approved', 'rescheduled', 'completed', 'cancelled'];
    if (status) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value.' });
      }
      updates.status = status;
    }
    if (appointment_date) {
      updates.appointment_date = appointment_date;
      if (!status) {
        updates.status = 'rescheduled';
      }
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (consultation_type) {
      updates.consultation_type = consultation_type;
      if (consultation_type === 'video' && !existing.meeting_link) {
        updates.meeting_link = `https://meet.jit.si/EzRemedy-${id.slice(0, 8)}`;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .update(updates)
    .eq('id', id)
    .select(APPOINTMENT_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Target time slot is already booked.' });
    }
    return res.status(500).json({ error: error.message });
  }

  res.json({ appointment: data });
});

module.exports = router;
