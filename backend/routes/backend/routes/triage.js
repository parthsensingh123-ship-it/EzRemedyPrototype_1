const express = require('express');
const { supabaseAdmin } = require('../config/supabaseClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

const TRIAGE_KNOWLEDGE_BASE = [
  {
    specialty: 'Cardiologist',
    urgency: 'High Priority · Cardiac Evaluation',
    urgencyColor: 'bg-status-cancelledBg text-status-cancelled border-status-cancelled',
    keywords: [
      'chest pain', 'chest tightness', 'palpitation', 'heart', 'blood pressure',
      'hypertension', 'bp', 'shortness of breath', 'breathless', 'cholesterol',
      'left arm pain', 'fast heartbeat', 'tachycardia', 'dizzy when standing'
    ],
    advice: 'Symptoms suggest cardiovascular or blood pressure involvement. A Cardiologist evaluation (including ECG/lipid screening) is recommended.'
  },
  {
    specialty: 'Neurologist',
    urgency: 'Moderate-High Priority · Neurological Consult',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'migraine', 'headache', 'blurred vision', 'seizure', 'numbness', 'tingling',
      'vertigo', 'dizziness', 'memory', 'tremor', 'nerve', 'paralysis', 'fainting',
      'blackout', 'head spinning', 'brain', 'sciatica'
    ],
    advice: 'Headaches paired with visual changes, dizziness, or nerve tingling warrant a specialist Neurological assessment.'
  },
  {
    specialty: 'Dermatologist',
    urgency: 'Routine Priority · Dermatology Care',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'acne', 'rash', 'itching', 'eczema', 'skin', 'hair loss', 'hairfall',
      'dandruff', 'pigmentation', 'pimple', 'psoriasis', 'fungal', 'allergy',
      'hives', 'mole', 'sunburn', 'dry skin'
    ],
    advice: 'Cutaneous, hair, or allergic skin symptoms are best diagnosed via targeted Dermatological inspection.'
  },
  {
    specialty: 'Orthopedic Surgeon',
    urgency: 'Moderate Priority · Musculoskeletal Care',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'knee pain', 'back pain', 'joint', 'fracture', 'sprain', 'ligament',
      'shoulder', 'arthritis', 'bone', 'neck pain', 'sports injury', 'muscle tear',
      'ankle', 'wrist', 'stiffness', 'slip disc', 'posture'
    ],
    advice: 'Joint, bone, spine, or ligament discomfort should be evaluated by an Orthopedic specialist for mobility and imaging.'
  },
  {
    specialty: 'Gastroenterologist',
    urgency: 'Moderate Priority · Digestive Health',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'stomach', 'acidity', 'acid reflux', 'heartburn', 'bloating', 'gas',
      'constipation', 'diarrhea', 'vomiting', 'nausea', 'liver', 'ibs',
      'indigestion', 'ulcer', 'abdominal pain', 'cramps', 'jaundice', 'fatty liver'
    ],
    advice: 'Persistent gastrointestinal, gastric reflux, or abdominal symptoms align with a Gastroenterologist consultation.'
  },
  {
    specialty: 'ENT Specialist',
    urgency: 'Routine-Moderate · Ear, Nose & Throat',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'ear pain', 'sore throat', 'tonsil', 'sinus', 'blocked nose', 'runny nose',
      'hearing', 'ringing in ear', 'tinnitus', 'snoring', 'voice', 'hoarse',
      'throat infection', 'difficulty swallowing', 'nasal'
    ],
    advice: 'Upper respiratory tract, sinus, ear, or throat complaints are directly managed by an ENT Specialist.'
  },
  {
    specialty: 'Psychiatrist',
    urgency: 'Supportive Care · Mental Health & Sleep',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'anxiety', 'stress', 'insomnia', 'sleep', 'depression', 'panic',
      'overthinking', 'mood', 'focus', 'adhd', 'burnout', 'restless', 'sadness',
      'mental health', 'nightmare'
    ],
    advice: 'Sleep disturbances, anxiety, or cognitive fatigue respond well to structured Psychiatric and behavioral care.'
  },
  {
    specialty: 'Gynecologist & OB-GYN',
    urgency: 'Routine-Moderate · Women’s Health',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'period', 'pcos', 'pcod', 'menstrual', 'pregnancy', 'prenatal',
      'irregular cycle', 'pelvic pain', 'hormonal', 'gynec', 'fertility'
    ],
    advice: 'Menstrual, hormonal, PCOS, or prenatal health inquiries are best addressed by a Gynecologist & OB-GYN.'
  },
  {
    specialty: 'Pediatrician',
    urgency: 'Moderate Priority · Child Healthcare',
    urgencyColor: 'bg-status-pendingBg text-status-pending border-status-pending',
    keywords: [
      'child', 'baby', 'infant', 'toddler', 'vaccination', 'immunization',
      'newborn', 'kid', 'growth', 'pediatric'
    ],
    advice: 'For infants, children, or vaccination schedules, a Pediatrician provides age-specific clinical care.'
  },
  {
    specialty: 'General Physician',
    urgency: 'Routine Priority · Primary Internal Medicine',
    urgencyColor: 'bg-status-approvedBg text-status-approved border-status-approved',
    keywords: [
      'fever', 'cold', 'cough', 'flu', 'viral', 'weakness', 'fatigue',
      'body ache', 'diabetes', 'sugar', 'thyroid', 'checkup', 'infection', 'chills'
    ],
    advice: 'Systemic symptoms like viral fever, cough, fatigue, or metabolic checkups should start with a General Physician.'
  }
];

function evaluateSymptoms(rawSymptoms) {
  const lower = String(rawSymptoms || '').toLowerCase();
  let bestMatch = null;
  let highestScore = 0;
  let matchedKeywords = [];

  for (const rule of TRIAGE_KNOWLEDGE_BASE) {
    const hits = rule.keywords.filter((kw) => lower.includes(kw));
    if (hits.length > highestScore) {
      highestScore = hits.length;
      bestMatch = rule;
      matchedKeywords = hits;
    }
  }

  if (!bestMatch) {
    bestMatch = TRIAGE_KNOWLEDGE_BASE.find((r) => r.specialty === 'General Physician') || TRIAGE_KNOWLEDGE_BASE[0];
    matchedKeywords = ['general symptom evaluation'];
  }

  const confidence = highestScore >= 2 ? 96 : highestScore === 1 ? 89 : 78;

  return {
    recommendedSpecialty: bestMatch.specialty,
    urgency: bestMatch.urgency,
    urgencyColor: bestMatch.urgencyColor,
    advice: bestMatch.advice,
    matchedKeywords,
    confidence
  };
}

// POST /api/triage - Evaluates symptoms, matches database doctors, and saves triage log
router.post('/', async (req, res) => {
  const { symptoms } = req.body;
  if (!symptoms || !String(symptoms).trim()) {
    return res.status(400).json({ error: 'Please enter symptoms to analyze.' });
  }

  const cleanSymptoms = String(symptoms).trim();
  const analysis = evaluateSymptoms(cleanSymptoms);

  // Fetch doctors from Supabase to resolve the exact specialization string in database
  const { data: doctors } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, specialization, consultation_fee, years_experience')
    .eq('role', 'doctor');

  const allDoctors = doctors || [];
  const specs = Array.from(new Set(allDoctors.map((d) => d.specialization).filter(Boolean)));

  const matchedDatabaseSpecialty =
    specs.find(
      (s) =>
        s.toLowerCase() === analysis.recommendedSpecialty.toLowerCase() ||
        s.toLowerCase().includes(analysis.recommendedSpecialty.toLowerCase().split(' ')[0]) ||
        analysis.recommendedSpecialty.toLowerCase().includes(s.toLowerCase().split(' ')[0])
    ) || 'all';

  // Persist triage event in `symptom_triage_logs` (silent if table not created yet)
  if (req.user?.id) {
    await supabaseAdmin.from('symptom_triage_logs').insert({
      patient_id: req.user.id,
      symptoms_text: cleanSymptoms,
      recommended_specialty: analysis.recommendedSpecialty,
      urgency: analysis.urgency,
      confidence: analysis.confidence,
      matched_keywords: analysis.matchedKeywords,
      advice: analysis.advice
    });
  }

  return res.json({
    triage: {
      input: cleanSymptoms,
      ...analysis,
      matchedDatabaseSpecialty
    }
  });
});

// GET /api/triage/history - Returns recent symptom triage logs for patient or doctor
router.get('/history', async (req, res) => {
  let query = supabaseAdmin
    .from('symptom_triage_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (req.user.role === 'patient') {
    query = query.eq('patient_id', req.user.id);
  } else if (req.query.patient_id) {
    query = query.eq('patient_id', req.query.patient_id);
  }

  const { data, error } = await query;
  if (error) {
    return res.json({ logs: [] });
  }

  return res.json({ logs: data || [] });
});

module.exports = router;
