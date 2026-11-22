import React from 'react';
import './technicianAvailability.css';

const choices = [
  { value: 'AVAILABLE', label: 'Available', detail: 'Ready for new work', explanation: 'Accept new assignments that match your skills and available capacity.', icon: '+' },
  { value: 'BUSY', label: 'Busy', detail: 'Focused on assigned work', explanation: 'Continue your current incidents. New work goes to another available technician.', icon: '◷' },
  { value: 'UNAVAILABLE', label: 'Unavailable', detail: 'Away from new assignments', explanation: 'New work is routed to another eligible technician. Arrange a transfer for existing work that needs cover.', icon: '−' },
];

export default function TechnicianAvailability({ value, busy, loading, feedback, error, onChange, onRetry }) {
  return <section className="tech-availability" aria-labelledby="availability-title" aria-busy={busy || loading}>
    <header><div><span className="tech-availability-eyebrow">WORK PREFERENCES</span><h3 id="availability-title">Your availability</h3><p>Let the team know when you can take on new incidents.</p></div><span className="tech-availability-save" role="status">{loading ? 'Loading status…' : busy ? 'Saving status…' : value ? 'Changes save automatically' : 'Status unavailable'}</span></header>
    <div className="tech-availability-options" role="group" aria-label="Choose your availability">
      {choices.map(choice => <button type="button" key={choice.value} aria-pressed={value === choice.value} disabled={busy || loading || !value} className={`tech-availability-option ${choice.value.toLowerCase()} ${value === choice.value ? 'selected' : ''}`} onClick={() => onChange({ target: { value: choice.value } })}>
        <span className="tech-availability-icon" aria-hidden="true">{choice.icon}</span><span className="tech-availability-copy"><strong>{choice.label}</strong><small>{choice.detail}</small></span><span className="tech-availability-check" aria-hidden="true">{value === choice.value ? '✓' : ''}</span>
      </button>)}
    </div>
    {value && <p className="tech-availability-guidance">{choices.find(choice => choice.value === value)?.explanation}</p>}
    {feedback && <p className={error ? 'tech-availability-error' : 'tech-availability-confirmation'} role={error ? 'alert' : 'status'}>{feedback}</p>}
    {!value && !loading && <button type="button" className="tech-availability-retry" onClick={onRetry}>Retry loading status</button>}
  </section>;
}
