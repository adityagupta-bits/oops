import React, { useEffect, useState } from 'react';
import { apiRequest } from './api.js';

export default function AssignmentPreview() {
  const [incidents, setIncidents] = useState([]);
  const [id, setId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiRequest('incidents').then(rows => { if (active) setIncidents(rows.filter(i => i.status === 'CLASSIFIED' && !i.assignedTechnician)); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!id) { setResult(null); return; }
    let active = true;
    setLoading(true); setError(''); setResult(null);
    apiRequest(`admin/assignment-preview/${id}`).then(value => { if (active) setResult(value); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  return <section className="admin-section">
    <h3>Preview technician eligibility</h3>
    <p className="report-guidance">Uses the saved strategy and current workload. Previewing does not assign or change an incident.</p>
    <div className="report-field"><label htmlFor="assignment-preview-incident">Pending incident</label>
      <select id="assignment-preview-incident" value={id} onChange={e => setId(e.target.value)}>
        <option value="">Select an incident</option>
        {incidents.map(i => <option key={i.id} value={i.id}>#{i.id} · {i.title}</option>)}
      </select></div>
    {loading && <p role="status">Loading eligibility…</p>}
    {error && <p role="alert" className="report-error">{error}</p>}
    {!loading && !error && !incidents.length && <p>No classified incidents are waiting for assignment.</p>}
    {result && <><p>Saved strategy: {result.strategy.replaceAll('_', ' ')} · Required skill: {result.requiredSkill || 'Not established'}</p>
      <div className="dashboard-table-scroll"><table><thead><tr><th>Technician</th><th>Workload</th><th>Eligibility</th></tr></thead><tbody>
        {result.technicians.map(t => <tr key={t.id}><td>{t.name}</td><td>{t.workload} / {t.capacity}</td><td>{t.selected ? 'Selected by strategy' : t.eligible ? 'Eligible' : t.reasons.join(' ')}</td></tr>)}
      </tbody></table></div>{!result.technicians.length && <p>No technician accounts are configured.</p>}</>}
  </section>;
}
