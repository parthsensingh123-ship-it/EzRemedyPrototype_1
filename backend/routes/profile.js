const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// GET /api/profile - current user's own profile
router.get('/', async (req, res) => {
  res.json({ profile: req.user });
});

// PATCH /api/profile - update own profile
router.patch('/', async (req, res) => {
  const { full_name, phone, specialization, bio, years_experience } = req.body;

  const updates = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (specialization !== undefined) updates.specialization = specialization;
  if (bio !== undefined) updates.bio = bio;
  if (years_experience !== undefined) updates.years_experience = years_experience;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided to update.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ profile: data });
});

module.exports = router;
