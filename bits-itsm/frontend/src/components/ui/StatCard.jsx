import React from 'react';
import NavIcon from '../NavIcon.jsx';

export default function StatCard({ title, value, icon, subtitle, tone = 'default', trend, onClick }) {
  const isClickable = typeof onClick === 'function';
  const Component = isClickable ? 'button' : 'div';

  return (
    <Component
      className={`bits-stat-card tone-${tone} ${isClickable ? 'is-clickable' : ''}`}
      onClick={onClick}
      type={isClickable ? 'button' : undefined}
    >
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {icon && (
          <span className="stat-card-icon" aria-hidden="true">
            <NavIcon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className="stat-card-body">
        <span className="stat-card-value">{value ?? '—'}</span>
        {trend && <span className={`stat-card-trend trend-${trend.direction}`}>{trend.text}</span>}
      </div>
      {subtitle && <p className="stat-card-subtitle">{subtitle}</p>}
    </Component>
  );
}
