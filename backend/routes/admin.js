const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate);
router.use(requireRole('admin', 'doctor'));

// GET /api/admin/patients - list all patients (for staff to search/manage)
router.get('/patients', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, phone, created_at')
    .eq('role', 'patient')
    .order('full_name', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ patients: data });
});

// GET /api/admin/overview - hospital resource allocation summary
// Counts appointments by status and doctor, for the admin dashboard.
router.get('/overview', async (req, res) => {
  const { data: appointments, error: apptError } = await supabaseAdmin
    .from('appointments')
    .select('status, doctor_id, doctor:doctor_id ( full_name, specialization )');

  if (apptError) {
    return res.status(500).json({ error: apptError.message });
  }

  const statusCounts = { pending: 0, approved: 0, rescheduled: 0, completed: 0, cancelled: 0 };
  const doctorLoad = {};

  appointments.forEach((appt) => {
    if (statusCounts[appt.status] !== undefined) {
      statusCounts[appt.status] += 1;
    }
    if (appt.doctor_id) {
      if (!doctorLoad[appt.doctor_id]) {
        doctorLoad[appt.doctor_id] = {
          doctor_id: appt.doctor_id,
          full_name: appt.doctor ? appt.doctor.full_name : 'Unknown',
          specialization: appt.doctor ? appt.doctor.specialization : null,
          appointment_count: 0
        };
      }
      doctorLoad[appt.doctor_id].appointment_count += 1;
    }
  });

  const { count: doctorCount, error: doctorCountError } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'doctor');

  const { count: patientCount, error: patientCountError } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'patient');

  if (doctorCountError || patientCountError) {
    return res.status(500).json({
      error: (doctorCountError && doctorCountError.message) || (patientCountError && patientCountError.message)
    });
  }

  res.json({
    status_counts: statusCounts,
    doctor_load: Object.values(doctorLoad),
    total_doctors: doctorCount,
    total_patients: patientCount
  });
});

module.exports = router;
