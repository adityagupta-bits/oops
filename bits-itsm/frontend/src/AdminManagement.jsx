import React, { useEffect, useState } from 'react';
import { apiRequest, apiSend } from './api.js';
import { readableLabel } from './MyIncidents.jsx';

const endpoints = {
  'Manage IT Problem Templates': 'problem-templates',
  'Manage Users': 'users',
  'IT Services': 'catalog',
  'Incident Categories': 'catalog',
  'SLA Policies': 'sla-policies',
  'Classification Review': 'classification-review',
  'Urgency & Impact Rules': 'classification-settings',
  'Escalations': 'escalations',
  'Audit Logs': 'audit',
  'Reports & Analytics': 'reports',
};
const display = value => value == null ? '—' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);

function SavedTable({ title, columns, rows, onEdit, editLabel = 'Edit' }) {
  return <section className="dashboard-incidents admin-section"><div className="dashboard-section-heading"><h2>{title}</h2><span>{rows.length} records</span></div>
    {rows.length ? <div className="dashboard-table-scroll"><table><thead><tr>{columns.map(([key, colTitle]) => <th key={key}>{colTitle}</th>)}{onEdit && <th>Action</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index}>{columns.map(([key]) => <td key={key}>{display(row[key])}</td>)}{onEdit && <td><button className="incident-view" onClick={() => onEdit(row)}>{editLabel}</button></td>}</tr>)}</tbody></table></div> : <p className="dashboard-empty">No matching records.</p>}
  </section>;
}

export default function AdminManagement({ page }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [enabled, setEnabled] = useState('');
  const [catalogOptions, setCatalogOptions] = useState({ services: [], categories: [] });
  const [correctionReason, setCorrectionReason] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await apiRequest('admin/' + endpoints[page]);
      setRecords(data);
      if (page === 'Classification Review') {
        const catalog = await apiRequest('admin/catalog');
        setCatalogOptions({
          services: catalog.filter(item => item.kind === 'SERVICE' && item.enabled),
          categories: catalog.filter(item => item.kind === 'CATEGORY' && item.enabled),
        });
      }
    }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { setEditing(null); setQuery(''); setEnabled(''); setCorrectionReason(''); load(); }, [page]);

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      if (page === 'Manage IT Problem Templates') {
        await apiSend('admin/problem-templates' + (editing.id ? '/' + editing.id : ''), editing, editing.id ? 'PUT' : 'POST');
        setEditing(null); await load(); return;
      }
      if (page === 'Classification Review') {
        if (!editing.affectedService) throw new Error('Please select an affected service.');
        if (!correctionReason.trim() || correctionReason.trim().length < 5) throw new Error('Mandatory audit reason must contain at least 5 characters.');
        await apiSend(`admin/incidents/${editing.id}/classify`, {
          affectedService: editing.affectedService,
          category: editing.category,
          impact: editing.impact || 'MEDIUM',
          urgency: editing.urgency || 'MEDIUM',
          reason: correctionReason.trim(),
        });
        setEditing(null); setCorrectionReason(''); await load();
        return;
      }

      if (page === 'Urgency & Impact Rules') {
        await apiSend('admin/classification-settings', records, 'PUT');
        await load();
        return;
      }

      const path = page === 'Manage Users' ? 'users' + (editing.id ? '/' + editing.id : '') : page === 'SLA Policies' ? 'sla-policies/' + editing.priority : 'catalog/' + editing.kind + '/' + editing.code;
      await apiSend('admin/' + path, editing, page === 'Manage Users' && !editing.id ? 'POST' : 'PUT');
      setSuccess(page === 'Manage Users' ? 'Account saved successfully.' : 'Changes saved successfully.');
      setEditing(null); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function field(key, value) { setEditing(previous => ({ ...previous, [key]: value })); }
  function settingField(key, value) { setRecords(previous => ({ ...previous, [key]: value })); }

  const filtered = Array.isArray(records) ? records.filter(row => Object.values(row).some(value => String(value ?? '').toLowerCase().includes(query.toLowerCase())) && (!enabled || String(row.enabled) === enabled)) : [];

  if (page === 'Manage IT Problem Templates') return <>
    <button className="report-clear" onClick={() => setEditing({ title: '', category: '', description: '', keywords: '', enabled: true, displayOrder: 0, serviceCode: null })}>Add Problem Template</button>
    {error && <p role="alert">{error}</p>}
    {editing && <form className="report-form" onSubmit={save}>
      {['title', 'category', 'description', 'keywords'].map(key => <div className="report-field" key={key}><label htmlFor={'template-' + key}>{readableLabel(key)}</label><input id={'template-' + key} value={editing[key]} required={['title','category'].includes(key)} maxLength={['title','category'].includes(key) ? 100 : 2000} onChange={event => field(key,event.target.value)} /></div>)}
      <div className="report-field"><label htmlFor="template-order">Display order</label><input id="template-order" type="number" min="0" value={editing.displayOrder} onChange={event => field('displayOrder',Number(event.target.value))} /></div>
      <label><input type="checkbox" checked={editing.enabled} onChange={event => field('enabled',event.target.checked)} /> Enabled</label>
      <div className="report-actions"><button className="report-clear" disabled={busy}>Save</button><button type="button" className="report-clear" onClick={() => setEditing(null)}>Cancel</button></div>
    </form>}
    <SavedTable title={page} rows={Array.isArray(records) ? records : []} columns={ [['title','Problem'],['category','Category'],['enabled','Enabled'],['displayOrder','Order']] } onEdit={setEditing} />
  </>;

  return <>
    {success && <p className="status-message" role="status">{success}</p>}
    <div className="report-actions">
      <button className="report-clear" disabled={loading} onClick={load}>Refresh</button>
      {page === 'Manage Users' && <button className="incident-view" onClick={() => setEditing({ name: '', email: '', password: '', role: 'STUDENT', studentNumber: '', skill: 'NETWORK' })}>Add User</button>}
    </div>
    {error && <p className="report-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading saved records…</p> : <>
      {!['Reports & Analytics', 'Urgency & Impact Rules'].includes(page) && (
        <div className="report-row">
          <div className="report-field"><label htmlFor="admin-search">Search saved records</label><input id="admin-search" value={query} onChange={event => setQuery(event.target.value)} /></div>
          {page === 'Manage Users' && <div className="report-field"><label htmlFor="account-status">Account status</label><select id="account-status" value={enabled} onChange={event => setEnabled(event.target.value)}><option value="">All</option><option value="true">Enabled</option><option value="false">Disabled</option></select></div>}
        </div>
      )}

      {page === 'Urgency & Impact Rules' && records && (
        <form className="report-form admin-section" onSubmit={save}>
          <h2>Automatic Classification & Severity Engine Rules</h2>
          <p>Configure backend rules used to determine incident urgency, scope/impact, and handling of uncertain classifications. Values persist in PostgreSQL.</p>
          <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <input type="checkbox" checked={Boolean(records.autoClassifyEnabled)} onChange={event => settingField('autoClassifyEnabled', event.target.checked)} /> <strong>Enable Automatic Backend Classification</strong>
            </label>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <input type="checkbox" checked={Boolean(records.flagUncertain)} onChange={event => settingField('flagUncertain', event.target.checked)} /> <strong>Flag uncertain classifications for administrator review</strong> (prevents inventing arbitrary services or fake urgency)
            </label>
            <div className="report-field">
              <label htmlFor="high-urgency-kw">High Urgency Keywords (comma-separated)</label>
              <textarea id="high-urgency-kw" rows={2} value={records.highUrgencyKeywords || ''} onChange={event => settingField('highUrgencyKeywords', event.target.value)} />
            </div>
            <div className="report-field">
              <label htmlFor="low-urgency-kw">Low Urgency Keywords (comma-separated)</label>
              <textarea id="low-urgency-kw" rows={2} value={records.lowUrgencyKeywords || ''} onChange={event => settingField('lowUrgencyKeywords', event.target.value)} />
            </div>
            <div className="report-field">
              <label htmlFor="high-impact-kw">High Impact Keywords (campus/wide disruption, comma-separated)</label>
              <textarea id="high-impact-kw" rows={2} value={records.highImpactKeywords || ''} onChange={event => settingField('highImpactKeywords', event.target.value)} />
            </div>
            <div className="report-field">
              <label htmlFor="med-impact-kw">Medium Impact Keywords (multiple users/departments, comma-separated)</label>
              <textarea id="med-impact-kw" rows={2} value={records.mediumImpactKeywords || ''} onChange={event => settingField('mediumImpactKeywords', event.target.value)} />
            </div>
            <div className="report-row">
              <div className="report-field">
                <label htmlFor="default-urgency">Default Urgency (when keywords are neutral)</label>
                <select id="default-urgency" value={records.defaultUrgency || 'MEDIUM'} onChange={event => settingField('defaultUrgency', event.target.value)}>
                  {['LOW', 'MEDIUM', 'HIGH'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </div>
              <div className="report-field">
                <label htmlFor="default-impact">Default Impact (single user default)</label>
                <select id="default-impact" value={records.defaultImpact || 'LOW'} onChange={event => settingField('defaultImpact', event.target.value)}>
                  {['LOW', 'MEDIUM', 'HIGH'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </div>
            </div>
            <div className="report-actions">
              <button className="incident-view" disabled={busy}>{busy ? 'Saving…' : 'Save Classification Rules'}</button>
            </div>
          </fieldset>
        </form>
      )}

      {editing && page === 'Classification Review' && (
        <form className="report-form" onSubmit={save}>
          <h2>Review & Correct Incident Classification (INC-{editing.id})</h2>
          <p><strong>Title:</strong> {editing.title}</p>
          <p><strong>Description:</strong> {editing.description}</p>
          {editing.classificationNotes && <p className="report-guidance"><strong>Review Note:</strong> {editing.classificationNotes}</p>}

          <div className="report-row">
            <div className="report-field">
              <label htmlFor="review-service">Affected IT Service</label>
              <select id="review-service" required value={editing.affectedService || ''} onChange={event => field('affectedService', event.target.value)}>
                <option value="">Select affected service</option>
                {catalogOptions.services.map(s => <option key={s.code} value={s.code}>{s.label} ({s.criticality || 'No criticality'})</option>)}
              </select>
            </div>
            <div className="report-field">
              <label htmlFor="review-category">Category</label>
              <select id="review-category" value={editing.category || ''} onChange={event => field('category', event.target.value)}>
                <option value="">Select category</option>
                {catalogOptions.categories.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="report-row">
            <div className="report-field">
              <label htmlFor="review-impact">Impact</label>
              <select id="review-impact" value={editing.impact || 'MEDIUM'} onChange={event => field('impact', event.target.value)}>
                {['LOW', 'MEDIUM', 'HIGH'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div className="report-field">
              <label htmlFor="review-urgency">Urgency</label>
              <select id="review-urgency" value={editing.urgency || 'MEDIUM'} onChange={event => field('urgency', event.target.value)}>
                {['LOW', 'MEDIUM', 'HIGH'].map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
          </div>

          <div className="report-field">
            <label htmlFor="correction-reason">Mandatory Audit Reason for Classification Correction</label>
            <textarea id="correction-reason" required minLength={5} maxLength={500} rows={3}
              placeholder="Explain the factual basis for this correction (e.g. Student reported hostel WiFi failure; service verified as Campus Wi-Fi)."
              value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} />
            <p className="report-guidance">Minimum 5 characters. The backend recalculates priority and SLA based on active administrator strategy.</p>
          </div>

          <div className="report-actions">
            <button className="incident-view" disabled={busy}>{busy ? 'Processing…' : 'Apply Classification & Recalculate'}</button>
            <button type="button" className="report-clear" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      {editing && page !== 'Classification Review' && (
        <form className="report-form" onSubmit={save}>
          <h2>{editing.id || editing.priority ? 'Edit saved record' : 'Create account'}</h2>
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
            {editing.kind === 'SERVICE' && <div className="report-field"><label htmlFor="catalog-criticality">Business criticality</label><select id="catalog-criticality" required={editing.enabled} value={editing.criticality || ''} onChange={event => field('criticality', event.target.value || null)}><option value="">Not configured - select a level</option>{['LOW', 'MEDIUM', 'HIGH'].map(level => <option key={level}>{level}</option>)}</select></div>}
            <div className="report-field"><label htmlFor="catalog-keywords">Classification keywords (comma-separated)</label><textarea id="catalog-keywords" rows={3} maxLength={1000} placeholder="e.g. wifi, wi-fi, eduroam, wireless" value={editing.keywords || ''} onChange={event => field('keywords', event.target.value)} /></div>
          </>}
          <div className="report-actions"><button className="incident-view" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="report-clear" disabled={busy} onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      )}

      {page === 'Manage Users' && ['STUDENT', 'TECHNICIAN', 'ADMIN'].map(role => <SavedTable key={role} title={readableLabel(role) + ' accounts'} rows={filtered.filter(row => row.role === role)} columns={role === 'TECHNICIAN' ? [['id', 'ID'], ['name', 'Name'], ['email', 'Institutional email'], ['availability', 'Availability'], ['enabled', 'Enabled']] : [['id', 'ID'], ['name', 'Name'], ['email', 'Institutional email'], ['studentNumber', 'Student ID'], ['enabled', 'Enabled']]} onEdit={setEditing} />)}
      {['IT Services', 'Incident Categories'].includes(page) && <SavedTable title={page} rows={filtered.filter(row => row.kind === (page === 'IT Services' ? 'SERVICE' : 'CATEGORY')).map(row => ({ ...row, configuration: row.criticality ? 'Configured' : 'Needs administrator configuration' }))} columns={[["code", "Code"], ["label", "Name"], ["enabled", "Enabled"], ...(page === 'IT Services' ? [["criticality", "Business criticality"], ["configuration", "Configuration status"]] : []), ["keywords", "Keywords"]]} onEdit={setEditing} />}
      {page === 'Classification Review' && (
        <SavedTable title="Incidents Awaiting Classification Review" rows={filtered.map(row => ({ ...row, reviewReason: row.classificationNotes || 'Uncertain keywords' }))} columns={[["id", "Incident ID"], ["title", "Title"], ["serviceLabel", "Detected Service"], ["priority", "Priority"], ["reviewReason", "Review Reason"], ["status", "Status"]]} onEdit={setEditing} editLabel="Review & Classify" />
      )}
      {page === 'SLA Policies' && <SavedTable title={page} rows={filtered} columns={[["priority", "Priority"], ["responseMinutes", "Response minutes"], ["resolutionMinutes", "Resolution minutes"]]} onEdit={setEditing} />}
      {page === 'Escalations' && <SavedTable title={page} rows={filtered} columns={[["incidentId", "Incident"], ["level", "Escalation level"], ["reason", "Reason"], ["escalatedAt", "Escalated at"]]} />}
      {page === 'Audit Logs' && <SavedTable title={page} rows={filtered} columns={[["timestamp", "Time"], ["actorId", "Actor ID"], ["incidentId", "Incident"], ["action", "Action"], ["previous", "Before"], ["next", "After"], ["description", "Description"]]} />}
      {page === 'Reports & Analytics' && <><section className="report-form"><h2>Current service report</h2><p>Total incidents: {records.total} · Active: {records.active} · Response breaches: {records.responseBreaches} · Resolution breaches: {records.resolutionBreaches}</p><p>Average resolution: {records.averageResolutionHours ?? '—'} hours · Average feedback: {records.averageFeedback ?? '—'}/5</p></section>{['byStatus', 'byPriority', 'byCategory'].map(key => <SavedTable key={key} title={key.replace('by', 'By ')} columns={[["label", "Group"], ["count", "Incidents"]]} rows={Object.entries(records[key] || {}).map(([label, count]) => ({ label, count }))} />)}</>}
    </>}
  </>;
}
