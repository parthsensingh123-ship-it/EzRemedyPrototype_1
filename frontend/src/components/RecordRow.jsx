import React from 'react';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function RecordRow({ record, viewerRole }) {
  return (
    <div className="py-4 border-b border-hairline last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] text-ink font-medium">{record.diagnosis}</p>
          <p className="text-sm text-muted mt-0.5">
            {viewerRole === 'patient' && record.doctor ? `Dr. ${record.doctor.full_name} · ` : ''}
            {viewerRole !== 'patient' ? `${record.patient.full_name} · ` : ''}
            {formatDate(record.created_at)}
          </p>
        </div>
      </div>
      {record.prescription && (
        <p className="text-sm text-muted mt-2">
          <span className="text-faint">Prescription: </span>
          {record.prescription}
        </p>
      )}
      {record.notes && (
        <p className="text-sm text-muted mt-1">
          <span className="text-faint">Notes: </span>
          {record.notes}
        </p>
      )}
    </div>
  );
}
