export const incidentStatusLabels = {
  NEW: 'New',
  CLASSIFIED: 'Classified',
  ASSIGNED: 'Assigned',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
  CLOSED: 'Closed',
};

export const incidentPriorityLabels = {
  PENDING: 'Awaiting Classification',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
};

export function priorityValue(priority) {
  return priority == null || priority === '' ? 'PENDING' : priority;
}

export function optionsForStatuses(incidents) {
  const statuses = new Set(Object.keys(incidentStatusLabels));
  incidents.forEach(incident => { if (incident.status) statuses.add(incident.status); });
  return [...statuses].map(value => [value, incidentStatusLabels[value] || value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())]);
}

export function filterAndSortIncidents(incidents, filters) {
  const query = filters.search.trim().toLowerCase();
  const matching = incidents.filter(incident => {
    const searchText = [incident.id, incident.title, incident.description]
      .map(value => String(value ?? '').toLowerCase());
    return (!query || searchText.some(value => value.includes(query)))
      && (!filters.status || incident.status === filters.status)
      && (!filters.priority || priorityValue(incident.priority) === filters.priority)
      && (!filters.category || incident.category === filters.category)
      && (!filters.service || incident.affectedService === filters.service)
      && (!filters.fromDate || String(incident.createdAt ?? '').slice(0, 10) >= filters.fromDate);
  });

  return matching.sort((left, right) => {
    const leftDate = Date.parse(left.createdAt ?? '') || 0;
    const rightDate = Date.parse(right.createdAt ?? '') || 0;
    return filters.sort === 'OLDEST' ? leftDate - rightDate : rightDate - leftDate;
  });
}
