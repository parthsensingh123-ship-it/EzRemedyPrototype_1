const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/billing - List invoices scoped by user role
router.get('/', async (req, res) => {
  let query = supabaseAdmin
    .from('invoices')
    .select(`
      *,
      appointment:appointment_id ( id, appointment_date, status, consultation_type ),
      patient:patient_id ( id, full_name, phone ),
      doctor:doctor_id ( id, full_name, specialization )
    `)
    .order('issued_at', { ascending: false });

  if (req.user.role === 'patient') {
    query = query.eq('patient_id', req.user.id);
  } else if (req.user.role === 'doctor') {
    query = query.eq('doctor_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ invoices: data || [] });
});

// GET /api/billing/appointment/:appointmentId - Fetch or auto-create receipt for an appointment
router.get('/appointment/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;

  const { data: existing } = await supabaseAdmin
    .from('invoices')
    .select(`
      *,
      appointment:appointment_id ( id, appointment_date, status, consultation_type ),
      patient:patient_id ( id, full_name, phone ),
      doctor:doctor_id ( id, full_name, specialization )
    `)
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  if (existing) {
    return res.json({ invoice: existing });
  }

  // Auto-generate receipt if missing for an older appointment
  const { data: appt, error: apptErr } = await supabaseAdmin
    .from('appointments')
    .select(`
      id,
      patient_id,
      doctor_id,
      doctor:doctor_id ( id, full_name, consultation_fee )
    `)
    .eq('id', appointmentId)
    .single();

  if (apptErr || !appt) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  const consultFee = Number(appt.doctor?.consultation_fee || 500);
  const platformFee = 49.0;
  const taxAmount = Number(((consultFee + platformFee) * 0.05).toFixed(2));
  const totalAmount = Number((consultFee + platformFee + taxAmount).toFixed(2));

  const { data: created, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      doctor_id: appt.doctor_id,
      consultation_fee: consultFee,
      platform_fee: platformFee,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      payment_method: 'UPI',
      payment_status: 'paid'
    })
    .select(`
      *,
      appointment:appointment_id ( id, appointment_date, status, consultation_type ),
      patient:patient_id ( id, full_name, phone ),
      doctor:doctor_id ( id, full_name, specialization )
    `)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ invoice: created });
});

module.exports = router;
