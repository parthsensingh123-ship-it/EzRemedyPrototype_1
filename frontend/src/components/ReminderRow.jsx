import React from 'react';

export default function ReminderRow({ reminder, onToggle, onDelete }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-hairline last:border-b-0">
      <div>
        <p className="text-[15px] text-ink font-medium">{reminder.medication_name}</p>
        <p className="text-sm text-muted">
          {reminder.dosage} · {reminder.frequency} · {reminder.reminder_time.slice(0, 5)}
        </p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={() => onToggle(reminder)}
          className="text-sm text-accent hover:text-accent-dark transition-colors duration-150"
        >
          {reminder.active ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={() => onDelete(reminder)}
          className="text-sm text-status-cancelled hover:opacity-70 transition-opacity"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
