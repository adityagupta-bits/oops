import React, { useEffect, useState } from 'react';
import UrgencyHint from './UrgencyHint.jsx';
import { apiRequest, apiSend } from './api.js';
import { readableLabel } from './MyIncidents.jsx';
import Badge from './components/ui/Badge.jsx';
import NavIcon from './components/NavIcon.jsx';
import { eligibleServices } from './serviceSetup.js';
import { AdminPasswordReset } from './PasswordSettings.jsx';

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

const display = (value) =>
  value == null ? '—' : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);

function SavedTable({ title, columns, rows, onEdit, editLabel = 'Edit' }) {
  return (
    <section className="dashboard-incidents admin-section">
      <div className="dashboard-section-heading">
        <h2>{title}</h2>
        <span className="results-counter-pill">{rows.length} records</span>
      </div>
      {rows.length ? (
        <div className="dashboard-table-scroll" role="region" aria-label={title} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {columns.map(([key, colTitle]) => (
                  <th key={key} scope="col">{colTitle}</th>
                ))}
                {onEdit && <th scope="col">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || index}>
                  {columns.map(([key]) => {
                    const val = row[key];
                    if (key === 'enabled') {
                      return (
                        <td key={key}>
                          <span className={`table-row-tag ${val ? 'tag-primary' : 'tag-neutral'}`}>
                            {val ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                      );
                    }
                    if (key === 'priority' || key === 'impact' || key === 'urgency') {
                      return (
                        <td key={key}>
                          <Badge value={val} type="priority" />
                        </td>
                      );
                    }
                    if (key === 'status') {
                      return (
                        <td key={key}>
                          <Badge value={val} type="status" />
                        </td>
                      );
                    }
                    return <td key={key}>{display(val)}</td>;
                  })}
                  {onEdit && (
                    <td>
                      <button className="incident-view" onClick={() => onEdit(row)}>
                        {editLabel}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state-panel">
          <NavIcon name="search" />
          <h3>No matching records</h3>
          <p>No records found in this management view.</p>
        </div>
      )}
    </section>
  );
}

export default function AdminManagement({ page, onNavigate }) {
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
  const [dynamicCategories, setDynamicCategories] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('admin/' + endpoints[page]);
      setRecords(data);
      if (page === 'Incident Categories') setDynamicCategories(Boolean((await apiRequest('incidents/options')).dynamicCategories));
      if (page === 'Classification Review' || page === 'Manage IT Problem Templates') {
        const catalog = await apiRequest('admin/catalog');
        setCatalogOptions({
          services: eligibleServices(catalog),
          categories: catalog.filter((item) => item.kind === 'CATEGORY' && item.enabled),
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setEditing(null);
    setQuery('');
    setEnabled('');
    setCorrectionReason('');
    load();
  }, [page]);

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (page === 'Manage IT Problem Templates') {
        await apiSend(
          'admin/problem-templates' + (editing.id ? '/' + editing.id : ''),
          editing,
          editing.id ? 'PUT' : 'POST'
        );
        setEditing(null);
        await load();
        return;
      }
      if (page === 'Classification Review') {
        if (!editing.affectedService) throw new Error('Please select an affected service.');
        if (!correctionReason.trim() || correctionReason.trim().length < 5)
          throw new Error('Mandatory audit reason must contain at least 5 characters.');
        await apiSend(`admin/incidents/${editing.id}/classify`, {
          affectedService: editing.affectedService,
          category: editing.category,
          impact: editing.impact || 'MEDIUM',
          urgency: editing.urgency || 'MEDIUM',
          reason: correctionReason.trim(),
        });
        setEditing(null);
        setCorrectionReason('');
        await load();
        return;
      }

      if (page === 'Urgency & Impact Rules') {
        await apiSend('admin/classification-settings', records, 'PUT');
        await load();
        return;
      }

      const path =
        page === 'Incident Categories' && !editing.id ? 'catalog/categories' : page === 'IT Services' && !editing.id ? 'catalog/services' : page === 'Manage Users'
          ? 'users' + (editing.id ? '/' + editing.id : '')
          : page === 'SLA Policies'
          ? 'sla-policies/' + editing.priority
          : 'catalog/' + editing.kind + '/' + editing.code;
      const payload = editing.kind === 'SERVICE' && editing.id && !editing.description?.trim()
        ? { ...editing, description: null } : editing;
      await apiSend('admin/' + path, payload, ['Manage Users', 'IT Services', 'Incident Categories'].includes(page) && !editing.id ? 'POST' : 'PUT');
      setSuccess(page === 'Manage Users'
        ? 'Account saved successfully.'
        : page === 'IT Services'
          ? (editing.id ? 'Service saved successfully.' : 'Custom service created successfully.')
          : 'Changes saved successfully.');
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function field(key, value) {
    setEditing((previous) => ({ ...previous, [key]: value }));
  }
  function settingField(key, value) {
    setRecords((previous) => ({ ...previous, [key]: value }));
  }

  const filtered = Array.isArray(records)
    ? records.filter(
        (row) =>
          Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query.toLowerCase())) &&
          (!enabled || String(row.enabled) === enabled)
      )
    : [];

  if (page === 'Manage IT Problem Templates') {
    return (
      <section className="admin-management-container problem-templates-page">
        <div className="report-actions template-toolbar">
          <p>Create reusable starting points for student reports.</p>
          <button
            className="incident-view"
            onClick={() =>
              setEditing({
                title: '',
                category: '',
                description: '',
                keywords: '',
                enabled: true,
                displayOrder: 0,
                serviceCode: null,
              })
            }
          >
            Create template
          </button>
        </div>

        {error && <p className="report-error" role="alert">{error}</p>}

        {editing && (
          <form className="report-form admin-section template-editor" onSubmit={save}>
            <h3>{editing.id ? 'Edit Problem Template' : 'Create Problem Template'}</h3>
            <p className="report-guidance">
              Set the details students see when choosing a common problem.
            </p>

            <div className="report-field">
              <label htmlFor="template-title">Template title</label>
              <input
                id="template-title"
                value={editing.title}
                required
                maxLength={100}
                onChange={(e) => field('title', e.target.value)}
              />
            </div>

            <div className="report-field">
              <label htmlFor="template-category">Category group</label>
              <input
                id="template-category"
                value={editing.category}
                required
                maxLength={100}
                placeholder="e.g. Network &amp; Wi-Fi, Campus Software, Lab Hardware"
                onChange={(e) => field('category', e.target.value)}
              />
            </div>

            <div className="report-field">
              <label htmlFor="template-desc">Suggested details</label>
              <textarea
                id="template-desc"
                rows={3}
                maxLength={2000}
                value={editing.description}
                onChange={(e) => field('description', e.target.value)}
              />
            </div>

            <div className="report-field">
              <label htmlFor="template-keywords">Classification keywords (comma-separated)</label>
              <input
                id="template-keywords"
                value={editing.keywords}
                maxLength={1000}
                placeholder="e.g. wifi, hostel, eduroam, disconnect"
                onChange={(e) => field('keywords', e.target.value)}
              />
            </div>
            <div className="report-field">
              <label htmlFor="template-service">Suggested affected service</label>
              <select id="template-service" value={editing.serviceCode || ''} onChange={e => field('serviceCode', e.target.value || null)}>
                <option value="">No service hint</option>
                {editing.serviceCode && !catalogOptions.services.some(s => s.code === editing.serviceCode) && <option value={editing.serviceCode}>{editing.serviceCode} (currently inactive)</option>}
                {catalogOptions.services.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
              <p className="report-guidance">Only enabled, configured services are suggested to students. Existing mappings are preserved.</p>
            </div>
            <div className="report-field"><label htmlFor="template-category-code">Suggested incident category</label>
              <select id="template-category-code" value={editing.categoryCode || ''} onChange={e => field('categoryCode',e.target.value || null)}>
                <option value="">No category suggestion</option>
                {editing.categoryCode && !catalogOptions.categories.some(c => c.code===editing.categoryCode) && <option value={editing.categoryCode}>{editing.categoryCode} (inactive)</option>}
                {catalogOptions.categories.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select></div>

            <div className="report-row">
              <div className="report-field">
                <label htmlFor="template-order">Display order</label>
                <input
                  id="template-order"
                  type="number"
                  min="0"
                  value={editing.displayOrder}
                  onChange={(e) => field('displayOrder', Number(e.target.value))}
                />
              </div>
              <div className="report-field checkbox-field template-availability">
                <label>
                  <input
                    type="checkbox"
                    checked={editing.enabled}
                    onChange={(e) => field('enabled', e.target.checked)}
                  />{' '}
                  <span>Available to students</span>
                </label>
              </div>
            </div>

            <div className="report-actions">
              <button className="submit-button-sm" disabled={busy}>
                {busy ? 'Saving…' : 'Save Template'}
              </button>
              <button type="button" className="report-clear" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <SavedTable
          title={page}
          rows={Array.isArray(records) ? records : []}
          columns={[
            ['title', 'Problem Template Title'],
            ['category', 'Category Group'],
            ['enabled', 'Status'],
            ['displayOrder', 'Sort Order'],
          ]}
          onEdit={setEditing}
        />
      </section>
    );
  }

  return (
    <section className="admin-management-container">
      {success && <p className="status-message status-success" role="status">{success}</p>}

      <div className="report-actions" style={{ marginBottom: '1rem' }}>
        <button className="report-clear" disabled={loading} onClick={load}>
          Refresh Records
        </button>
        {page === 'Manage Users' && (
          <button
            className="incident-view"
            onClick={() =>
              setEditing({
                name: '',
                email: '',
                password: '',
                role: 'STUDENT',
                studentNumber: '',
                skill: 'NETWORK',
              })
            }
          >
            + Add New User
          </button>
        )}
      </div>

      {error && <p className="report-error" role="alert">{error}</p>}

      {page === 'Incident Categories' && dynamicCategories && <button type="button" className="incident-view" onClick={() => setEditing({kind:'CATEGORY',code:'',label:'',keywords:'',enabled:false,requiredSkill:null})}>Add Category</button>}
      {page === 'IT Services' && <button type="button" className="incident-view" onClick={() => setEditing({kind:'SERVICE',code:'',label:'',description:'',keywords:'',criticality:null,enabled:false})}>Add Custom Service</button>}

      {loading ? (
        <div className="loading-state-box" role="status">
          <span className="spinner-border" aria-hidden="true" />
          <span>Loading saved records from PostgreSQL…</span>
        </div>
      ) : (
        <>
          {!['Reports & Analytics', 'Urgency & Impact Rules'].includes(page) && (
            <div className="incident-filters admin-filters" style={{ marginBottom: '1.25rem' }}>
              <div className="report-field search-field">
                <label htmlFor="admin-search">Search Saved Records</label>
                <div className="input-with-icon">
                  <NavIcon name="search" />
                  <input
                    id="admin-search"
                    placeholder="Search by name, code, or keyword…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
              </div>
              {page === 'Manage Users' && (
                <div className="report-field">
                  <label htmlFor="account-status">Account Status</label>
                  <select id="account-status" value={enabled} onChange={(event) => setEnabled(event.target.value)}>
                    <option value="">All Accounts</option>
                    <option value="true">Active Only</option>
                    <option value="false">Disabled Only</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {page === 'Urgency & Impact Rules' && records && (
            <form className="report-form admin-section" onSubmit={save}>
              <h2>Automatic Classification &amp; Severity Engine Rules</h2>
              <p>
                Configure backend keyword weights used by the classification engine to determine urgency, blast radius/impact, and threshold gating. Values persist directly in PostgreSQL.
              </p>
              <fieldset disabled={busy} style={{ border: 0, padding: 0 }}>
                <div className="settings-toggle-group">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={Boolean(records.autoClassifyEnabled)}
                      onChange={(event) => settingField('autoClassifyEnabled', event.target.checked)}
                    />
                    <div>
                      <strong>Enable Automatic Backend Classification</strong>
                      <p>When enabled, tickets are evaluated by keyword classifiers on creation.</p>
                    </div>
                  </label>

                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={Boolean(records.flagUncertain)}
                      onChange={(event) => settingField('flagUncertain', event.target.checked)}
                    />
                    <div>
                      <strong>Flag Uncertain Classifications for Administrator Review</strong>
                      <p>Prevents inventing arbitrary services or fake urgency when keyword confidence is low.</p>
                    </div>
                  </label>
                </div>

                <div className="report-field">
                  <label htmlFor="high-urgency-kw">High Urgency Keywords (comma-separated)</label>
                  <textarea
                    id="high-urgency-kw"
                    rows={2}
                    value={records.highUrgencyKeywords || ''}
                    onChange={(event) => settingField('highUrgencyKeywords', event.target.value)}
                  />
                </div>

                <div className="report-field">
                  <label htmlFor="low-urgency-kw">Low Urgency Keywords (comma-separated)</label>
                  <textarea
                    id="low-urgency-kw"
                    rows={2}
                    value={records.lowUrgencyKeywords || ''}
                    onChange={(event) => settingField('lowUrgencyKeywords', event.target.value)}
                  />
                </div>

                <div className="report-field">
                  <label htmlFor="high-impact-kw">High Impact Keywords (campus-wide disruption, comma-separated)</label>
                  <textarea
                    id="high-impact-kw"
                    rows={2}
                    value={records.highImpactKeywords || ''}
                    onChange={(event) => settingField('highImpactKeywords', event.target.value)}
                  />
                </div>

                <div className="report-field">
                  <label htmlFor="med-impact-kw">Medium Impact Keywords (multiple users/departments, comma-separated)</label>
                  <textarea
                    id="med-impact-kw"
                    rows={2}
                    value={records.mediumImpactKeywords || ''}
                    onChange={(event) => settingField('mediumImpactKeywords', event.target.value)}
                  />
                </div>

                <div className="report-row">
                  <div className="report-field">
                    <label htmlFor="default-urgency">Default Urgency (neutral keywords fallback)</label>
                    <select
                      id="default-urgency"
                      value={records.defaultUrgency || 'MEDIUM'}
                      onChange={(event) => settingField('defaultUrgency', event.target.value)}
                    >
                      {['LOW', 'MEDIUM', 'HIGH'].map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                  <div className="report-field">
                    <label htmlFor="default-impact">Default Impact (single-user baseline)</label>
                    <select
                      id="default-impact"
                      value={records.defaultImpact || 'LOW'}
                      onChange={(event) => settingField('defaultImpact', event.target.value)}
                    >
                      {['LOW', 'MEDIUM', 'HIGH'].map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="report-actions">
                  <button className="submit-button-sm" disabled={busy}>
                    {busy ? 'Saving to Database…' : 'Save Classification Rules'}
                  </button>
                </div>
              </fieldset>
            </form>
          )}

          {editing && page === 'Classification Review' && (
            <form className="report-form admin-section" onSubmit={save}>
              <h2>Review &amp; Correct Incident Classification (INC-#{editing.id})</h2>
              <div className="review-context-card">
                <p><strong>Title:</strong> {editing.title}</p>
                <p><strong>Description:</strong> {editing.description}</p>
                {editing.classificationNotes && (
                  <p className="text-warning">
                    <strong>Engine Review Note:</strong> {editing.classificationNotes}
                  </p>
                )}
              </div>

              <div className="report-row">
                <div className="report-field">
                  <label htmlFor="review-service">Affected IT Service</label>
                  <select
                    id="review-service"
                    required
                    value={editing.affectedService || ''}
                    onChange={(event) => field('affectedService', event.target.value)}
                  >
                    <option value="">Select affected service</option>
                    {catalogOptions.services.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label} ({s.criticality})
                      </option>
                    ))}
                  </select>
                  {catalogOptions.services.length === 0 && (
                    <p className="report-guidance" role="status">
                      No configured services are available. Configure business criticality and enable a service before completing review.{' '}
                      <button type="button" className="incident-view" onClick={() => onNavigate?.('IT Services')}>Open Service Setup</button>
                    </p>
                  )}
                </div>
                <div className="report-field">
                  <label htmlFor="review-category">Category</label>
                  <select
                    id="review-category"
                    value={editing.category || ''}
                    onChange={(event) => field('category', event.target.value)}
                  >
                    <option value="">Select category</option>
                    {catalogOptions.categories.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="report-row">
                <div className="report-field">
                  <label htmlFor="review-impact">Impact</label>
                  <select
                    id="review-impact"
                    value={editing.impact || 'MEDIUM'}
                    onChange={(event) => field('impact', event.target.value)}
                  >
                    {['LOW', 'MEDIUM', 'HIGH'].map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
                <div className="report-field">
                  <UrgencyHint incident={editing} onUse={value => field('urgency', value)} />
                  <label htmlFor="review-urgency">Urgency</label>
                  <select
                    id="review-urgency"
                    value={editing.urgency || 'MEDIUM'}
                    onChange={(event) => field('urgency', event.target.value)}
                  >
                    {['LOW', 'MEDIUM', 'HIGH'].map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="report-field">
                <label htmlFor="correction-reason">
                  Mandatory Audit Reason for Classification Correction <span className="field-required-mark">*</span>
                </label>
                <textarea
                  id="correction-reason"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  placeholder="Explain the factual basis for this reclassification (e.g. Student reported hostel room Wi-Fi outage; service verified as Campus Wi-Fi with High Urgency)."
                  value={correctionReason}
                  onChange={(event) => setCorrectionReason(event.target.value)}
                />
                <p className="report-guidance">
                  Minimum 5 characters. The backend automatically recalculates priority and SLA based on active administrator strategy.
                </p>
              </div>

              <div className="report-actions admin-edit-actions">
                <button className="submit-button-sm" disabled={busy}>
                  {busy ? 'Processing…' : 'Apply Classification & Recalculate'}
                </button>
                <button type="button" className="report-clear" disabled={busy} onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {editing && page !== 'Classification Review' && (
            <form className={`report-form admin-section ${page === 'Manage Users' && !editing.id ? 'create-account-form' : ''}`} onSubmit={save}>
              <h2>{page === 'IT Services'
                ? (editing.id ? 'Edit Service' : 'Create Custom Service')
                : (editing.id || editing.priority ? 'Edit Saved Record' : 'Create Account')}</h2>
              {page === 'Manage Users' ? (
                <>
                  <div className="report-field">
                    <label htmlFor="user-name">Full Name</label>
                    <input
                      id="user-name"
                      required
                      maxLength="100"
                      value={editing.name}
                      onChange={(event) => field('name', event.target.value)}
                    />
                  </div>
                  {editing.id ? (
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={editing.enabled}
                        onChange={(event) => field('enabled', event.target.checked)}
                      />{' '}
                      Account Enabled
                    </label>
                  ) : (
                    <>
                      <div className="report-field">
                        <label htmlFor="user-email">Institutional Email</label>
                        <input
                          id="user-email"
                          type="email"
                          required
                          pattern="[^\s@]+@hyderabad\.bits-pilani\.ac\.in"
                          value={editing.email}
                          onChange={(event) => field('email', event.target.value)}
                        />
                      </div>
                      <div className="report-field">
                        <label htmlFor="user-password">Initial Password</label>
                        <input
                          id="user-password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength="12"
                          maxLength="72"
                          value={editing.password}
                          onChange={(event) => field('password', event.target.value)}
                        />
                        <p className="report-guidance">Use at least 12 characters.</p>
                      </div>
                      <div className="report-field">
                        <label htmlFor="user-role">Role</label>
                        <select
                          id="user-role"
                          value={editing.role}
                          onChange={(event) => field('role', event.target.value)}
                        >
                          {['STUDENT', 'TECHNICIAN', 'ADMIN'].map((role) => (
                            <option key={role} value={role}>{role === 'ADMIN' ? 'Administrator' : readableLabel(role)}</option>
                          ))}
                        </select>
                      </div>
                      {editing.role === 'STUDENT' && (
                        <div className="report-field">
                          <label htmlFor="student-number">Student ID</label>
                          <input
                            id="student-number"
                            required
                            maxLength="30"
                            value={editing.studentNumber}
                            onChange={(event) => field('studentNumber', event.target.value)}
                          />
                        </div>
                      )}
                      {editing.role === 'TECHNICIAN' && (
                        <div className="report-field">
                          <label htmlFor="initial-skill">Initial Technical Skill</label>
                          <select
                            id="initial-skill"
                            value={editing.skill}
                            onChange={(event) => field('skill', event.target.value)}
                          >
                            {[
                              'NETWORK',
                              'HARDWARE',
                              'SOFTWARE',
                              'DATABASE',
                              'AUTHENTICATION',
                              'SECURITY',
                              'APPLICATION_SUPPORT',
                              'CLOUD',
                              'STORAGE',
                            ].map((skill) => (
                              <option key={skill}>{skill}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : page === 'SLA Policies' ? (
                <>
                  <p className="report-guidance">
                    Modifications apply to incidents classified after saving. Existing ticket deadlines remain untouched.
                  </p>
                  {['responseMinutes', 'resolutionMinutes'].map((key) => (
                    <div className="report-field" key={key}>
                      <label htmlFor={key}>
                        {key === 'responseMinutes' ? 'Response Target (Minutes)' : 'Resolution Target (Minutes)'}
                      </label>
                      <input
                        id={key}
                        type="number"
                        min="1"
                        max="525600"
                        required
                        value={editing[key]}
                        onChange={(event) => field(key, Number(event.target.value))}
                      />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="report-field">
                    <label htmlFor="catalog-label">Display Name</label>
                    <input
                      id="catalog-label"
                      required
                      maxLength="100"
                      value={editing.label}
                      onChange={(event) => field('label', event.target.value)}
                    />
                  </div>
                  {editing.kind === 'CATEGORY' && dynamicCategories && <>
                    <div className="report-field"><label htmlFor="category-code">Category code</label><input id="category-code" required pattern="[A-Z][A-Z0-9_]{1,49}" maxLength={50} readOnly={Boolean(editing.id)} value={editing.code} onChange={e => field('code',e.target.value.toUpperCase())} /></div>
                    <div className="report-field"><label htmlFor="category-skill">Required technician skill</label><select id="category-skill" value={editing.requiredSkill || ''} onChange={e => field('requiredSkill',e.target.value || null)}><option value="">Not configured (custom categories wait for assignment review)</option>{['NETWORK','HARDWARE','SOFTWARE','DATABASE','AUTHENTICATION','SECURITY','APPLICATION_SUPPORT','CLOUD','STORAGE'].map(skill => <option key={skill}>{skill}</option>)}</select></div>
                  </>}
                  {editing.kind === 'SERVICE' && <>
                    <div className="report-field"><label htmlFor="service-code">Service Code</label><input id="service-code" required pattern="[A-Z][A-Z0-9_]{1,49}" maxLength={50} readOnly={Boolean(editing.id)} value={editing.code} onChange={e => field('code', e.target.value.toUpperCase())} /></div>
                    <div className="report-field"><label htmlFor="service-description">Description</label><textarea id="service-description" required={!editing.id} maxLength={2000} value={editing.description || ''} onChange={e => field('description', e.target.value)} /></div>
                  </>}
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={editing.enabled}
                      disabled={editing.kind === 'SERVICE' && !editing.criticality}
                      onChange={(event) => field('enabled', event.target.checked)}
                    />{' '}
                    Available for New Incidents
                  </label>
                  {editing.kind === 'SERVICE' && !editing.criticality && <p className="report-guidance">Choose business criticality below to enable this service. Existing incidents are preserved.</p>}
                  {editing.kind === 'SERVICE' && (
                    <div className="report-field">
                      <label htmlFor="catalog-criticality">Business Criticality</label>
                      <select
                        id="catalog-criticality"
                        required={editing.enabled}
                        value={editing.criticality || ''}
                        onChange={(event) => field('criticality', event.target.value || null)}
                      >
                        <option value="">Not configured - select a level</option>
                        {['LOW', 'MEDIUM', 'HIGH'].map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="report-field">
                    <label htmlFor="catalog-keywords">Classification Keywords (comma-separated)</label>
                    <textarea
                      id="catalog-keywords"
                      required={!editing.id && editing.kind === 'SERVICE'}
                      rows={3}
                      maxLength={1000}
                      placeholder="e.g. wifi, wi-fi, eduroam, wireless, lan"
                      value={editing.keywords || ''}
                      onChange={(event) => field('keywords', event.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="report-actions">
                <button className="submit-button-sm" disabled={busy}>
                  {busy ? 'Saving…' : page === 'IT Services' && !editing.id ? 'Create Custom Service' : 'Save Changes'}
                </button>
                <button type="button" className="report-clear" disabled={busy} onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {page === 'Manage Users' && editing?.id && <AdminPasswordReset key={editing.id} account={editing} />}
          {page === 'Manage Users' &&
            ['STUDENT', 'TECHNICIAN', 'ADMIN'].map((role) => (
              <SavedTable
                key={role}
                title={readableLabel(role) + ' Accounts'}
                rows={filtered.filter((row) => row.role === role)}
                columns={
                  role === 'TECHNICIAN'
                    ? [
                        ['id', 'ID'],
                        ['name', 'Full Name'],
                        ['email', 'Institutional Email'],
                        ['availability', 'Availability'],
                        ['enabled', 'Status'],
                      ]
                    : [
                        ['id', 'ID'],
                        ['name', 'Full Name'],
                        ['email', 'Institutional Email'],
                        ['studentNumber', 'Student ID'],
                        ['enabled', 'Status'],
                      ]
                }
                onEdit={setEditing}
              />
            ))}

          {['IT Services', 'Incident Categories'].includes(page) && (
            <SavedTable
              title={page}
              rows={filtered
                .filter((row) => row.kind === (page === 'IT Services' ? 'SERVICE' : 'CATEGORY'))
                .map((row) => ({
                  ...row,
                  configuration: row.criticality ? 'Configured' : 'Needs administrator configuration',
                }))}
              columns={[
                ['code', 'Code'],
                ['label', 'Name'],
                ['enabled', 'Status'],
                ...(page === 'IT Services'
                  ? [
                      ['criticality', 'Business Criticality'],
                      ['configuration', 'Config Status'],
                    ]
                  : []),
                ['keywords', 'Keywords'],
              ]}
              onEdit={setEditing}
            />
          )}

          {page === 'Classification Review' && (
            <SavedTable
              title="Incidents Awaiting Classification Review"
              rows={filtered.map((row) => ({
                ...row,
                reviewReason: row.classificationNotes || 'Uncertain keywords',
              }))}
              columns={[
                ['id', 'Incident ID'],
                ['title', 'Title'],
                ['serviceLabel', 'Detected Service'],
                ['priority', 'Priority'],
                ['reviewReason', 'Review Reason'],
                ['status', 'Status'],
              ]}
              onEdit={setEditing}
              editLabel="Review &amp; Classify"
            />
          )}

          {page === 'SLA Policies' && (
            <SavedTable
              title={page}
              rows={filtered}
              columns={[
                ['priority', 'Priority'],
                ['responseMinutes', 'Response Target (Mins)'],
                ['resolutionMinutes', 'Resolution Target (Mins)'],
              ]}
              onEdit={setEditing}
            />
          )}

          {page === 'Escalations' && (
            <SavedTable
              title={page}
              rows={filtered}
              columns={[
                ['incidentId', 'Incident ID'],
                ['level', 'Escalation Tier'],
                ['reason', 'Escalation Reason'],
                ['escalatedAt', 'Escalated At'],
              ]}
            />
          )}

          {page === 'Audit Logs' && (
            <SavedTable
              title={page}
              rows={filtered}
              columns={[
                ['timestamp', 'Time'],
                ['actorId', 'Actor ID'],
                ['incidentId', 'Incident'],
                ['action', 'Action Type'],
                ['previous', 'State Before'],
                ['next', 'State After'],
                ['description', 'Audit Description'],
              ]}
            />
          )}

          {page === 'Reports & Analytics' && (
            <>
              <section className="report-form admin-section">
                <h2>Service Quality &amp; SLA Report</h2>
                <div className="dashboard-summary">
                  <div className="dashboard-summary-card">
                    <h3>Total Incidents</h3>
                    <p>{records.total}</p>
                  </div>
                  <div className="dashboard-summary-card">
                    <h3>Active Incidents</h3>
                    <p>{records.active}</p>
                  </div>
                  <div className="dashboard-summary-card">
                    <h3>Response Breaches</h3>
                    <p className="text-warning">{records.responseBreaches}</p>
                  </div>
                  <div className="dashboard-summary-card">
                    <h3>Resolution Breaches</h3>
                    <p className="text-warning">{records.resolutionBreaches}</p>
                  </div>
                  <div className="dashboard-summary-card">
                    <h3>Avg. Resolution Time</h3>
                    <p>{records.averageResolutionHours ?? '—'} hrs</p>
                  </div>
                  <div className="dashboard-summary-card">
                    <h3>Student Satisfaction</h3>
                    <p>{records.averageFeedback ?? '—'} / 5.0</p>
                  </div>
                </div>
              </section>

              {['byStatus', 'byPriority', 'byCategory'].map((key) => (
                <SavedTable
                  key={key}
                  title={key.replace('by', 'By ')}
                  columns={[
                    ['label', 'Group'],
                    ['count', 'Incident Count'],
                  ]}
                  rows={Object.entries(records[key] || {}).map(([label, count]) => ({ label, count }))}
                />
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
