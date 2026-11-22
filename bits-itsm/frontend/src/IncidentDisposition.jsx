import React, { useState } from 'react';
import { dispositionPayload } from './incidentDisposition.js';
import Modal from './components/ui/Modal.jsx';
import './accountForms.css';

export default function IncidentDisposition({ incident, role, onAction }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(role === 'STUDENT' ? 'WITHDRAWN' : 'INVALID');
  const [reason, setReason] = useState('');
  const [original, setOriginal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!((role === 'STUDENT' && incident.status === 'NEW') || (role === 'ADMIN' && ['NEW', 'CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status)))) return null;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const payload = dispositionPayload(kind, reason, original);
      if (payload.duplicateOf === incident.id) throw new Error('Choose a different incident as the original report.');
      await onAction('disposition', payload);
      setOpen(false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!open) return <button className="incident-view" onClick={() => setOpen(true)}>{role === 'STUDENT' ? 'Withdraw report' : 'Close as invalid or duplicate'}</button>;
  return <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title={role === 'STUDENT' ? 'Withdraw report' : 'Close without resolution'} className="account-form-dialog"><form className="refined-form" onSubmit={submit}>
    <p>The report and its history will be retained. This will not record a successful resolution.</p>
    {role === 'ADMIN' && <label>Closure type<select value={kind} onChange={e => setKind(e.target.value)} disabled={busy}><option value="INVALID">Invalid report</option><option value="DUPLICATE">Duplicate report</option></select></label>}
    {kind === 'DUPLICATE' && <label>Original incident number<input type="number" min="1" step="1" required value={original} onChange={e => setOriginal(e.target.value)} disabled={busy} /></label>}
    <label>Reason<textarea rows={4} placeholder="Explain why this report should be closed" required minLength={5} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></label>
    {error && <p className="report-error" role="alert">{error}</p>}
    <div className="form-buttons"><button className="incident-view" disabled={busy}>{busy ? 'Saving…' : 'Confirm closure'}</button><button className="incident-view" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button></div>
  </form></Modal>;
}
