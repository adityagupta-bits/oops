import React from 'react';
import NavIcon from '../NavIcon.jsx';

export default function EmptyState({ title = 'No records found', description, icon = 'search', action }) {
  return (
    <div className="bits-empty-state" role="status">
      <div className="empty-state-icon" aria-hidden="true">
        <NavIcon name={icon} size={28} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
