import React from 'react';
import { motion } from 'framer-motion';

export default function DoctorCard({ doctor, onBook }) {
  return (
    <motion.div
      className="panel p-6 flex flex-col justify-between h-full"
      whileHover={{ y: -3, borderColor: '#2F4A52' }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <div>
        <p className="text-xs text-faint mb-1">{doctor.specialization || 'General practice'}</p>
        <h3 className="font-display text-lg text-ink mb-2">{doctor.full_name}</h3>
        {doctor.bio && <p className="text-sm text-muted leading-relaxed mb-3">{doctor.bio}</p>}
        {typeof doctor.years_experience === 'number' && (
          <p className="text-sm text-faint">{doctor.years_experience} years experience</p>
        )}
      </div>
      <button onClick={() => onBook(doctor)} className="btn-primary mt-5 text-sm w-full">
        Book appointment
      </button>
    </motion.div>
  );
}
