const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/doctors - list all doctors (for patients to browse and book)
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, specialization, bio, years_experience, phone')
    .eq('role', 'doctor')
    .order('full_name', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ doctors: data });
});

// GET /api/doctors/:id - single doctor's public profile
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, specialization, bio, years_experience, phone')
    .eq('id', id)
    .eq('role', 'doctor')
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Doctor not found.' });
  }

  res.json({ doctor: data });
});

module.exports = router;
