import React from 'react';
import Badge from './Badge';

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export default function AppointmentRow({ appointment, viewerRole, onCancel, onApprove, onComplete, onReschedule }) {
  const canCancel =
    (viewerRole === 'patient' && ['pending', 'approved'].includes(appointment.status)) ||
    (['doctor', 'admin'].includes(viewerRole) && appointment.status !== 'cancelled' && appointment.status !== 'completed');

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-hairline last:border-b-0">
      <div>
        <p className="text-[15px] text-ink font-medium">
          {viewerRole === 'patient'
            ? `Dr. ${appointment.doctor.full_name}`
            : appointment.patient.full_name}
        </p>
        <p className="text-sm text-muted">
          {formatDateTime(appointment.appointment_date)}
          {viewerRole !== 'patient' && appointment.doctor.specialization
            ? ` · ${appointment.doctor.specialization}`
            : ''}
        </p>
        {appointment.reason && <p className="text-sm text-faint mt-0.5">{appointment.reason}</p>}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Badge status={appointment.status} />

        {viewerRole !== 'patient' && appointment.status === 'pending' && (
          <button onClick={() => onApprove(appointment)} className="btn-text text-sm">
            Approve
          </button>
        )}
        {viewerRole !== 'patient' && ['pending', 'approved', 'rescheduled'].includes(appointment.status) && (
          <button onClick={() => onReschedule(appointment)} className="btn-text text-sm">
            Reschedule
          </button>
        )}
        {viewerRole !== 'patient' && ['approved', 'rescheduled'].includes(appointment.status) && (
          <button onClick={() => onComplete(appointment)} className="btn-text text-sm">
            Mark complete
          </button>
        )}
        {canCancel && (
          <button onClick={() => onCancel(appointment)} className="text-sm text-status-cancelled hover:opacity-70 transition-opacity">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
