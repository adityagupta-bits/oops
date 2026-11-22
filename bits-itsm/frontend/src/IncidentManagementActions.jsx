import './incidentManagement.css';
import DirectCollaborators from './DirectCollaborators.jsx';
import React, { useEffect, useState } from 'react';
import TechnicianOperations, { operationLabels } from './pages/TechnicianOperations.jsx';
import { apiRequest } from './api.js';
import PriorityOverride from './PriorityOverride.jsx';
import IncidentDisposition from './IncidentDisposition.jsx';
import Modal from './components/ui/Modal.jsx';
import ManualEscalation from './ManualEscalation.jsx';
import IncidentConversation from './IncidentConversation.jsx';
import AssignmentManagement from './AssignmentManagement.jsx';

export default function IncidentManagementActions({ incident, role, options, onAction, onRefresh }) {
  const [action, setAction] = useState(null);
  const [panel, setPanel] = useState(null);
  const [category, setCategory] = useState(incident.category);
  const [technicianId, setTechnicianId] = useState('');
  const [assignmentReason, setAssignmentReason] = useState('');
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
      await onAction(action, action === 'classify' ? { category } : action === 'assign' ? { technicianId: Number(technicianId), reason: assignmentReason } : {});
      setMessage('Saved successfully.');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <>
    {options?.incidentDisposition && <IncidentDisposition incident={incident} role={role} onAction={onAction} />}
    {role === 'ADMIN' && <section className="student-detail-section"><h3>Incident Management</h3><div className="report-actions">{['Assignment','Change Priority','Escalate Incident','Transfer Requests','Collaborators','Message Technician','Audit History'].map(name => <button type="button" className="incident-view" key={name} onClick={() => setPanel(name)}>{name}</button>)}</div></section>}
    <Modal className="incident-management-dialog" isOpen={role === 'ADMIN' && Boolean(panel)} title={panel || ''} onClose={() => { if (!busy) setPanel(null); }} maxWidth="720px">
      <p>Incident #{incident.id}: {incident.title}</p>
      {panel === 'Escalate Incident' && <ManualEscalation incident={incident} onSaved={onRefresh} onClose={() => setPanel(null)} />}
      {panel === 'Message Technician' && <IncidentConversation incidentId={incident.id} role="ADMIN" initialChannel="internal" />}
      {panel === 'Transfer Requests' && <AssignmentManagement mode="transfer" role="ADMIN" incidentId={incident.id} onSaved={onRefresh} />}
      {panel === 'Collaborators' && <DirectCollaborators incident={incident} onSaved={onRefresh} />}
      {panel === 'Collaborators' && <AssignmentManagement mode="collaboration" role="ADMIN" incidentId={incident.id} onSaved={onRefresh} />}
      {panel === 'Audit History' && <ol>{incident.history?.map(event => <li key={event.id}><strong>{event.action}</strong><p>{event.description}</p><small>{event.actor?.name || 'System'} ? {event.createdAt}</small></li>)}</ol>}
    {panel === 'Change Priority' && <PriorityOverride incident={incident} onAction={onAction} initiallyOpen onClose={() => setPanel(null)} />}
    {panel === 'Related incidents' && <section className="student-detail-section"><h3>Related incident suggestions</h3><p>Rule-based text similarity; incidents are not merged automatically.</p>{related.length ? <ul>{related.map(item => <li key={item.incidentId}>Incident {item.incidentId}: {item.title} ({Math.round(item.similarity * 100)}% similar)</li>)}</ul> : <p>No related incidents found.</p>}</section>}
    {panel === 'Assignment' && !assignable && !['NEW', 'VERIFIED'].includes(incident.status) && <p>Assignment is not available for an incident in this state.</p>}
    {panel === 'Assignment' && (assignable || ['NEW', 'VERIFIED'].includes(incident.status)) && <form className="report-form" onSubmit={submit}>
      {incident.status === 'NEW' && incident.categorySuggestion && <p>Suggested category: <strong>{incident.categorySuggestion.category}</strong>. {incident.categorySuggestion.explanation}</p>}
      {incident.status === 'NEW' && <div className="report-field"><label htmlFor="classify-category">Confirm Category</label><select id="classify-category" value={category} onChange={event => setCategory(event.target.value)} required>{options.categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}
      {assignable && <div className="report-field"><label htmlFor="assign-technician">Assign Technician</label><select id="assign-technician" value={technicianId} onChange={event => setTechnicianId(event.target.value)}><option value="">{candidatesLoading ? 'Loading eligible technicians…' : 'Choose an eligible technician'}</option>{candidates.map(person => <option key={person.id} value={person.id}>{person.name} · {person.total}/{person.maxWorkload} active</option>)}</select>{!candidatesLoading && !candidates.length && <p>No eligible technicians currently available.</p>}</div>}
      {assignable && incident.assignedTechnician && <div className="report-field"><label htmlFor="assignment-reason">Reassignment reason</label><textarea id="assignment-reason" required minLength={5} maxLength={2000} value={assignmentReason} onChange={e => setAssignmentReason(e.target.value)} /></div>}
      <div className="report-actions"><button className="incident-view" type="submit" disabled={busy || (assignable && !technicianId)}>{busy ? 'Saving…' : incident.status === 'NEW' ? 'Classify Incident' : assignable ? incident.status === 'CLASSIFIED' ? 'Assign Technician' : 'Reassign Technician' : 'Close Incident'}</button>
      {incident.status === 'CLASSIFIED' && <button className="incident-view" type="submit" value="auto" disabled={busy}>Automatically Assign</button>}</div>
    </form>}
    {error && <p className="report-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </Modal>
    {role === 'TECHNICIAN' && <div className="report-actions">{(incident.primaryOwner ? [...(incident.status === 'ASSIGNED' ? [options?.atomicStartWork ? 'start' : 'acknowledge'] : incident.status === 'ACKNOWLEDGED' ? ['start'] : incident.status === 'IN_PROGRESS' ? ['note', 'information', 'resolution'] : []), ...(['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status) ? ['transfer', 'collaboration'] : [])] : incident.status === 'IN_PROGRESS' ? ['note'] : []).map(action => <button className="incident-view" key={action} onClick={() => setAction(action)}>{operationLabels[action]}</button>)}</div>}
    {error && <p className="report-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {action && <TechnicianOperations key={`${incident.id}-${action}`} incident={incident} action={action} onAction={onAction} onClose={() => setAction(null)} />}
  </>;
}
