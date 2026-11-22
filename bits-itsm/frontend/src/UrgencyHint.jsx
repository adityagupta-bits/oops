import React from 'react';
import { urgencyHint } from './urgencyHint.js';
export default function UrgencyHint({ incident, onUse }) {
  const hint = urgencyHint(incident.title, incident.description);
  return hint ? <aside className="report-guidance"><strong>Suggested urgency: High</strong><p>{hint.reason}</p><button type="button" className="incident-view" onClick={() => onUse(hint.value)}>Use Suggested Urgency</button></aside> : null;
}
