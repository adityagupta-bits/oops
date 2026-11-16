import React, { useEffect, useState } from 'react';
import TechnicianOperations, { operationLabels } from './pages/TechnicianOperations.jsx';
import { apiRequest } from './api.js';

export default function IncidentManagementActions({ incident, role, options, onAction }) {
  const [action, setAction] = useState(null);
  const [category, setCategory] = useState(incident.category);
  const [technicianId, setTechnicianId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [related, setRelated] = useState([]);
  useEffect(() => {
    if (role !== 'ADMIN') return;
    let active = true;
    apiRequest(`admin/incidents/${incident.id}/related`).then(data => { if (active) setRelated(data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [incident.id, role]);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const assignable = ['CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status);
  useEffect(() => {
    if (role !== 'ADMIN' || !assignable) return;
    let active = true;
    setCandidatesLoading(true); setTechnicianId('');
    apiRequest(`incidents/${incident.id}/eligible-technicians`).then(data => { if (active) setCandidates(data); })
      .catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setCandidatesLoading(false); });
    return () => { active = false; };
  }, [incident, role, assignable]);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const action = event.nativeEvent.submitter?.value === 'auto' ? 'auto-assign' : incident.status === 'NEW' ? 'classify' : assignable ? 'assign' : 'close';
      await onAction(action, action === 'classify' ? { category } : action === 'assign' ? { technicianId: Number(technicianId) } : {});
      setMessage('Saved successfully.');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <>
    {role === 'ADMIN' && <section className="student-detail-section"><h3>Related incident suggestions</h3><p>Rule-based text similarity; incidents are not merged automatically.</p>{related.length ? <ul>{related.map(item => <li key={item.incidentId}>Incident {item.incidentId}: {item.title} ({Math.round(item.similarity * 100)}% similar)</li>)}</ul> : <p>No related incidents found.</p>}</section>}
    {role === 'ADMIN' && (assignable || ['NEW', 'VERIFIED'].includes(incident.status)) && <form className="report-form" onSubmit={submit}>
      {incident.status === 'NEW' && incident.categorySuggestion && <p>Suggested category: <strong>{incident.categorySuggestion.category}</strong>. {incident.categorySuggestion.explanation}</p>}
      {incident.status === 'NEW' && <div className="report-field"><label htmlFor="classify-category">Confirm Category</label><select id="classify-category" value={category} onChange={event => setCategory(event.target.value)} required>{options.categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}
      {assignable && <div className="report-field"><label htmlFor="assign-technician">Assign Technician</label><select id="assign-technician" value={technicianId} onChange={event => setTechnicianId(event.target.value)}><option value="">{candidatesLoading ? 'Loading eligible technicians…' : 'Choose an eligible technician'}</option>{candidates.map(person => <option key={person.id} value={person.id}>{person.name} · {person.total}/{person.maxWorkload} active</option>)}</select>{!candidatesLoading && !candidates.length && <p>No eligible technicians currently available.</p>}</div>}
      <div className="report-actions"><button className="incident-view" type="submit" disabled={busy || (assignable && !technicianId)}>{busy ? 'Saving…' : incident.status === 'NEW' ? 'Classify Incident' : assignable ? incident.status === 'CLASSIFIED' ? 'Assign Technician' : 'Reassign Technician' : 'Close Incident'}</button>
      {incident.status === 'CLASSIFIED' && <button className="incident-view" type="submit" value="auto" disabled={busy}>Automatically Assign</button>}</div>
    </form>}
    {role === 'TECHNICIAN' && <div className="report-actions">{(incident.primaryOwner ? [...(incident.status === 'ASSIGNED' ? ['acknowledge'] : incident.status === 'ACKNOWLEDGED' ? ['start'] : incident.status === 'IN_PROGRESS' ? ['note', 'information', 'resolution'] : []), ...(['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status) ? ['transfer', 'collaboration'] : [])] : incident.status === 'IN_PROGRESS' ? ['note'] : []).map(action => <button className="incident-view" key={action} onClick={() => setAction(action)}>{operationLabels[action]}</button>)}</div>}
    {error && <p className="report-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {action && <TechnicianOperations key={`${incident.id}-${action}`} incident={incident} action={action} onAction={onAction} onClose={() => setAction(null)} />}
  </>;
}
