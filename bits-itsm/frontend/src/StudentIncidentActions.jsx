import React, { useEffect, useRef, useState } from 'react';
import { auditLogs, investigationNotes, studentResponses, supportRequests, users } from './demoData.js';

function DraftForm({ kind, incident }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const proposal = useRef(null);
  useEffect(() => { if (preview) proposal.current?.focus(); }, [preview]);
  const fields = kind === 'reply' ? [
    { name: 'message', label: 'Message', required: true }, { name: 'additional', label: 'Additional information (optional)' },
  ] : kind === 'verification' ? [
    { name: 'decision', label: 'Resolution verification', required: true, options: [['CONFIRM', 'Confirm Issue Resolved'], ['UNRESOLVED', 'Issue Still Exists']] },
    ...(values.decision === 'UNRESOLVED' ? [{ name: 'explanation', label: 'Explain what still needs attention', required: true }] : []),
  ] : [
    { name: 'rating', label: 'How satisfied are you with the support you received? (1–5)', required: true, options: ['1', '2', '3', '4', '5'].map((value) => [value, value]) },
    { name: 'comment', label: 'Comment (optional)' },
  ];

  function submit(event) {
    event.preventDefault();
    setPreview(false);
    for (const field of fields) {
      const value = values[field.name]?.trim() || '';
      if ((field.required && !value) || (field.options && !field.options.some(([option]) => option === value))) {
        setError(`Please complete ${field.label.toLowerCase()}.`);
        event.currentTarget.elements.namedItem(field.name).focus();
        return;
      }
    }
    setError(''); setPreview(true);
  }

  return <form className="student-draft-form" onSubmit={submit} noValidate>
    {fields.map((field) => {
      const props = { id: `${kind}-${field.name}`, name: field.name, value: values[field.name] || '', required: field.required, 'aria-describedby': `${kind}-error`, onChange: (event) => { setValues({ ...values, [field.name]: event.target.value }); setError(''); setPreview(false); } };
      return <div className="report-field" key={field.name}><label htmlFor={props.id}>{field.label}</label>{field.options ? <select {...props}><option value="">Choose an option</option>{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <textarea {...props} rows={3} maxLength={1000} />}</div>;
    })}
    <div className="report-actions"><button type="submit" className="incident-view">Preview {kind === 'reply' ? 'Reply' : kind === 'verification' ? 'Verification' : 'Feedback'}</button><button type="button" className="report-clear" onClick={() => { setValues({}); setError(''); setPreview(false); }}>Clear Draft</button></div>
    <p id={`${kind}-error`} className="report-error" role="alert">{error}</p>
    {preview && <div ref={proposal} tabIndex={-1} className="technician-draft" role="status"><strong>Draft preview — not submitted</strong><dl className="incident-details">{fields.map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{field.options?.find(([value]) => value === values[field.name])?.[1] || values[field.name]?.trim() || 'Not provided'}</dd></div>)}</dl><p>Java backend integration is required to send or save this {kind}. Incident {incident.id} remains {incident.status}. Verification, closure and reopened investigation follow the future backend policy.</p></div>}
  </form>;
}

export default function StudentIncidentActions({ incident }) {
  const history = auditLogs.filter((event) => event.incidentId === incident.id && ['Incident Created', 'Technician Assigned', 'Incident Acknowledged', 'Incident Resolved', 'Incident Verified', 'Incident Closed'].includes(event.action));
  const notes = investigationNotes.filter((note) => note.incidentId === incident.id && note.visibility === 'STUDENT_VISIBLE');
  const updates = [...history.map((event) => ({ id: event.id, timestamp: event.timestamp, text: event.action })), ...notes.map((note) => ({ id: note.id, timestamp: note.timestamp, text: note.note }))].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const requests = supportRequests.filter((request) => request.incidentId === incident.id);
  const messages = [...requests.map((request) => ({ id: request.id, timestamp: request.requestedAt, author: users.find((user) => user.id === request.technicianId).name, message: request.message })), ...studentResponses.filter((response) => response.incidentId === incident.id).map((response) => ({ id: response.id, timestamp: response.timestamp, author: users.find((user) => user.id === response.reporterId).name, message: response.response }))].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return <>
    <section className="student-detail-section"><h3>Student-visible Progress</h3><ol className="technician-updates">{updates.map((update) => <li key={update.id}><time dateTime={update.timestamp}>{update.timestamp.replace('T', ' ')}</time><p>{update.text}</p></li>)}</ol></section>
    <section className="student-detail-section"><h3>Support Communication</h3><p className="report-guidance">Sample messages only. Reply drafts are not sent.</p>{messages.length ? <ol className="technician-updates">{messages.map((message) => <li key={message.id}><strong>{message.author}</strong> · <time dateTime={message.timestamp}>{message.timestamp.replace('T', ' ')}</time><p>{message.message}</p></li>)}</ol> : <p className="report-guidance">No support messages recorded.</p>}{requests.length > 0 && <DraftForm kind="reply" incident={incident} />}</section>
    {incident.status === 'RESOLVED' && <section className="student-detail-section"><h3>Resolution Verification</h3><dl className="incident-details"><div><dt>Resolution Summary</dt><dd>{incident.resolution}</dd></div><div><dt>Technician</dt><dd>{incident.assignedTechnician}</dd></div><div><dt>Resolution Date</dt><dd>{incident.resolvedAt?.replace('T', ' ') || 'Not recorded'}</dd></div><div><dt>Steps Performed</dt><dd>{incident.resolution}</dd></div></dl><DraftForm kind="verification" incident={incident} /></section>}
    {['RESOLVED', 'VERIFIED', 'CLOSED'].includes(incident.status) && <section className="student-detail-section"><h3>Support Feedback</h3><DraftForm kind="feedback" incident={incident} /></section>}
  </>;
}
