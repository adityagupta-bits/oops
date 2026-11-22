import React, { useState, useRef, useEffect } from 'react';
import { commonProblemCategories, standardProblemTitles } from './commonProblems.js';
import { apiPost, apiRequest } from './api.js';
import { readableLabel } from './MyIncidents.jsx';
import Badge from './components/ui/Badge.jsx';
import NavIcon from './components/NavIcon.jsx';
import { applyReportingTemplate } from './reportingTemplate.js';

const emptyForm = { category: '', affectedService: '', urgency: '', affectedUsers: '', title: '', description: '' };
const validationNotice = 'Form validated successfully. In live mode, this incident is submitted to the campus ITSM system.';

export default function ReportIncident({ onCancel, onOpenIncident, live = false }) {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [serviceHints, setServiceHints] = useState(false);
  const [reportedScope, setReportedScope] = useState(false);
  const [templateDetails, setTemplateDetails] = useState([]);
  const [problemGroups, setProblemGroups] = useState(commonProblemCategories);
  const [catalogError, setCatalogError] = useState('');
  useEffect(() => {
    let active = true;
    if (live) Promise.all([apiRequest('incidents/options'), apiRequest('student/problem-templates')]).then(([data, templates]) => {
      if (!active) return;
      setCategories(data.categories);
      setServices(data.services);
      setServiceHints(Boolean(data.serviceHints));
      setReportedScope(Boolean(data.reportedScope));
      setTemplateDetails(templates);
      const groups = new Map();
      const seen = new Set();
      for (const template of templates) {
        const key = template.title.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        if (!groups.has(template.category)) groups.set(template.category, []);
        groups.get(template.category).push(template.title);
      }
      if (!seen.has('other it problem')) groups.set('Other', [...(groups.get('Other') || []), 'Other IT problem']);
      setProblemGroups([...groups].map(([category, problems]) => ({ category, problems })));
    }).catch(error => { if (active) setCatalogError(error.message); });
    return () => { active = false; };
  }, [live]);
  const inFlight = useRef(false);
  const [selectedProblem, setSelectedProblem] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [validated, setValidated] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedIncident, setSavedIncident] = useState(null);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
    setValidated(false);
    setMessage('');
    setSavedIncident(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = {};
    if (!form.category) nextErrors.category = 'Select an incident category.';
    const title = form.title.trim();
    const description = form.description.trim();

    if (!title) nextErrors.title = 'Please enter an incident title.';
    else if (title.length > 100) nextErrors.title = 'Keep the title within 100 characters.';

    if (!description) nextErrors.description = 'Please describe the issue.';
    else if (description.length < 20) nextErrors.description = 'Please provide at least 20 characters of detail.';
    else if (description.length > 2000) nextErrors.description = 'Keep the description within 2000 characters.';

    setErrors(nextErrors);
    setValidated(false);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = Object.keys(emptyForm).find((name) => nextErrors[name]);
      event.currentTarget.elements.namedItem(firstInvalid)?.focus();
      return;
    }

    setForm(previous => ({ ...previous, title, description }));
    if (!live) {
      setValidated(true);
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setMessage('');
    setSavedIncident(null);
    try {
      const saved = await apiPost('incidents', { title, description, category: form.category, affectedService: form.affectedService || null, urgency: form.urgency || null, ...(reportedScope ? {affectedUsers:form.affectedUsers ? Number(form.affectedUsers) : null} : {}) });
      setSavedIncident(saved);
      if (saved.needsClassificationReview || saved.priority === 'PENDING') {
        setMessage(`Incident ${saved.id} submitted successfully. Status: Awaiting Classification.`);
      } else {
        setMessage(
          `Incident ${saved.id} submitted successfully. Affected Service: ${saved.serviceLabel || 'Identified'} · Calculated Priority: ${saved.priority} · Status: ${readableLabel(saved.status)}.`
        );
      }
      setForm(emptyForm);
      setSelectedProblem('');
      setValidated(true);
    } catch (error) {
      setMessage(error.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function clearForm() {
    setSelectedProblem('');
    setForm(emptyForm);
    setErrors({});
    setValidated(false);
    setMessage('');
    setSavedIncident(null);
  }

  const descLength = form.description.length;
  const isDescValid = descLength >= 20 && descLength <= 2000;

  return (
    <section className="report-incident" aria-labelledby="report-title">
      <div className="dashboard-welcome">
        <div>
          <h2 id="report-title">Report an IT Incident</h2>
          <p>
            Describe what happened and where. BITSolve determines the service and priority automatically.
          </p>
        </div>
      </div>

      <form className="report-form" onSubmit={handleSubmit} onReset={clearForm} noValidate>
        <div className="report-field">
          <label htmlFor="incident-category">Incident Category *</label>
          <select id="incident-category" name="category" value={form.category} onChange={handleChange} required disabled={busy} aria-invalid={Boolean(errors.category)}>
            <option value="">Select a category</option>
            {categories.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
          </select>
          {(errors.category || catalogError) && <p role="alert" className="report-error">{errors.category || catalogError}</p>}
        </div>
        {serviceHints && <div className="report-field">
          <label htmlFor="reported-service">Affected service (optional)</label>
          <select id="reported-service" name="affectedService" value={form.affectedService} onChange={handleChange} disabled={busy}>
            <option value="">Not sure</option>
            {services.map(service => <option key={service.value} value={service.value}>{service.label}</option>)}
          </select>
          <p className="report-guidance">Your selection is a hint. The system independently checks the description and configured service rules.</p>
        </div>}
        <div className="report-field">
          <label htmlFor="reported-urgency">How urgently do you need this issue resolved?</label>
          <select id="reported-urgency" name="urgency" value={form.urgency} onChange={handleChange} disabled={busy}>
            <option value="">Let the support team evaluate</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
          </select>
          <p className="report-guidance">This is your suggestion. Backend rules determine the final urgency and priority.</p>
        </div>
        <div className="report-field">
          {reportedScope && <div className="report-field"><label htmlFor="affected-users">How many people are affected? (optional estimate)</label><input id="affected-users" name="affectedUsers" type="number" min="1" max="2147483647" step="1" value={form.affectedUsers} onChange={handleChange} disabled={busy} /><p className="report-guidance">An estimate, not a verified outage count. Describe the observed scope so support can assess impact.</p></div>}
          <label htmlFor="common-problem">Common Campus IT Problems</label>
          <select id="common-problem" value={selectedProblem} disabled={busy} onChange={(event) => {
            const value = event.target.value;
            setSelectedProblem(value);
            const template = templateDetails.find(t => t.title === value);
            setForm(previous => applyReportingTemplate(previous, value, template, problemGroups.flatMap(group => group.problems), serviceHints));
            setErrors(previous => ({ ...previous, title: '' }));
            setMessage(''); setValidated(false); setSavedIncident(null);
          }}>
            <option value="">Choose a common problem (optional)</option>
            {problemGroups.map(group => <optgroup key={group.category} label={group.category}>{group.problems.map(title => <option key={title} value={title}>{title}</option>)}</optgroup>)}
          </select>
          <p className="report-guidance">You can edit the title. Your description is preserved.</p>
        </div>
        <div className="report-field">
          <label htmlFor="incident-title">
            Incident Title <span className="field-required-mark">*</span>
          </label>
          <input
            id="incident-title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            required
            maxLength={100}
            placeholder="e.g. Unable to connect to campus Wi-Fi in hostel"
            aria-invalid={Boolean(errors.title)}
            aria-describedby="title-error"
          />
          {errors.title && <p className="report-error" id="title-error" role="alert">{errors.title}</p>}
        </div>

        <div className="report-field">
          <div className="field-label-row">
            <label htmlFor="incident-description">
              Detailed Description <span className="field-required-mark">*</span>
            </label>
            <span className={`character-count ${descLength > 0 && !isDescValid ? 'invalid' : ''} ${isDescValid ? 'valid' : ''}`}>
              {descLength} / 2000 chars {descLength < 20 && descLength > 0 ? '(min 20 needed)' : ''}
            </span>
          </div>
          <textarea
            id="incident-description"
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            minLength={20}
            maxLength={2000}
            rows={6}
            placeholder="Explain the issue, when it started, what device, building or hostel room was involved, and any deadlines or error messages."
            aria-invalid={Boolean(errors.description)}
            aria-describedby="description-hint description-error"
          />
          <p className="report-guidance" id="description-hint">
            Minimum 20 characters required. The more details you provide (location, device, exact error text), the faster our team can resolve it.
          </p>
          {errors.description && <p className="report-error" id="description-error" role="alert">{errors.description}</p>}
        </div>

        <div className="report-actions">
          <button className="submit-button" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner-border spinner-sm" aria-hidden="true" />
                <span>Submitting to ITSM…</span>
              </>
            ) : (
              <>
                <NavIcon name="check" />
                <span>Submit Incident</span>
              </>
            )}
          </button>
          <button className="report-clear" type="reset" disabled={busy}>
            Clear Form
          </button>
          <button className="report-clear" type="button" onClick={onCancel} disabled={busy}>
            Back to Dashboard
          </button>
        </div>

        {savedIncident && (
          <div className="submission-result-card" role="status">
            {onOpenIncident && <button type="button" className="report-clear" onClick={() => onOpenIncident(savedIncident.id)}>Open incident #{savedIncident.id}</button>}
            <div className="submission-header">
              <span className="submission-icon" aria-hidden="true">✓</span>
              <div>
                <h4>Incident {savedIncident.id} Submitted Successfully</h4>
                <p>Recorded in BITS Hyderabad IT Service Desk</p>
              </div>
            </div>

            <div className="submission-meta-grid">
              <div>
                <span className="meta-label">Incident ID</span>
                <span className="meta-value">#{savedIncident.id}</span>
              </div>
              <div>
                <span className="meta-label">Detected Service</span>
                <span className="meta-value">{savedIncident.serviceLabel || 'Campus IT Service'}</span>
              </div>
              <div>
                <span className="meta-label">Calculated Priority</span>
                <span className="meta-value">
                  <Badge value={savedIncident.priority} type="priority" />
                </span>
              </div>
              <div>
                <span className="meta-label">Current Status</span>
                <span className="meta-value">
                  <Badge value={savedIncident.status} type="status" />
                </span>
              </div>
            </div>

            {savedIncident.needsClassificationReview && (
              <p className="submission-note">
                <strong>Administrator Review:</strong> Because this problem has unique characteristics, it has been flagged for expedited supervisor review before technician assignment.
              </p>
            )}
          </div>
        )}

        <p className="status-message" role="status" aria-hidden={live ? !message : !validated}>
          {live ? message : validationNotice}
        </p>
      </form>
    </section>
  );
}
