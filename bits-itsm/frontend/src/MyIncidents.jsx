import React, { useEffect, useRef, useState } from 'react';
import StudentIncidentActions from './StudentIncidentActions.jsx';
import { users } from './demoData.js';
import { apiRequest } from './api.js';
import IncidentManagementActions from './IncidentManagementActions.jsx';

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
  const summary = [
    { label: 'Total Incidents', count: incidents.length },
    ...[['Open Incidents', 'open'], ['In Progress', 'in-progress'], ['Resolved Incidents', 'resolved']].map(([label, group]) => ({
      label, count: incidents.filter((incident) => incidentStatuses[incident.status]?.group === group).length,
    })),
  ];

  return (
    <section className="dashboard-summary" aria-label="Incident summary">
      {summary.map((item) => (
        <div className="dashboard-summary-card" key={item.label}>
          <h3>{item.label}</h3><p>{item.count}</p>
        </div>
      ))}
    </section>
  );
}

const emptyFilters = { search: '', status: '', priority: '', category: '', service: '', fromDate: '' };

export default function MyIncidents({ incidents, initialIncidentId, liveRole, team, options, onAction }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const detailsDialog = useRef(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const title = liveRole === 'ADMIN' ? 'All Incidents' : liveRole === 'TECHNICIAN' ? team ? 'My Team Incidents' : 'Assigned Incidents' : 'My Incidents';
  useEffect(() => {
    const incident = incidents.find((item) => item.id === initialIncidentId);
    if (incident) { setSelectedIncident(incident); if (!detailsDialog.current.open) detailsDialog.current.showModal(); }
  }, [initialIncidentId, incidents]);
  const categories = [...new Set(incidents.map((incident) => incident.category))].sort();
  const query = filters.search.trim().toLowerCase();
  const filteredIncidents = incidents.filter((incident) =>
    (String(incident.id).toLowerCase().includes(query) || incident.title.toLowerCase().includes(query)) &&
    (!filters.status || incident.status === filters.status) &&
    (!filters.priority || incident.priority === filters.priority) &&
    (!filters.category || incident.category === filters.category) &&
    (!filters.service || incident.affectedService === filters.service) &&
    (!filters.fromDate || incident.createdAt.slice(0, 10) >= filters.fromDate),
  );

  function changeFilter(event) {
    const { name, value } = event.target;
    setFilters((previous) => ({ ...previous, [name]: value }));
  }

  async function viewDetails(incident) {
    setDetailError('');
    setSelectedIncident(liveRole ? null : incident);
    detailsDialog.current.showModal();
    if (!liveRole) return;
    setDetailLoading(true);
    try { setSelectedIncident(await apiRequest(`incidents/${incident.id}`)); }
    catch (error) { setDetailError(error.message); }
    finally { setDetailLoading(false); }
  }

  async function performAction(name, payload) {
    const result = await onAction(selectedIncident.id, name, payload);
    setSelectedIncident(result.incident);
    return result.request;
  }

  return (
    <section aria-labelledby="my-incidents-title">
      <div className="dashboard-welcome">
        <div><h2 id="my-incidents-title">{title}</h2><p>{liveRole ? 'View and manage the incidents available to your account.' : 'View and track all your reported IT support requests.'}</p></div>
      </div>
      <IncidentSummary incidents={incidents} />
      <p className="report-guidance">Open: New, Classified. In progress: Assigned, Acknowledged, In Progress. Resolved: Resolved, Verified, Closed. {liveRole ? 'Priority is calculated when the administrator classifies an incident.' : "Counts include this demo student's incidents."}</p>

      <div className="incident-filters" role="search" aria-label="Search and filter incidents">
        <div className="report-field">
          <label htmlFor="incident-search">Search incidents</label>
          <input id="incident-search" type="search" name="search" placeholder="Incident ID or title" value={filters.search} onChange={changeFilter} />
        </div>
        <div className="report-field">
          <label htmlFor="filter-status">Status</label>
          <select id="filter-status" name="status" value={filters.status} onChange={changeFilter}>
            <option value="">All statuses</option>
            {Object.entries(incidentStatuses).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}
          </select>
        </div>
        <div className="report-field">
          <label htmlFor="filter-priority">Priority</label>
          <select id="filter-priority" name="priority" value={filters.priority} onChange={changeFilter}>
            <option value="">All priorities</option>
            {['PENDING', 'P1', 'P2', 'P3', 'P4'].map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </div>
        <div className="report-field">
          <label htmlFor="filter-category">Category</label>
          <select id="filter-category" name="category" value={filters.category} onChange={changeFilter}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{readableLabel(category)}</option>)}
          </select>
        </div>
        <div className="report-field"><label htmlFor="filter-service">Affected service</label><select id="filter-service" name="service" value={filters.service} onChange={changeFilter}><option value="">All services</option>{[...new Set(incidents.map(item => item.affectedService))].filter(Boolean).map(service => <option key={service} value={service}>{readableLabel(service)}</option>)}</select></div>
        <div className="report-field"><label htmlFor="filter-date">Reported on or after</label><input id="filter-date" type="date" name="fromDate" value={filters.fromDate} onChange={changeFilter} /></div>
        <button type="button" className="report-clear" onClick={() => setFilters(emptyFilters)}>Clear Filters</button>
      </div>

      <section className="dashboard-incidents" aria-labelledby="incident-list-title">
        <div className="dashboard-section-heading">
          <h2 id="incident-list-title">{title}</h2><span>{liveRole ? 'Saved incidents' : 'Demo data'}</span>
        </div>
        <p className="incident-results" role="status">{filteredIncidents.length} of {incidents.length} incidents</p>
        {incidents.length === 0 ? <p className="dashboard-empty">No incidents reported yet.</p> : filteredIncidents.length === 0 ? (
          <p className="dashboard-empty">No incidents match your search or filters.</p>
        ) : (
          <div className="dashboard-table-scroll" role="region" aria-labelledby="incident-list-title" tabIndex={0}>
            <table>
              <thead><tr>{['Incident ID', 'Title', 'Category', 'Priority', 'Status', 'Created Date', 'Action'].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
              <tbody>
                {filteredIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td className="dashboard-incident-id">{incident.id}</td>
                    <td className="dashboard-incident-title">{incident.title}</td>
                    <td>{readableLabel(incident.category)}</td>
                    <td><span className={`incident-priority priority-${incident.priority.toLowerCase()}`}>{incident.priority}</span></td>
                    <td><span className={`incident-status status-${incidentStatuses[incident.status]?.group}`}>{incidentStatuses[incident.status]?.label || readableLabel(incident.status)}</span></td>
                    <td><time dateTime={incident.createdAt}>{incident.createdAt.slice(0, 10)}</time></td>
                    <td><button type="button" className="incident-view" aria-label={`View Details for ${incident.id}`} onClick={() => viewDetails(incident)}>View Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog className="incident-dialog" ref={detailsDialog} aria-labelledby="incident-details-title" onClose={() => setSelectedIncident(null)}>
        <div className="dashboard-section-heading">
          <h2 id="incident-details-title">Incident Details</h2>
          <button type="button" className="report-clear" autoFocus onClick={() => detailsDialog.current.close()}>Close</button>
        </div>
        {detailLoading && <p role="status">Loading incident details…</p>}
        {detailError && <p className="report-error" role="alert">{detailError}</p>}
        {selectedIncident && (liveRole ? <>
          <dl className="incident-details">{[
            ['Incident ID', selectedIncident.id], ['Title', selectedIncident.title], ['Description', selectedIncident.description],
            ['Reporter', selectedIncident.reporter.name], ['Category', readableLabel(selectedIncident.category)], ['Affected Service', selectedIncident.serviceLabel],
            ['Business criticality', readableLabel(selectedIncident.criticality)], ['Response SLA', readableLabel(selectedIncident.responseSla)], ['Resolution SLA', readableLabel(selectedIncident.resolutionSla)], ['Response deadline', selectedIncident.responseDeadline || 'Pending classification'], ['Resolution deadline', selectedIncident.resolutionDeadline || 'Pending classification'],
            ['Impact', readableLabel(selectedIncident.impact)], ['Urgency', readableLabel(selectedIncident.urgency)], ['Priority', readableLabel(selectedIncident.priority)],
            ['Status', readableLabel(selectedIncident.status)], ['Assigned Technician', selectedIncident.assignedTechnician?.name || 'Not assigned'],
            ...['createdAt', 'updatedAt', 'acknowledgedAt', 'resolvedAt', 'verifiedAt', 'closedAt'].filter(field => selectedIncident[field]).map(field => [field.replace(/([A-Z])/g, ' $1'), new Date(selectedIncident[field]).toLocaleString()]),
            ['Resolution Summary', selectedIncident.resolutionSummary || 'No resolution recorded'], ['Steps Performed', selectedIncident.resolutionSteps || 'Not recorded'],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {liveRole === 'STUDENT' ? <StudentIncidentActions incident={selectedIncident} onAction={performAction} /> : <>
            <IncidentManagementActions key={selectedIncident.id} incident={selectedIncident} role={liveRole} options={options} onAction={performAction} />
            <section className="student-detail-section"><h3>Incident Team</h3><p>Primary: {selectedIncident.assignedTechnician?.name || 'Not assigned'}</p>{selectedIncident.collaborators.map(member => <p key={member.technician.id}>{member.technician.name} · {member.responsibility}</p>)}</section>
            <section className="student-detail-section"><h3>Investigation &amp; Support Communication</h3>{selectedIncident.notes.length ? <ol className="technician-updates">{selectedIncident.notes.map(note => <li key={note.id}><strong>{note.author.name}</strong> · {readableLabel(note.visibility)} · {readableLabel(note.kind)}<p>{note.content}</p><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time></li>)}</ol> : <p>No notes or messages yet.</p>}</section>
            {selectedIncident.feedback && <p>Support feedback: {selectedIncident.feedback.rating}/5 · {selectedIncident.feedback.comment}</p>}
          </>}
          <section className="student-detail-section"><h3>Incident History</h3><ol className="technician-updates">{selectedIncident.history.map(event => <li key={event.id}><strong>{readableLabel(event.action)}</strong> · {event.actor.name}<p>{event.description}</p><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></li>)}</ol></section>
        </> : <>
          <p className="report-guidance">Fictional demo incident · Read only</p>
          <dl className="incident-details">
            {[
              ['Incident ID', selectedIncident.id], ['Title', selectedIncident.title],
              ['Category', readableLabel(selectedIncident.category)], ['Affected Service', selectedIncident.affectedService],
              ['Description', selectedIncident.description], ['Impact', readableLabel(selectedIncident.impact)],
              ['Urgency', readableLabel(selectedIncident.urgency)], ['Priority', selectedIncident.priority],
              ['Status', incidentStatuses[selectedIncident.status]?.label || readableLabel(selectedIncident.status)],
              ['Created Date', selectedIncident.createdAt.replace('T', ' ')],
              ['Assigned Technician', selectedIncident.assignedTechnician || 'Not assigned'],
              ['Collaborators', selectedIncident.collaborators.map((member) => users.find((user) => user.id === member.technicianId)?.name).join(', ') || 'None'],
              ['SLA Status (sample snapshot)', readableLabel(selectedIncident.slaStatus)],
              ['Response Deadline', selectedIncident.responseDeadline.replace('T', ' ')],
              ['Resolution Deadline', selectedIncident.resolutionDeadline.replace('T', ' ')],
              ['Resolution Information', selectedIncident.resolution || 'No resolution recorded'],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}
          </dl>
          <StudentIncidentActions key={selectedIncident.id} incident={selectedIncident} />
        </>)}
      </dialog>
    </section>
  );
}
