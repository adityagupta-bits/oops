import React from 'react';

const STATUS_LABELS = {
  NEW: 'New',
  CLASSIFIED: 'Classified',
  ASSIGNED: 'Assigned',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  AWAITING_INFO: 'Awaiting Info',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
  CLOSED: 'Closed',
};

const PRIORITY_LABELS = {
  P1: 'P1 · Critical',
  P2: 'P2 · High',
  P3: 'P3 · Medium',
  P4: 'P4 · Low',
  PENDING: 'Pending Classification',
};

export default function Badge({ variant = 'neutral', status, priority, value, type, label, children, size = 'md' }) {
  let displayLabel = children || label;
  let toneClass = `badge-${variant}`;

  // Existing pages pass value/type; also allow the clearer status/priority props.
  if (value !== undefined) {
    if (type === 'priority' && priority === undefined) priority = value;
    else if (type === 'status' && status === undefined) status = value;
    else displayLabel = displayLabel || value;
  }

  if (status) {
    displayLabel = displayLabel || STATUS_LABELS[status] || status.replace(/_/g, ' ');
    const s = String(status).toUpperCase();
    if (s === 'NEW') toneClass = 'badge-new';
    else if (s === 'CLASSIFIED') toneClass = 'badge-classified';
    else if (s === 'ASSIGNED') toneClass = 'badge-assigned';
    else if (s === 'ACKNOWLEDGED') toneClass = 'badge-acknowledged';
    else if (s === 'IN_PROGRESS') toneClass = 'badge-in-progress';
    else if (s === 'AWAITING_INFO') toneClass = 'badge-awaiting-info';
    else if (s === 'RESOLVED') toneClass = 'badge-resolved';
    else if (s === 'VERIFIED') toneClass = 'badge-verified';
    else if (s === 'CLOSED') toneClass = 'badge-closed';
  } else if (priority) {
    displayLabel = displayLabel || PRIORITY_LABELS[priority] || priority;
    const p = String(priority).toUpperCase();
    if (p === 'P1') toneClass = 'badge-p1';
    else if (p === 'P2') toneClass = 'badge-p2';
    else if (p === 'P3') toneClass = 'badge-p3';
    else if (p === 'P4') toneClass = 'badge-p4';
    else toneClass = 'badge-pending';
  }

  return (
    <span className={`bits-badge ${toneClass} bits-badge-${size}`}>
      <span className="badge-dot" aria-hidden="true" />
      <span className="badge-text">{displayLabel}</span>
    </span>
  );
}
