import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ label, value, delay = 0 }) {
  return (
    <motion.div
      className="panel p-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ borderColor: '#2F4A52' }}
    >
      <p className="text-3xl font-display text-ink">{value}</p>
      <p className="text-sm text-muted mt-1">{label}</p>
    </motion.div>
  );
}
