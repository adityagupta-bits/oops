import React, { useEffect, useState } from 'react';
import { slaCountdown } from '../slaCountdown.js';

export default function SlaCountdown({ incident }) {
  const [now, setNow] = useState(Date.now);
  const result = slaCountdown(incident, now);
  useEffect(() => {
    if (!result.active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [result.active, incident.id]);
  return <span className={result.overdue ? 'sla-countdown sla-countdown-overdue' : 'sla-countdown'}
    title="Resolution countdown based on the saved deadline. Backend SLA status is authoritative.">{result.text}</span>;
}
