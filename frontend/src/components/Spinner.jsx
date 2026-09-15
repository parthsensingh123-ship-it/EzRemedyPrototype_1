import React from 'react';
import { motion } from 'framer-motion';

export default function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 text-muted text-sm py-8" role="status" aria-live="polite">
      <motion.span
        className="block w-4 h-4 border-2 border-hairline border-t-accent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      />
      <span>{label}</span>
    </div>
  );
}
