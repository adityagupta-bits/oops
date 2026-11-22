import React, { useEffect, useState } from 'react';
import { apiRequest } from './api.js';
export default function HistoricalResolution({ incidentId }) {
  const [estimate, setEstimate] = useState(null);
  useEffect(() => {
    let active = true;
    setEstimate(null);
    apiRequest(`incidents/${incidentId}/resolution-estimate`).then(data => { if (active) setEstimate(data.estimate || null); }).catch(() => {});
    return () => { active = false; };
  }, [incidentId]);
  if (!estimate) return null;
  const hours = Math.floor(estimate.minutes / 60), minutes = estimate.minutes % 60;
  const duration = [hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '', minutes ? `${minutes} minutes` : ''].filter(Boolean).join(' ');
  return <aside className="report-guidance" aria-label="Historical resolution estimate"><strong>Usually fixed within about {duration}</strong><p>Based on the median of {estimate.sampleSize} recent, comparable resolved incidents. Historical estimate — not a guaranteed resolution time. The official SLA deadline remains unchanged.</p></aside>;
}
