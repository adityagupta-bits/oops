import React, { useState } from 'react';
export default function PriorityOverride({ incident, onAction, initiallyOpen = false, onClose }) {
  const [open,setOpen]=useState(initiallyOpen), [priority,setPriority]=useState(['P1','P2','P3','P4'].includes(incident.priority) ? incident.priority : 'P3'), [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  async function submit(event) {
    event.preventDefault(); if(busy) return; setBusy(true); setError('');
    try { await onAction('priority-override',{priority,reason:reason.trim()}); setOpen(false); setReason(''); onClose?.(); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  if(!open) return <button className="incident-view" onClick={() => setOpen(true)}>Override priority</button>;
  return <form className="report-form" onSubmit={submit}><h3>Priority override</h3><p>Current effective priority: {incident.priority}</p><p>Original calculated priority: not available as a separate stored value. Consult the incident history.</p>
    <p>The original calculation remains in the activity history. Existing SLA deadlines will be preserved.</p>
    <label htmlFor="override-priority">Priority</label><select id="override-priority" value={priority} onChange={e => setPriority(e.target.value)}>{['P1','P2','P3','P4'].map(p => <option key={p}>{p}</option>)}</select>
    <label htmlFor="override-reason">Reason</label><textarea id="override-reason" rows={3} required minLength={5} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} />
    {error && <p role="alert" className="report-error">{error}</p>}
    <div className="report-actions"><button className="incident-view" disabled={busy}>{busy?'Saving…':'Save override'}</button><button type="button" className="report-clear" disabled={busy} onClick={() => { setOpen(false); onClose?.(); }}>Cancel</button></div>
  </form>;
}
