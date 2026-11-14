const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/billing - List all invoices for the logged-in patient or doctor
router.get('/', async (req, res, next) => {
  try {
    const { data: invoices, error } = await req.supabase
      .from('invoices')
      .select(`
        *,
        appointment:appointments(id, appointment_date, status, consultation_type),
        patient:profiles!invoices_patient_id_fkey(id, full_name, phone),
        doctor:profiles!invoices_doctor_id_fkey(id, full_name, specialization)
      `)
      .order('issued_at', { ascending: false });

    if (error) throw error;
    res.json({ invoices: invoices || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/billing/checkout - Process payment & generate itemized receipt for an appointment
router.post('/checkout', async (req, res, next) => {
  try {
    const { appointment_id, payment_method = 'UPI' } = req.body;

    if (!appointment_id) {
      return res.status(400).json({ error: 'appointment_id is required.' });
    }

    // Fetch appointment and doctor's consultation fee
    const { data: appt, error: apptErr } = await req.supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        doctor_id,
        doctor:profiles!appointments_doctor_id_fkey(id, full_name, consultation_fee)
      `)
      .eq('id', appointment_id)
      .single();

    if (apptErr || !appt) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    // Check if an invoice already exists for this appointment
    const { data: existing } = await req.supabase
      .from('invoices')
      .select('*')
      .eq('appointment_id', appointment_id)
      .maybeSingle();

    if (existing) {
      return res.json({ invoice: existing });
    }

    const consultationFee = Number(appt.doctor?.consultation_fee || 500);
    const platformFee = 49.0;
    const taxAmount = Number(((consultationFee + platformFee) * 0.05).toFixed(2));
    const totalAmount = Number((consultationFee + platformFee + taxAmount).toFixed(2));

    const { data: invoice, error } = await req.supabase
      .from('invoices')
      .insert({
        appointment_id: appt.id,
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        consultation_fee: consultationFee,
        platform_fee: platformFee,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_method,
        payment_status: 'paid'
      })
      .select(`
        *,
        patient:profiles!invoices_patient_id_fkey(id, full_name, phone),
        doctor:profiles!invoices_doctor_id_fkey(id, full_name, specialization)
      `)
      .single();

    if (error) throw error;

    // Also update appointment payment_status to 'paid'
    await req.supabase
      .from('appointments')
      .update({ payment_status: 'paid' })
      .eq('id', appt.id);

    res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
