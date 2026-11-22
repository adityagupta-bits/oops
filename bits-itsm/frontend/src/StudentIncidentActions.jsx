import React, { useEffect, useRef, useState } from 'react';
import { auditLogs, investigationNotes, studentResponses, supportRequests, users } from './demoData.js';
import NavIcon from './components/NavIcon.jsx';

function DraftForm({ kind, incident, onAction }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const proposal = useRef(null);

  useEffect(() => {
    if (preview) proposal.current?.focus();
  }, [preview]);

  const fields =
    kind === 'reply'
      ? [
          { name: 'message', label: 'Message to Support Team', required: true },
          { name: 'additional', label: 'Additional Information or Context (optional)' },
        ]
      : kind === 'verification'
      ? [
          {
            name: 'decision',
            label: 'Resolution Verification Decision',
            required: true,
            options: [
              ['CONFIRM', 'Confirm Issue Is Resolved'],
              ['UNRESOLVED', 'Issue Still Exists (Reopen Investigation)'],
            ],
          },
          ...(values.decision === 'UNRESOLVED'
            ? [{ name: 'explanation', label: 'Explain what still needs attention', required: true }]
            : []),
        ]
      : [
          {
            name: 'rating',
            label: 'Support Satisfaction Rating (1–5 Stars)',
            required: true,
            options: [
              ['5', '5 Stars — Excellent'],
              ['4', '4 Stars — Good'],
              ['3', '3 Stars — Acceptable'],
              ['2', '2 Stars — Needs Improvement'],
              ['1', '1 Star — Poor'],
            ],
          },
          { name: 'comment', label: 'Feedback Comment (optional)' },
        ];

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setPreview(false);
    for (const field of fields) {
      const value = values[field.name]?.trim() || '';
      if (
        (field.required && !value) ||
        (field.options && !field.options.some(([option]) => option === value))
      ) {
        setError(`Please complete ${field.label.toLowerCase()}.`);
        event.currentTarget.elements.namedItem(field.name)?.focus();
        return;
      }
    }
    setError('');
    if (!onAction) {
      setPreview(true);
      return;
    }
    setBusy(true);
    setSaved(false);
    try {
      let action;
      let payload;
      if (kind === 'verification') {
        action = 'verify';
        payload = { confirmed: values.decision === 'CONFIRM', reason: values.explanation || '' };
      } else if (kind === 'reply') {
        action = 'reply';
        payload = { content: [values.message, values.additional].filter(Boolean).join('\n') };
      } else {
        action = 'feedback';
        payload = { rating: Number(values.rating), comment: values.comment || '' };
      }
      await onAction(action, payload);
      setValues({});
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="student-draft-form" onSubmit={submit} noValidate>
      {fields.map((field) => {
        const props = {
          id: `${kind}-${field.name}`,
          name: field.name,
          value: values[field.name] || '',
          required: field.required,
          'aria-describedby': `${kind}-error`,
          onChange: (event) => {
            setValues({ ...values, [field.name]: event.target.value });
            setError('');
            setPreview(false);
          },
        };
        return (
          <div className="report-field" key={field.name}>
            <label htmlFor={props.id}>
              {field.label} {field.required && <span className="field-required-mark">*</span>}
            </label>
            {field.options ? (
              <select {...props}>
                <option value="">Choose an option</option>
                {field.options.map(([val, lbl]) => (
                  <option key={val} value={val}>{lbl}</option>
                ))}
              </select>
            ) : (
              <textarea {...props} rows={3} maxLength={1000} placeholder={`Enter ${field.label.toLowerCase()}…`} />
            )}
          </div>
        );
      })}

      <div className="report-actions">
        <button type="submit" className="incident-view" disabled={busy}>
          {busy ? 'Saving…' : onAction ? 'Submit' : 'Preview'}{' '}
          {kind === 'reply' ? 'Reply' : kind === 'verification' ? 'Verification' : 'Feedback'}
        </button>
        <button
          type="button"
          className="report-clear"
          disabled={busy}
          onClick={() => {
            setValues({});
            setError('');
            setPreview(false);
            setSaved(false);
          }}
        >
          Clear Draft
        </button>
      </div>

      {error && <p id={`${kind}-error`} className="report-error" role="alert">{error}</p>}
      {saved && <p className="status-message status-success" role="status">Saved successfully.</p>}

      {preview && (
        <div ref={proposal} tabIndex={-1} className="technician-draft" role="status">
          <strong>Draft preview — not submitted</strong>
          <dl className="incident-details">
            {fields.map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd>
                  {field.options?.find(([opt]) => opt === values[field.name])?.[1] ||
                    values[field.name]?.trim() ||
                    'Not provided'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="report-guidance">
            Java backend integration is required to record this {kind}. Incident #{incident.id} remains {incident.status}.
          </p>
        </div>
      )}
    </form>
  );
}

function EditReport({ incident, onAction }) {
  const [title, setTitle] = useState(incident.title);
  const [description, setDescription] = useState(incident.description);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await onAction('edit', { title, description });
      setMessage('Report updated successfully.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="report-form admin-section" onSubmit={save}>
      <h3>Edit Incident Report</h3>
      <p className="report-guidance">You can refine your title and description until the ticket is classified by the ITSM engine.</p>
      <div className="report-field">
        <label htmlFor="edit-title">Title</label>
        <input
          id="edit-title"
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="report-field">
        <label htmlFor="edit-description">Description</label>
        <textarea
          id="edit-description"
          required
          minLength={20}
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="report-actions">
        <button className="submit-button-sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save Updated Report'}
        </button>
      </div>
      {message && <p className="status-message status-success" role="status">{message}</p>}
    </form>
  );
}

export default function StudentIncidentActions({ incident, onAction }) {
  if (onAction) {
    return (
      <>
        {incident.status === 'NEW' && <EditReport key={incident.id} incident={incident} onAction={onAction} />}
        <section className="student-detail-section">
          <h3>Support Communication</h3>
          {incident.notes?.length ? (
            <ol className="technician-updates">
              {incident.notes.map((note) => (
                <li key={note.id}>
                  <strong>{note.author.name}</strong> ·{' '}
                  <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
                  <p>{note.content}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="report-guidance">No support messages yet.</p>
          )}
          {incident.status === 'IN_PROGRESS' &&
            (incident.awaitingStudent ?? incident.notes?.some((note) => note.kind === 'INFORMATION_REQUEST')) && (
              <DraftForm kind="reply" incident={incident} onAction={onAction} />
            )}
        </section>

        {incident.status === 'RESOLVED' && (
          <section className="student-detail-section">
            <h3>Resolution Verification</h3>
            <div className="resolution-box">
              <h4>Technician Resolution Summary:</h4>
              <p>{incident.resolutionSummary}</p>
              {incident.resolutionSteps && (
                <>
                  <h4>Steps Performed:</h4>
                  <p>{incident.resolutionSteps}</p>
                </>
              )}
            </div>
            <DraftForm kind="verification" incident={incident} onAction={onAction} />
          </section>
        )}

        {['VERIFIED', 'CLOSED'].includes(incident.status) && incident.resolvedAt && (
          <section className="student-detail-section">
            <h3>Support Feedback</h3>
            {incident.feedback ? (
              <div className="feedback-banner">
                <strong>Feedback Submitted:</strong> {incident.feedback.rating}/5 stars · {incident.feedback.comment || 'No comment provided'}
              </div>
            ) : (
              <DraftForm kind="feedback" incident={incident} onAction={onAction} />
            )}
          </section>
        )}
      </>
    );
  }

  const history = auditLogs.filter(
    (event) =>
      event.incidentId === incident.id &&
      [
        'Incident Created',
        'Technician Assigned',
        'Incident Acknowledged',
        'Incident Resolved',
        'Incident Verified',
        'Incident Closed',
      ].includes(event.action)
  );
  const notes = investigationNotes.filter(
    (note) => note.incidentId === incident.id && note.visibility === 'STUDENT_VISIBLE'
  );
  const updates = [
    ...history.map((event) => ({ id: event.id, timestamp: event.timestamp, text: event.action })),
    ...notes.map((note) => ({ id: note.id, timestamp: note.timestamp, text: note.note })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const requests = supportRequests.filter((request) => request.incidentId === incident.id);
  const messages = [
    ...requests.map((request) => ({
      id: request.id,
      timestamp: request.requestedAt,
      author: users.find((user) => user.id === request.technicianId)?.name || 'Technician',
      message: request.message,
    })),
    ...studentResponses
      .filter((response) => response.incidentId === incident.id)
      .map((response) => ({
        id: response.id,
        timestamp: response.timestamp,
        author: users.find((user) => user.id === response.reporterId)?.name || 'Student',
        message: response.response,
      })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <>
      <section className="student-detail-section">
        <h3>Student-Visible Progress</h3>
        <ol className="technician-updates">
          {updates.map((update) => (
            <li key={update.id}>
              <time dateTime={update.timestamp}>{update.timestamp.replace('T', ' ')}</time>
              <p>{update.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="student-detail-section">
        <h3>Support Communication</h3>
        <p className="report-guidance">Demonstration messages.</p>
        {messages.length ? (
          <ol className="technician-updates">
            {messages.map((message) => (
              <li key={message.id}>
                <strong>{message.author}</strong> ·{' '}
                <time dateTime={message.timestamp}>{message.timestamp.replace('T', ' ')}</time>
                <p>{message.message}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="report-guidance">No support messages recorded.</p>
        )}
        {requests.length > 0 && <DraftForm kind="reply" incident={incident} />}
      </section>

      {incident.status === 'RESOLVED' && (
        <section className="student-detail-section">
          <h3>Resolution Verification</h3>
          <dl className="incident-details">
            <div>
              <dt>Resolution Summary</dt>
              <dd>{incident.resolution}</dd>
            </div>
            <div>
              <dt>Assigned Technician</dt>
              <dd>{incident.assignedTechnician}</dd>
            </div>
            <div>
              <dt>Resolution Date</dt>
              <dd>{incident.resolvedAt?.replace('T', ' ') || 'Not recorded'}</dd>
            </div>
          </dl>
          <DraftForm kind="verification" incident={incident} />
        </section>
      )}

      {['RESOLVED', 'VERIFIED', 'CLOSED'].includes(incident.status) && (
        <section className="student-detail-section">
          <h3>Support Feedback</h3>
          <DraftForm kind="feedback" incident={incident} />
        </section>
      )}
    </>
  );
}
