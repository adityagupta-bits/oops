import React, { useEffect, useState } from 'react';
import { apiRequest, apiPost } from './api.js';
export default function ManualEscalation({ incident, onClose, onSaved }) {
 const [state,setState]=useState(null),[level,setLevel]=useState(''),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 async function load() { try { setError(''); setState(await apiRequest(`admin/incidents/${incident.id}/escalation`)); } catch(e) { setError(e.message); } }
 useEffect(() => { load(); },[incident.id]);
 async function submit(e) { e.preventDefault(); if(busy)return; setBusy(true); setError(''); setSaved(false); try { setState(await apiPost(`admin/incidents/${incident.id}/escalation`,{level,reason})); setReason(''); setLevel(''); setSaved(true); await onSaved?.(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
 return <form onSubmit={submit}><p>Current escalation: {state?.current || (error ? 'Unavailable' : 'Loading...')}</p>{error && <p role="alert">{error}<button type="button" onClick={load}>Retry</button></p>}<>{saved && <p role="status">Escalation saved successfully.</p>}</><label>Escalation level<select required value={level} onChange={e => setLevel(e.target.value)}><option value="">Select level</option>{state?.levels.map(v => <option key={v} value={v}>{v.toLowerCase().replaceAll('_', ' ')}</option>)}</select></label><label>Reason<textarea rows={3} required minLength={5} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="report-actions"><button disabled={busy || !state}>{busy?'Saving…':'Confirm escalation'}</button><button type="button" disabled={busy} onClick={onClose}>Cancel</button></div></form>;
}
