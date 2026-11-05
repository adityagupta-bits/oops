import React, { useEffect, useRef, useState } from 'react';
import Button27 from '../components/ui/button-27.jsx';
import Notifications from '../Notifications.jsx';
import { incidentStatuses, readableLabel } from '../MyIncidents.jsx';
import { demoIncidents, users, technicians, technicianSkills, transferRequests, collaborationRequests, services, incidentCategories, slaPolicies, auditLogs, investigationNotes, adminNotifications, relatedIncidentExamples, recommendationExamples, isActive, technicianWorkload } from '../demoData.js';

const pages = ['Dashboard', 'All Incidents', 'Assignment Requests', 'Collaboration Requests', 'Manage Technicians', 'Manage Users', 'IT Services', 'Incident Categories', 'SLA Policies', 'Assignment Strategies', 'Escalations', 'Reports & Analytics', 'Audit Logs', 'Notifications', 'Settings'];
const person = (id) => users.find((user) => user.id === id)?.name || 'Unassigned';
const incidentById = (id) => demoIncidents.find((incident) => incident.id === id);
const technicianById = (id) => technicians.find((technician) => technician.id === id);
const dateText = (value) => value?.replace('T', ' ') || 'Not recorded';
const statusText = (value) => incidentStatuses[value]?.label || readableLabel(value);
const optionsFor = (values) => values.map((value) => ({ value, label: readableLabel(value) }));
const technicianOptions = technicians.map((technician) => ({ value: technician.id, label: `${technician.id} · ${technician.name} · ${readableLabel(technician.availability)}` }));
const requestStates = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const slaStates = ['ON_TRACK', 'AT_RISK', 'BREACHED', 'MET'];
const priorities = ['P1', 'P2', 'P3', 'P4'];
const userRoles = ['STUDENT', 'TECHNICIAN', 'ADMIN'];
const accountStates = ['ACTIVE', 'DISABLED'];

function Badge({ value }) {
  return <span className={`incident-status admin-badge badge-${value.toLowerCase().replaceAll('_', '-')}`}>{priorities.includes(value) ? value : statusText(value)}</span>;
}

function Table({ title, headers, rows }) {
  return (
    <section className="dashboard-incidents admin-section" aria-label={title}>
      <div className="dashboard-section-heading"><h2>{title}</h2><span>Demo data</span></div>
      {rows.length ? <div className="dashboard-table-scroll" role="region" aria-label={title} tabIndex={0}>
        <table><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => <td key={column}>{cell ?? '—'}</td>)}</tr>)}</tbody>
        </table>
      </div> : <p className="dashboard-empty">No matching records.</p>}
    </section>
  );
}

function Facts({ items }) {
  return <dl className="incident-details admin-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl>;
}

function Cards({ items }) {
  return <div className="dashboard-summary">{items.map(([label, count]) => <div className="dashboard-summary-card" key={label}><h3>{label}</h3><p>{count}</p></div>)}</div>;
}

function Filter({ label, name, value, onChange, options, type = 'search' }) {
  return <div className="report-field"><label htmlFor={`admin-filter-${name}`}>{label}</label>
    {options ? <select id={`admin-filter-${name}`} name={name} value={value} onChange={onChange}><option value="">All</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <input id={`admin-filter-${name}`} type={type} name={name} value={value} onChange={onChange} />}
  </div>;
}

function PreviewForm({ specification }) {
  const [values, setValues] = useState(Object.fromEntries(specification.fields.map((field) => [field.name, field.value ?? (field.type === 'multiselect' ? [] : field.type === 'checkbox' ? false : '')])));
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const proposal = useRef(null);
  const fields = specification.fields.filter((field) => !field.when || field.when(values));

  useEffect(() => { if (preview) proposal.current?.focus(); }, [preview]);

  function change(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setPreview(false);
    setError('');
  }

  function submit(event) {
    event.preventDefault();
    setPreview(false);
    for (const field of fields) {
      const value = values[field.name];
      const empty = Array.isArray(value) ? !value.length : typeof value === 'boolean' ? !value : !String(value).trim();
      let problem = '';
      if (field.required !== false && empty) problem = `Complete ${field.label.toLowerCase()}.`;
      else if (field.options && !empty && !(Array.isArray(value) ? value : [value]).every((entry) => field.options.some((option) => option.value === entry))) problem = 'Select an available option.';
      else if (field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) <= 0)) problem = 'Targets must be positive numbers.';
      else if (field.type === 'email' && !/^[^\s@]+@hyderabad\.bits-pilani\.ac\.in$/i.test(String(value).trim())) problem = 'Use a BITS Hyderabad institutional email.';
      else if (field.readOnly && value !== field.value) problem = `${field.label} cannot be changed in this preview.`;
      if (problem) { setError(problem); event.currentTarget.querySelector(`[name="${field.name}"]`)?.focus(); return; }
    }
    const problem = specification.validate?.(values);
    if (problem) { setError(problem); return; }
    setError('');
    setPreview(true);
  }

  return <section className="admin-preview-form">
    <h3>{specification.title}</h3><p className="report-guidance">{specification.subject} · Proposed values only. No changes will be saved.</p>
    <form onSubmit={submit} noValidate>
      <div className="report-row">{fields.map((field) => {
        const props = { id: `preview-${field.name}`, name: field.name, value: values[field.name], required: field.required !== false, readOnly: field.readOnly, 'aria-describedby': 'admin-proposal-error', onChange: (event) => change(field.name, event.target.value) };
        if (field.type === 'multiselect') return <fieldset className="admin-skill-options" key={field.name}><legend>{field.label}</legend>{field.options.map((option) => <label key={option.value}><input type="checkbox" name={field.name} value={option.value} checked={values[field.name].includes(option.value)} aria-describedby="admin-proposal-error" onChange={(event) => change(field.name, event.target.checked ? [...values[field.name], option.value] : values[field.name].filter((value) => value !== option.value))} />{option.label}</label>)}</fieldset>;
        if (field.type === 'checkbox') return <label key={field.name} className="admin-confirmation"><input type="checkbox" name={field.name} checked={values[field.name]} onChange={(event) => change(field.name, event.target.checked)} aria-describedby="admin-proposal-error" />{field.label}</label>;
        return <div className="report-field" key={field.name}><label htmlFor={props.id}>{field.label}</label>
          {field.options ? <select {...props}><option value="">Select an option</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            : field.type === 'textarea' ? <textarea {...props} rows={3} maxLength={1000} /> : <input {...props} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? 'any' : undefined} maxLength={200} />}
        </div>;
      })}</div>
      <button className="incident-view" type="submit">Preview proposal</button>
      <p id="admin-proposal-error" className="report-error" role="alert">{error}</p>
    </form>
    {preview && <div ref={proposal} tabIndex={-1} className="admin-proposal" role="status"><strong>Proposal preview — not saved</strong>
      <p>Changes validated. Saving will be available after Java backend integration.</p>
      <Facts items={fields.map((field) => [field.label, Array.isArray(values[field.name]) ? values[field.name].map((value) => field.options.find((option) => option.value === value)?.label || value).join(', ') : typeof values[field.name] === 'boolean' ? 'Confirmed for preview only' : field.options?.find((option) => option.value === values[field.name])?.label || String(values[field.name]).trim()])} />
      <p>{specification.outcome || 'Java authorization and persistence are required before this proposal can take effect.'}</p>
    </div>}
  </section>;
}

function Team({ incident }) {
  const members = [
    ...(incident.primaryTechnicianId ? [{ technicianId: incident.primaryTechnicianId, responsibility: 'Primary owner: coordinate investigation and resolution' }] : []),
    ...incident.collaborators,
  ];
  return <Table title="Incident team" headers={['Technician', 'Role / responsibility', 'Specializations', 'Active workload', 'Availability']} rows={members.map((member) => {
    const technician = technicianById(member.technicianId);
    return [person(member.technicianId), member.responsibility, technician.skills.map(readableLabel).join(', '), technicianWorkload(member.technicianId).total, readableLabel(technician.availability)];
  })} />;
}

function WorkloadTable({ title = 'Technician workload', ids = technicians.map((technician) => technician.id), open }) {
  return <Table title={title} headers={['Technician', 'Active primary', 'Active collaborations', 'Total active', 'Availability', 'Workload status', 'Skills']} rows={ids.filter(Boolean).map((id) => {
    const technician = technicianById(id);
    const workload = technicianWorkload(id);
    return [open ? <button className="incident-view" onClick={() => open('technician', id)}>{id} · {technician.name}</button> : `${id} · ${technician.name}`, workload.activePrimary, workload.activeCollaboration, workload.total, readableLabel(technician.availability), workloadLevel(technician, workload), technician.skills.map(readableLabel).join(', ')];
  })} />;
}

function workloadLevel(technician, workload) {
  if (workload.total > technician.workloadLimit) return 'OVERLOADED';
  if (workload.total === technician.workloadLimit) return 'HIGH';
  return workload.total >= technician.workloadLimit / 2 ? 'MODERATE' : 'LOW';
}

function AuditTable({ records = auditLogs, title = 'Audit history' }) {
  return <Table title={title} headers={['Event ID', 'Timestamp', 'Actor', 'Incident', 'Action', 'Previous', 'New', 'Description']} rows={records.map((record) => [record.id, dateText(record.timestamp), person(record.userId), record.incidentId, readableLabel(record.actionType), record.previous, record.next, record.description])} />;
}

function IncidentList({ records, title, open }) {
  return <Table title={title} headers={['Incident', 'Title', 'Priority', 'Status', 'Primary technician', 'SLA', 'Action']} rows={records.map((incident) => [incident.id, incident.title, <Badge value={incident.priority} />, <Badge value={incident.status} />, person(incident.primaryTechnicianId), <Badge value={incident.slaStatus} />, <button className="incident-view" onClick={() => open('incident', incident.id)}>View {incident.id}</button>])} />;
}

function DashboardHome({ open, navigate }) {
  const active = demoIncidents.filter(isActive);
  const pendingTransfers = transferRequests.filter((request) => request.status === 'PENDING');
  const pendingCollaborations = collaborationRequests.filter((request) => request.status === 'PENDING');
  return <>
    <Cards items={[
      ['Total Incidents', demoIncidents.length], ['Active Incidents', active.length], ['Critical Incidents', active.filter((incident) => incident.priority === 'P1').length],
      ['Resolved Incidents', demoIncidents.length - active.length], ['SLA Violations', demoIncidents.filter((incident) => incident.slaStatus === 'BREACHED').length],
      ['Available Technicians', technicians.filter((technician) => technician.availability === 'AVAILABLE').length], ['Pending Transfer Requests', pendingTransfers.length], ['Pending Collaboration Requests', pendingCollaborations.length],
    ]} />
    <p className="report-guidance">Active excludes Resolved, Verified and Closed. Critical means active P1. SLA labels and deadlines are frozen demo snapshots, not live clock calculations.</p>
    <IncidentList title="Critical incident monitoring" records={demoIncidents.filter((incident) => (isActive(incident) && ['P1', 'P2'].includes(incident.priority)) || incident.slaStatus === 'BREACHED' || incident.escalation)} open={open} />
    <Table title="Pending administrative actions" headers={['Type', 'Reference', 'Incident', 'Action']} rows={[
      ...pendingTransfers.map((request) => ['Transfer', request.id, request.incidentId, <button className="incident-view" onClick={() => open('transfer', request.id)}>Review {request.id}</button>]),
      ...pendingCollaborations.map((request) => ['Collaboration', request.id, request.incidentId, <button className="incident-view" onClick={() => open('collaboration', request.id)}>Review {request.id}</button>]),
      ...demoIncidents.filter((incident) => incident.escalation).map((incident) => ['Escalation', incident.escalation.level, incident.id, <button className="incident-view" onClick={() => navigate('Escalations')}>Review escalations</button>]),
    ]} />
    <WorkloadTable open={open} />
    <IntelligentMonitoring open={open} />
    <AuditTable title="Recent activity" records={auditLogs.slice(0, 6)} />
  </>;
}

function AllIncidents({ open }) {
  const initial = { search: '', date: '', status: '', priority: '', category: '', service: '', technician: '', sla: '' };
  const [filters, setFilters] = useState(initial);
  const change = (event) => setFilters({ ...filters, [event.target.name]: event.target.value });
  const query = filters.search.trim().toLowerCase();
  const records = demoIncidents.filter((incident) =>
    `${incident.id} ${incident.title}`.toLowerCase().includes(query) && (!filters.date || incident.createdAt.startsWith(filters.date)) &&
    (!filters.status || incident.status === filters.status) && (!filters.priority || incident.priority === filters.priority) &&
    (!filters.category || incident.category === filters.category) && (!filters.service || incident.affectedService === filters.service) &&
    (!filters.technician || (filters.technician === 'UNASSIGNED' ? !incident.primaryTechnicianId : incident.primaryTechnicianId === filters.technician)) && (!filters.sla || incident.slaStatus === filters.sla),
  );
  return <>
    <div className="incident-filters admin-filters">
      <Filter label="Incident ID or title" name="search" value={filters.search} onChange={change} />
      <Filter label="Created date" name="date" type="date" value={filters.date} onChange={change} />
      {[
        ['Status', 'status', Object.entries(incidentStatuses).map(([value, status]) => ({ value, label: status.label }))],
        ['Priority', 'priority', priorities.map((value) => ({ value, label: value }))],
        ['Category', 'category', optionsFor([...new Set(demoIncidents.map((incident) => incident.category))])],
        ['Service', 'service', services.map((service) => ({ value: service.name, label: service.name }))],
        ['Primary technician', 'technician', [{ value: 'UNASSIGNED', label: 'Unassigned' }, ...technicianOptions]],
        ['SLA status', 'sla', optionsFor(slaStates)],
      ].map(([label, name, options]) => <Filter key={name} label={label} name={name} options={options} value={filters[name]} onChange={change} />)}
      <button className="report-clear" onClick={() => setFilters(initial)}>Clear Filters</button>
    </div>
    <p className="report-guidance" role="status">{records.length} of {demoIncidents.length} demo incidents</p>
    <Table title="All incidents" headers={['ID', 'Reporter', 'Title', 'Category', 'Service', 'Priority', 'Status', 'Primary Technician', 'Collaborators', 'Created', 'SLA', 'Action']} rows={records.map((incident) => [incident.id, person(incident.reporterId), incident.title, readableLabel(incident.category), incident.affectedService, <Badge value={incident.priority} />, <Badge value={incident.status} />, person(incident.primaryTechnicianId), incident.collaborators.map((member) => person(member.technicianId)).join(', ') || 'None', dateText(incident.createdAt), <Badge value={incident.slaStatus} />, <button className="incident-view" onClick={() => open('incident', incident.id)}>View {incident.id}</button>])} />
  </>;
}

function Requests({ type, open }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const transfer = type === 'transfer';
  const requests = (transfer ? transferRequests : collaborationRequests).filter((request) => (!status || status === request.status) && `${request.id} ${request.incidentId} ${request.reason}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <>
    <div className="incident-filters">
      <Filter label="Request, incident or reason" name="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      <Filter label="Request status" name="status" options={optionsFor(transfer ? requestStates : ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'])} value={status} onChange={(event) => setStatus(event.target.value)} />
      <button className="report-clear" onClick={() => { setSearch(''); setStatus(''); }}>Clear Filters</button>
    </div>
    <Table title={transfer ? 'Transfer requests' : 'Collaboration requests'} headers={transfer
      ? ['Request', 'Incident', 'Current Technician', 'Suggested Receiver', 'Reason', 'Current / Receiver Workload', 'Priority', 'SLA', 'Requested', 'Status', 'Action']
      : ['Request', 'Incident', 'Primary Technician', 'Requested Collaborator', 'Required Skills', 'Reason', 'Priority', 'SLA', 'Requested', 'Status', 'Action']}
      rows={requests.map((request) => {
        const incident = incidentById(request.incidentId);
        return transfer
          ? [request.id, request.incidentId, person(request.currentTechnicianId), person(request.suggestedTechnicianId), request.reason, `${technicianWorkload(request.currentTechnicianId).total} / ${technicianWorkload(request.suggestedTechnicianId).total}`, incident.priority, <Badge value={incident.slaStatus} />, dateText(request.requestedAt), <Badge value={request.status} />, <button className="incident-view" onClick={() => open(type, request.id)}>Review {request.id}</button>]
          : [request.id, request.incidentId, person(request.primaryTechnicianId), person(request.requestedTechnicianId), request.skills.join(', '), request.reason, incident.priority, <Badge value={incident.slaStatus} />, dateText(request.requestedAt), <Badge value={request.status} />, <button className="incident-view" onClick={() => open(type, request.id)}>Review {request.id}</button>];
      })} />
  </>;
}

function RequestReview({ type, request, cancel }) {
  const transfer = type === 'transfer';
  const incident = incidentById(request.incidentId);
  const [decision, setDecision] = useState('approve');
  const [target, setTarget] = useState(transfer ? request.suggestedTechnicianId : request.requestedTechnicianId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const targetField = useRef(null);
  const eligible = technicians.filter((technician) => technician.id !== incident.primaryTechnicianId && !incident.collaborators.some((member) => member.technicianId === technician.id));

  function submit(event) {
    event.preventDefault();
    setPreview(false);
    if (decision === 'reject' && !reason.trim()) { setError('An explanation is required for rejection.'); return; }
    if (decision === 'approve' && !eligible.some((technician) => technician.id === target && technician.availability !== 'UNAVAILABLE')) { setError('Choose an available technician who is not already on this incident team.'); return; }
    setError('');
    setPreview(true);
  }

  return <>
    <Facts items={[
      ['Request', request.id], ['Request status', request.status], ['Incident', `${incident.id} · ${incident.title}`], ['Description', incident.description],
      [transfer ? 'Requesting technician' : 'Request primary technician', person(transfer ? request.currentTechnicianId : request.primaryTechnicianId)],
      [transfer ? 'Suggested receiving technician' : 'Requested collaborator', person(transfer ? request.suggestedTechnicianId : request.requestedTechnicianId)],
      ['Priority', incident.priority], ['Current primary owner', person(incident.primaryTechnicianId)], ['Reason', request.reason],
      [transfer ? 'Handover notes' : 'Required expertise', transfer ? request.handover : request.skills.join(', ')],
      ['Response deadline', dateText(incident.responseDeadline)], ['Resolution deadline', dateText(incident.resolutionDeadline)], ['SLA status', incident.slaStatus],
    ]} />
    <Team incident={incident} />
    <WorkloadTable title="Technician comparison — current demo workload" />
    <p className="report-guidance">Workloads and availability reflect the shared demo snapshot, not the historical request time.</p>
    {request.status !== 'PENDING' ? <p className="status-message">Historical {readableLabel(request.status)} request · {request.decision} · {dateText(request.decidedAt)}</p> : <form className="admin-preview-form" onSubmit={submit}>
      <fieldset><legend>{transfer ? 'Transfer decision preview' : 'Collaboration decision preview'}</legend>
        <div className="admin-choice">{['approve', 'reject'].map((value) => <label key={value}><input type="radio" name="decision" value={value} checked={decision === value} onChange={() => { setDecision(value); setPreview(false); setError(''); }} /> {value === 'approve' ? 'Approve' : 'Reject'} {transfer ? 'Transfer' : 'Collaboration'}</label>)}</div>
        <div className="report-field"><label htmlFor="review-target">{transfer ? 'Proposed primary technician' : 'Proposed collaborator'}</label>
          <select ref={targetField} id="review-target" value={target} disabled={decision === 'reject'} onChange={(event) => { setTarget(event.target.value); setPreview(false); setError(''); }}>
            <option value="">Choose technician</option>{eligible.map((technician) => <option key={technician.id} value={technician.id}>{technician.id} · {technician.name} · {readableLabel(technician.availability)}</option>)}
          </select>
        </div>
        <button className="incident-view" type="button" disabled={decision === 'reject'} onClick={() => { setTarget(''); setPreview(false); targetField.current.focus(); }}>{transfer ? 'Choose Another Technician' : 'Suggest Different Technician'}</button>
        <div className="report-field"><label htmlFor="decision-reason">Explanation {decision === 'reject' ? '(required)' : '(optional)'}</label><textarea id="decision-reason" rows={3} maxLength={1000} value={reason} onChange={(event) => { setReason(event.target.value); setPreview(false); setError(''); }} /></div>
        <div className="report-actions"><button className="incident-view" type="submit">Preview {decision === 'approve' ? 'Approval' : 'Rejection'}</button><button className="report-clear" type="button" onClick={cancel}>Cancel</button></div>
        <p className="report-error" role="alert">{error}</p>
      </fieldset>
      {preview && <div className="admin-proposal" role="status"><h3>Decision preview — no changes saved</h3>
        <p>{decision === 'reject' ? `Would reject ${request.id}: ${reason.trim()}` : transfer ? `${person(target)} would become the primary owner of ${incident.id}; ${person(incident.primaryTechnicianId)} would lose primary ownership.` : `${person(target)} would join ${incident.id} as a collaborator. ${person(incident.primaryTechnicianId)} would remain primary owner.`}</p>
        <p>Incident ID {incident.id} and SLA deadlines would remain unchanged: response {dateText(incident.responseDeadline)}, resolution {dateText(incident.resolutionDeadline)}.</p>
        <p>Java must authorize the decision, handle team membership, record audit history and send notifications. This preview performs none of those operations.</p>
      </div>}
    </form>}
  </>;
}

const reasonField = { name: 'reason', label: 'Reason', type: 'textarea' };
const textField = (name, label, value = '') => ({ name, label, value });
const selectField = (name, label, options, value = '') => ({ name, label, options, value });
const skillsField = (value = []) => ({ name: 'skills', label: 'Technical Skills (select at least one)', type: 'multiselect', options: technicianSkills, value });

function userSpecification(user, title) {
  return { title, subject: user?.id || 'New sample account proposal', fields: [
    ...(user ? [{ ...textField('id', 'User ID', user.id), readOnly: true }] : []),
    textField('name', 'Full Name', user?.name), { name: 'email', label: 'Institutional Email', type: 'email', value: user?.email, readOnly: Boolean(user) },
    selectField('role', 'Role proposal', optionsFor(userRoles), user?.role || 'STUDENT'),
    selectField('status', 'Account status proposal', optionsFor(accountStates), user?.status || 'ACTIVE'),
    { name: 'confirmAdmin', type: 'checkbox', label: 'I understand this proposes ADMIN access and requires explicit backend authorization.', when: (values) => values.role === 'ADMIN' && user?.role !== 'ADMIN' },
  ], validate: (values) => {
    if (users.some((existing) => existing.id !== user?.id && existing.email.toLowerCase() === values.email.trim().toLowerCase())) return 'An account with this institutional email already exists.';
    return protectOnlyAdministrator(user, values);
  }, outcome: 'No user, account status or security role has changed. Java must revalidate and authorize this proposal. Administrator access is never granted by this preview.' };
}

function protectOnlyAdministrator(user, values) {
  const onlyAdministrator = user?.role === 'ADMIN' && !users.some((other) => other.id !== user.id && other.role === 'ADMIN' && other.status === 'ACTIVE');
  return onlyAdministrator && (values.status === 'DISABLED' || (values.role && values.role !== 'ADMIN')) ? 'The only administrator cannot be disabled or demoted in this preview. An explicit future backend policy is required.' : '';
}

function accountStatusSpecification(user) {
  return { title: 'Enable / Disable User', subject: `${user.id} · ${user.name}`, fields: [
    { ...textField('id', 'User ID', user.id), readOnly: true },
    { ...textField('email', 'Institutional Email', user.email), readOnly: true },
    selectField('status', 'Proposed account status', optionsFor(accountStates), user.status),
  ], validate: (values) => protectOnlyAdministrator(user, values), outcome: `Confirmation preview only. The account remains ${user.status}. Java must authorize and save any future access change.` };
}

function StrategyConfiguration() {
  const [strategy, setStrategy] = useState('SKILL_BASED');
  const strategies = {
    SKILL_BASED: { label: 'Skill-Based Assignment', explanation: 'Match incident needs with relevant technical specialization.', factors: 'Incident category, specialization, availability and relevant experience when recorded.', example: 'A network connectivity issue is reviewed against networking skills.' },
    LOAD_BASED: { label: 'Load-Based Assignment', explanation: 'Consider current workload and available capacity alongside incident requirements.', factors: 'Active primary and collaboration assignments, availability, capacity and incident requirements.', example: 'Several eligible technicians exist; current workload can help distribute new work.' },
  };
  const selected = strategies[strategy];
  return <section className="report-form admin-section"><h2>Assignment Strategies</h2>
    <p className="report-guidance">Current demo configuration: Skill-Based Assignment. Selection below previews a proposal only.</p>
    <div className="report-row">{Object.values(strategies).map((item) => <div key={item.label}><h3>{item.label}</h3><p>{item.explanation}</p><p className="report-guidance">Factors: {item.factors}</p></div>)}</div>
    <div className="report-field"><label htmlFor="assignment-strategy">Preview strategy</label><select id="assignment-strategy" value={strategy} onChange={(event) => setStrategy(event.target.value)}>{Object.entries(strategies).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></div>
    <div className="admin-proposal" role="status"><strong>Selected proposal: {selected.label}</strong><p>{selected.explanation}</p><p>Factors: {selected.factors}</p><p>Example: {selected.example}</p><p>No strategy has been activated or incident reassigned. Java will persist this choice for new assignments.</p></div>
    <p className="report-guidance">Future Java implementations use AssignmentStrategy, SkillBasedAssignment and LoadBasedAssignment through interfaces and polymorphism. The backend must enforce availability, capacity, administrator overrides and no-eligible-technician handling, and record audit events and notifications.</p>
  </section>;
}

function Technicians({ open, preview, navigate }) {
  return <>
    <div className="admin-actions"><button className="incident-view" onClick={() => preview({ title: 'Add Technician', subject: 'New technician proposal', fields: [textField('name', 'Full Name'), { name: 'email', label: 'Institutional Email', type: 'email' }, skillsField(), selectField('availability', 'Availability', optionsFor(['AVAILABLE', 'BUSY', 'UNAVAILABLE']))], validate: (values) => users.some((user) => user.email.toLowerCase() === values.email.trim().toLowerCase()) ? 'An account with this institutional email already exists.' : '' })}>Add Technician preview</button></div>
    <Table title="Manage technicians" headers={['ID', 'Full Name', 'Institutional Email', 'Specializations', 'Availability', 'Active Primary', 'Active Collaborations', 'High-Priority Incidents', 'Unique Active Incidents', 'Workload Level', 'Action']} rows={technicians.map((technician) => {
      const workload = technicianWorkload(technician.id);
      return [technician.id, technician.name, technician.email, technician.skills.map((skill) => technicianSkills.find((option) => option.value === skill).label).join(', '), <Badge value={technician.availability} />, workload.activePrimary, workload.activeCollaboration, workload.active.filter((incident) => ['P1', 'P2'].includes(incident.priority)).length, workload.active.length, <Badge value={workloadLevel(technician, workload)} />, <button className="incident-view" onClick={() => open('technician', technician.id)}>View {technician.id}</button>];
    })} />
    <p className="report-guidance">Illustrative workload levels: Low below half capacity; Moderate from half to below capacity; High at capacity; Overloaded above capacity. Primary and collaboration participations are separate; unique incident totals count each incident once. High priority means active P1/P2. Java will define the final limits.</p>
    <section className="dashboard-summary admin-workload" aria-label="Technician workload comparison">{technicians.map((technician) => {
      const workload = technicianWorkload(technician.id);
      return <div className="dashboard-summary-card" key={technician.id}><h3>{technician.name}</h3><p className="admin-workload-total">{workload.total} / {technician.workloadLimit}</p><progress aria-label={`${technician.name} demo workload`} max={technician.workloadLimit} value={workload.total} /><span>{workload.activePrimary} primary · {workload.activeCollaboration} collaborating · {readableLabel(workloadLevel(technician, workload))}</span></div>;
    })}</section>
    {technicians.filter((technician) => technicianWorkload(technician.id).total >= technician.workloadLimit).map((technician) => <p className="admin-warning" key={technician.id}>Technician {technician.id} has a high workload ({technicianWorkload(technician.id).total}/{technician.workloadLimit} illustrative capacity). Consider reviewing incident assignments.</p>)}
    <div className="admin-actions"><button className="incident-view" onClick={() => navigate('All Incidents')}>Review All Incidents</button><button className="incident-view" onClick={() => navigate('Assignment Requests')}>Review Transfer Requests</button></div>
  </>;
}

function Users({ open, preview }) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const records = users.filter((user) => (!role || user.role === role) && (!status || user.status === status) && `${user.id} ${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <>
    <div className="incident-filters"><Filter label="Search name or institutional email" name="user-search" value={search} onChange={(event) => setSearch(event.target.value)} /><Filter label="Role" name="role" value={role} options={optionsFor(userRoles)} onChange={(event) => setRole(event.target.value)} /><Filter label="Account status" name="account-status" value={status} options={optionsFor(accountStates)} onChange={(event) => setStatus(event.target.value)} /><button className="report-clear" onClick={() => { setSearch(''); setRole(''); setStatus(''); }}>Clear Filters</button><button className="incident-view" onClick={() => preview(userSpecification(null, 'Add User'))}>Add User preview</button></div>
    <p className="report-guidance" role="status">{records.length} of {users.length} sample users</p>
    <Table title="User accounts" headers={['User ID', 'Full Name', 'Institutional Email', 'Role', 'Account Status', 'Created Date', 'Action']} rows={records.map((user) => [user.id, user.name, user.email, user.role, <Badge value={user.status} />, dateText(user.createdAt), <button className="incident-view" onClick={() => open('user', user.id)}>View {user.id}</button>])} />
  </>;
}

function Services({ preview }) {
  function edit(service) {
    preview({ title: service ? 'Edit Service' : 'Add Service', subject: service?.id || 'New service proposal', fields: [
      ...(service ? [{ ...textField('id', 'Service ID', service.id), readOnly: true }] : []),
      { ...textField('name', 'Service Name', service?.name), readOnly: Boolean(service) },
      selectField('category', 'Category', optionsFor(incidentCategories.map((category) => category.name)), service?.category),
      { name: 'description', label: 'Description', type: 'textarea', value: service?.description },
      selectField('criticality', 'Business Criticality', optionsFor(['LOW', 'MEDIUM', 'HIGH']), service?.criticality),
      selectField('status', 'Service Status', optionsFor(['OPERATIONAL', 'DEGRADED', 'UNAVAILABLE']), service?.status),
    ], validate: (values) => services.some((existing) => existing.id !== service?.id && existing.name.toLowerCase() === values.name.trim().toLowerCase()) ? 'A service with this name already exists.' : '', outcome: 'Service proposal only. Existing incidents and priorities are unchanged. Java will enforce consistency and priority rules.' });
  }
  return <><div className="admin-actions"><button className="incident-view" onClick={() => edit(null)}>Add Service preview</button></div>
    <Table title="Campus IT services" headers={['Service ID', 'Service Name', 'Category', 'Description', 'Business Criticality', 'Service Status', 'Related Incidents', 'Action']} rows={services.map((service) => [service.id, service.name, readableLabel(service.category), service.description, readableLabel(service.criticality), <Badge value={service.status} />, demoIncidents.filter((incident) => incident.affectedService === service.name).length, <button className="incident-view" onClick={() => edit(service)}>Edit {service.name}</button>])} />
  </>;
}

function Categories({ preview }) {
  function edit(category) {
    preview({ title: category ? 'Edit Incident Category' : 'Add Incident Category', subject: category?.name || 'New category proposal', fields: [
      { ...textField('name', 'Category Name (UPPER_CASE)', category?.name), readOnly: Boolean(category) },
      { name: 'description', label: 'Description', type: 'textarea', value: category?.description }, skillsField(category?.skills),
      selectField('status', 'Category Status', optionsFor(accountStates), category?.status || 'ACTIVE'),
    ], validate: (values) => {
      if (incidentCategories.some((existing) => existing.name !== category?.name && existing.name.toLowerCase() === values.name.trim().toLowerCase())) return 'A category with this name already exists.';
      if (!/^[A-Z][A-Z0-9_]*$/.test(values.name.trim())) return 'Use uppercase letters, numbers and underscores for the category name.';
      return '';
    }, outcome: 'Category proposal only. No category, historical incident classification or skill requirement has changed.' });
  }
  return <><div className="admin-actions"><button className="incident-view" onClick={() => edit(null)}>Add Category preview</button></div>
    <Table title="Incident categories" headers={['Category Name', 'Description', 'Related Technical Skills', 'Status', 'Related Incidents', 'Action']} rows={incidentCategories.map((category) => [category.name, category.description, category.skills.map((skill) => technicianSkills.find((item) => item.value === skill).label).join(', '), category.status, demoIncidents.filter((incident) => incident.category === category.name).length, <button className="incident-view" onClick={() => edit(category)}>Edit {category.name}</button>])} />
  </>;
}

function SlaPolicies({ preview, open }) {
  return <>
    <p className="report-guidance">Response SLA measures time to initial acknowledgment; resolution SLA measures time to resolution. Java will determine deadlines from priority and policy, and detect violations. Proposed policy changes apply to new incidents only unless an explicit future migration is authorized.</p>
    <Table title="SLA policies" headers={['Policy ID', 'Priority', 'Response Target', 'Resolution Target', 'Policy Status', 'Action']} rows={slaPolicies.map((policy) => [policy.id, policy.priority, policy.response, policy.resolution, policy.status, <button className="incident-view" onClick={() => preview({ title: 'Edit SLA Policy', subject: policy.id, fields: [
      { ...textField('priority', 'Priority', policy.priority), readOnly: true },
      { name: 'response', label: 'Response Target (minutes)', type: 'number', value: policy.responseMinutes }, { name: 'resolution', label: 'Resolution Target (minutes)', type: 'number', value: policy.resolutionMinutes },
      selectField('status', 'Policy Status', optionsFor(accountStates), policy.status),
    ], validate: (values) => Number(values.resolution) < Number(values.response) ? 'Resolution target must not be shorter than response target.' : '', outcome: 'Policy preview for newly created incidents only. Existing incident deadlines and SLA status remain unchanged.' })}>Edit {policy.priority} preview</button>])} />
    <Cards items={slaStates.map((status) => [readableLabel(status), demoIncidents.filter((incident) => incident.slaStatus === status).length])} />
    <IncidentList title="SLA monitoring: seeded snapshots" records={demoIncidents} open={open} />
  </>;
}

function Escalations({ open, preview }) {
  const records = demoIncidents.filter((incident) => incident.escalation);
  return <>
    <p className="report-guidance">Demonstration hierarchy: Technician → Team Lead → System Administrator → IT Manager. These are escalation levels, not additional login roles.</p>
    <Table title="Escalated incidents" headers={['Incident', 'Priority', 'Assigned Technician', 'Reason', 'SLA', 'Level', 'Time Escalated', 'Action']} rows={records.map((incident) => [incident.id, incident.priority, person(incident.primaryTechnicianId), incident.escalation.reason, <Badge value={incident.slaStatus} />, incident.escalation.level, dateText(incident.escalation.escalatedAt), <button className="incident-view" onClick={() => open('incident', incident.id)}>Review Escalation</button>])} />
    {records.map((incident) => <section className="report-form admin-section" key={incident.id}><h2>{incident.id} · Proposed management action</h2><div className="admin-actions">{['Assign Specialist', 'Reallocate Workload', 'Escalate to Higher Authority', 'Record Decision'].map((title) => <button className="incident-view" key={title} onClick={() => preview({ title, subject: incident.id, fields: [title.includes('Authority') ? selectField('level', 'Escalation level', optionsFor(['TEAM_LEAD', 'SYSTEM_ADMINISTRATOR', 'IT_MANAGER'])) : selectField('technician', 'Suggested technician', technicianOptions, incident.primaryTechnicianId), reasonField], outcome: 'Escalation decision preview only; ownership, deadlines and audit history remain unchanged.' })}>{title}</button>)}</div></section>)}
  </>;
}

function Reports() {
  const active = demoIncidents.filter(isActive);
  const compliant = demoIncidents.filter((incident) => ['ON_TRACK', 'MET'].includes(incident.slaStatus)).length;
  return <>
    <Cards items={[
      ['Total Incidents', demoIncidents.length], ['Active Incidents', active.length], ['Critical (active P1)', active.filter((incident) => incident.priority === 'P1').length],
      ['Resolved / verified / closed', demoIncidents.length - active.length], ['Closed Incidents', demoIncidents.filter((incident) => incident.status === 'CLOSED').length],
    ]} />
    <p className="report-guidance">Closed is a subset of resolved. All figures derive from the same fictional incident and request records.</p>
    <Table title="Incident status distribution" headers={['Status', 'Incidents']} rows={Object.entries(incidentStatuses).map(([status, details]) => [details.label, demoIncidents.filter((incident) => incident.status === status).length])} />
    <Table title="Category distribution" headers={['Category', 'Incidents']} rows={incidentCategories.map(({ name }) => [readableLabel(name), demoIncidents.filter((incident) => incident.category === name).length])} />
    <Table title="Priority analysis" headers={['Priority', 'Incidents']} rows={priorities.map((priority, index) => [`${priority} ${['Critical', 'High', 'Medium', 'Low'][index]}`, demoIncidents.filter((incident) => incident.priority === priority).length])} />
    <Table title="Technician performance" headers={['Technician', 'Active primary', 'Active collaborations', 'Resolved primary', 'Availability']} rows={technicians.map((technician) => { const workload = technicianWorkload(technician.id); return [technician.name, workload.activePrimary, workload.activeCollaboration, workload.resolved, readableLabel(technician.availability)]; })} />
    <Table title="SLA monitoring" headers={['Measure', 'Incidents']} rows={[
      ['Compliant (On track + Met)', compliant], ['At risk', demoIncidents.filter((incident) => incident.slaStatus === 'AT_RISK').length], ['Breached', demoIncidents.filter((incident) => incident.slaStatus === 'BREACHED').length],
    ]} />
    <Table title="Resolution performance" headers={['Incident', 'Resolved at', 'Resolution target', 'Seeded SLA outcome']} rows={demoIncidents.filter((incident) => incident.resolvedAt).map((incident) => [incident.id, dateText(incident.resolvedAt), dateText(incident.resolutionDeadline), readableLabel(incident.slaStatus)])} />
    <Table title="Transfer analytics" headers={['Measure', 'Requests']} rows={[
      ['Total', transferRequests.length], ...requestStates.map((status) => [readableLabel(status), transferRequests.filter((request) => request.status === status).length]), ['High-workload reasons (all states)', transferRequests.filter((request) => request.reasonType === 'HIGH_WORKLOAD').length],
    ]} />
    <Table title="Collaboration analytics" headers={['Measure', 'Count']} rows={[
      ['Unassigned incidents', demoIncidents.filter((incident) => !incident.primaryTechnicianId).length],
      ['Single-technician incidents', demoIncidents.filter((incident) => incident.primaryTechnicianId && incident.collaborators.length === 0).length],
      ['Multi-technician incidents', demoIncidents.filter((incident) => incident.primaryTechnicianId && incident.collaborators.length > 0).length],
      ['Pending collaboration requests', collaborationRequests.filter((request) => request.status === 'PENDING').length],
    ]} />
  </>;
}

function AuditLogs() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [date, setDate] = useState('');
  const records = auditLogs.filter((record) => (!action || record.actionType === action) && (!date || record.timestamp.startsWith(date)) && `${record.incidentId} ${person(record.userId)} ${record.action} ${record.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <><div className="incident-filters"><Filter label="Search audit history" name="audit-search" value={search} onChange={(event) => setSearch(event.target.value)} /><Filter label="Action" name="audit-action" value={action} options={[...new Set(auditLogs.map((record) => record.actionType))].map((value) => ({ value, label: readableLabel(value) }))} onChange={(event) => setAction(event.target.value)} /><Filter label="Event date" type="date" name="audit-date" value={date} onChange={(event) => setDate(event.target.value)} /><button className="report-clear" onClick={() => { setSearch(''); setAction(''); setDate(''); }}>Clear Filters</button></div><AuditTable records={records} /></>;
}

function IntelligentMonitoring({ open }) {
  return <section aria-label="Intelligent monitoring examples">
    <h2>Intelligent Monitoring</h2>
    <p className="report-guidance">Pre-seeded fictional examples. No similarity scores, recommendations or risks are calculated here. Java will provide the actual detection and assignment strategies.</p>
    <Table title="Potentially related incidents" headers={['Incidents / titles', 'Affected services', 'Similarity status', 'Review']} rows={relatedIncidentExamples.map((example) => {
      const records = example.incidentIds.map(incidentById);
      return [records.map((incident) => `${incident.id}: ${incident.title}`).join(' / '), [...new Set(records.map((incident) => incident.affectedService))].join(', '), example.status, <div className="admin-actions">{records.map((incident) => <button key={incident.id} className="incident-view" onClick={() => open('incident', incident.id)}>Review {incident.id}</button>)}</div>];
    })} />
    <Table title="Sample technician recommendation" headers={['Incident', 'Suggested technician', 'Skills', 'Availability', 'Current active workload', 'Explanation', 'Review']} rows={recommendationExamples.map((example) => {
      const technician = technicianById(example.technicianId);
      return [example.incidentId, technician.name, technician.skills.map(readableLabel).join(', '), readableLabel(technician.availability), `${technicianWorkload(technician.id).total} / ${technician.workloadLimit}`, example.explanation, <button className="incident-view" onClick={() => open('incident', example.incidentId)}>Review {example.incidentId}</button>];
    })} />
    <Table title="SLA risk monitoring" headers={['Incident', 'Priority', 'Primary technician', 'SLA', 'Relevant deadline', 'Snapshot time', 'Review']} rows={demoIncidents.filter((incident) => ['AT_RISK', 'BREACHED'].includes(incident.slaStatus)).map((incident) => [incident.id, incident.priority, person(incident.primaryTechnicianId), <Badge value={incident.slaStatus} />, `${incident.acknowledgedAt ? 'Resolution' : 'Response'}: ${dateText(incident.acknowledgedAt ? incident.resolutionDeadline : incident.responseDeadline)}`, dateText(incident.slaEvaluatedAt), <button className="incident-view" onClick={() => open('incident', incident.id)}>Review {incident.id}</button>])} />
  </section>;
}

function IncidentDetails({ incident, open, setAction }) {
  const availableTeam = technicianOptions.filter((option) => option.value !== incident.primaryTechnicianId && !incident.collaborators.some((member) => member.technicianId === option.value));
  const pending = transferRequests.find((request) => request.incidentId === incident.id && request.status === 'PENDING');
  const history = auditLogs.filter((record) => record.incidentId === incident.id);
  return <>
    <Facts items={[
      ['Incident', incident.id], ['Title', incident.title], ['Reporter', `${person(incident.reporterId)} · ${users.find((user) => user.id === incident.reporterId).email}`],
      ['Category', readableLabel(incident.category)], ['Service', incident.affectedService], ['Description', incident.description], ['Impact', readableLabel(incident.impact)], ['Urgency', readableLabel(incident.urgency)],
      ['Priority', incident.priority], ['Status', statusText(incident.status)], ['Created date', dateText(incident.createdAt)], ['Primary technician', person(incident.primaryTechnicianId)],
      ['SLA status', incident.slaStatus], ['Response deadline', dateText(incident.responseDeadline)], ['Resolution deadline', dateText(incident.resolutionDeadline)], ['Resolution', incident.resolution || 'Not resolved'],
    ]} />
    <div className="admin-actions">
      <button className="incident-view" onClick={() => setAction({ title: 'Assign / Reassign Technician', subject: incident.id, fields: [selectField('technician', 'Proposed primary technician', availableTeam), reasonField], validate: (values) => technicianById(values.technician).availability === 'UNAVAILABLE' ? 'Choose an available technician.' : '', outcome: `The selected technician would replace the current primary owner on ${incident.id}. The incident and SLA deadlines would remain unchanged. No assignment has been made.` })}>Assign / Reassign Technician</button>
      <button className="incident-view" disabled={!pending} onClick={() => open('transfer', pending.id)}>{pending ? 'Approve Transfer — review' : 'No pending transfer'}</button>
      <button className="incident-view" disabled={!incident.primaryTechnicianId} onClick={() => setAction({ title: 'Manage Collaborators', subject: incident.id, fields: [selectField('operation', 'Team operation', optionsFor(['ADD', 'REMOVE']), 'ADD'), selectField('technician', 'Technician', technicianOptions.filter((option) => option.value !== incident.primaryTechnicianId)), reasonField], validate: (values) => {
        const exists = incident.collaborators.some((member) => member.technicianId === values.technician);
        if (values.operation === 'ADD' && exists) return 'That technician is already a collaborator.';
        if (values.operation === 'REMOVE' && !exists) return 'Choose a current collaborator to remove.';
        if (values.operation === 'ADD' && technicianById(values.technician).availability === 'UNAVAILABLE') return 'Choose an available technician.';
        return '';
      }, outcome: 'Team change preview only. The primary owner and SLA deadlines would remain unchanged. Java must record the audit event and notify affected team members.' })}>Manage Collaborators</button>
      <button className="incident-view" onClick={() => setAction({ title: 'Change Priority with Reason', subject: incident.id, fields: [selectField('priority', 'Proposed priority', priorities.map((value) => ({ value, label: value })), incident.priority), reasonField] })}>Change Priority with Reason</button>
      <button className="incident-view" onClick={() => setAction({ title: 'Escalate Incident', subject: incident.id, fields: [selectField('level', 'Escalation level', optionsFor(['TEAM_LEAD', 'SYSTEM_ADMINISTRATOR', 'IT_MANAGER'])), reasonField] })}>Escalate Incident</button>
      <button className="incident-view" onClick={() => setAction({ title: 'View Audit History', records: history })}>View Audit History</button>
    </div>
    <Team incident={incident} />
    <Table title="Investigation history" headers={['Time', 'Technician', 'Note']} rows={investigationNotes.filter((note) => note.incidentId === incident.id).map((note) => [dateText(note.timestamp), person(note.technicianId), note.note])} />
    <Table title="Transfer history" headers={['Request', 'From', 'Suggested receiver', 'Status', 'Decision']} rows={transferRequests.filter((request) => request.incidentId === incident.id).map((request) => [request.id, person(request.currentTechnicianId), person(request.suggestedTechnicianId), request.status, request.decision || 'Awaiting review'])} />
    <AuditTable title="Incident audit timeline" records={history} />
  </>;
}

function TechnicianDetails({ technician, open, setAction, navigate }) {
  const workload = technicianWorkload(technician.id);
  return <>
    <Facts items={[[ 'Technician', `${technician.id} · ${technician.name}`], ['Email', technician.email], ['Specializations', technician.skills.join(', ')], ['Availability', readableLabel(technician.availability)], ['Active primary assignments', String(workload.activePrimary)], ['Active collaboration responsibilities', String(workload.activeCollaboration)], ['Current workload', `${workload.total} / ${technician.workloadLimit} demo capacity`], ['Resolved primary incidents', String(workload.resolved)]]} />
    <div className="admin-actions">
      <button className="incident-view" onClick={() => setAction({ title: 'Edit Technician Skills', subject: technician.id, fields: [skillsField(technician.skills)], outcome: 'Skill selection preview only. The shared technician profile and incident assignments remain unchanged.' })}>Edit Technician Skills</button>
      <button className="incident-view" onClick={() => setAction({ title: 'Update Availability', subject: technician.id, fields: [selectField('availability', 'Availability', optionsFor(['AVAILABLE', 'BUSY', 'UNAVAILABLE']), technician.availability)], outcome: 'Availability preview only. No live availability or assignment has changed.' })}>Update Availability</button>
      <button className="incident-view" onClick={() => navigate('Assignment Requests')}>Review Transfer Requests</button>
      <button className="incident-view" disabled={!workload.primary.length} onClick={() => open('incident', workload.primary[0].id)}>Reassign Incident — review first assignment</button>
    </div>
    <IncidentList title="View assigned incidents" records={workload.primary} open={open} />
    <Table title="Collaboration responsibilities" headers={['Incident', 'Title', 'Responsibility', 'Status', 'Action']} rows={workload.collaborating.map((incident) => [incident.id, incident.title, incident.collaborators.find((member) => member.technicianId === technician.id).responsibility, statusText(incident.status), <button className="incident-view" onClick={() => open('incident', incident.id)}>View {incident.id}</button>])} />
    <IncidentList title="Resolved primary incidents" records={workload.primary.filter((incident) => !isActive(incident))} open={open} />
  </>;
}

export default function AdminDashboard() {
  const [page, setPage] = useState('Dashboard');
  const [readIds, setReadIds] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  const [selection, setSelection] = useState(null);
  const [action, setAction] = useState(null);
  const dialog = useRef(null);
  const actionPanel = useRef(null);
  useEffect(() => {
    if (action) {
      actionPanel.current?.focus();
      actionPanel.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [action]);
  const admin = users.find((user) => user.role === 'ADMIN');

  function open(type, id) {
    setSelection({ type, id });
    setAction(null);
    if (!dialog.current.open) dialog.current.showModal();
  }
  function preview(specification) {
    setSelection({ type: 'preview', id: specification.title });
    setAction(specification);
    if (!dialog.current.open) dialog.current.showModal();
  }
  function close() { dialog.current.close(); }
  function navigate(nextPage) { if (dialog.current.open) close(); setPage(nextPage); if (window.matchMedia('(max-width: 700px)').matches) setIsMenuOpen(false); }

  let content;
  switch (page) {
    case 'All Incidents': content = <AllIncidents open={open} />; break;
    case 'Assignment Requests': content = <Requests key="transfers" type="transfer" open={open} />; break;
    case 'Collaboration Requests': content = <Requests key="collaborations" type="collaboration" open={open} />; break;
    case 'Manage Technicians': content = <Technicians open={open} preview={preview} navigate={navigate} />; break;
    case 'Manage Users': content = <Users open={open} preview={preview} />; break;
    case 'IT Services': content = <Services preview={preview} />; break;
    case 'Incident Categories': content = <Categories preview={preview} />; break;
    case 'Assignment Strategies': content = <StrategyConfiguration />; break;
    case 'SLA Policies': content = <SlaPolicies preview={preview} open={open} />; break;
    case 'Escalations': content = <Escalations open={open} preview={preview} />; break;
    case 'Reports & Analytics': content = <Reports />; break;
    case 'Audit Logs': content = <AuditLogs />; break;
    case 'Notifications': content = <Notifications records={adminNotifications} readIds={readIds} onRead={(id) => setReadIds((previous) => previous.includes(id) ? previous : [...previous, id])} onOpen={(item) => open(item.target, item.referenceId)} />; break;
    case 'Settings': content = <><button className="incident-view" onClick={() => navigate('Assignment Strategies')}>Open Assignment Strategies</button><section className="report-form"><h2>Preview environment</h2><p>Administrative decisions, notifications and security changes require Java integration. Nothing is stored between page reloads.</p></section></>; break;
    default: content = <DashboardHome open={open} navigate={navigate} />;
  }

  const selectedUser = selection?.type === 'user' ? users.find((user) => user.id === selection.id) : null;
  return <div className={`student-dashboard admin-portal${isMenuOpen ? '' : ' menu-collapsed'}`}>
    <aside className="dashboard-sidebar" id="admin-sidebar" hidden={!isMenuOpen}>
      <div className="dashboard-brand"><span className="brand-name">BITSolve</span><span className="brand-caption">Administrator Portal</span></div>
      <nav aria-label="Administrator navigation">{pages.map((name) => <button type="button" key={name} className={page === name ? 'dashboard-nav-active' : ''} aria-current={page === name ? 'page' : undefined} onClick={() => navigate(name)}>{name}</button>)}</nav>
      <p className="dashboard-sidebar-note">BITS Pilani<br />Hyderabad Campus</p>
    </aside>
    <div className="dashboard-workspace">
      <header className="dashboard-topbar"><div className="dashboard-heading"><Button27 isOpen={isMenuOpen} onToggle={() => setIsMenuOpen(!isMenuOpen)} controls="admin-sidebar" /><h1>{page === 'Dashboard' ? 'Administrator Dashboard' : page}</h1></div><div className="dashboard-profile"><span className="dashboard-avatar" aria-hidden="true">DA</span><div><strong>{admin.name}</strong><span>Administrator · Demo</span></div></div></header>
      <main className="dashboard-content">
        <div className="dashboard-preview-note"><p><strong>Development preview</strong> · Fictional records. No authenticated session. All administrative actions are unsaved proposals.</p><div className="preview-links"><a href="?preview=student">Student preview</a><a href="/">Back to login</a></div></div>
        <div className="dashboard-welcome"><div><h2>{page === 'Dashboard' ? 'Campus IT overview' : page}</h2><p>Review incidents, teams and service health in one place.</p></div></div>
        {content}
      </main>
      <footer className="dashboard-footer">BITSolve — BITS Hyderabad IT Support</footer>
    </div>
    <dialog ref={dialog} className="incident-dialog admin-dialog" aria-labelledby="admin-dialog-title" onClose={() => { setSelection(null); setAction(null); }}>
      <div className="dashboard-section-heading"><h2 id="admin-dialog-title">{selection?.type === 'preview' ? selection.id : `${selection?.id || ''} · Review`}</h2><button className="report-clear" type="button" autoFocus onClick={close}>Close</button></div>
      <p className="report-guidance">Demo inspection and proposals only. No records, deadlines, permissions, audit logs or notifications are changed.</p>
      {selection?.type === 'incident' && <IncidentDetails incident={incidentById(selection.id)} open={open} setAction={setAction} />}
      {selection?.type === 'technician' && <TechnicianDetails technician={technicianById(selection.id)} open={open} setAction={setAction} navigate={navigate} />}
      {['transfer', 'collaboration'].includes(selection?.type) && <RequestReview key={selection.id} type={selection.type} request={(selection.type === 'transfer' ? transferRequests : collaborationRequests).find((request) => request.id === selection.id)} cancel={close} />}
      {selectedUser && <><Facts items={[
        ['User ID', selectedUser.id], ['Full Name', selectedUser.name], ['Institutional Email', selectedUser.email], ['Role', selectedUser.role], ['Account Status', selectedUser.status], ['Created Date', dateText(selectedUser.createdAt)],
        ...(selectedUser.studentId ? [['Student ID', selectedUser.studentId]] : []),
        ['Associated Incident Count', selectedUser.role === 'ADMIN' ? 'Not applicable' : demoIncidents.filter((incident) => incident.reporterId === selectedUser.id || incident.primaryTechnicianId === selectedUser.id || incident.collaborators.some((member) => member.technicianId === selectedUser.id)).length],
      ]} /><div className="admin-actions"><button className="incident-view" onClick={() => setAction(userSpecification(selectedUser, 'Edit User'))}>Edit User preview</button><button className="incident-view" onClick={() => setAction(accountStatusSpecification(selectedUser))}>Enable / Disable User preview</button></div></>}
      {action && <section ref={actionPanel} tabIndex={-1} className="admin-action-panel" aria-label="Selected action preview"><div className="admin-actions"><button className="report-clear" onClick={() => { setAction(null); if (selection.type === 'preview') close(); }}>Cancel proposal</button></div>{action.records ? <AuditTable records={action.records} /> : <PreviewForm key={`${action.title}-${action.subject}`} specification={action} />}</section>}
    </dialog>
  </div>;
}
