import NotificationShortcut from '../components/NotificationShortcut.jsx';
import Notifications from '../Notifications.jsx';
import PasswordSettings from '../PasswordSettings.jsx';
import LiveIncidents from '../LiveIncidents.jsx';
import OperationsDashboard from '../OperationsDashboard.jsx';
import TechnicianAvailability from '../TechnicianAvailability.jsx';
import AssignmentManagement from '../AssignmentManagement.jsx';
import React, { useEffect, useRef, useState } from 'react';
import Button27 from '../components/ui/button-27.jsx';
import TechnicianOperations, { operationLabels } from './TechnicianOperations.jsx';
import { KnowledgeBase, NotificationCenter, SavedKnowledge } from './TechnicianResources.jsx';
import { incidentStatuses, readableLabel } from '../MyIncidents.jsx';
import { apiRequest, apiSend } from '../api.js';
import Badge from '../components/ui/Badge.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import NavIcon from '../components/NavIcon.jsx';
import {
  demoIncidents,
  technicians,
  users,
  slaPolicies,
  auditLogs,
  investigationNotes,
  studentResponses,
  supportRequests,
  transferRequests,
  collaborationRequests,
  technicianNotifications,
  technicianWorkload,
  isActive,
} from '../demoData.js';

const priorities = { P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low' };
const slaStates = ['ON_TRACK', 'AT_RISK', 'BREACHED', 'MET'];
const availabilityStates = new Set(['AVAILABLE', 'BUSY', 'UNAVAILABLE']);
const emptyFilters = { search: '', status: '', priority: '', category: '', slaStatus: '' };
const pages = {
  dashboard: 'Dashboard',
  assigned: 'Assigned Incidents',
  team: 'My Team Incidents',
  transfers: 'Transfer Requests',
  investigation: 'Investigation',
  workload: 'My Workload',
  notifications: 'Notifications',
  profile: 'Profile & Settings',
};

const navIconMap = {
  dashboard: 'dashboard',
  assigned: 'incidents',
  team: 'users',
  transfers: 'git-pull-request',
  investigation: 'activity',
  workload: 'server',
  notifications: 'notifications',
  profile: 'profile',
};

const dateLabel = (value) => (value ? value.slice(0, 16).replace('T', ' ') : 'Not provided');
const userName = (id) => users.find((user) => user.id === id)?.name || 'Not provided';

function TechBadge({ value }) {
  if (['P1', 'P2', 'P3', 'P4'].includes(value)) {
    return <Badge value={value} type="priority" />;
  }
  return <Badge value={value} type="status" />;
}

function AvailabilityIndicator({ value, loading = false }) {
  const label = availabilityStates.has(value) ? readableLabel(value) : loading ? 'Loading status' : 'Status unavailable';
  const tone = availabilityStates.has(value) ? value.toLowerCase() : 'unknown';
  return <span className={`technician-availability-indicator ${tone}`}><i aria-hidden="true" />{label}</span>;
}

function DetailSection({ title, items, children }) {
  return (
    <section className="report-form technician-section" aria-label={title}>
      <h3 className="section-title">{title}</h3>
      {items && (
        <dl className="incident-details">
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? 'Not provided'}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </section>
  );
}

function IncidentTable({ incidents, view = 'assigned', onView, emptyMessage = 'No incidents assigned yet.' }) {
  const headings =
    view === 'priority'
      ? ['Incident ID', 'Title', 'Priority', 'Status', 'SLA Status', 'Resolution Deadline', 'Action']
      : view === 'recent'
      ? ['Incident ID', 'Title', 'Category', 'Priority', 'Status', 'Assigned Date', 'Action']
      : ['Incident ID', 'Title', 'Reporter', 'Category', 'Affected Service', 'Priority', 'Status', 'Created Date', 'SLA Status', 'Action'];

  if (!incidents.length) return <p className="dashboard-empty">{emptyMessage}</p>;

  return (
    <div className="dashboard-table-scroll" role="region" aria-label={`${view} incidents`} tabIndex={0}>
      <table>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td className="dashboard-incident-id">#{incident.id}</td>
              <td className="dashboard-incident-title">
                <strong>{incident.title}</strong>
              </td>
              {view === 'assigned' && <td>{userName(incident.reporterId)}</td>}
              {view !== 'priority' && <td>{readableLabel(incident.category)}</td>}
              {view === 'assigned' && <td>{incident.affectedService || '—'}</td>}
              <td><TechBadge value={incident.priority} /></td>
              <td><TechBadge value={incident.status} /></td>
              {view === 'priority' && <td><TechBadge value={incident.slaStatus} /></td>}
              <td>
                <time dateTime={view === 'priority' ? incident.resolutionDeadline : view === 'recent' ? incident.assignedAt : incident.createdAt}>
                  {dateLabel(view === 'priority' ? incident.resolutionDeadline : view === 'recent' ? incident.assignedAt : incident.createdAt)}
                </time>
              </td>
              {view === 'assigned' && <td><TechBadge value={incident.slaStatus} /></td>}
              <td>
                <button
                  type="button"
                  className="incident-view"
                  aria-label={`View details for ${incident.id}`}
                  onClick={() => onView(incident.id)}
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCards({ items, label }) {
  const tones = ['navy', 'amber', 'blue', 'red', 'purple', 'emerald'];
  return (
    <section className="dashboard-summary" aria-label={label}>
      {items.map(([title, count], idx) => (
        <StatCard
          key={title}
          title={title}
          value={count}
          tone={tones[idx % tones.length]}
        />
      ))}
    </section>
  );
}

function SlaAttention({ incidents, onView, onAction }) {
  const attention = incidents
    .filter((incident) => isActive(incident) && ['AT_RISK', 'BREACHED'].includes(incident.slaStatus))
    .sort(
      (a, b) =>
        (a.slaStatus === 'BREACHED' ? 0 : 1) - (b.slaStatus === 'BREACHED' ? 0 : 1) ||
        a.resolutionDeadline.localeCompare(b.resolutionDeadline)
    );

  return (
    <section className="dashboard-incidents technician-section" aria-label="SLA attention">
      <div className="dashboard-section-heading">
        <h2>Incidents Requiring Immediate SLA Attention</h2>
        <span className="table-row-tag tag-warning">{attention.length} at risk</span>
      </div>
      <p className="incident-results">
        Primary and collaboration assignments approaching SLA targets. Real-time deadlines evaluated against active policy.
      </p>
      {!attention.length ? (
        <div className="empty-state-panel">
          <NavIcon name="check" />
          <h3>All SLAs On Track</h3>
          <p>No active incidents are currently at risk of breaching response or resolution SLAs.</p>
        </div>
      ) : (
        <div className="dashboard-table-scroll" role="region" aria-label="SLA attention table" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {['Incident ID', 'Title / SLA Warning', 'Priority', 'Response Deadline', 'Resolution Deadline', 'SLA Status', 'Action'].map(
                  (label) => (
                    <th key={label} scope="col">{label}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {attention.map((incident) => (
                <tr key={incident.id} className="row-sla-warning">
                  <td className="dashboard-incident-id">#{incident.id}</td>
                  <td className="dashboard-incident-title">
                    <strong>{incident.title}</strong>
                    {incident.slaWarning && (
                      <p className="report-guidance text-warning"><NavIcon name="alert" /> {incident.slaWarning}</p>
                    )}
                  </td>
                  <td><TechBadge value={incident.priority} /></td>
                  <td><time dateTime={incident.responseDeadline}>{dateLabel(incident.responseDeadline)}</time></td>
                  <td><time dateTime={incident.resolutionDeadline}>{dateLabel(incident.resolutionDeadline)}</time></td>
                  <td><TechBadge value={incident.slaStatus} /></td>
                  <td>
                    <div className="technician-resource-links">
                      <button
                        type="button"
                        className="incident-view"
                        aria-label={`View details for ${incident.id}`}
                        onClick={() => onView(incident.id)}
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        className="danger-button-sm"
                        aria-label={`Escalate ${incident.id}`}
                        onClick={() => onAction('escalate', incident)}
                      >
                        Escalate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InvestigationSummary({ incident }) {
  const notes = investigationNotes.filter((n) => n.incidentId === incident.id);
  const responses = studentResponses.filter((r) => r.incidentId === incident.id);
  return (
    <div className="investigation-summary-box">
      <h4>Investigation History</h4>
      {notes.length ? (
        <ol className="technician-updates">
          {notes.map((n) => (
            <li key={n.id}>
              <strong>{n.note}</strong>
              <time dateTime={n.timestamp}>{dateLabel(n.timestamp)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="report-guidance">No investigation notes recorded yet.</p>
      )}
      <h4>Student Responses</h4>
      {responses.length ? (
        <ul className="technician-updates">
          {responses.map((r) => (
            <li key={r.id}>
              <strong>{r.response}</strong>
              <time dateTime={r.timestamp}>{dateLabel(r.timestamp)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="report-guidance">No student responses recorded yet.</p>
      )}
    </div>
  );
}

function IncidentDetails({ incident, backLabel, onBack, onAction }) {
  const timeline = auditLogs.filter((a) => a.incidentId === incident.id);
  return (
    <section className="incident-details-view" aria-labelledby="tech-incident-detail-title">
      <div className="dashboard-welcome">
        <div>
          <button type="button" className="report-clear" onClick={onBack} style={{ marginBottom: '0.5rem' }}>
            ← Back to {backLabel}
          </button>
          <h2 id="tech-incident-detail-title">Incident #{incident.id}: {incident.title}</h2>
          <p>Assigned IT Service Request Details and Action Center</p>
        </div>
        <div className="incident-status-summary-bar">
          <TechBadge value={incident.status} />
          <TechBadge value={incident.priority} />
        </div>
      </div>

      <DetailSection
        title="Incident Overview"
        items={[
          ['Incident ID', `#${incident.id}`],
          ['Reporter', userName(incident.reporterId)],
          ['Category', readableLabel(incident.category)],
          ['Affected Service', incident.affectedService || 'Campus IT'],
          ['Created Date', dateLabel(incident.createdAt)],
          ['Assigned Date', dateLabel(incident.assignedAt)],
        ]}
      >
        <div className="incident-desc-block">
          <h4>Problem Description:</h4>
          <p>{incident.description}</p>
        </div>
      </DetailSection>

      <DetailSection
        title="SLA Compliance Metrics"
        items={[
          ['SLA Status', readableLabel(incident.slaStatus)],
          ['Response Deadline', dateLabel(incident.responseDeadline)],
          ['Resolution Deadline', dateLabel(incident.resolutionDeadline)],
        ]}
      >
        {incident.slaWarning && (
          <p className="technician-warning"><NavIcon name="alert" /> Incident {incident.id}: {incident.slaWarning}</p>
        )}
        {['AT_RISK', 'BREACHED'].includes(incident.slaStatus) && (
          <button type="button" className="danger-button-sm" onClick={() => onAction('escalate', incident)}>
            Escalate to Supervisor
          </button>
        )}
      </DetailSection>

      <DetailSection title="Activity Timeline">
        <ol className="technician-updates">
          {timeline.map((event) => (
            <li key={event.id}>
              <strong>{event.action}</strong>
              <p>{event.description}</p>
              <time dateTime={event.timestamp}>{dateLabel(event.timestamp)} · {userName(event.userId)}</time>
            </li>
          ))}
        </ol>
      </DetailSection>

      <DetailSection title="Investigation Notes &amp; Communication">
        <InvestigationSummary incident={incident} />
      </DetailSection>

      <DetailSection title="Technician Action Dispatcher">
        <p className="report-guidance">
          Execute workflow actions to transition ticket lifecycle or request assistance.
        </p>
        <div className="report-actions">
          {Object.entries(operationLabels).map(([action, label]) => (
            <button
              key={action}
              type="button"
              className={action === 'resolution' ? 'submit-button-sm' : 'report-clear'}
              onClick={() => onAction(action, incident)}
            >
              {label}
            </button>
          ))}
        </div>
      </DetailSection>
    </section>
  );
}

function DashboardHome({ incidents, technician, workload, onView, onAction, onNavigate }) {
  const active = incidents.filter(isActive);
  const pending = active.filter((incident) => incident.status === 'ASSIGNED');
  const inProgress = active.filter((incident) => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status));
  const highPriority = active.filter((incident) => ['P1', 'P2'].includes(incident.priority));
  const atRisk = active.filter((incident) => incident.slaStatus === 'AT_RISK');
  const summary = [
    ['Total Assigned', incidents.length],
    ['Pending Acknowledgment', pending.length],
    ['In Progress', inProgress.length],
    ['High Priority (P1/P2)', highPriority.length],
    ['SLA At Risk', atRisk.length],
    ['Resolved Incidents', incidents.filter((incident) => !isActive(incident)).length],
  ];
  const recent = [...incidents].sort((a, b) => (b.assignedAt || '').localeCompare(a.assignedAt || '')).slice(0, 5);
  const pendingCollaboration = collaborationRequests.filter(
    (request) =>
      request.status === 'PENDING' &&
      (request.primaryTechnicianId === technician.id || request.requestedTechnicianId === technician.id)
  );
  const responses = studentResponses.filter((response) =>
    workload.participating.some((incident) => incident.id === response.incidentId)
  );
  const slaAlerts = workload.active.filter((incident) => ['AT_RISK', 'BREACHED'].includes(incident.slaStatus));

  return (
    <>
      <section className="dashboard-welcome">
        <div>
          <h2>Welcome back, {technician?.name || 'Technician'}!</h2>
          <p>Manage assigned IT incidents, track priority queues, and monitor SLA compliance.</p>
        </div>
      </section>

      <SummaryCards items={summary} label="Technician incident summary" />

      <section className="technician-section" aria-label="Quick Navigation Actions">
        <div className="report-actions">
          {[
            ['assigned', 'View Assigned Incidents'],
            ['workload', 'Review Workload'],
            ['transfers', 'Transfer Requests'],
            ['notifications', 'Notifications'],
          ].map(([targetPage, label]) => (
            <button key={targetPage} type="button" className="report-clear" onClick={() => onNavigate(targetPage)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <DetailSection title="Actionable Alerts &amp; Queue Status">
        <ul className="technician-alerts">
          <li>
            <strong>{slaAlerts.length} incident(s) require SLA attention.</strong> Review warnings and deadlines below.
          </li>
          <li>
            {workload.total >= technician.workloadLimit
              ? 'Your current active workload is at capacity. Consider requesting redistribution.'
              : 'Workload capacity is within normal limits.'}{' '}
            <button type="button" className="incident-view" onClick={() => onNavigate('workload')}>
              Review Workload
            </button>
          </li>
          <li>
            {pendingCollaboration.length} pending team collaboration request(s).{' '}
            <button type="button" className="incident-view" onClick={() => onNavigate('team')}>
              Review Team Requests
            </button>
          </li>
          <li>
            {responses.length} student response(s) awaiting investigation review.{' '}
            <button type="button" className="incident-view" onClick={() => onNavigate('investigation')}>
              Open Investigation
            </button>
          </li>
        </ul>
      </DetailSection>

      <SlaAttention incidents={workload.participating} onView={onView} onAction={onAction} />

      <section className="dashboard-incidents technician-section" aria-labelledby="technician-priority-title">
        <div className="dashboard-section-heading">
          <h2 id="technician-priority-title">High Priority Queue</h2>
          <span>Active P1 / P2 Incidents</span>
        </div>
        <IncidentTable
          incidents={[...highPriority].sort(
            (a, b) => a.priority.localeCompare(b.priority) || a.resolutionDeadline.localeCompare(b.resolutionDeadline)
          )}
          view="priority"
          onView={onView}
          emptyMessage="No active high-priority incidents."
        />
      </section>

      <section className="dashboard-incidents technician-section" aria-labelledby="technician-recent-title">
        <div className="dashboard-section-heading">
          <h2 id="technician-recent-title">Recently Assigned Incidents</h2>
          <span>Latest 5</span>
        </div>
        <IncidentTable incidents={recent} view="recent" onView={onView} />
      </section>
    </>
  );
}

function AssignedIncidents({ incidents, filters, onFilter, onClear, onView }) {
  const query = filters.search.trim().toLowerCase();
  const filtered = incidents.filter(
    (incident) =>
      (incident.id.toLowerCase().includes(query) || incident.title.toLowerCase().includes(query)) &&
      ['status', 'priority', 'category', 'slaStatus'].every((key) => !filters[key] || incident[key] === filters[key])
  );
  const filterOptions = [
    ['status', 'Status', Object.keys(incidentStatuses)],
    ['priority', 'Priority', Object.keys(priorities)],
    ['category', 'Category', [...new Set(incidents.map((incident) => incident.category))].sort()],
    ['slaStatus', 'SLA Status', slaStates],
  ];

  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h2>My Assigned Incidents</h2>
          <p>Prioritize, investigate, and resolve support requests assigned to you.</p>
        </div>
      </div>

      <div className="incident-filters" role="search" aria-label="Search assigned incidents">
        <div className="report-field search-field">
          <label htmlFor="technician-search">Search Incidents</label>
          <div className="input-with-icon">
            <NavIcon name="search" />
            <input
              id="technician-search"
              type="search"
              name="search"
              value={filters.search}
              onChange={onFilter}
              placeholder="Search by ID or title…"
            />
          </div>
        </div>

        {filterOptions.map(([name, label, options]) => (
          <div key={name} className="report-field">
            <label htmlFor={`technician-${name}`}>{label}</label>
            <select id={`technician-${name}`} name={name} value={filters[name]} onChange={onFilter}>
              <option value="">All {label.toLowerCase()}</option>
              {options.map((value) => (
                <option key={value} value={value}>
                  {priorities[value] ? `${value} · ${priorities[value]}` : incidentStatuses[value]?.label || readableLabel(value)}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button type="button" className="report-clear filter-clear-btn" onClick={onClear}>
          Clear Filters
        </button>
      </div>

      <section className="dashboard-incidents" aria-label="Assigned incident results">
        <div className="dashboard-section-heading">
          <h2>Assigned Tickets</h2>
          <span className="results-counter-pill" role="status">
            {filtered.length} of {incidents.length}
          </span>
        </div>
        <IncidentTable
          incidents={filtered}
          onView={onView}
          emptyMessage={incidents.length ? 'No incidents match your search or filters.' : 'No incidents assigned yet.'}
        />
      </section>
    </>
  );
}

function TeamIncidents({ incidents, technicianId, onView }) {
  const requests = collaborationRequests.filter(
    (request) => request.primaryTechnicianId === technicianId || request.requestedTechnicianId === technicianId
  );
  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h2>My Team Incidents</h2>
          <p>Primary assignments and collaborative incidents across BITS IT Support.</p>
        </div>
      </div>
      <section className="dashboard-incidents technician-section" aria-label="Team incidents">
        {!incidents.length ? (
          <p className="dashboard-empty">No team incidents yet.</p>
        ) : (
          <div className="dashboard-table-scroll" role="region" aria-label="Team incident table" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  {['Incident ID', 'Title', 'Primary Technician', 'Collaborators', 'My Role', 'Priority', 'Status', 'Action'].map(
                    (label) => (
                      <th key={label} scope="col">{label}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id}>
                    <td className="dashboard-incident-id">#{incident.id}</td>
                    <td className="dashboard-incident-title"><strong>{incident.title}</strong></td>
                    <td>{userName(incident.primaryTechnicianId)}</td>
                    <td>{incident.collaborators.map((member) => userName(member.technicianId)).join(', ') || 'None'}</td>
                    <td>
                      <span className={`table-row-tag ${incident.primaryTechnicianId === technicianId ? 'tag-primary' : 'tag-neutral'}`}>
                        {incident.primaryTechnicianId === technicianId ? 'PRIMARY' : 'COLLABORATOR'}
                      </span>
                    </td>
                    <td><TechBadge value={incident.priority} /></td>
                    <td><TechBadge value={incident.status} /></td>
                    <td>
                      <button
                        type="button"
                        className="incident-view"
                        aria-label={`View details for ${incident.id}`}
                        onClick={() => onView(incident.id)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DetailSection title="Collaboration Requests">
        {requests.length ? (
          <ul className="technician-updates">
            {requests.map((request) => (
              <li key={request.id}>
                <strong>{request.id} · Incident #{request.incidentId}</strong> <TechBadge value={request.status} />
                <p>
                  {userName(request.primaryTechnicianId)} requested assistance from {userName(request.requestedTechnicianId)} for {request.skills.map(readableLabel).join(', ')}.
                </p>
                <p>{request.reason}</p>
                <time dateTime={request.requestedAt}>{dateLabel(request.requestedAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="report-guidance">No collaboration requests recorded.</p>
        )}
      </DetailSection>
    </>
  );
}

function InvestigationWorkspace({ incidents, onAction, onView }) {
  const [incidentId, setIncidentId] = useState(incidents[0]?.id || '');
  const incident = incidents.find((item) => item.id === incidentId);
  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h2>Investigation Workspace</h2>
          <p>Review diagnostic notes, communicate with student reporters, and document findings.</p>
        </div>
      </div>
      {!incident ? (
        <p className="dashboard-empty">No assigned or collaborating incidents to investigate.</p>
      ) : (
        <>
          <div className="report-field">
            <label htmlFor="investigation-incident">Select Incident to Investigate</label>
            <select id="investigation-incident" value={incidentId} onChange={(event) => setIncidentId(event.target.value)}>
              {incidents.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.id} · {item.title}
                </option>
              ))}
            </select>
          </div>
          <div className="report-actions technician-section">
            <button type="button" className="incident-view" onClick={() => onView(incident.id)}>
              View Full Incident Record
            </button>
            {['note', 'information'].map((action) => (
              <button key={action} type="button" className="report-clear" onClick={() => onAction(action, incident)}>
                {operationLabels[action]}
              </button>
            ))}
          </div>
          <DetailSection title={`Incident #${incident.id} · ${incident.title}`}>
            <InvestigationSummary incident={incident} />
          </DetailSection>
        </>
      )}
    </>
  );
}

function TransferRequests({ technicianId }) {
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
  const relevant = transferRequests.filter(
    (request) => request.currentTechnicianId === technicianId || request.suggestedTechnicianId === technicianId
  );
  const filtered = relevant.filter((request) => !status || request.status === status);
  const incident = selected ? demoIncidents.find((item) => item.id === selected.incidentId) : null;

  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h2>Transfer Requests</h2>
          <p>Monitor requests initiated by or routed to your account.</p>
        </div>
      </div>
      <div className="report-field technician-selector">
        <label htmlFor="transfer-status">Filter by Status</label>
        <select id="transfer-status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All Statuses</option>
          {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((value) => (
            <option key={value} value={value}>{readableLabel(value)}</option>
          ))}
        </select>
      </div>

      <section className="dashboard-incidents technician-section" aria-label="Transfer requests">
        {!filtered.length ? (
          <p className="dashboard-empty">{relevant.length ? 'No transfer requests match this filter.' : 'No transfer requests recorded.'}</p>
        ) : (
          <div className="dashboard-table-scroll" role="region" aria-label="Transfer request table" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  {['Request ID', 'Incident ID', 'Origin Technician', 'Suggested Technician', 'Reason', 'Status', 'Requested Date', 'Action'].map(
                    (label) => (
                      <th key={label} scope="col">{label}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((request) => (
                  <tr key={request.id}>
                    <td>#{request.id}</td>
                    <td>#{request.incidentId}</td>
                    <td>{userName(request.currentTechnicianId)}</td>
                    <td>{userName(request.suggestedTechnicianId)}</td>
                    <td>{request.reason}</td>
                    <td><TechBadge value={request.status} /></td>
                    <td><time dateTime={request.requestedAt}>{dateLabel(request.requestedAt)}</time></td>
                    <td>
                      <button
                        type="button"
                        className="incident-view"
                        aria-label={`View request ${request.id}`}
                        onClick={() => {
                          setSelected(request);
                          dialog.current.showModal();
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog
        ref={dialog}
        className="incident-dialog technician-operation-dialog"
        aria-labelledby="transfer-detail-title"
        onClose={() => setSelected(null)}
      >
        <div className="dashboard-section-heading dialog-header">
          <h2 id="transfer-detail-title">Transfer Request #{selected?.id}</h2>
          <button type="button" className="dialog-close-btn" autoFocus onClick={() => dialog.current.close()}>
            ✕
          </button>
        </div>
        {selected && incident && (
          <DetailSection
            title={`Incident #${incident.id}`}
            items={[
              ['Incident Title', incident.title],
              ['Request Status', readableLabel(selected.status)],
              ['Requesting Technician', userName(selected.currentTechnicianId)],
              ['Suggested Technician', userName(selected.suggestedTechnicianId)],
              ['Transfer Reason', selected.reason],
              ['Handover Notes', selected.handover],
              ['Requested Date', dateLabel(selected.requestedAt)],
              ['Decision', selected.decision || 'Pending administrator review'],
            ]}
          />
        )}
      </dialog>
    </>
  );
}

function MyWorkload({ technician, workload, onView, onAction }) {
  const primary = workload.primary.filter(isActive);
  const collaborating = workload.collaborating.filter(isActive);
  const [transferId, setTransferId] = useState(primary[0]?.id || '');
  const transferIncident = primary.find((incident) => incident.id === transferId);
  const summary = [
    ['Total Active', workload.active.length],
    ['Pending Acknowledgment', primary.filter((incident) => incident.status === 'ASSIGNED').length],
    ['In Progress', workload.active.filter((incident) => ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(incident.status)).length],
    ['High-Priority Incidents', workload.active.filter((incident) => ['P1', 'P2'].includes(incident.priority)).length],
    ['Collaborating', collaborating.length],
    ['Resolved Count', workload.participating.filter((incident) => !isActive(incident)).length],
  ];

  return (
    <>
      <div className="dashboard-welcome">
        <div>
          <h2>Technician Workload &amp; Capacity</h2>
          <p>Review primary assignments, active collaborations, and current capacity utilisation.</p>
        </div>
      </div>
      <SummaryCards items={summary} label="Workload summary" />

      <DetailSection
        title="Availability &amp; Capacity Status"
        items={[
          ['Active Primary Assignments', workload.activePrimary],
          ['Active Collaborations', workload.activeCollaboration],
          ['Total Active Workload', `${workload.total} / ${technician.workloadLimit}`],
          ['Availability Status', readableLabel(technician.availability)],
        ]}
      >
        {workload.total >= technician.workloadLimit && (
          <div className="technician-warning">
            <NavIcon name="alert" /> Your active workload is at maximum capacity. Consider redistributing pending tickets.
          </div>
        )}
      </DetailSection>

      <DetailSection title="Redistribute Workload">
        {primary.length ? (
          <>
            <div className="report-field">
              <label htmlFor="redistribution-incident">Select active primary assignment to transfer</label>
              <select id="redistribution-incident" value={transferId} onChange={(e) => setTransferId(e.target.value)}>
                {primary.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    #{inc.id} · {inc.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="report-clear"
              onClick={() => onAction('transfer', transferIncident)}
            >
              Request Workload Redistribution
            </button>
          </>
        ) : (
          <p className="report-guidance">No active primary assignments available to transfer.</p>
        )}
      </DetailSection>

      <section className="dashboard-incidents technician-section" aria-label="Primary workload">
        <div className="dashboard-section-heading">
          <h2>Active Primary Assignments</h2>
          <span>{primary.length} tickets</span>
        </div>
        <IncidentTable incidents={primary} onView={onView} emptyMessage="No active primary assignments." />
      </section>

      <section className="dashboard-incidents technician-section" aria-label="Collaboration workload">
        <div className="dashboard-section-heading">
          <h2>Active Collaboration Assignments</h2>
          <span>{collaborating.length} tickets</span>
        </div>
        <IncidentTable incidents={collaborating} onView={onView} emptyMessage="No active collaboration assignments." />
      </section>
    </>
  );
}

function TechnicianProfile({ technician, availability, availabilityLoading, workload, onView, onLogout, signingOut }) {
  const initials = technician?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'TC';

  return (
    <section className="profile-container" aria-labelledby="technician-profile-title">
      <div className="dashboard-welcome">
        <div>
          <h2 id="technician-profile-title">Technician Account Profile</h2>
          <p>Technical credentials, skill specializations, and account session controls.</p>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-header">
          <span className="profile-avatar-large" aria-hidden="true">{initials}</span>
          <div className="profile-meta">
            <h3 className="technician-profile-heading">{technician.name}<AvailabilityIndicator value={availability} loading={availabilityLoading} /></h3>
            <p className="profile-role">IT Support Technician · BITS Pilani, Hyderabad Campus</p>
          </div>
        </div>

        <dl className="incident-details profile-grid">
          {[
            ['Technician ID', technician.id],
            ['Full Name', technician.name],
            ['Institutional Email', technician.email],
            ['Specializations', technician.skills?.map(readableLabel).join(', ') || 'General IT Support'],
            ['Active Primary Assignments', workload.activePrimary],
            ['Active Collaborations', workload.activeCollaboration],
            ['Resolved Incidents', workload.participating.filter((incident) => !isActive(incident)).length],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {technician.passwordManagement && <PasswordSettings />}
        <div className="profile-security-box">
          <h4>Account Management</h4>
          <p className="report-guidance">
            Technician skill tags and maximum workload limits are configured by IT Administrators under Assignment Strategies.
          </p>
        </div>

        <div className="profile-actions-bar">
          <button
            className="danger-button"
            type="button"
            disabled={signingOut}
            onClick={onLogout}
          >
            <NavIcon name="profile" />
            <span>{signingOut ? 'Signing out…' : 'Sign Out of BITSolve'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default function TechnicianDashboard({
  incidents = demoIncidents,
  sessionUser,
  sessionNotice,
  onLogout,
  signingOut = false,
}) {
  const [technicianId, setTechnicianId] = useState(technicians[0].id);
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [returnPage, setReturnPage] = useState('assigned');
  const [operation, setOperation] = useState(null);
  const [readIds, setReadIds] = useState(() =>
    technicianNotifications.filter((n) => n.read).map((n) => n.id)
  );
  const [filters, setFilters] = useState(emptyFilters);
  const [isMenuOpen, setIsMenuOpen] = useState(() => window.matchMedia('(min-width: 901px)').matches);
  const heading = useRef(null);

  const technician = technicians.find((p) => p.id === technicianId) || technicians[0];
  const assigned = incidents.filter((incident) => incident.primaryTechnicianId === technicianId);
  const teamIncidents = incidents.filter(
    (incident) =>
      incident.primaryTechnicianId === technicianId ||
      incident.collaborators.some((m) => m.technicianId === technicianId)
  );
  const selected = teamIncidents.find((incident) => incident.id === selectedId);
  const workload = technicianWorkload(technicianId, incidents);
  const accessibleIds = teamIncidents.map((incident) => incident.id);

  const [availability, setAvailability] = useState(() => sessionUser ? null : technician?.availability || 'AVAILABLE');
  const [availabilityLoading, setAvailabilityLoading] = useState(Boolean(sessionUser));
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [availabilityFeedback, setAvailabilityFeedback] = useState('');
  const [availabilityError, setAvailabilityError] = useState(false);

  const sessionKey = sessionUser?.id ?? sessionUser?.email ?? null;

  useEffect(() => {
    if (!sessionKey || availabilityBusy) return;
    const refreshStatus = () => { if (!document.hidden) setAvailabilityRefresh(n => n + 1); };
    const timer = window.setInterval(refreshStatus, 30000);
    window.addEventListener('focus', refreshStatus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshStatus); };
  }, [sessionKey, availabilityBusy]);

  useEffect(() => {
    if (!sessionUser) {
      setAvailability(technician?.availability || 'AVAILABLE');
      setAvailabilityLoading(false);
      setAvailabilityFeedback('');
      setAvailabilityError(false);
      return;
    }
    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityFeedback('');
    setAvailabilityError(false);
    apiRequest('technician/availability', { cache: 'no-store' })
      .then((data) => {
        if (!active) return;
        if (availabilityStates.has(data?.availability)) setAvailability(data.availability);
        else {
          setAvailability(null);
          setAvailabilityFeedback('The server returned an invalid availability status. Retry to load it again.');
          setAvailabilityError(true);
        }
      })
      .catch(error => { if (active) { setAvailability(null); setAvailabilityFeedback(error.message); setAvailabilityError(true); } })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => {
      active = false;
    };
  }, [sessionKey, technicianId, availabilityRefresh, page]);

  async function handleAvailabilityChange(event) {
    const nextStatus = event.target.value;
    if (availabilityBusy || availabilityLoading || !availabilityStates.has(nextStatus) || nextStatus === availability) return;
    setAvailabilityFeedback('');
    setAvailabilityError(false);
    if (!sessionUser) {
      setAvailability(nextStatus);
      setAvailabilityFeedback('Availability updated (preview).');
      setTimeout(() => setAvailabilityFeedback(''), 3000);
      return;
    }
    setAvailabilityBusy(true);
    try {
      const res = await apiSend('technician/availability', { availability: nextStatus }, 'PUT');
      if (!availabilityStates.has(res?.availability)) throw new Error('The server did not confirm the saved availability. Refresh the status and try again.');
      setAvailability(res.availability);
      setAvailabilityFeedback('Availability saved.');
      setAvailabilityError(false);
    } catch (err) {
      try {
        const latest = await apiRequest('technician/availability', { cache: 'no-store' });
        setAvailability(availabilityStates.has(latest?.availability) ? latest.availability : null);
      } catch {
        setAvailability(null);
      }
      setAvailabilityFeedback(err.message || 'Failed to update availability.');
      setAvailabilityError(true);
    } finally {
      setAvailabilityBusy(false);
    }
  }

  useEffect(() => {
    heading.current?.focus();
  }, [page, selectedId]);

  function navigate(nextPage) {
    setPage(nextPage);
    setSelectedId(null);
    if (window.matchMedia('(max-width: 900px)').matches) setIsMenuOpen(false);
  }

  function viewDetails(id) {
    if (!accessibleIds.includes(id)) return;
    setReturnPage(page === 'dashboard' ? 'assigned' : page);
    navigate('details');
    setSelectedId(id);
  }

  function changeTechnician(event) {
    const nextId = event.target.value;
    setTechnicianId(nextId);
    const nextTech = technicians.find((p) => p.id === nextId);
    if (nextTech) setAvailability(nextTech.availability || 'AVAILABLE');
    setFilters(emptyFilters);
    navigate('dashboard');
  }

  function openOperation(action, incident) {
    setOperation({ action, incident });
  }

  let content;
  switch (page) {
    case 'team':
      content = <TeamIncidents incidents={teamIncidents} technicianId={technicianId} onView={viewDetails} />;
      break;
    case 'transfers':
      content = <TransferRequests key={technicianId} technicianId={technicianId} />;
      break;
    case 'investigation':
      content = <InvestigationWorkspace key={technicianId} incidents={teamIncidents} onAction={openOperation} onView={viewDetails} />;
      break;
    case 'details':
      content = selected && <IncidentDetails incident={selected} backLabel={pages[returnPage]} onBack={() => navigate(returnPage)} onAction={openOperation} />;
      break;
    case 'assigned':
      content = (
        <AssignedIncidents
          incidents={assigned}
          filters={filters}
          onFilter={(event) => {
            const { name, value } = event.target;
            setFilters((previous) => ({ ...previous, [name]: value }));
          }}
          onClear={() => setFilters(emptyFilters)}
          onView={viewDetails}
        />
      );
      break;
    case 'workload':
      content = <MyWorkload key={technicianId} technician={technician} workload={workload} onView={viewDetails} onAction={openOperation} />;
      break;
    case 'knowledge':
      content = <KnowledgeBase incidents={incidents} accessibleIds={accessibleIds} onView={viewDetails} />;
      break;
    case 'notifications':
      content = (
        <NotificationCenter
          key={technicianId}
          technicianId={technicianId}
          accessibleIds={accessibleIds}
          readIds={readIds}
          onRead={(id) => setReadIds((previous) => (previous.includes(id) ? previous : [...previous, id]))}
          onView={viewDetails}
        />
      );
      break;
    case 'profile':
      content = sessionUser ? (
        <TechnicianProfile
          technician={{ ...technician, name: sessionUser.name, email: sessionUser.email, passwordManagement: sessionUser.passwordManagement }}
          availability={availability}
          availabilityLoading={availabilityLoading}
          workload={workload}
          onView={viewDetails}
          onLogout={onLogout}
          signingOut={signingOut}
        />
      ) : (
        <TechnicianProfile
          technician={technician}
          availability={availability}
          availabilityLoading={availabilityLoading}
          workload={workload}
          onView={viewDetails}
          onLogout={onLogout}
          signingOut={signingOut}
        />
      );
      break;
    default:
      content = <DashboardHome incidents={assigned} technician={technician} workload={workload} onView={viewDetails} onAction={openOperation} onNavigate={navigate} />;
  }

  if (sessionUser && page === 'knowledge') content = <SavedKnowledge />;
  if (sessionUser && page === 'notifications') content = <Notifications live role="TECHNICIAN" />;
  if (sessionUser && ['dashboard', 'assigned', 'investigation'].includes(page)) {
    content = page === 'dashboard' ? <OperationsDashboard role="TECHNICIAN" onNavigate={navigate} availability={availability} /> : <LiveIncidents role="TECHNICIAN" team={page === 'investigation'} />;
  }
  if (sessionUser && page === 'team') {
    content = (
      <>
        <LiveIncidents role="TECHNICIAN" team />
        <AssignmentManagement mode="collaboration" role="TECHNICIAN" userId={sessionUser.id} />
      </>
    );
  }
  if (sessionUser && ['transfers', 'workload'].includes(page)) {
    content = (
      <AssignmentManagement
        key={page}
        mode={page === 'transfers' ? 'transfer' : 'workload'}
        role="TECHNICIAN"
        userId={sessionUser.id}
      />
    );
  }

  const currentDisplayUser = sessionUser || technician;
  const initials = currentDisplayUser?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'TC';

  return (
    <div className={`student-dashboard technician-portal${isMenuOpen ? '' : ' menu-collapsed'}`}>
      <aside className="dashboard-sidebar" id="technician-sidebar" hidden={!isMenuOpen}>
        <div className="dashboard-brand">
          <div className="brand-logo-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <span className="brand-name">BITSolve</span>
            <span className="brand-caption">Technician Portal</span>
          </div>
        </div>

        <nav aria-label="Technician navigation">
          {Object.entries(pages).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={(page === 'details' ? returnPage : page) === value ? 'dashboard-nav-active' : ''}
              aria-current={(page === 'details' ? returnPage : page) === value ? 'page' : undefined}
              onClick={() => navigate(value)}
            >
              <NavIcon name={navIconMap[value] || 'circle'} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar-footer">
          <p className="dashboard-sidebar-note">
            <strong>BITS Pilani</strong><br />IT Operations
          </p>
        </div>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div className="dashboard-heading">
            <Button27 isOpen={isMenuOpen} onToggle={() => setIsMenuOpen(!isMenuOpen)} controls="technician-sidebar" />
            <h1 ref={heading} tabIndex={-1}>
              {page === 'details' ? 'Incident Details' : page === 'dashboard' ? 'Technician Dashboard' : pages[page]}
            </h1>
          </div>

          <div className="dashboard-user-area"><NotificationShortcut live={Boolean(sessionUser)} onOpen={() => navigate('notifications')} />
            <button type="button" className="dashboard-profile" onClick={() => navigate('profile')} title="View Profile" aria-label="View technician profile">
              <span className="dashboard-avatar" aria-hidden="true">{initials}</span>
              <div className="technician-header-profile-copy">
                <strong>{currentDisplayUser?.name}</strong>
                <span>{sessionUser ? 'Support Technician' : 'Technician · Demo'}</span>
              </div>
            </button>
            <button type="button" className={`tech-status-link ${(availability || 'unknown').toLowerCase()}`} onClick={() => navigate('dashboard')} title="Manage availability on your dashboard" aria-label={`Manage availability. Current status: ${availability ? readableLabel(availability) : availabilityLoading ? 'loading' : 'unavailable'}`}>
              <AvailabilityIndicator value={availability} loading={availabilityLoading} />
            </button>
          </div>
        </header>

        <main className="dashboard-content">
          {!sessionUser && (
            <div className="dashboard-preview-note">
              <p><strong>Development-only Technician preview</strong> · Viewing sample technician records.</p>
              <div className="preview-links">
                <a href="?preview=student">Student preview</a>
                <a href="?preview=admin">Administrator preview</a>
                <a href="/">Back to login</a>
              </div>
            </div>
          )}

          {!sessionUser && (
            <div className="report-field technician-selector">
              <label htmlFor="demo-technician">Demo technician profile</label>
              <select id="demo-technician" value={technicianId} onChange={changeTechnician}>
                {technicians.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} ({person.id} · {person.skills?.map(readableLabel).join(', ')})
                  </option>
                ))}
              </select>
            </div>
          )}

          {page === 'dashboard' && <TechnicianAvailability value={availability} busy={availabilityBusy} loading={availabilityLoading} feedback={availabilityFeedback} error={availabilityError} onChange={handleAvailabilityChange} onRetry={() => setAvailabilityRefresh(n => n + 1)} />}
          {content}
        </main>

        <footer className="dashboard-footer">
          <span>BITSolve — BITS Hyderabad IT Support</span>
          <span>Single Source of Truth · Production ITSM</span>
        </footer>
      </div>

      {operation && (
        <TechnicianOperations
          key={`${operation.action}-${operation.incident.id}`}
          action={operation.action}
          incident={operation.incident}
          technicianId={technicianId}
          onClose={() => setOperation(null)}
        />
      )}
    </div>
  );
}
