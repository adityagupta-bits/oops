import React, { useState } from 'react';
import { apiPost } from './api.js';
import { readableLabel } from './MyIncidents.jsx';
import { commonProblemCategories, standardProblemTitles } from './commonProblems.js';

const emptyForm = { title: '', description: '' };
const validationNotice = 'Form validated successfully. Backend integration is pending. No incident has been saved.';

export default function ReportIncident({ onCancel, live = false }) {
  const [form, setForm] = useState(emptyForm);
  const [selectedProblem, setSelectedProblem] = useState('');
  const [errors, setErrors] = useState({});
  const [validated, setValidated] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedIncident, setSavedIncident] = useState(null);

  function handleProblemSelect(event) {
    const value = event.target.value;
    setSelectedProblem(value);
    if (!value) {
      return;
    }
    if (value === 'Other IT problem') {
      // Clear title if it was populated from standard templates to allow clean custom title entry,
      // while preserving any existing description.
      setForm((previous) => ({
        ...previous,
        title: standardProblemTitles.includes(previous.title) ? '' : previous.title,
      }));
    } else {
      // Auto-populate the title, preserving existing description
      setForm((previous) => ({ ...previous, title: value }));
      setErrors((previous) => ({ ...previous, title: '' }));
    }
  }

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
    if (busy) return;
    const nextErrors = {};
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

    setForm({ title, description });
    if (!live) { setValidated(true); return; }
    setBusy(true); setMessage(''); setSavedIncident(null);
    try {
      const saved = await apiPost('incidents', { title, description });
      setSavedIncident(saved);
      if (saved.needsClassificationReview || saved.priority === 'PENDING') {
        setMessage(`Incident ${saved.id} submitted successfully. Status: Awaiting Classification.`);
      } else {
        setMessage(`Incident ${saved.id} submitted successfully. Affected Service: ${saved.serviceLabel || 'Identified'} · Calculated Priority: ${saved.priority} · Status: ${readableLabel(saved.status)}.`);
      }
      setForm(emptyForm);
      setSelectedProblem('');
      setValidated(true);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  function clearForm() {
    setForm(emptyForm);
    setSelectedProblem('');
    setErrors({});
    setValidated(false);
    setMessage('');
    setSavedIncident(null);
  }

  return (
    <section className="report-incident" aria-labelledby="report-title">
      <div className="dashboard-welcome">
        <div>
          <h2 id="report-title">Report an IT Incident</h2>
          <p>Describe the issue you're experiencing. The backend automatic classification engine will identify the affected service, evaluate urgency and impact, and calculate the priority.</p>
        </div>
      </div>

      <form className="report-form" onSubmit={handleSubmit} onReset={clearForm} noValidate>
        <section className="common-problems-section" aria-labelledby="common-problems-heading">
          <h3 id="common-problems-heading" className="common-problems-heading">Common Campus IT Problems</h3>
          <div className="report-field">
            <label htmlFor="common-problem-select">Select a frequent issue (optional)</label>
            <select
              id="common-problem-select"
              name="commonProblem"
              value={selectedProblem}
              onChange={handleProblemSelect}
              aria-describedby="common-problems-hint"
            >
              <option value="">-- Choose a common problem or enter custom title below --</option>
              {commonProblemCategories.map((group) => (
                <optgroup key={group.category} label={group.category}>
                  {group.problems.map((problem) => (
                    <option key={problem} value={problem}>
                      {problem}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="report-guidance" id="common-problems-hint">
              {selectedProblem === 'Other IT problem'
                ? 'Custom issue selected — please type your specific title and description below.'
                : 'Selecting an issue automatically populates the title. You can edit the suggested title and add more details below.'}
            </p>
          </div>
        </section>

        <p className="report-guidance">
          Enter an accurate title and detailed description. Affected service, urgency, and priority are calculated automatically by the backend.
        </p>

        <div className="report-field">
          <label htmlFor="incident-title">Incident Title</label>
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
          <p className="report-error" id="title-error" role="alert">{errors.title}</p>
        </div>

        <div className="report-field">
          <label htmlFor="incident-description">Detailed Description</label>
          <textarea
            id="incident-description"
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            minLength={20}
            maxLength={2000}
            rows={6}
            placeholder="Explain the issue, when it started, what device or location was involved, and any deadlines or error messages."
            aria-invalid={Boolean(errors.description)}
            aria-describedby="description-hint description-error"
          />
          <p className="report-guidance" id="description-hint">20–2000 characters · {form.description.length}/2000</p>
          <p className="report-error" id="description-error" role="alert">{errors.description}</p>
        </div>

        <div className="report-actions">
          <button className="submit-button" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Incident'}</button>
          <button className="report-clear" type="reset" disabled={busy}>Clear Form</button>
          <button className="report-clear" type="button" onClick={onCancel}>Back to Dashboard</button>
        </div>

        {savedIncident && (
          <div className="admin-proposal" role="status" style={{ marginTop: '1rem' }}>
            <strong>Submission Details:</strong>
            <p>
              {savedIncident.needsClassificationReview || savedIncident.priority === 'PENDING' ? (
                <>Status: <strong>Awaiting Classification</strong>. Your incident has been recorded and queued for administrator review.</>
              ) : (
                <>
                  Detected Service: <strong>{savedIncident.serviceLabel || 'Campus IT'}</strong> ·
                  Calculated Priority: <strong>{savedIncident.priority}</strong> ·
                  Status: <strong>{readableLabel(savedIncident.status)}</strong>
                </>
              )}
            </p>
          </div>
        )}

        <p className="status-message" role="status" aria-hidden={live ? !message : !validated}>{live ? message : validationNotice}</p>
      </form>
    </section>
  );
}
