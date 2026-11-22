import React, { useId, useState } from 'react';
import './incidentReportsChart.css';

const campusDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
function dateKey(date) {
  const parts = Object.fromEntries(campusDate.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export default function IncidentReportsChart({ incidents, role }) {
  const [days, setDays] = useState(7);
  const id = useId();
  const today = dateKey(new Date());
  const end = Date.parse(`${today}T12:00:00Z`);
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(end - (days - 1 - index) * 86400000);
    return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' }), count: 0 };
  });
  const byDate = new Map(buckets.map(bucket => [bucket.key, bucket]));
  incidents.forEach(incident => {
    if (!incident.createdAt) return;
    const date = new Date(incident.createdAt);
    if (!Number.isFinite(date.getTime())) return;
    const bucket = byDate.get(dateKey(date));
    if (bucket) bucket.count++;
  });
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const maximum = Math.max(1, ...buckets.map(bucket => bucket.count));
  const tick = Math.max(1, Math.ceil(maximum / 4));
  const ceiling = tick * 4;
  const left = 42, top = 18, height = 160, width = 720, slot = width / days;
  const scope = role === 'ADMIN' ? 'All campus reports' : role === 'TECHNICIAN' ? 'Reports currently assigned to you' : 'Your submitted reports';
  return <section className="incident-reports-chart" aria-labelledby={`${id}-title`}>
    <div className="incident-reports-chart-heading">
      <div><h3 id={`${id}-title`}>Incident reports</h3><p>{scope} · Daily totals in campus time</p></div>
      <label>Period <select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label>
    </div>
    <p className="incident-reports-chart-total"><strong>{total}</strong> {total === 1 ? 'report' : 'reports'} in this period</p>
    {total === 0 ? <p className="incident-reports-chart-empty">No incidents reported in this period.</p> : <>
      <svg viewBox="0 0 790 220" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <desc id={`${id}-description`}>{buckets.map(b => `${b.label}: ${b.count}`).join('; ')}</desc>
        {[0, 1, 2, 3, 4].map(index => {
          const y = top + height - index * height / 4;
          return <g key={index}><line x1={left} y1={y} x2={left + width} y2={y} className="incident-chart-grid" /><text x={left - 10} y={y + 4} textAnchor="end">{index * tick}</text></g>;
        })}
        {buckets.map((bucket, index) => {
          const barHeight = bucket.count / ceiling * height;
          return <g key={bucket.key}>
            <rect x={left + index * slot + slot * .2} y={top + height - barHeight} width={slot * .6} height={barHeight} rx="3" className="incident-chart-bar"><title>{bucket.label}: {bucket.count} reports</title></rect>
            {(days === 7 || index % 5 === 0 || index === days - 1) && <text x={left + (index + .5) * slot} y={top + height + 24} textAnchor="middle">{bucket.label}</text>}
          </g>;
        })}
      </svg>
      <details><summary>View daily counts</summary><table><thead><tr><th>Date</th><th>Reports</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.key}><td>{bucket.label}</td><td>{bucket.count}</td></tr>)}</tbody></table></details>
    </>}
  </section>;
}
