const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/chat/:appointmentId
router.get('/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;

  const { data: appt, error: apptErr } = await supabaseAdmin
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
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({ error: 'Access denied to this consultation chat.' });
  }

  const { data: messages, error } = await supabaseAdmin
    .from('messages')
    .select(`
      id,
      appointment_id,
      sender_id,
      receiver_id,
      content,
      is_read,
      created_at,
      sender:sender_id ( id, full_name, role )
    `)
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ messages: messages || [] });
});

// POST /api/chat/:appointmentId
router.post('/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const { data: appt, error: apptErr } = await supabaseAdmin
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
    req.user.role !== 'admin'
  ) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const receiverId = req.user.id === appt.patient_id ? appt.doctor_id : appt.patient_id;

  const { data: message, error } = await supabaseAdmin
    .from('messages')
    .insert({
      appointment_id: appointmentId,
      sender_id: req.user.id,
      receiver_id: receiverId,
      content: content.trim()
    })
    .select(`
      id,
      appointment_id,
      sender_id,
      receiver_id,
      content,
      is_read,
      created_at,
      sender:sender_id ( id, full_name, role )
    `)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ message });
});

module.exports = router;
