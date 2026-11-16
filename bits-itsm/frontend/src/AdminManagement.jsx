import React, { useEffect, useState } from 'react';
import { apiRequest, apiSend } from './api.js';
import { readableLabel } from './MyIncidents.jsx';

const endpoints = { 'Manage Users': 'users', 'IT Services': 'catalog', 'Incident Categories': 'catalog', 'SLA Policies': 'sla-policies', 'Escalations': 'escalations', 'Audit Logs': 'audit', 'Reports & Analytics': 'reports' };
const display = value => value == null ? '—' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);

function SavedTable({ title, columns, rows, onEdit }) {
  return <section className="dashboard-incidents admin-section"><div className="dashboard-section-heading"><h2>{title}</h2><span>{rows.length} records</span></div>
    {rows.length ? <div className="dashboard-table-scroll"><table><thead><tr>{columns.map(([key, title]) => <th key={key}>{title}</th>)}{onEdit && <th>Action</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map(([key]) => <td key={key}>{display(row[key])}</td>)}{onEdit && <td><button className="incident-view" onClick={() => onEdit(row)}>Edit</button></td>}</tr>)}</tbody></table></div> : <p className="dashboard-empty">No matching records.</p>}
  </section>;
}

export default function AdminManagement({ page }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [enabled, setEnabled] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { setRecords(await apiRequest('admin/' + endpoints[page])); }
    catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { setEditing(null); setQuery(''); setEnabled(''); load(); }, [page]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const path = page === 'Manage Users' ? 'users' + (editing.id ? '/' + editing.id : '') : page === 'SLA Policies' ? 'sla-policies/' + editing.priority : 'catalog/' + editing.kind + '/' + editing.code;
      await apiSend('admin/' + path, editing, page === 'Manage Users' && !editing.id ? 'POST' : 'PUT');
      setEditing(null); await load();
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  function field(key, value) { setEditing(previous => ({ ...previous, [key]: value })); }
  const filtered = Array.isArray(records) ? records.filter(row => Object.values(row).some(value => String(value ?? '').toLowerCase().includes(query.toLowerCase())) && (!enabled || String(row.enabled) === enabled)) : [];
  return <>
    <div className="report-actions"><button className="report-clear" disabled={loading} onClick={load}>Refresh</button>{page === 'Manage Users' && <button className="incident-view" onClick={() => setEditing({ name: '', email: '', password: '', role: 'STUDENT', studentNumber: '', skill: 'NETWORK' })}>Add User</button>}</div>
    {error && <p className="report-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading saved records…</p> : <>
      {page !== 'Reports & Analytics' && <div className="report-row"><div className="report-field"><label htmlFor="admin-search">Search saved records</label><input id="admin-search" value={query} onChange={event => setQuery(event.target.value)} /></div>{page === 'Manage Users' && <div className="report-field"><label htmlFor="account-status">Account status</label><select id="account-status" value={enabled} onChange={event => setEnabled(event.target.value)}><option value="">All</option><option value="true">Enabled</option><option value="false">Disabled</option></select></div>}</div>}
      {editing && <form className="report-form" onSubmit={save}><h2>{editing.id || editing.priority ? 'Edit saved record' : 'Create account'}</h2>
        {page === 'Manage Users' ? <>
          <div className="report-field"><label htmlFor="user-name">Full name</label><input id="user-name" required maxLength="100" value={editing.name} onChange={event => field('name', event.target.value)} /></div>
          {editing.id ? <label><input type="checkbox" checked={editing.enabled} onChange={event => field('enabled', event.target.checked)} /> Account enabled</label> : <>
            <div className="report-field"><label htmlFor="user-email">Institutional email</label><input id="user-email" type="email" required pattern="[^\s@]+@hyderabad\.bits-pilani\.ac\.in" value={editing.email} onChange={event => field('email', event.target.value)} /></div>
            <div className="report-field"><label htmlFor="user-password">Initial password</label><input id="user-password" type="password" autoComplete="new-password" required minLength="8" maxLength="72" value={editing.password} onChange={event => field('password', event.target.value)} /></div>
            <div className="report-field"><label htmlFor="user-role">Role</label><select id="user-role" value={editing.role} onChange={event => field('role', event.target.value)}>{['STUDENT', 'TECHNICIAN', 'ADMIN'].map(role => <option key={role}>{role}</option>)}</select></div>
            {editing.role === 'STUDENT' && <div className="report-field"><label htmlFor="student-number">Student ID</label><input id="student-number" required maxLength="30" value={editing.studentNumber} onChange={event => field('studentNumber', event.target.value)} /></div>}
            {editing.role === 'TECHNICIAN' && <div className="report-field"><label htmlFor="initial-skill">Initial skill</label><select id="initial-skill" value={editing.skill} onChange={event => field('skill', event.target.value)}>{['NETWORK', 'HARDWARE', 'SOFTWARE', 'DATABASE', 'AUTHENTICATION', 'SECURITY', 'APPLICATION_SUPPORT', 'CLOUD', 'STORAGE'].map(skill => <option key={skill}>{skill}</option>)}</select></div>}
          </>}
        </> : page === 'SLA Policies' ? <>
          <p>Changes apply to incidents classified after saving. Existing deadlines remain unchanged.</p>
          {['responseMinutes', 'resolutionMinutes'].map(key => <div className="report-field" key={key}><label htmlFor={key}>{key === 'responseMinutes' ? 'Response target (minutes)' : 'Resolution target (minutes)'}</label><input id={key} type="number" min="1" max="525600" required value={editing[key]} onChange={event => field(key, Number(event.target.value))} /></div>)}
        </> : <>
          <div className="report-field"><label htmlFor="catalog-label">Display name</label><input id="catalog-label" required maxLength="100" value={editing.label} onChange={event => field('label', event.target.value)} /></div>
          <label><input type="checkbox" checked={editing.enabled} onChange={event => field('enabled', event.target.checked)} /> Available for new incidents</label>
          {editing.kind === 'SERVICE' && <div className="report-field"><label htmlFor="catalog-criticality">Business criticality</label><select id="catalog-criticality" value={editing.criticality} onChange={event => field('criticality', event.target.value)}>{['LOW', 'MEDIUM', 'HIGH'].map(level => <option key={level}>{level}</option>)}</select></div>}
        </>}
        <div className="report-actions"><button className="incident-view" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="report-clear" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
      </form>}
      {page === 'Manage Users' && ['STUDENT', 'TECHNICIAN', 'ADMIN'].map(role => <SavedTable key={role} title={readableLabel(role) + ' accounts'} rows={filtered.filter(row => row.role === role)} columns={[['id', 'ID'], ['name', 'Name'], ['email', 'Institutional email'], ['studentNumber', 'Student ID'], ['enabled', 'Enabled']]} onEdit={setEditing} />)}
      {['IT Services', 'Incident Categories'].includes(page) && <SavedTable title={page} rows={filtered.filter(row => row.kind === (page === 'IT Services' ? 'SERVICE' : 'CATEGORY'))} columns={[["code", "Code"], ["label", "Name"], ["enabled", "Enabled"], ...(page === 'IT Services' ? [["criticality", "Business criticality"]] : [])]} onEdit={setEditing} />}
      {page === 'SLA Policies' && <SavedTable title={page} rows={filtered} columns={[["priority", "Priority"], ["responseMinutes", "Response minutes"], ["resolutionMinutes", "Resolution minutes"]]} onEdit={setEditing} />}
      {page === 'Escalations' && <SavedTable title={page} rows={filtered} columns={[["incidentId", "Incident"], ["level", "Escalation level"], ["reason", "Reason"], ["escalatedAt", "Escalated at"]]} />}
      {page === 'Audit Logs' && <SavedTable title={page} rows={filtered} columns={[["timestamp", "Time"], ["actorId", "Actor ID"], ["incidentId", "Incident"], ["action", "Action"], ["previous", "Before"], ["next", "After"], ["description", "Description"]]} />}
      {page === 'Reports & Analytics' && <><section className="report-form"><h2>Current service report</h2><p>Total incidents: {records.total} · Active: {records.active} · Response breaches: {records.responseBreaches} · Resolution breaches: {records.resolutionBreaches}</p><p>Average resolution: {records.averageResolutionHours ?? '—'} hours · Average feedback: {records.averageFeedback ?? '—'}/5</p></section>{['byStatus', 'byPriority', 'byCategory'].map(key => <SavedTable key={key} title={key.replace('by', 'By ')} columns={[["label", "Group"], ["count", "Incidents"]]} rows={Object.entries(records[key] || {}).map(([label, count]) => ({ label, count }))} />)}</>}
    </>}
  </>;
}
