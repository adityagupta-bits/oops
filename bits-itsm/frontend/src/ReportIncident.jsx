import React, { useState } from 'react';
import { incidentCategories, services } from './demoData.js';
import { readableLabel } from './MyIncidents.jsx';

const emptyForm = { title: '', category: '', affectedService: '', description: '', impact: '', urgency: '' };
const validationNotice = 'Form validated successfully. Backend integration is pending. No incident has been saved.';

// Provisional options; replace these with backend data when available.
const dropdowns = [
  { name: 'category', label: 'Incident Category', options: incidentCategories.filter((category) => category.status === 'ACTIVE').map((category) => ({ value: category.name, label: readableLabel(category.name) })) },
  { name: 'affectedService', label: 'Affected Service', options: [...services.map((service) => service.name), 'Other'].map((label) => ({ value: label, label })) },
  { name: 'impact', label: 'Impact', options: [
    { value: 'LOW', label: 'Low — Individual user affected' },
    { value: 'MEDIUM', label: 'Medium — Multiple users affected' },
    { value: 'HIGH', label: 'High — Major service disruption' },
  ] },
  { name: 'urgency', label: 'Urgency', options: [
    { value: 'LOW', label: 'Low — Can wait' },
    { value: 'MEDIUM', label: 'Medium — Needs attention soon' },
    { value: 'HIGH', label: 'High — Requires immediate attention' },
  ] },
];

export default function ReportIncident({ onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [validated, setValidated] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
    setValidated(false);
  }
// function to get 
  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    const title = form.title.trim();
    const description = form.description.trim();

    if (!title) nextErrors.title = 'Please enter an incident title.';
    else if (form.title.length > 100) nextErrors.title = 'Keep the title within 100 characters.';

    dropdowns.forEach((field) => {
      if (!field.options.some((option) => option.value === form[field.name])) {
        nextErrors[field.name] = `Please select ${field.label.toLowerCase()}.`;
      }
    });

    if (!description) nextErrors.description = 'Please describe the issue.';
    else if (description.length < 20) nextErrors.description = 'Please provide at least 20 characters of detail.';
    else if (form.description.length > 2000) nextErrors.description = 'Keep the description within 2000 characters.';

    setErrors(nextErrors);
    setValidated(false);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = Object.keys(emptyForm).find((name) => nextErrors[name]);
      event.currentTarget.elements.namedItem(firstInvalid).focus();
      return;
    }

    // Retain the validated payload for a future POST /api/incidents integration.
    setForm({ ...form, title, description });
    setValidated(true);
  }

  function clearForm() {
    setForm(emptyForm);
    setErrors({});
    setValidated(false);
  }

  function renderDropdown(field) {
    return (
      <div className="report-field" key={field.name}>
        <label htmlFor={`incident-${field.name}`}>{field.label}</label>
        <select id={`incident-${field.name}`} name={field.name} value={form[field.name]} onChange={handleChange}
          required aria-invalid={Boolean(errors[field.name])} aria-describedby={`${field.name}-error`}>
          <option value="">Select {field.label.toLowerCase()}</option>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p className="report-error" id={`${field.name}-error`} role="alert">{errors[field.name]}</p>
      </div>
    );
  }

  return (
    <section className="report-incident" aria-labelledby="report-title">
      <div className="dashboard-welcome">
        <div>
          <h2 id="report-title">Report an IT Incident</h2>
          <p>Describe your issue so our campus IT support team can assist you.</p>
        </div>
      </div>

      <form className="report-form" onSubmit={handleSubmit} onReset={clearForm} noValidate>
        <p className="report-guidance">All fields are required. Service options are provisional demo data.</p>
        <div className="report-field">
          <label htmlFor="incident-title">Incident Title</label>
          <input id="incident-title" name="title" type="text" value={form.title} onChange={handleChange} required maxLength={100}
            placeholder="e.g. Unable to connect to campus Wi-Fi" aria-invalid={Boolean(errors.title)} aria-describedby="title-error" />
          <p className="report-error" id="title-error" role="alert">{errors.title}</p>
        </div>

        <div className="report-row">{dropdowns.slice(0, 2).map(renderDropdown)}</div>

        <div className="report-field">
          <label htmlFor="incident-description">Detailed Description</label>
          <textarea id="incident-description" name="description" value={form.description} onChange={handleChange} required minLength={20} maxLength={2000} rows={5}
            placeholder="Explain the issue, when it started, and any error messages you encountered."
            aria-invalid={Boolean(errors.description)} aria-describedby="description-hint description-error" />
          <p className="report-guidance" id="description-hint">20–2000 characters · {form.description.length}/2000</p>
          <p className="report-error" id="description-error" role="alert">{errors.description}</p>
        </div>

        <div className="report-row">{dropdowns.slice(2).map(renderDropdown)}</div>
        <p className="report-guidance">Priority will be calculated by the Java backend from impact and urgency.</p>

        <div className="report-actions">
          <button className="submit-button" type="submit">Submit Incident</button>
          <button className="report-clear" type="reset">Clear Form</button>
          <button className="report-clear" type="button" onClick={onCancel}>Back to Dashboard</button>
        </div>
        <p className="status-message" role="status" aria-hidden={!validated}>{validationNotice}</p>
      </form>
    </section>
  );
}
