import React from 'react';

const STATUS_STYLES = {
  approved: 'text-status-approved bg-status-approvedBg',
  completed: 'text-status-approved bg-status-approvedBg',
  pending: 'text-status-pending bg-status-pendingBg',
  rescheduled: 'text-status-pending bg-status-pendingBg',
  cancelled: 'text-status-cancelled bg-status-cancelledBg'
};

export default function Badge({ status }) {
  const classes = STATUS_STYLES[status] || 'text-status-neutral bg-status-neutralBg';
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
