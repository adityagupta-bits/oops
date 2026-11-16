import React, { useEffect, useRef, useState } from 'react';
import { apiRequest, apiPost, apiSend } from './api.js';
import { readableLabel } from './MyIncidents.jsx';
import PriorityConfiguration from './PriorityConfiguration.jsx';

const skills = ['NETWORK', 'HARDWARE', 'SOFTWARE', 'DATABASE', 'AUTHENTICATION', 'SECURITY', 'APPLICATION_SUPPORT', 'CLOUD', 'STORAGE'];
const date = value => value ? new Date(value).toLocaleString() : 'Not reviewed';

function Table({ title, headers, rows }) {
  return <section className="dashboard-incidents admin-section"><div className="dashboard-section-heading"><h2>{title}</h2><span>Saved data</span></div>
    {rows.length ? <div className="dashboard-table-scroll" role="region" aria-label={title} tabIndex={0}><table><thead><tr>{headers.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div> : <p className="dashboard-empty">No matching records.</p>}
  </section>;
}

function ProfileForm({ technician, onSaved }) {
  const [values, setValues] = useState({ skills: technician.skills, availability: technician.availability, maxWorkload: technician.maxWorkload });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await apiSend(`admin/technicians/${technician.id}/assignment-profile`, values, 'PUT'); onSaved(); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <form className="report-form" onSubmit={submit}><h3>Assignment profile · {technician.name}</h3>
    <div className="report-field"><label htmlFor="technician-skills">Technical skills (select one or more)</label><select id="technician-skills" multiple required value={values.skills} onChange={event => setValues({ ...values, skills: [...event.target.selectedOptions].map(option => option.value) })}>{skills.map(skill => <option key={skill} value={skill}>{readableLabel(skill)}</option>)}</select><p className="report-guidance">Use Ctrl or Command to select multiple skills.</p></div>
    <div className="report-row"><div className="report-field"><label htmlFor="technician-availability">Availability</label><select id="technician-availability" value={values.availability} onChange={event => setValues({ ...values, availability: event.target.value })}>{['AVAILABLE', 'BUSY', 'UNAVAILABLE'].map(value => <option key={value}>{value}</option>)}</select></div>
    <div className="report-field"><label htmlFor="technician-capacity">Maximum active workload</label><input id="technician-capacity" type="number" min="1" max="100" required value={values.maxWorkload} onChange={event => setValues({ ...values, maxWorkload: Number(event.target.value) })} /></div></div>
    <button className="incident-view" disabled={busy}>{busy ? 'Saving…' : 'Save Assignment Profile'}</button>{message && <p className="report-error" role="alert">{message}</p>}
  </form>;
}

function StrategyForm({ current, onSaved }) {
  const [strategy, setStrategy] = useState(current.strategy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await apiSend('admin/assignment-strategy', { strategy }, 'PUT'); onSaved(); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <form className="report-form admin-section" onSubmit={submit}><h2>Assignment Strategies</h2>
    <p>Current strategy: <strong>{readableLabel(current.strategy)}</strong></p>
    <div className="report-row"><div><h3>Skill-Based Assignment</h3><p>Prefer relevant expertise, then lowest active workload, then technician ID.</p></div><div><h3>Load-Based Assignment</h3><p>Choose the lowest active workload among qualified technicians, then technician ID.</p></div></div>
    <p className="report-guidance">Both strategies enforce required category skills, enabled accounts, availability and capacity. For Other incidents, service expertise is a preference in Skill-Based mode. Saving affects future automatic assignments.</p>
    <div className="report-field"><label htmlFor="assignment-strategy">Assignment strategy</label><select id="assignment-strategy" value={strategy} onChange={event => setStrategy(event.target.value)}><option value="SKILL_BASED">Skill-Based Assignment</option><option value="LOAD_BASED">Load-Based Assignment</option></select></div>
    <button className="incident-view" disabled={busy}>{busy ? 'Saving…' : 'Save Strategy'}</button>{message && <p className="report-error" role="alert">{message}</p>}
  </form>;
}

function Review({ request, collaboration, admin, userId, onClose, onSaved }) {
  const dialog = useRef(null);
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState(null);
  const [loads, setLoads] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    dialog.current.showModal();
    Promise.all([apiRequest(`incidents/${request.incidentId}`), admin ? apiRequest('admin/technicians/workloads') : Promise.resolve([])])
      .then(([incident, workloads]) => { if (active) { setDetails(incident); setLoads(workloads); } })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [request, admin]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await apiPost(`${admin ? 'admin' : 'technician'}/${collaboration ? 'collaboration' : 'transfer'}-requests/${request.id}/${event.nativeEvent.submitter.value}`, { notes });
      onSaved(); onClose();
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="incident-dialog" aria-labelledby="request-review-title" onClose={onClose}>
    <div className="dashboard-section-heading"><h2 id="request-review-title">{collaboration ? 'Collaboration' : 'Transfer'} Request {request.id}</h2><button className="report-clear" onClick={onClose}>Close</button></div>
    <dl className="incident-details">{[
      ['Incident', `${request.incidentId} · ${request.incidentTitle}`], ['Request Status', readableLabel(request.status)],
      ['Original Primary', request.primaryTechnician.name], ['Proposed Technician', request.proposedTechnician.name],
      ['Reason', request.reason], ['Requested', date(request.requestedAt)],
      ...(collaboration ? [['Required Skill', readableLabel(request.requiredSkill)], ['Responsibility', request.responsibility]] : [['Handover Notes', request.handoverNotes]]),
      ['Reviewed By', request.reviewedBy?.name || 'Not reviewed'], ['Reviewed At', date(request.reviewedAt)], ['Review Notes', request.reviewNotes || 'None'],
      ...(details ? [['Current Primary', details.assignedTechnician?.name || 'Unassigned'], ['Incident Status', readableLabel(details.status)], ['Description', details.description], ['Priority', details.priority]] : []),
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {admin && loads.filter(load => [request.primaryTechnician.id, request.proposedTechnician.id].includes(load.id)).map(load => <section className="student-detail-section" key={load.id}><h3>{load.name}</h3><p>{load.skills.map(readableLabel).join(', ')} · {readableLabel(load.availability)}</p><p>Active workload: {load.activePrimary} primary + {load.activeCollaboration} collaboration / {load.maxWorkload} capacity.</p></section>)}
    {request.status === 'PENDING' && (admin || request.primaryTechnician.id === userId) && <form className="report-form" onSubmit={submit}>
      <div className="report-field"><label htmlFor="request-review-notes">{admin ? 'Review notes' : 'Cancellation reason'}</label><textarea id="request-review-notes" rows={3} required maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></div>
      <div className="report-actions">{admin ? <><button className="incident-view" value="approve" disabled={busy || !details}>Approve Request</button><button className="report-clear" value="reject" disabled={busy}>Reject Request</button></> : <button className="report-clear" value="cancel" disabled={busy}>Cancel Request</button>}</div>
    </form>}
    {error && <p className="report-error" role="alert">{error}</p>}
  </dialog>;
}

export default function AssignmentManagement({ mode, role, userId }) {
  const admin = role === 'ADMIN';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const path = mode === 'strategy' ? 'admin/assignment-strategy' : mode === 'workload' ? admin ? 'admin/technicians/workloads' : 'technician/workload' : `${admin ? 'admin' : 'technician'}/${mode}-requests`;
    apiRequest(path).then(result => { if (active) setData(result); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, admin, refresh]);
  function saved() { setMessage('Saved successfully.'); setProfile(null); setRefresh(value => value + 1); }
  const rows = mode === 'workload' && data ? admin ? data : [data] : [];
  const requests = Array.isArray(data) ? data.filter(item => (!status || item.status === status) && `${item.id} ${item.incidentId} ${item.reason}`.toLowerCase().includes(search.trim().toLowerCase())) : [];
  return <>
    {mode === 'strategy' && <PriorityConfiguration />}
    <div className="report-actions"><button className="report-clear" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh {mode === 'workload' ? 'Workload' : mode === 'strategy' ? 'Strategy' : 'Requests'}</button></div>
    {message && <p role="status">{message}</p>}
    {loading ? <p role="status">Loading {mode}…</p> : error ? <p className="report-error" role="alert">{error}</p> : mode === 'strategy' ? <StrategyForm key={refresh} current={data} onSaved={saved} /> : mode === 'workload' ? <>
      <p className="report-guidance">Active: Assigned, Acknowledged and In Progress. Primary and collaboration counts are separate. Resolved, Verified and Closed incidents are not active. Low: below 50%; Moderate: 50–79%; High: 80–99%; Overloaded: at or above capacity. Busy and unavailable technicians cannot receive new work.</p>
      {!admin && <section className="dashboard-summary">{[['Active Primary', data.activePrimary], ['Active Collaboration', data.activeCollaboration], ['Total Active', data.total], ['High Priority', data.highPriority], ['Resolved', data.resolvedCount], ['Remaining Capacity', data.remainingCapacity]].map(([label, count]) => <div className="dashboard-summary-card" key={label}><h3>{label}</h3><p>{count}</p></div>)}</section>}
      <Table title={admin ? 'Technician Workloads' : 'Availability & Capacity'} headers={['Technician', 'Skills', 'Availability', 'Primary', 'Collaboration', 'Total / Capacity', 'Remaining', 'Workload', ...(admin ? ['Action'] : [])]}
        rows={rows.map(item => [item.name, item.skills.map(readableLabel).join(', '), item.enabled ? readableLabel(item.availability) : 'Disabled', item.activePrimary, item.activeCollaboration, `${item.total} / ${item.maxWorkload}`, item.remainingCapacity, readableLabel(item.level), ...(admin ? [<button className="incident-view" onClick={() => setProfile(item)}>Edit {item.name}</button>] : [])])} />
      {profile && <ProfileForm key={profile.id} technician={profile} onSaved={saved} />}
    </> : <>
      <div className="incident-filters"><div className="report-field"><label htmlFor="request-search">Request, incident or reason</label><input id="request-search" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="report-field"><label htmlFor="request-status">Request status</label><select id="request-status" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(value => <option key={value}>{value}</option>)}</select></div><button className="report-clear" onClick={() => { setSearch(''); setStatus(''); }}>Clear Filters</button></div>
      <Table title={mode === 'transfer' ? 'Transfer Requests' : 'Collaboration Requests'} headers={['Request', 'Incident', 'Primary Technician', 'Proposed Technician', 'Reason', 'Status', 'Requested', 'Action']} rows={requests.map(item => [item.id, `${item.incidentId} · ${item.incidentTitle}`, item.primaryTechnician.name, item.proposedTechnician.name, item.reason, readableLabel(item.status), date(item.requestedAt), <button className="incident-view" onClick={() => setSelected(item)}>Review {item.id}</button>])} />
    </>}
    {selected && <Review request={selected} collaboration={mode === 'collaboration'} admin={admin} userId={userId} onClose={() => setSelected(null)} onSaved={saved} />}
  </>;
}
