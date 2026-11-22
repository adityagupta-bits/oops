import React, { useEffect, useRef, useState } from 'react';
import SlaCountdown from './components/SlaCountdown.jsx';
import IncidentConversation from './IncidentConversation.jsx';
import HistoricalResolution from './HistoricalResolution.jsx';
import StudentIncidentActions from './StudentIncidentActions.jsx';
import { users } from './demoData.js';
import { apiRequest } from './api.js';
import IncidentManagementActions from './IncidentManagementActions.jsx';
import IncidentDisposition from './IncidentDisposition.jsx';
import IncidentReportsChart from './IncidentReportsChart.jsx';
import { filterAndSortIncidents, incidentPriorityLabels, optionsForStatuses, priorityValue } from './incidentFilters.js';
import Badge from './components/ui/Badge.jsx';
import StatCard from './components/ui/StatCard.jsx';
import NavIcon from './components/NavIcon.jsx';
import { resolvedSuccessfully } from './incidentDisposition.js';
import './MyIncidents.css';

// Shared display groups keep both pages' summary counts consistent.
export const incidentStatuses = {
  NEW: { label: 'New', group: 'open' },
  CLASSIFIED: { label: 'Classified', group: 'open' },
  ASSIGNED: { label: 'Assigned', group: 'in-progress' },
  ACKNOWLEDGED: { label: 'Acknowledged', group: 'in-progress' },
  IN_PROGRESS: { label: 'In Progress', group: 'in-progress' },
  RESOLVED: { label: 'Resolved', group: 'resolved' },
  VERIFIED: { label: 'Verified', group: 'resolved' },
  CLOSED: { label: 'Closed', group: 'resolved' },
};

export function readableLabel(value) {
  return value ? value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Not provided';
}

export function IncidentSummary({ incidents }) {
  const total = incidents.length;
  const openCount = incidents.filter((incident) => incidentStatuses[incident.status]?.group === 'open').length;
  const inProgressCount = incidents.filter((incident) => incidentStatuses[incident.status]?.group === 'in-progress').length;
  const resolvedCount = incidents.filter(resolvedSuccessfully).length;

  return (
    <section className="dashboard-summary" aria-label="Incident summary KPIs">
      <StatCard
        title="Total Incidents"
        value={total}
        caption="All recorded tickets"
        icon={<NavIcon name="incidents" />}
        tone="navy"
      />
      <StatCard
        title="Open Incidents"
        value={openCount}
        caption="New &amp; Classified"
        icon={<NavIcon name="clock" />}
        tone="amber"
      />
      <StatCard
        title="In Progress"
        value={inProgressCount}
        caption="Actively investigated"
        icon={<NavIcon name="activity" />}
        tone="blue"
      />
      <StatCard
        title="Resolved"
        value={resolvedCount}
        caption="Successfully resolved reports"
        icon={<NavIcon name="check" />}
        tone="emerald"
      />
    </section>
  );
}

const emptyFilters = { search: '', status: '', priority: '', category: '', service: '', fromDate: '', sort: 'NEWEST' };

export default function MyIncidents({ incidents, initialIncidentId, liveRole, team, options, onAction, titleOverride, dashboard = false }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [studentFilter, setStudentFilter] = useState('all');
  const studentView = !liveRole || liveRole === 'STUDENT';
  const [selectedIncident, setSelectedIncident] = useState(null);
  const detailsDialog = useRef(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);

  const title = titleOverride || (liveRole === 'ADMIN' ? 'All Incidents' : liveRole === 'TECHNICIAN' ? team ? 'My Team Incidents' : 'Assigned Incidents' : 'My Incidents');
  const adminAllIncidents = liveRole === 'ADMIN' && !dashboard && !team;

  useEffect(() => {
    const incident = incidents.find((item) => item.id === initialIncidentId);
    if (incident) {
      setSelectedIncident(incident);
      if (detailsDialog.current && !detailsDialog.current.open) {
        detailsDialog.current.showModal();
      }
    }
  }, [initialIncidentId, incidents]);

  const categories = [...new Set(incidents.map((incident) => incident.category))].sort();
  const filteredIncidents = filterAndSortIncidents(incidents, studentView ? emptyFilters : filters)
    .filter((incident) => !studentView || studentFilter === 'all' ||
      (studentFilter === 'resolved' ? resolvedSuccessfully(incident)
        : studentFilter === 'closed' ? incident.status === 'CLOSED'
        : !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(incident.status)));
  const statusOptions = optionsForStatuses(incidents);

  function changeFilter(event) {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  }

  async function viewDetails(incident) {
    setDetailError('');
    setSelectedIncident(liveRole ? null : incident);
    if (detailsDialog.current && !detailsDialog.current.open) {
      detailsDialog.current.showModal();
    }
    if (!liveRole) return;
    setDetailLoading(true);
    try {
      setSelectedIncident(await apiRequest(`incidents/${incident.id}`));
    } catch (error) {
      setDetailError(error.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function performAction(name, payload) {
    const result = await onAction(selectedIncident.id, name, payload);
    setSelectedIncident(result.incident);
    return result.request;
  }

  return (
    <section className="incident-list-page" aria-labelledby="my-incidents-title">
      <div className="dashboard-welcome">
        <div>
          <h2 id="my-incidents-title">{title}</h2>
          <p>{liveRole === 'ADMIN' ? 'Track campus reports, ownership and service deadlines.' : liveRole === 'TECHNICIAN' ? 'Review your assigned work and service deadlines.' : 'Track your reports and updates from the support team.'}</p>
        </div>
      </div>

      <IncidentSummary incidents={incidents} />
      {dashboard && <IncidentReportsChart incidents={incidents} role={liveRole} />}

      {!studentView && <p className="report-guidance">
        Open: New, Classified. In Progress: Assigned, Acknowledged, In Progress. Resolved counts exclude withdrawals and invalid or duplicate closures. {liveRole ? 'Priority is calculated automatically when an incident is classified.' : 'Counts include student-reported incidents.'}
      </p>}

      {studentView ? (
        <div className="student-incident-filters" role="group" aria-label="Filter your incidents">
          {['all', 'active', 'resolved', 'closed'].map((value) => (
            <button key={value} type="button"
              className={`filter-pill ${studentFilter === value ? 'active' : ''}`}
              aria-pressed={studentFilter === value}
              onClick={() => setStudentFilter(value)}>
              {readableLabel(value)}
            </button>
          ))}
        </div>
      ) : <div className="incident-filters" role="search" aria-label="Search and filter incidents">
        <div className="report-field search-field">
          <label htmlFor="incident-search">Search Incidents</label>
          <div className="input-with-icon">
            <NavIcon name="search" />
            <input
              id="incident-search"
              type="search"
              name="search"
              placeholder="Search by ID, title, or keywords…"
              value={filters.search}
              onChange={changeFilter}
            />
          </div>
        </div>

        <div className="report-field">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" name="status" value={filters.status} onChange={changeFilter}>
            <option value="">All Statuses</option>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label htmlFor="filter-priority">Priority</label>
          <select id="filter-priority" name="priority" value={filters.priority} onChange={changeFilter}>
            <option value="">All Priorities</option>
            {Object.entries(incidentPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label htmlFor="filter-category">Category</label>
          <select id="filter-category" name="category" value={filters.category} onChange={changeFilter}>
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{readableLabel(category)}</option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label htmlFor="filter-service">Affected Service</label>
          <select id="filter-service" name="service" value={filters.service} onChange={changeFilter}>
            <option value="">All Services</option>
            {[...new Set(incidents.map((item) => item.affectedService))].filter(Boolean).map((service) => (
              <option key={service} value={service}>{readableLabel(service)}</option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label htmlFor="filter-date">Reported On / After</label>
          <input id="filter-date" type="date" name="fromDate" value={filters.fromDate} onChange={changeFilter} />
        </div>

        <div className="report-field">
          <label htmlFor="filter-sort">Sort Order</label>
          <select id="filter-sort" name="sort" value={filters.sort} onChange={changeFilter}>
            <option value="NEWEST">Newest First</option>
            <option value="OLDEST">Oldest First</option>
          </select>
        </div>

        <button type="button" className="report-clear filter-clear-btn" onClick={() => setFilters(emptyFilters)}>
          Clear Filters
        </button>
      </div>}

      <section className={`dashboard-incidents${adminAllIncidents ? ' dashboard-incidents--all' : ''}`} aria-labelledby="incident-list-title">
        <div className="dashboard-section-heading">
          <h2 id="incident-list-title">{title}</h2>
          <span className="results-counter-pill" role="status">
            {filteredIncidents.length} of {incidents.length} tickets
          </span>
        </div>

        {incidents.length === 0 ? (
          <div className="empty-state-panel">
            <NavIcon name="incidents" />
            <h3>{liveRole === 'TECHNICIAN' ? 'No assigned incidents' : 'No incidents yet'}</h3>
            <p>{liveRole === 'TECHNICIAN' ? 'Work assigned to you will appear here. Manage your availability from the dashboard.' : liveRole === 'ADMIN' ? 'Student reports will appear here as they are submitted.' : 'Use Report an Incident to request help with a campus IT problem.'}</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="empty-state-panel">
            <NavIcon name="search" />
            <h3>No matching results</h3>
            <p>No incidents match the selected filter criteria. Try adjusting your search keywords or clearing filters.</p>
            <button type="button" className="report-clear" onClick={() => setFilters(emptyFilters)}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className={`dashboard-table-scroll${adminAllIncidents ? ' all-incidents-table-scroll' : ''}`} role="region" aria-labelledby="incident-list-title" tabIndex={0}>
            <table className={adminAllIncidents ? 'all-incidents-table' : undefined}>
              {adminAllIncidents && (
                <colgroup>
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '27%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
              )}
              <thead>
                <tr>
                  {['Incident ID', 'Title', 'Category', 'Priority', 'Status', 'Resolution SLA', 'Created Date', 'Action'].map((heading) => (
                    <th key={heading} scope="col">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((incident) => {
                  const pVal = priorityValue(incident.priority);
                  return (
                    <tr key={incident.id}>
                      <td className="dashboard-incident-id">#{incident.id}</td>
                      <td className="dashboard-incident-title">
                        <strong>{incident.title}</strong>
                        {incident.needsClassificationReview && (
                          <span className="table-row-tag tag-warning">Needs Review</span>
                        )}
                      </td>
                      <td>{readableLabel(incident.category)}</td>
                      <td><Badge value={pVal} type="priority" /></td>
                      <td><Badge value={incident.status} type="status" /></td>
                      <td>{liveRole ? <SlaCountdown incident={incident} /> : 'Preview'}</td>
                      <td>
                        <time dateTime={incident.createdAt}>
                          {incident.createdAt ? incident.createdAt.slice(0, 10) : '—'}
                        </time>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="incident-view"
                          aria-label={`View Details for ${incident.id}`}
                          onClick={() => viewDetails(incident)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog
        className="incident-dialog"
        ref={detailsDialog}
        aria-labelledby="incident-details-title"
        onClose={event => { if (event.target === event.currentTarget) setSelectedIncident(null); }}
      >
        <div className="dashboard-section-heading dialog-header">
          <div>
            <span className="dialog-eyebrow">ITSM INCIDENT RECORD</span>
            <h2 id="incident-details-title">
              {selectedIncident ? `Incident #${selectedIncident.id}` : 'Incident Details'}
            </h2>
          </div>
          <button
            type="button"
            className="dialog-close-btn"
            autoFocus
            onClick={() => detailsDialog.current.close()}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {detailLoading && (
          <div className="loading-state-box" role="status">
            <span className="spinner-border" aria-hidden="true" />
            <span>Loading full incident details…</span>
          </div>
        )}

        {detailError && <p className="report-error" role="alert">{detailError}</p>}

        {selectedIncident && (
          <div className="incident-dialog-body">
            {liveRole ? (
              <>
                <div className="incident-status-summary-bar">
                  <div className="status-badge-group">
                    <span className="status-label">Status:</span>
                    <Badge value={selectedIncident.status} type="status" />
                  </div>
                  <div className="status-badge-group">
                    <span className="status-label">Priority:</span>
                    <Badge value={selectedIncident.priority} type="priority" />
                  </div>
                  {selectedIncident.responseSla && (
                    <div className="status-badge-group">
                      <span className="status-label">SLA:</span>
                      <span className="sla-pill">{readableLabel(selectedIncident.responseSla)}</span>
                    </div>
                  )}
                </div>

                <dl className="incident-details">
                  {[
                    ['Incident ID', `#${selectedIncident.id}`],
                    ['Title', selectedIncident.title],
                    ['Description', selectedIncident.description],
                    ['Reporter', selectedIncident.reporter?.name || 'Student'],
                    ['Reported Category', readableLabel(selectedIncident.reportedCategory)],
                    ['Reported Urgency', selectedIncident.reportedUrgency ? readableLabel(selectedIncident.reportedUrgency) : 'Not supplied'],
                    ['Calculated Urgency', selectedIncident.urgency ? readableLabel(selectedIncident.urgency) : 'Awaiting review'],
                    ['Category', readableLabel(selectedIncident.category)],
                    ['Affected Service', selectedIncident.serviceLabel || readableLabel(selectedIncident.affectedService)],
                    ['Business Criticality', readableLabel(selectedIncident.criticality)],
                    ['Response Deadline', selectedIncident.responseDeadline || 'Pending classification'],
                    ['Resolution Deadline', selectedIncident.resolutionDeadline || 'Pending classification'],
                    ['Assigned Technician', selectedIncident.assignedTechnician?.name || 'Not yet assigned'],
                    ...['createdAt', 'acknowledgedAt', 'resolvedAt', 'verifiedAt', 'closedAt']
                      .filter((f) => selectedIncident[f])
                      .map((f) => [f.replace(/([A-Z])/g, ' $1'), new Date(selectedIncident[f]).toLocaleString()]),
                    ['Resolution SLA', <SlaCountdown incident={selectedIncident} />],
                    ['Resolution Summary', selectedIncident.resolutionSummary || 'No resolution recorded yet'],
                    ['Steps Performed', selectedIncident.resolutionSteps || 'Not recorded'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>

                {liveRole === 'STUDENT' && <HistoricalResolution incidentId={selectedIncident.id} />}
                {options?.incidentMessaging && <IncidentConversation key={selectedIncident.id} incidentId={selectedIncident.id} role={liveRole} />}
                {liveRole === 'STUDENT' ? (
                  <><StudentIncidentActions incident={selectedIncident} onAction={performAction} />
                    {options?.incidentDisposition && <IncidentDisposition key={selectedIncident.id} incident={selectedIncident} role={liveRole} onAction={performAction} />}</>
                ) : (
                  <>
                    <IncidentManagementActions
                      key={selectedIncident.id}
                      incident={selectedIncident}
                      role={liveRole}
                      options={options}
                      onAction={performAction}
                      onRefresh={async () => setSelectedIncident(await apiRequest(`incidents/${selectedIncident.id}`))}
                    />
                    <section className="student-detail-section">
                      <h3>Incident Team</h3>
                      <p><strong>Primary Technician:</strong> {selectedIncident.assignedTechnician?.name || 'Not assigned'}</p>
                      {selectedIncident.collaborators?.map((member) => (
                        <p key={member.technician.id}>
                          <strong>Collaborator:</strong> {member.technician.name} · {member.responsibility}
                        </p>
                      ))}
                    </section>
                    <section className="student-detail-section">
                      <h3>Investigation &amp; Support Communication</h3>
                      {selectedIncident.notes?.filter(note => note.kind !== 'MESSAGE').length ? (
                        <ol className="technician-updates">
                          {selectedIncident.notes.filter(note => note.kind !== 'MESSAGE').map((note) => (
                            <li key={note.id}>
                              <strong>{note.author.name}</strong> · {readableLabel(note.visibility)} · {readableLabel(note.kind)}
                              <p>{note.content}</p>
                              <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p>No notes or messages yet.</p>
                      )}
                    </section>
                    {selectedIncident.feedback && (
                      <div className="feedback-banner">
                        <strong>Student Feedback:</strong> {selectedIncident.feedback.rating}/5 stars · {selectedIncident.feedback.comment}
                      </div>
                    )}
                  </>
                )}

                <section className="student-detail-section">
                  <h3>Incident Audit History</h3>
                  <ol className="technician-updates">
                    {selectedIncident.history?.map((event) => (
                      <li key={event.id}>
                        <strong>{readableLabel(event.action)}</strong> · {event.actor?.name || 'System'}
                        <p>{event.description}</p>
                        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            ) : (
              <>
                <p className="report-guidance">Demonstration Record · Read-only preview</p>
                <dl className="incident-details">
                  {[
                    ['Incident ID', `#${selectedIncident.id}`],
                    ['Title', selectedIncident.title],
                    ['Category', readableLabel(selectedIncident.category)],
                    ['Affected Service', selectedIncident.affectedService],
                    ['Description', selectedIncident.description],
                    ['Impact', readableLabel(selectedIncident.impact)],
                    ['Urgency', readableLabel(selectedIncident.urgency)],
                    ['Priority', selectedIncident.priority],
                    ['Status', incidentStatuses[selectedIncident.status]?.label || readableLabel(selectedIncident.status)],
                    ['Created Date', selectedIncident.createdAt?.replace('T', ' ')],
                    ['Assigned Technician', selectedIncident.assignedTechnician || 'Not assigned'],
                    [
                      'Collaborators',
                      selectedIncident.collaborators?.map((m) => users.find((u) => u.id === m.technicianId)?.name).filter(Boolean).join(', ') || 'None',
                    ],
                    ['Resolution', selectedIncident.resolution || 'No resolution recorded'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || 'Not provided'}</dd>
                    </div>
                  ))}
                </dl>
                <StudentIncidentActions key={selectedIncident.id} incident={selectedIncident} />
              </>
            )}
          </div>
        )}
      </dialog>
    </section>
  );
}
