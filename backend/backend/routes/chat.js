const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/chat/:appointmentId - Fetch all chat messages for an appointment
router.get('/:appointmentId', async (req, res, next) => {
  try {
    const { appointmentId } = req.params;

    // Verify user is part of this appointment
    const { data: appt, error: apptErr } = await req.supabase
      .from('appointments')
      .select('id, patient_id, doctor_id')
      .eq('id', appointmentId)
      .single();

    if (apptErr || !appt) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (
      appt.patient_id !== req.user.id &&
      appt.doctor_id !== req.user.id &&
      req.profile?.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Not authorized to view this conversation.' });
    }

    const { data: messages, error } = await req.supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, role)
      `)
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ messages: messages || [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/:appointmentId - Send a message to the doctor or patient
router.post('/:appointmentId', async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const { data: appt, error: apptErr } = await req.supabase
      .from('appointments')
      .select('id, patient_id, doctor_id')
      .eq('id', appointmentId)
      .single();

    if (apptErr || !appt) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const receiverId = req.user.id === appt.patient_id ? appt.doctor_id : appt.patient_id;

    const { data: message, error } = await req.supabase
      .from('messages')
      .insert({
        appointment_id: appointmentId,
        sender_id: req.user.id,
        receiver_id: receiverId,
        content: content.trim()
      })
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, role)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
