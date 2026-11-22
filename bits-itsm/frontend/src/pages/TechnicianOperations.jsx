import React, { useEffect, useRef, useState } from 'react';
import { readableLabel } from '../MyIncidents.jsx';
import { technicians, technicianWorkload } from '../demoData.js';
import { apiRequest } from '../api.js';

export const operationLabels = {
  acknowledge: 'Acknowledge Incident',
  start: 'Start Work',
  note: 'Add Investigation Note',
  information: 'Request Additional Information',
  transfer: 'Request Transfer',
  collaboration: 'Request Collaborator',
  escalate: 'Escalate Incident',
  resolution: 'Resolve Incident',
  resolve: 'Mark as Resolved',
};

const transferReasons = [
  'DIFFERENT_SPECIALIZATION',
  'EXCESSIVE_WORKLOAD',
  'TECHNICIAN_UNAVAILABLE',
  'SENIOR_ESCALATION',
  'OTHER',
];
const escalationReasons = [
  'SLA Deadline Approaching',
  'Critical Incident',
  'Insufficient Resources',
  'Technical Expertise Required',
  'Technician Unavailable',
  'Administrator Intervention Required',
  'Other',
];
const informationTypes = [
  'Screenshot of error',
  'Device information',
  'Exact error message',
  'Time problem occurred',
  'Steps to reproduce issue',
  'Other',
];
const lifecycleExplanations = {
  acknowledge: 'Acknowledgment requires the backend to validate ASSIGNED → ACKNOWLEDGED and record the acting technician.',
  start: 'Starting an investigation requires the backend to validate ACKNOWLEDGED → IN_PROGRESS and record the activity.',
  resolve: 'Marking an incident as resolved requires a resolution record and a valid IN_PROGRESS → RESOLVED transition. Prepare the information using Provide Resolution. Student or administrator verification and closure happen later.',
};

function operationFields(action, candidates, live = false) {
  const receivingTechnician = {
    name: 'technicianId',
    label: action === 'transfer' ? 'Suggested Destination Technician' : 'Suggested Collaborator',
    optional: action === 'transfer',
    options: candidates.map((person) => [String(person.id), `${person.name} (${person.id})`]),
  };
  switch (action) {
    case 'transfer':
      return [
        { name: 'reason', label: 'Transfer Reason', options: transferReasons },
        receivingTechnician,
        { name: 'handover', label: 'Additional Explanation / Handover Notes' },
      ];
    case 'collaboration':
      return [
        {
          name: 'skill',
          label: 'Required Technical Skill',
          options: live
            ? [
                'NETWORK',
                'HARDWARE',
                'SOFTWARE',
                'DATABASE',
                'AUTHENTICATION',
                'SECURITY',
                'APPLICATION_SUPPORT',
                'CLOUD',
                'STORAGE',
              ]
            : [...new Set(technicians.flatMap((person) => person.skills))].sort(),
        },
        receivingTechnician,
        { name: 'reason', label: 'Reason for Collaboration' },
        { name: 'task', label: 'Task Description', optional: !live },
      ];
    case 'note':
      return [
        { name: 'note', label: 'Investigation Note Content' },
        { name: 'visibility', label: 'Note Visibility', options: ['INTERNAL', 'STUDENT_VISIBLE'] },
      ];
    case 'information':
      return [
        { name: 'information', label: 'Information Type Requested', options: informationTypes },
        { name: 'message', label: 'Message to Student Reporter' },
      ];
    case 'resolution':
      return [
        { name: 'summary', label: 'Resolution Summary' },
        { name: 'steps', label: 'Troubleshooting Steps Performed' },
        { name: 'rootCause', label: 'Root Cause', optional: true },
        { name: 'notes', label: 'Additional Notes', optional: true },
      ];
    case 'escalate':
      return [
        { name: 'reason', label: 'Escalation Reason', options: escalationReasons },
        { name: 'explanation', label: 'Explanation' },
        { name: 'requestedAction', label: 'Requested Administrator Action' },
      ];
    default:
      return [];
  }
}

export default function TechnicianOperations({ action, incident, technicianId, onClose, onAction }) {
  const dialog = useRef(null);
  const previewPanel = useRef(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [eligible, setEligible] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedRequest, setSavedRequest] = useState(null);

  const primary = onAction
    ? incident.assignedTechnician
    : technicians.find((person) => person.id === incident.primaryTechnicianId);
  const candidates = onAction
    ? eligible
    : technicians.filter(
        (person) =>
          person.id !== incident.primaryTechnicianId &&
          (action !== 'transfer' || person.id !== technicianId) &&
          (action !== 'collaboration' || !incident.collaborators?.some((m) => m.technicianId === person.id))
      );
  const fields = operationFields(action, candidates, Boolean(onAction)).filter(
    (field) => !onAction || !['rootCause', 'notes'].includes(field.name)
  );
  const receiver = candidates.find((person) => String(person.id) === values.technicianId);
  const workload = receiver ? (onAction ? receiver : technicianWorkload(receiver.id)) : null;
  const request = action === 'transfer' || action === 'collaboration';

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    if (preview) previewPanel.current?.focus();
  }, [preview]);

  useEffect(() => {
    if (!onAction || !request) return;
    let active = true;
    setLoading(true);
    setError('');
    apiRequest(
      `incidents/${incident.id}/eligible-technicians?collaboration=${action === 'collaboration'}${
        values.skill ? `&skill=${values.skill}` : ''
      }`
    )
      .then((data) => {
        if (active) setEligible(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [incident.id, action, values.skill, Boolean(onAction)]);

  function change(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
    setPreview(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const nextErrors = {};
    fields.forEach((field) => {
      const value = (values[field.name] || '').trim();
      if (!field.optional && !value) nextErrors[field.name] = `${field.label} is required.`;
      else if (
        value &&
        field.options &&
        !field.options.some((opt) => (Array.isArray(opt) ? opt[0] : opt) === value)
      )
        nextErrors[field.name] = 'Choose a valid option.';
    });
    if (request && values.technicianId === incident.primaryTechnicianId)
      nextErrors.technicianId = 'Choose someone other than the primary technician.';
    if (action === 'transfer' && values.technicianId && values.technicianId === technicianId)
      nextErrors.technicianId = 'You cannot suggest yourself as the destination.';
    if (action === 'transfer' && values.handover?.trim().length < 10)
      nextErrors.handover = 'Please provide a meaningful explanation (at least 10 characters).';
    if (
      !onAction &&
      action === 'collaboration' &&
      incident.collaborators?.some((m) => m.technicianId === values.technicianId)
    )
      nextErrors.technicianId = 'This technician is already a collaborator.';
    if (request && receiver?.availability === 'UNAVAILABLE')
      nextErrors.technicianId = 'This technician is unavailable. Choose another technician.';

    setErrors(nextErrors);
    setPreview(false);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements.namedItem(fields.find((f) => nextErrors[f.name]).name)?.focus();
      return;
    }
    if (!onAction) {
      setPreview(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const route = {
        acknowledge: 'acknowledge',
        start: 'start',
        note: 'notes',
        information: 'information',
        resolution: 'resolve',
        transfer: 'transfer-requests',
        collaboration: 'collaboration-requests',
      }[action];
      const payload =
        action === 'transfer'
          ? {
              ...(values.technicianId ? { technicianId: Number(values.technicianId) } : {}),
              reason: values.reason,
              handoverNotes: values.handover,
            }
          : action === 'collaboration'
          ? {
              technicianId: Number(values.technicianId),
              requiredSkill: values.skill,
              reason: values.reason,
              responsibility: values.task,
            }
          : action === 'note'
          ? { content: values.note, visibility: values.visibility }
          : action === 'information'
          ? { content: `${values.information}: ${values.message}` }
          : action === 'resolution'
          ? { summary: values.summary, steps: values.steps }
          : {};
      const saved = await onAction(route, payload);
      if (request) setSavedRequest(saved);
      else onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="incident-dialog technician-operation-dialog"
      aria-labelledby="operation-title"
      onClose={onClose}
    >
      <div className="dashboard-section-heading dialog-header">
        <h2 id="operation-title">{operationLabels[action]}</h2>
        <button type="button" className="dialog-close-btn" autoFocus onClick={() => dialog.current.close()}>
          ✕
        </button>
      </div>

      <p id="operation-notice" className="report-guidance">
        {onAction
          ? 'Changes are validated and recorded into this incident.'
          : 'Frontend preview. In production, lifecycle changes require authorized transitions.'}
      </p>

      {onAction && request && (
        <p role="status">
          {loading
            ? 'Loading eligible technicians…'
            : 'Administrator approval is required. Submitting routes the request to administrative review.'}
        </p>
      )}

      <dl className="incident-details technician-operation-context">
        <div>
          <dt>Incident ID</dt>
          <dd>#{incident.id}</dd>
        </div>
        <div>
          <dt>Incident Title</dt>
          <dd>{incident.title}</dd>
        </div>
        <div>
          <dt>Current Primary</dt>
          <dd>{primary?.name ? `${primary.name} (${primary.id})` : 'Unassigned'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{readableLabel(incident.status)}</dd>
        </div>
      </dl>

      {lifecycleExplanations[action] && !onAction ? (
        <div className="status-message">
          <p>{lifecycleExplanations[action]}</p>
          <p>The incident remains {readableLabel(incident.status)}.</p>
        </div>
      ) : (
        <form className="technician-operation-form" onSubmit={submit} noValidate>
          {fields.map((field) => (
            <React.Fragment key={field.name}>
              <div className="report-field">
                <label htmlFor={`operation-${field.name}`}>
                  {field.label} {field.optional ? '(optional)' : <span className="field-required-mark">*</span>}
                </label>
                {field.options ? (
                  <select
                    id={`operation-${field.name}`}
                    name={field.name}
                    value={values[field.name] || ''}
                    onChange={change}
                    required={!field.optional}
                    aria-invalid={Boolean(errors[field.name])}
                    aria-describedby={`operation-${field.name}-error`}
                  >
                    <option value="">Choose an option</option>
                    {field.options.map((option) => {
                      const [val, lbl] = Array.isArray(option)
                        ? option
                        : [option, option.includes('_') || option === option.toUpperCase() ? readableLabel(option) : option];
                      return (
                        <option key={val} value={val}>{lbl}</option>
                      );
                    })}
                  </select>
                ) : (
                  <textarea
                    id={`operation-${field.name}`}
                    name={field.name}
                    rows={3}
                    maxLength={2000}
                    value={values[field.name] || ''}
                    onChange={change}
                    required={!field.optional}
                    aria-invalid={Boolean(errors[field.name])}
                    aria-describedby={`operation-${field.name}-error`}
                  />
                )}
                {errors[field.name] && (
                  <p id={`operation-${field.name}-error`} className="report-error" role="alert">
                    {errors[field.name]}
                  </p>
                )}
              </div>

              {field.name === 'technicianId' && receiver && (
                <section className="technician-candidate" aria-label="Selected technician details">
                  <dl className="incident-details">
                    <div>
                      <dt>Skills</dt>
                      <dd>{receiver.skills?.map(readableLabel).join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Availability</dt>
                      <dd>{readableLabel(receiver.availability)}</dd>
                    </div>
                    <div>
                      <dt>Current Workload</dt>
                      <dd>
                        {workload.total} active / limit {receiver.maxWorkload ?? receiver.workloadLimit} (
                        {workload.activePrimary} primary, {workload.activeCollaboration} collaborating)
                      </dd>
                    </div>
                  </dl>
                  {receiver.availability === 'UNAVAILABLE' && (
                    <p className="technician-warning" role="status">
                      Unavailable in current schedule. Choose another technician.
                    </p>
                  )}
                  {workload.total >= receiver.workloadLimit && (
                    <p className="technician-warning" role="status">
                      At or above workload capacity. Administrator review is needed.
                    </p>
                  )}
                </section>
              )}
            </React.Fragment>
          ))}

          <div className="report-actions">
            <button className="submit-button-sm" type="submit" disabled={busy || loading || Boolean(savedRequest)}>
              {busy ? 'Saving…' : onAction ? operationLabels[action] : request ? 'Submit Request (preview)' : 'Preview Draft'}
            </button>
            <button
              type="button"
              className="report-clear"
              disabled={busy}
              onClick={() => dialog.current.close()}
            >
              {savedRequest ? 'Done' : 'Cancel'}
            </button>
          </div>

          {savedRequest && (
            <p className="status-message status-success" role="status">
              Request #{savedRequest.id} saved successfully. Status: {readableLabel(savedRequest.status)}.
            </p>
          )}
          {error && <p className="report-error" role="alert">{error}</p>}

          {preview && (
            <section ref={previewPanel} tabIndex={-1} className="technician-draft" aria-label="Validated draft preview">
              <h3>Validated Preview</h3>
              <dl className="incident-details">
                <div>
                  <dt>Acting Technician</dt>
                  <dd>{technicians.find((p) => p.id === technicianId)?.name}</dd>
                </div>
                {fields.map((field) => (
                  <div key={field.name}>
                    <dt>{field.label}</dt>
                    <dd>
                      {field.name === 'technicianId'
                        ? `${receiver?.name} (${receiver?.id})`
                        : values[field.name]?.trim() || 'Not provided'}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </form>
      )}
    </dialog>
  );
}
