import React, { useEffect, useRef, useState } from 'react';
import Button27 from '../components/ui/button-27.jsx';
import TechnicianOperations, { operationLabels } from './TechnicianOperations.jsx';
import { KnowledgeBase, NotificationCenter } from './TechnicianResources.jsx';
import { incidentStatuses, readableLabel } from '../MyIncidents.jsx';
import { demoIncidents, technicians, users, slaPolicies, auditLogs, investigationNotes, studentResponses, supportRequests, transferRequests, collaborationRequests, technicianNotifications, technicianWorkload, isActive } from '../demoData.js';

const priorities = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
const slaStates = ['ON_TRACK', 'AT_RISK', 'BREACHED', 'MET'];
const emptyFilters = { search: '', status: '', priority: '', category: '', slaStatus: '' };
const pages = { dashboard: 'Dashboard', assigned: 'Assigned Incidents', team: 'My Team Incidents', transfers: 'Transfer Requests', investigation: 'Investigation', workload: 'My Workload', knowledge: 'Knowledge Base', notifications: 'Notifications', profile: 'Profile' };
const dateLabel = (value) => value ? value.slice(0, 16).replace('T', ' ') : 'Not provided';
const userName = (id) => users.find((user) => user.id === id)?.name || 'Not provided';

function Badge({ value }) {
  const status = incidentStatuses[value];
  const color = status ? `status-${status.group}` : `badge-${value.toLowerCase().replaceAll('_', '-')}`;
  return <span className={`incident-status technician-badge ${color}`}>{priorities[value] ? `${value} · ${priorities[value]}` : status?.label || readableLabel(value)}</span>;
}

function IncidentTable({ incidents, view = 'assigned', onView, emptyMessage = 'No incidents assigned yet.' }) {
  const headings = view === 'priority'
    ? ['Incident ID', 'Title', 'Priority', 'Status', 'SLA Status', 'Resolution Deadline', 'Action']
    : view === 'recent'
      ? ['Incident ID', 'Title', 'Category', 'Priority', 'Status', 'Assigned Date', 'Action']
      : ['Incident ID', 'Title', 'Reporter', 'Category', 'Affected Service', 'Priority', 'Status', 'Created Date', 'SLA Status', 'Action'];

  if (!incidents.length) return <p className="dashboard-empty">{emptyMessage}</p>;
  return <div className="dashboard-table-scroll" role="region" aria-label={`${view} incidents`} tabIndex={0}>
    <table>
      <thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
      <tbody>{incidents.map((incident) => <tr key={incident.id}>
        <td className="dashboard-incident-id">{incident.id}</td>
        <td className="dashboard-incident-title">{incident.title}</td>
        {view === 'assigned' && <td>{userName(incident.reporterId)}</td>}
        {view !== 'priority' && <td>{readableLabel(incident.category)}</td>}
        {view === 'assigned' && <td>{incident.affectedService}</td>}
        <td><Badge value={incident.priority} /></td>
        <td><Badge value={incident.status} /></td>
        {view === 'priority' && <td><Badge value={incident.slaStatus} /></td>}
        <td><time dateTime={view === 'priority' ? incident.resolutionDeadline : view === 'recent' ? incident.assignedAt : incident.createdAt}>{dateLabel(view === 'priority' ? incident.resolutionDeadline : view === 'recent' ? incident.assignedAt : incident.createdAt)}</time></td>
        {view === 'assigned' && <td><Badge value={incident.slaStatus} /></td>}
        <td><button type="button" className="incident-view" aria-label={`View details for ${incident.id}`} onClick={() => onView(incident.id)}>View Details</button></td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function SummaryCards({ items, label }) {
  return <section className="dashboard-summary" aria-label={label}>{items.map(([title, count]) => <div className="dashboard-summary-card" key={title}><h3>{title}</h3><p>{count}</p></div>)}</section>;
}

function SlaAttention({ incidents, onView, onAction }) {
  const attention = incidents.filter((incident) => isActive(incident) && ['AT_RISK', 'BREACHED'].includes(incident.slaStatus))
    .sort((a, b) => (a.slaStatus === 'BREACHED' ? 0 : 1) - (b.slaStatus === 'BREACHED' ? 0 : 1) || a.resolutionDeadline.localeCompare(b.resolutionDeadline));
  return <section className="dashboard-incidents technician-section" aria-label="SLA attention">
    <div className="dashboard-section-heading"><h2>Incidents Requiring SLA Attention</h2></div>
    <p className="incident-results">Primary and collaboration assignments. Historical snapshots, not live monitoring; each row shows when its SLA status was evaluated.</p>
    {!attention.length ? <p className="dashboard-empty">No incidents require SLA attention in this demo snapshot.</p> : <div className="dashboard-table-scroll" role="region" aria-label="SLA attention table" tabIndex={0}><table>
      <thead><tr>{['Incident ID', 'Title / Warning', 'Priority', 'Response Deadline', 'Resolution Deadline', 'SLA Status', 'Action'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{attention.map((incident) => <tr key={incident.id}><td>{incident.id}</td><td className="dashboard-incident-title">{incident.title}<p className="report-guidance">Incident {incident.id} {incident.slaWarning}</p></td><td><Badge value={incident.priority} /></td><td><time dateTime={incident.responseDeadline}>{dateLabel(incident.responseDeadline)}</time></td><td><time dateTime={incident.resolutionDeadline}>{dateLabel(incident.resolutionDeadline)}</time></td><td><Badge value={incident.slaStatus} /><p className="report-guidance">As of {dateLabel(incident.slaEvaluatedAt)}</p></td><td><div className="technician-resource-links"><button type="button" className="incident-view" aria-label={`View details for ${incident.id}`} onClick={() => onView(incident.id)}>View Details</button><button type="button" className="incident-view" aria-label={`Escalate ${incident.id}`} onClick={() => onAction('escalate', incident)}>Escalate Incident</button></div></td></tr>)}</tbody>
    </table></div>}
  </section>;
}

function DashboardHome({ incidents, technician, workload, onView, onAction, onNavigate }) {
  const active = incidents.filter(isActive);
  const pending = active.filter((incident) => incident.status === 'ASSIGNED');
  const inProgress = active.filter((incident) => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status));
  const highPriority = active.filter((incident) => ['P1', 'P2'].includes(incident.priority));
  const atRisk = active.filter((incident) => incident.slaStatus === 'AT_RISK');
  const summary = [
    ['Total Assigned Incidents', incidents.length], ['Pending Acknowledgment', pending.length],
    ['In Progress', inProgress.length], ['High-Priority Incidents', highPriority.length],
    ['SLA At Risk', atRisk.length], ['Resolved Incidents', incidents.filter((incident) => !isActive(incident)).length],
  ];
  const recent = [...incidents].sort((a, b) => (b.assignedAt || '').localeCompare(a.assignedAt || '')).slice(0, 5);
  const pendingCollaboration = collaborationRequests.filter((request) => request.status === 'PENDING' && (request.primaryTechnicianId === technician.id || request.requestedTechnicianId === technician.id));
  const responses = studentResponses.filter((response) => workload.participating.some((incident) => incident.id === response.incidentId));
  const slaAlerts = workload.active.filter((incident) => ['AT_RISK', 'BREACHED'].includes(incident.slaStatus));

  return <>
    <section className="dashboard-welcome"><div><h2>Welcome back, Technician!</h2><p>Manage assigned IT incidents, track priorities, and monitor your support workload.</p></div></section>
    <SummaryCards items={summary} label="Technician incident summary" />
    <p className="report-guidance">Primary assignments only. Pending: Assigned. In progress: Acknowledged or In Progress. Resolved: Resolved, Verified or Closed. High priority: active P1/P2. SLA at risk: active AT_RISK. Priority and SLA counts can overlap with status counts.</p>
    <section className="technician-section" aria-label="Quick Actions"><div className="report-actions">{[['assigned', 'View Assigned Incidents'], ['workload', 'View My Workload'], ['transfers', 'View Transfer Requests'], ['knowledge', 'Open Knowledge Base'], ['notifications', 'View Notifications']].map(([page, label]) => <button key={page} type="button" className="report-clear" onClick={() => onNavigate(page)}>{label}</button>)}</div></section>
    <DetailSection title="Important Alerts"><ul className="technician-alerts">
      <li><strong>{slaAlerts.length} incident(s) need SLA attention.</strong> Review their warnings and deadlines below.</li>
      <li>{workload.total >= technician.workloadLimit ? 'Your current workload is high. Consider requesting incident redistribution.' : 'Workload is below the illustrative limit.'} <button type="button" className="incident-view" onClick={() => onNavigate('workload')}>Review Workload</button></li>
      <li>{pendingCollaboration.length} pending collaboration request(s). <button type="button" className="incident-view" onClick={() => onNavigate('team')}>Review Team Requests</button></li>
      <li>{responses.length} student response(s) in the sample history. <button type="button" className="incident-view" onClick={() => onNavigate('investigation')}>Review Investigation</button></li>
    </ul></DetailSection>
    <SlaAttention incidents={workload.participating} onView={onView} onAction={onAction} />
    <section className="dashboard-incidents technician-section" aria-labelledby="technician-priority-title">
      <div className="dashboard-section-heading"><h2 id="technician-priority-title">Priority Incidents</h2><span>Active P1 / P2</span></div>
      <IncidentTable incidents={[...highPriority].sort((a, b) => a.priority.localeCompare(b.priority) || a.resolutionDeadline.localeCompare(b.resolutionDeadline))} view="priority" onView={onView} emptyMessage="No active high-priority incidents." />
    </section>
    <section className="dashboard-incidents technician-section" aria-labelledby="technician-recent-title">
      <div className="dashboard-section-heading"><h2 id="technician-recent-title">Recent Assigned Incidents</h2><span>Latest 5</span></div>
      <IncidentTable incidents={recent} view="recent" onView={onView} />
    </section>
  </>;
}

function AssignedIncidents({ incidents, filters, onFilter, onClear, onView }) {
  const query = filters.search.trim().toLowerCase();
  const filtered = incidents.filter((incident) =>
    (incident.id.toLowerCase().includes(query) || incident.title.toLowerCase().includes(query)) &&
    ['status', 'priority', 'category', 'slaStatus'].every((key) => !filters[key] || incident[key] === filters[key]),
  );
  const filterOptions = [
    ['status', 'Status', Object.keys(incidentStatuses)], ['priority', 'Priority', Object.keys(priorities)],
    ['category', 'Category', [...new Set(incidents.map((incident) => incident.category))].sort()],
    ['slaStatus', 'SLA Status', slaStates],
  ];

  return <>
    <section className="dashboard-welcome"><div><h2>My Assigned Incidents</h2><p>View, prioritize, and manage IT support requests assigned to you.</p></div></section>
    <div className="incident-filters" role="search" aria-label="Search assigned incidents">
      <div className="report-field"><label htmlFor="technician-search">Search incidents</label><input id="technician-search" type="search" name="search" value={filters.search} onChange={onFilter} placeholder="Incident ID or title" /></div>
      {filterOptions.map(([name, label, options]) => <div key={name} className="report-field">
        <label htmlFor={`technician-${name}`}>{label}</label>
        <select id={`technician-${name}`} name={name} value={filters[name]} onChange={onFilter}>
          <option value="">All {label.toLowerCase()}</option>
          {options.map((value) => <option key={value} value={value}>{priorities[value] ? `${value} · ${priorities[value]}` : incidentStatuses[value]?.label || readableLabel(value)}</option>)}
        </select>
      </div>)}
      <button type="button" className="report-clear" onClick={onClear}>Clear Filters</button>
    </div>
    <section className="dashboard-incidents" aria-label="Assigned incident results">
      <div className="dashboard-section-heading"><h2>Assigned Incidents</h2><span role="status">{filtered.length} of {incidents.length}</span></div>
      <IncidentTable incidents={filtered} onView={onView} emptyMessage={incidents.length ? 'No incidents match your search or filters.' : 'No incidents assigned yet.'} />
    </section>
  </>;
}

function DetailSection({ title, items, children }) {
  return <section className="report-form technician-section">
    <h2>{title}</h2>
    {items && <dl className="incident-details">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not provided'}</dd></div>)}</dl>}
    {children}
  </section>;
}

function InvestigationSummary({ incident }) {
  const notes = investigationNotes.filter((note) => note.incidentId === incident.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const updates = auditLogs.filter((event) => event.incidentId === incident.id && ['Investigation Started', 'Incident Resolved', 'Incident Closed'].includes(event.action)).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const responses = studentResponses.filter((response) => response.incidentId === incident.id);
  const requests = supportRequests.filter((request) => request.incidentId === incident.id);
  return <>
    <h3>Shared Investigation Notes</h3>
    {notes.length ? <ul className="technician-updates">{notes.map((note) => <li key={note.id}><strong>{note.id} · {userName(note.technicianId)}</strong><p>{note.note}</p><time dateTime={note.timestamp}>{dateLabel(note.timestamp)}</time> · Visibility: {readableLabel(note.visibility)}</li>)}</ul> : <p className="report-guidance">No investigation notes are recorded for this incident.</p>}
    <h3>Previous updates</h3>
    {updates.length ? <ul className="technician-updates">{updates.map((event) => <li key={event.id}>{event.description} <time dateTime={event.timestamp}>{dateLabel(event.timestamp)}</time></li>)}</ul> : <p className="report-guidance">No investigation updates recorded.</p>}
    <h3>Sample student responses</h3>
    {requests.length > 0 && <ul className="technician-updates">{requests.map((request) => <li key={request.id}><strong>{request.id} · {userName(request.technicianId)}</strong><p>{request.message}</p><time dateTime={request.requestedAt}>{dateLabel(request.requestedAt)}</time></li>)}</ul>}
    {responses.length ? <ul className="technician-updates">{responses.map((response) => <li key={response.id}><strong>{response.id} · {userName(response.reporterId)}</strong><p>Requested: {response.requestedInformation}. {response.message}</p><p>Response: {response.response}</p><time dateTime={response.timestamp}>{dateLabel(response.timestamp)}</time></li>)}</ul> : <p className="report-guidance">No student responses in the demo history.</p>}
    <h3>Resolution</h3><p className="technician-description">{incident.resolution || 'No resolution recorded.'}</p>
  </>;
}

function IncidentDetails({ incident, onBack, backLabel, onAction }) {
  const reporter = users.find((user) => user.id === incident.reporterId);
  const technician = technicians.find((person) => person.id === incident.primaryTechnicianId);
  const policy = slaPolicies.find((item) => item.priority === incident.priority);
  const timeline = auditLogs.filter((event) => event.incidentId === incident.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return <>
    <div className="dashboard-welcome"><div><h2>{incident.id} · {incident.title}</h2><p>Read-only records with frontend operation previews</p></div><button type="button" className="report-clear" onClick={onBack}>Back to {backLabel}</button></div>
    <DetailSection title="Incident Overview" items={[
      ['Incident ID', incident.id], ['Title', incident.title], ['Category', readableLabel(incident.category)],
      ['Affected Service', incident.affectedService], ['Impact', readableLabel(incident.impact)], ['Urgency', readableLabel(incident.urgency)],
      ['Priority', <Badge value={incident.priority} />], ['Current Status', <Badge value={incident.status} />], ['Created Date', dateLabel(incident.createdAt)],
    ]}><h3>Description</h3><p className="technician-description">{incident.description}</p></DetailSection>
    <DetailSection title="Reporter Information" items={[
      ['Reporter Name', reporter?.name], ['Student ID', reporter?.studentId], ['Institutional Email', reporter?.email], ['Reported Date', dateLabel(incident.createdAt)],
    ]} />
    <DetailSection title="Assignment & Collaboration Workspace" items={[
      ['Primary Technician', technician?.name], ['Technician ID', technician?.id],
      ['Technician Specialization', technician?.skills.map(readableLabel).join(', ')], ['Assignment Date', dateLabel(incident.assignedAt)],
      ['Primary Responsibility', 'Overall incident investigation and resolution'],
    ]}><h3>Collaborating Technicians</h3>
      {incident.collaborators.length ? <ul className="technician-updates">{incident.collaborators.map((member) => <li key={member.technicianId}><strong>{userName(member.technicianId)} ({member.technicianId})</strong><p>Specializations: {technicians.find((person) => person.id === member.technicianId).skills.map(readableLabel).join(', ')}</p><p>Responsibility: {member.responsibility}</p></li>)}</ul> : <p className="report-guidance">No collaborating technicians.</p>}
    </DetailSection>
    <DetailSection title="SLA Information" items={[
      ['Incident Priority', <Badge value={incident.priority} />],
      ['Response Target', policy?.response], ['Response Deadline', dateLabel(incident.responseDeadline)],
      ['Actual Response Time', incident.actualResponseTime || 'Not acknowledged'], ['Acknowledged At', incident.acknowledgedAt ? dateLabel(incident.acknowledgedAt) : 'Not acknowledged'],
      ['Resolution Target', policy?.resolution], ['Resolution Deadline', dateLabel(incident.resolutionDeadline)], ['SLA Status', <Badge value={incident.slaStatus} />],
      ['SLA Snapshot Time', dateLabel(incident.slaEvaluatedAt)],
    ]}><p className="report-guidance technician-sla-note">Predefined demo targets, response durations and deadlines in campus local time. Each incident is a historical snapshot evaluated at the time above, not against today’s clock.</p>
      {incident.slaWarning && <p className="technician-warning">Incident {incident.id} {incident.slaWarning}</p>}
      {['AT_RISK', 'BREACHED'].includes(incident.slaStatus) && <button type="button" className="incident-view" onClick={() => onAction('escalate', incident)}>Escalate Incident</button>}
    </DetailSection>
    <DetailSection title="Incident Activity Timeline">
      <ol className="technician-updates">{timeline.map((event) => <li key={event.id}>
        <strong>{event.action}</strong><p>{event.description}</p><time dateTime={event.timestamp}>{dateLabel(event.timestamp)}</time> · {userName(event.userId)}
      </li>)}</ol>
    </DetailSection>
    <DetailSection title="Investigation Summary"><InvestigationSummary incident={incident} /></DetailSection>
    <DetailSection title="Technician Actions">
      <p className="report-guidance">Prepare unsaved previews. Lifecycle changes require backend integration: Assigned → Acknowledged → In Progress → Resolved → Verified → Closed.</p>
      <div className="report-actions">{Object.entries(operationLabels).map(([action, label]) => <button key={action} type="button" className="report-clear" onClick={() => onAction(action, incident)}>{label}</button>)}</div>
    </DetailSection>
  </>;
}

function TeamIncidents({ incidents, technicianId, onView }) {
  const requests = collaborationRequests.filter((request) => request.primaryTechnicianId === technicianId || request.requestedTechnicianId === technicianId);
  return <>
    <div className="dashboard-welcome"><div><h2>My Team Incidents</h2><p>Primary assignments and incidents where you are a collaborator.</p></div></div>
    <section className="dashboard-incidents technician-section" aria-label="Team incidents">
      {!incidents.length ? <p className="dashboard-empty">No team incidents yet.</p> : <div className="dashboard-table-scroll" role="region" aria-label="Team incident table" tabIndex={0}><table>
        <thead><tr>{['Incident ID', 'Title', 'Primary Technician', 'Collaborators', 'My Role', 'Priority', 'Status', 'Action'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{incidents.map((incident) => <tr key={incident.id}><td>{incident.id}</td><td className="dashboard-incident-title">{incident.title}</td><td>{userName(incident.primaryTechnicianId)}</td><td>{incident.collaborators.map((member) => userName(member.technicianId)).join(', ') || 'None'}</td><td><span className="incident-status status-open">{incident.primaryTechnicianId === technicianId ? 'PRIMARY' : 'COLLABORATOR'}</span></td><td><Badge value={incident.priority} /></td><td><Badge value={incident.status} /></td><td><button type="button" className="incident-view" aria-label={`View details for ${incident.id}`} onClick={() => onView(incident.id)}>View Details</button></td></tr>)}</tbody>
      </table></div>}
    </section>
    <DetailSection title="Collaboration Requests">
      <p className="report-guidance">Read-only sample history: Pending → Accepted / Rejected / Cancelled. New previews do not create requests or add members.</p>
      {requests.length ? <ul className="technician-updates">{requests.map((request) => <li key={request.id}>
        <strong>{request.id} · {request.incidentId}</strong> <Badge value={request.status} />
        <p>{userName(request.primaryTechnicianId)} requested {userName(request.requestedTechnicianId)} for {request.skills.map(readableLabel).join(', ')}.</p>
        <p>{request.reason}</p><time dateTime={request.requestedAt}>{dateLabel(request.requestedAt)}</time>
        {request.decision && <p>{request.decision} · {dateLabel(request.decidedAt)}</p>}
      </li>)}</ul> : <p className="report-guidance">No collaboration requests for this demo technician.</p>}
    </DetailSection>
  </>;
}

function InvestigationWorkspace({ incidents, onAction, onView }) {
  const [incidentId, setIncidentId] = useState(incidents[0]?.id || '');
  const incident = incidents.find((item) => item.id === incidentId);
  return <>
    <div className="dashboard-welcome"><div><h2>Investigation Workspace</h2><p>Review shared notes and student responses, and prepare unsaved updates.</p></div></div>
    {!incident ? <p className="dashboard-empty">No assigned or collaborating incidents to investigate.</p> : <>
      <div className="report-field"><label htmlFor="investigation-incident">Incident</label><select id="investigation-incident" value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>{incidents.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}</option>)}</select></div>
      <div className="report-actions technician-section"><button type="button" className="incident-view" onClick={() => onView(incident.id)}>View Incident Details</button>{['note', 'information'].map((action) => <button key={action} type="button" className="report-clear" onClick={() => onAction(action, incident)}>{operationLabels[action]}</button>)}</div>
      <DetailSection title={`${incident.id} · ${incident.title}`}><InvestigationSummary incident={incident} /></DetailSection>
    </>}
  </>;
}

function TransferRequests({ technicianId }) {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
  const relevant = transferRequests.filter((request) => request.currentTechnicianId === technicianId || request.suggestedTechnicianId === technicianId);
  const filtered = relevant.filter((request) => !status || request.status === status);
  const incident = selected ? demoIncidents.find((item) => item.id === selected.incidentId) : null;
  return <>
    <div className="dashboard-welcome"><div><h2>Transfer Requests</h2><p>Read-only requests sent by or suggested for this demo technician. Approval belongs to administrators.</p></div></div>
    <div className="report-field technician-selector"><label htmlFor="transfer-status">Status</label><select id="transfer-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((value) => <option key={value} value={value}>{readableLabel(value)}</option>)}</select></div>
    <section className="dashboard-incidents technician-section" aria-label="Transfer requests">
      {!filtered.length ? <p className="dashboard-empty">{relevant.length ? 'No transfer requests match this status.' : 'No transfer requests for this demo technician.'}</p> : <div className="dashboard-table-scroll" role="region" aria-label="Transfer request table" tabIndex={0}><table>
        <thead><tr>{['Request ID', 'Incident ID', 'Current Technician', 'Suggested Technician', 'Reason', 'Status', 'Requested Date', 'Action'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{filtered.map((request) => <tr key={request.id}><td>{request.id}</td><td>{request.incidentId}</td><td>{userName(request.currentTechnicianId)}</td><td>{userName(request.suggestedTechnicianId)}</td><td>{request.reason}</td><td><Badge value={request.status} /></td><td><time dateTime={request.requestedAt}>{dateLabel(request.requestedAt)}</time></td><td><button type="button" className="incident-view" aria-label={`View request ${request.id}`} onClick={() => { setSelected(request); dialog.current.showModal(); }}>View Details</button></td></tr>)}</tbody>
      </table></div>}
    </section>
    <p className="report-guidance">Technician columns describe the original request. Historical transfers may have a different current primary owner. No approvals or cancellations are performed here.</p>
    <dialog ref={dialog} className="incident-dialog technician-operation-dialog" aria-labelledby="transfer-detail-title" onClose={() => setSelected(null)}>
      <div className="dashboard-section-heading"><h2 id="transfer-detail-title">Transfer Request Details</h2><button type="button" className="report-clear" autoFocus onClick={() => dialog.current.close()}>Close</button></div>
      {selected && <>
        <DetailSection title={selected.id} items={[
          ['Incident', `${incident.id} · ${incident.title}`], ['Request Status', readableLabel(selected.status)],
          ['Requesting Technician', userName(selected.currentTechnicianId)], ['Suggested Technician', userName(selected.suggestedTechnicianId)],
          ['Current Primary Owner', userName(incident.primaryTechnicianId)], ['Reason', selected.reason], ['Handover Notes', selected.handover],
          ['Requested Date', dateLabel(selected.requestedAt)], ['Historical Decision', selected.decision || 'Pending administrator review'],
          ['Decision Date', dateLabel(selected.decidedAt)], ['Response Deadline', dateLabel(incident.responseDeadline)], ['Resolution Deadline', dateLabel(incident.resolutionDeadline)],
        ]} />
        <p className="report-guidance">Fictional history only. Approving a transfer later must preserve identity, deadlines and history, replace primary ownership, and generate audit records and notifications in Java.</p>
      </>}
    </dialog>
  </>;
}

function MyWorkload({ technician, workload, onView, onAction }) {
  const primary = workload.primary.filter(isActive);
  const collaborating = workload.collaborating.filter(isActive);
  const [transferId, setTransferId] = useState(primary[0]?.id || '');
  const transferIncident = primary.find((incident) => incident.id === transferId);
  const summary = [
    ['Total Active Incidents', workload.active.length], ['Pending Acknowledgment', primary.filter((incident) => incident.status === 'ASSIGNED').length],
    ['In Progress', workload.active.filter((incident) => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status)).length],
    ['High-Priority Incidents', workload.active.filter((incident) => ['P1', 'P2'].includes(incident.priority)).length],
    ['Collaborating Incidents', collaborating.length], ['Resolved Incidents', workload.participating.filter((incident) => !isActive(incident)).length],
  ];
  return <>
    <div className="dashboard-welcome"><div><h2>My Workload</h2><p>Review primary responsibilities, collaboration assignments and support capacity.</p></div></div>
    <SummaryCards items={summary} label="Workload summary" />
    <p className="report-guidance">Unique active incidents include primary and collaboration assignments once. Pending acknowledgment counts primary assignments only. In progress includes Acknowledged and In Progress; resolved includes Resolved, Verified and Closed participations. Other cards may overlap.</p>
    <DetailSection title="Availability & Capacity" items={[
      ['Primary Assignments (active)', workload.activePrimary], ['Collaboration Assignments (active)', workload.activeCollaboration], ['Total Active Participations', workload.total],
      ['Availability (demo)', readableLabel(technician.availability)], ['Illustrative participation limit', technician.workloadLimit],
    ]}>
      <p className="report-guidance technician-sla-note">Counts and capacity are illustrative. A warning appears at or above the shared demo limit; final workload rules and limits belong to Java.</p>
      {workload.total >= technician.workloadLimit && <p className="technician-warning">Your current workload is high. Consider requesting incident redistribution.</p>}
    </DetailSection>
    <DetailSection title="Workload Distribution">
      <div className="technician-distribution">{Object.entries(priorities).map(([priority, label]) => {
        const count = workload.active.filter((incident) => incident.priority === priority).length;
        return <div key={priority}><label htmlFor={`workload-${priority}`}>{priority} · {label} <strong>{count}</strong></label><progress id={`workload-${priority}`} max={workload.active.length || 1} value={count} aria-valuetext={`${count} of ${workload.active.length} unique active incidents`} /></div>;
      })}</div>
    </DetailSection>
    <DetailSection title="Request Workload Redistribution">
      {primary.length ? <><div className="report-field"><label htmlFor="redistribution-incident">Choose an active primary assignment</label><select id="redistribution-incident" value={transferId} onChange={(event) => setTransferId(event.target.value)}>{primary.map((incident) => <option key={incident.id} value={incident.id}>{incident.id} · {incident.title}</option>)}</select></div><button type="button" className="report-clear" onClick={() => onAction('transfer', transferIncident)}>Request Workload Redistribution</button></> : <><p className="report-guidance">No active primary assignments are available to transfer.</p><button type="button" className="report-clear" disabled>Request Workload Redistribution</button></>}
      <p className="report-guidance technician-sla-note">Uses the existing transfer request preview. Ownership and deadlines remain unchanged.</p>
    </DetailSection>
    <section className="dashboard-incidents technician-section" aria-label="Primary workload"><div className="dashboard-section-heading"><h2>Primary Assignments</h2><span>Active</span></div><IncidentTable incidents={primary} onView={onView} emptyMessage="No active primary assignments." /></section>
    <section className="dashboard-incidents technician-section" aria-label="Collaboration workload"><div className="dashboard-section-heading"><h2>Collaboration Assignments</h2><span>Active</span></div><IncidentTable incidents={collaborating} onView={onView} emptyMessage="No active collaboration assignments." /></section>
    <section className="dashboard-incidents technician-section" aria-label="Demo SLA policies"><div className="dashboard-section-heading"><h2>Demo SLA Policies</h2></div><div className="dashboard-table-scroll" role="region" aria-label="SLA policy table" tabIndex={0}><table><thead><tr><th scope="col">Priority</th><th scope="col">Response Target</th><th scope="col">Resolution Target</th></tr></thead><tbody>{slaPolicies.map((policy) => <tr key={policy.priority}><td><Badge value={policy.priority} /></td><td>{policy.response}</td><td>{policy.resolution}</td></tr>)}</tbody></table></div></section>
  </>;
}

function TechnicianProfile({ technician, workload, onView }) {
  return <>
    <div className="dashboard-welcome"><div><h2>Technician Profile</h2><p>Read-only fictional profile. Account management requires backend integration.</p></div></div>
    <DetailSection title={technician.name} items={[
      ['Technician ID', technician.id], ['Full Name', technician.name], ['Institutional Email', technician.email], ['Technical Specializations', technician.skills.map(readableLabel).join(', ')],
      ['Current Availability (demo)', readableLabel(technician.availability)], ['Active Primary Assignments', workload.activePrimary], ['Active Collaborations', workload.activeCollaboration],
      ['Resolved Incident Count', workload.participating.filter((incident) => !isActive(incident)).length],
    ]}><p className="report-guidance technician-sla-note">Resolved counts unique primary and collaboration incidents in Resolved, Verified or Closed states.</p></DetailSection>
    <DetailSection title="Active Assignments">
      {workload.primary.filter(isActive).length ? <ul className="technician-updates">{workload.primary.filter(isActive).map((incident) => <li key={incident.id}>{incident.title} <button type="button" className="incident-view" onClick={() => onView(incident.id)}>View {incident.id}</button></li>)}</ul> : <p className="report-guidance">No active primary assignments.</p>}
    </DetailSection>
    <DetailSection title="Collaboration Responsibilities">
      {workload.collaborating.length ? <ul className="technician-updates">{workload.collaborating.map((incident) => <li key={incident.id}><strong>{incident.id} · {incident.title}</strong><p>{incident.collaborators.find((member) => member.technicianId === technician.id).responsibility}</p><button type="button" className="incident-view" onClick={() => onView(incident.id)}>View {incident.id}</button></li>)}</ul> : <p className="report-guidance">No collaboration responsibilities.</p>}
    </DetailSection>
  </>;
}

export default function TechnicianDashboard({ incidents = demoIncidents }) {
  const [technicianId, setTechnicianId] = useState(technicians[0].id);
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [returnPage, setReturnPage] = useState('assigned');
  const [operation, setOperation] = useState(null);
  const [readIds, setReadIds] = useState(() => technicianNotifications.filter((notification) => notification.read).map((notification) => notification.id));
  const [filters, setFilters] = useState(emptyFilters);
  const [isMenuOpen, setIsMenuOpen] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  const heading = useRef(null);
  const technician = technicians.find((person) => person.id === technicianId);
  const assigned = incidents.filter((incident) => incident.primaryTechnicianId === technicianId);
  const teamIncidents = incidents.filter((incident) => incident.primaryTechnicianId === technicianId || incident.collaborators.some((member) => member.technicianId === technicianId));
  const selected = teamIncidents.find((incident) => incident.id === selectedId);
  const workload = technicianWorkload(technicianId, incidents);
  const accessibleIds = teamIncidents.map((incident) => incident.id);

  useEffect(() => { heading.current?.focus(); }, [page, selectedId]);

  function navigate(nextPage) {
    setPage(nextPage);
    setSelectedId(null);
    if (window.matchMedia('(max-width: 700px)').matches) setIsMenuOpen(false);
  }
  function viewDetails(id) {
    if (!accessibleIds.includes(id)) return;
    setReturnPage(page === 'dashboard' ? 'assigned' : page);
    navigate('details');
    setSelectedId(id);
  }
  function changeTechnician(event) {
    setTechnicianId(event.target.value);
    setFilters(emptyFilters);
    navigate('dashboard');
  }

  function openOperation(action, incident) { setOperation({ action, incident }); }

  let content;
  switch (page) {
    case 'team': content = <TeamIncidents incidents={teamIncidents} technicianId={technicianId} onView={viewDetails} />; break;
    case 'transfers': content = <TransferRequests key={technicianId} technicianId={technicianId} />; break;
    case 'investigation': content = <InvestigationWorkspace key={technicianId} incidents={teamIncidents} onAction={openOperation} onView={viewDetails} />; break;
    case 'details': content = selected && <IncidentDetails incident={selected} backLabel={pages[returnPage]} onBack={() => navigate(returnPage)} onAction={openOperation} />; break;
    case 'assigned': content = <AssignedIncidents incidents={assigned} filters={filters} onFilter={(event) => { const { name, value } = event.target; setFilters((previous) => ({ ...previous, [name]: value })); }} onClear={() => setFilters(emptyFilters)} onView={viewDetails} />; break;
    case 'workload': content = <MyWorkload key={technicianId} technician={technician} workload={workload} onView={viewDetails} onAction={openOperation} />; break;
    case 'knowledge': content = <KnowledgeBase incidents={incidents} accessibleIds={accessibleIds} onView={viewDetails} />; break;
    case 'notifications': content = <NotificationCenter key={technicianId} technicianId={technicianId} accessibleIds={accessibleIds} readIds={readIds} onRead={(id) => setReadIds((previous) => previous.includes(id) ? previous : [...previous, id])} onView={viewDetails} />; break;
    case 'profile': content = <TechnicianProfile technician={technician} workload={workload} onView={viewDetails} />; break;
    default: content = <DashboardHome incidents={assigned} technician={technician} workload={workload} onView={viewDetails} onAction={openOperation} onNavigate={navigate} />;
  }

  return <div className={`student-dashboard technician-portal${isMenuOpen ? '' : ' menu-collapsed'}`}>
    <aside className="dashboard-sidebar" id="technician-sidebar" hidden={!isMenuOpen}>
      <div className="dashboard-brand"><span className="brand-name">BITSolve</span><span className="brand-caption">Technician Portal</span></div>
      <nav aria-label="Technician navigation">
        {Object.entries(pages).map(([value, label]) => <button key={value} type="button" className={(page === 'details' ? returnPage : page) === value ? 'dashboard-nav-active' : ''} aria-current={(page === 'details' ? returnPage : page) === value ? 'page' : undefined} onClick={() => navigate(value)}>{label}</button>)}
      </nav>
      <p className="dashboard-sidebar-note">BITS Pilani<br />Hyderabad Campus</p>
    </aside>
    <div className="dashboard-workspace">
      <header className="dashboard-topbar">
        <div className="dashboard-heading"><Button27 isOpen={isMenuOpen} onToggle={() => setIsMenuOpen(!isMenuOpen)} controls="technician-sidebar" /><h1 ref={heading} tabIndex={-1}>BITSolve · {page === 'details' ? 'Incident Details' : page === 'dashboard' ? 'Technician Dashboard' : pages[page]}</h1></div>
        <div className="dashboard-profile"><span className="dashboard-avatar" aria-hidden="true">DT</span><div><strong>{technician.name}</strong><span>Technician · Demo</span></div></div>
      </header>
      <main className="dashboard-content">
        <div className="dashboard-preview-note"><p><strong>Development-only Technician preview</strong> · Fictional records. No authenticated session or saved changes.</p><div className="preview-links"><a href="?preview=student">Student preview</a><a href="?preview=admin">Administrator preview</a><a href="/">Back to login</a></div></div>
        <div className="report-field technician-selector"><label htmlFor="demo-technician">Demo technician (preview only)</label><select id="demo-technician" value={technicianId} onChange={changeTechnician}>{technicians.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.id})</option>)}</select></div>
        {content}
      </main>
      <footer className="dashboard-footer">BITSolve — BITS Hyderabad IT Support</footer>
    </div>
    {operation && <TechnicianOperations key={`${operation.action}-${operation.incident.id}`} action={operation.action} incident={operation.incident} technicianId={technicianId} onClose={() => setOperation(null)} />}
  </div>;
}
