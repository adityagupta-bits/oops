import React, { useEffect, useRef, useState } from 'react';
import { readableLabel } from '../MyIncidents.jsx';
import { technicians, technicianWorkload } from '../demoData.js';

export const operationLabels = {
  acknowledge: 'Acknowledge Incident', start: 'Start Investigation', note: 'Add Investigation Note',
  information: 'Request Additional Information', transfer: 'Request Transfer', collaboration: 'Request Collaborator',
  escalate: 'Escalate Incident', resolution: 'Provide Resolution', resolve: 'Mark as Resolved',
};

const transferReasons = ['Excessive workload', 'Insufficient technical expertise', 'Technician unavailable', 'Incorrect initial assignment', 'Another technician better suited', 'Urgent redistribution', 'Other'];
const escalationReasons = ['SLA Deadline Approaching', 'Critical Incident', 'Insufficient Resources', 'Technical Expertise Required', 'Technician Unavailable', 'Administrator Intervention Required', 'Other'];
const informationTypes = ['Screenshot of error', 'Device information', 'Exact error message', 'Time problem occurred', 'Steps to reproduce issue', 'Other'];
const lifecycleExplanations = {
  acknowledge: 'Acknowledgment requires the backend to validate ASSIGNED → ACKNOWLEDGED and record the acting technician.',
  start: 'Starting an investigation requires the backend to validate ACKNOWLEDGED → IN_PROGRESS and record the activity.',
  resolve: 'Marking an incident as resolved requires a resolution record and a valid IN_PROGRESS → RESOLVED transition. Prepare the information using Provide Resolution. Student or administrator verification and closure happen later.',
};

function operationFields(action, candidates) {
  const receivingTechnician = { name: 'technicianId', label: action === 'transfer' ? 'Suggested Receiving Technician' : 'Suggested Collaborator', options: candidates.map((person) => [person.id, `${person.name} (${person.id})`]) };
  switch (action) {
    case 'transfer': return [
      { name: 'reason', label: 'Transfer Reason', options: transferReasons }, receivingTechnician,
      { name: 'handover', label: 'Handover Notes' },
    ];
    case 'collaboration': return [
      { name: 'skill', label: 'Required Technical Skill', options: [...new Set(technicians.flatMap((person) => person.skills))].sort() },
      receivingTechnician, { name: 'reason', label: 'Reason for Collaboration' },
      { name: 'task', label: 'Task Description', optional: true },
    ];
    case 'note': return [
      { name: 'note', label: 'Note text' },
      { name: 'visibility', label: 'Visibility', options: ['INTERNAL', 'STUDENT_VISIBLE'] },
    ];
    case 'information': return [
      { name: 'information', label: 'Information requested', options: informationTypes },
      { name: 'message', label: 'Message to student' },
    ];
    case 'resolution': return [
      { name: 'summary', label: 'Resolution Summary' }, { name: 'steps', label: 'Steps Taken' },
      { name: 'rootCause', label: 'Root Cause', optional: true }, { name: 'notes', label: 'Additional Notes', optional: true },
    ];
    case 'escalate': return [
      { name: 'reason', label: 'Escalation Reason', options: escalationReasons },
      { name: 'explanation', label: 'Explanation' }, { name: 'requestedAction', label: 'Requested Administrator Action' },
    ];
    default: return [];
  }
}

export default function TechnicianOperations({ action, incident, technicianId, onClose }) {
  const dialog = useRef(null);
  const previewPanel = useRef(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(false);
  const primary = technicians.find((person) => person.id === incident.primaryTechnicianId);
  const candidates = technicians.filter((person) => person.id !== incident.primaryTechnicianId && (action !== 'transfer' || person.id !== technicianId) &&
    (action !== 'collaboration' || !incident.collaborators.some((member) => member.technicianId === person.id)));
  const fields = operationFields(action, candidates);
  const receiver = technicians.find((person) => person.id === values.technicianId);
  const workload = receiver ? technicianWorkload(receiver.id) : null;
  const request = action === 'transfer' || action === 'collaboration';

  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => { if (preview) previewPanel.current?.focus(); }, [preview]);

  function change(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
    setPreview(false);
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    fields.forEach((field) => {
      const value = (values[field.name] || '').trim();
      if (!field.optional && !value) nextErrors[field.name] = `${field.label} is required.`;
      else if (value && field.options && !field.options.some((option) => (Array.isArray(option) ? option[0] : option) === value)) nextErrors[field.name] = 'Choose a valid option.';
    });
    if (request && values.technicianId === incident.primaryTechnicianId) nextErrors.technicianId = 'Choose someone other than the primary technician.';
    if (action === 'transfer' && values.technicianId === technicianId) nextErrors.technicianId = 'You cannot request a transfer to yourself.';
    if (action === 'collaboration' && incident.collaborators.some((member) => member.technicianId === values.technicianId)) nextErrors.technicianId = 'This technician is already a collaborator.';
    if (request && receiver?.availability === 'UNAVAILABLE') nextErrors.technicianId = 'This technician is unavailable. Choose another technician for this preview.';
    setErrors(nextErrors);
    setPreview(false);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements.namedItem(fields.find((field) => nextErrors[field.name]).name)?.focus();
      return;
    }
    setPreview(true);
  }

  return <dialog ref={dialog} className="incident-dialog technician-operation-dialog" aria-labelledby="operation-title" aria-describedby="operation-notice" onClose={onClose}>
    <div className="dashboard-section-heading"><h2 id="operation-title">{operationLabels[action]}</h2><button type="button" className="report-clear" autoFocus onClick={() => dialog.current.close()}>Close</button></div>
    <p id="operation-notice" className="report-guidance">Frontend preview only. Nothing is saved, submitted, sent or approved.</p>
    <dl className="incident-details technician-operation-context">
      <div><dt>Incident ID</dt><dd>{incident.id}</dd></div><div><dt>Incident Title</dt><dd>{incident.title}</dd></div>
      <div><dt>Current Primary Technician</dt><dd>{primary.name} ({primary.id})</dd></div>
      <div><dt>Current Status</dt><dd>{readableLabel(incident.status)}</dd></div>
    </dl>
    {lifecycleExplanations[action] ? <div className="status-message"><p>{lifecycleExplanations[action]}</p><p>The incident remains {readableLabel(incident.status)}. Backend integration is required.</p></div> : <form className="technician-operation-form" onSubmit={submit} noValidate>
      {fields.map((field) => <React.Fragment key={field.name}>
        <div className="report-field">
          <label htmlFor={`operation-${field.name}`}>{field.label}{field.optional ? ' (optional)' : ' (required)'}</label>
          {field.options ? <select id={`operation-${field.name}`} name={field.name} value={values[field.name] || ''} onChange={change} required={!field.optional} aria-invalid={Boolean(errors[field.name])} aria-describedby={`operation-${field.name}-error`}>
            <option value="">Choose an option</option>
            {field.options.map((option) => {
              const [value, label] = Array.isArray(option) ? option : [option, option.includes('_') || option === option.toUpperCase() ? readableLabel(option) : option];
              return <option key={value} value={value}>{label}</option>;
            })}
          </select> : <textarea id={`operation-${field.name}`} name={field.name} rows={3} maxLength={2000} value={values[field.name] || ''} onChange={change} required={!field.optional} aria-invalid={Boolean(errors[field.name])} aria-describedby={`operation-${field.name}-error`} />}
          <p id={`operation-${field.name}-error`} className="report-error" role="alert">{errors[field.name]}</p>
        </div>
        {field.name === 'technicianId' && receiver && <section className="technician-candidate" aria-label="Selected technician details">
          <dl className="incident-details"><div><dt>Skills</dt><dd>{receiver.skills.map(readableLabel).join(', ')}</dd></div><div><dt>Availability</dt><dd>{readableLabel(receiver.availability)}</dd></div>
            <div><dt>Current workload</dt><dd>{workload.total} active / limit {receiver.workloadLimit} ({workload.activePrimary} primary, {workload.activeCollaboration} collaborating)</dd></div></dl>
          {receiver.availability === 'UNAVAILABLE' && <p className="technician-warning" role="status">Unavailable in this demo snapshot. Choose another technician.</p>}
          {workload.total >= receiver.workloadLimit && <p className="technician-warning" role="status">At or above the workload limit. Administrator review is needed before adding work.</p>}
          {action === 'collaboration' && values.skill && !receiver.skills.includes(values.skill) && <p className="report-guidance">The selected skill is not listed in this technician’s profile. Review the suggested specialist.</p>}
        </section>}
      </React.Fragment>)}
      <div className="report-actions"><button type="submit" className="submit-button">{request ? 'Submit Request (preview)' : 'Preview Draft'}</button><button type="button" className="report-clear" onClick={() => dialog.current.close()}>Cancel</button></div>
      {preview && <section ref={previewPanel} tabIndex={-1} className="technician-draft" aria-label="Validated draft preview">
        <h3>Validated preview — not saved</h3>
        <p role="status">{action === 'transfer' ? 'Transfer request validated. Backend integration is required before it can be submitted for approval.' : action === 'collaboration' ? 'Collaboration request validated. Backend integration and acceptance are required before anyone joins the team.' : action === 'information' ? 'Information request validated. No message has been sent to the student.' : `${operationLabels[action]} draft validated. Backend integration is required to save or submit it.`}</p>
        <dl className="incident-details"><div><dt>Prepared by</dt><dd>{technicians.find((person) => person.id === technicianId).name}</dd></div>
          {fields.map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{field.name === 'technicianId' ? `${receiver.name} (${receiver.id})` : values[field.name]?.trim() || 'Not provided'}</dd></div>)}
        </dl>
        {request && <p>Proposed initial state: PENDING (not submitted). {action === 'transfer' ? 'Only an administrator can approve or reject a transfer; a request may also be cancelled.' : 'Future request states: PENDING, ACCEPTED, REJECTED or CANCELLED. No acceptance has occurred.'}</p>}
        <p>Primary owner remains {primary.name}; status remains {readableLabel(incident.status)}. Response deadline: {incident.responseDeadline.replace('T', ' ')}. Resolution deadline: {incident.resolutionDeadline.replace('T', ' ')}.</p>
        <p>Java must validate the workflow, preserve incident history, and manage authorization, audit records and notifications.</p>
      </section>}
    </form>}
  </dialog>;
}
