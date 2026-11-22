export function slaCountdown(incident, now = Date.now()) {
  if (incident.status === 'CLOSED' && !incident.resolvedAt && incident.closedAt) return { text: 'Closed without resolution', active: false, overdue: false };
  const deadline = Date.parse(incident.resolutionDeadline || '');
  if (!Number.isFinite(deadline)) return { text: 'SLA pending', active: false, overdue: false };
  const finished = ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(incident.status);
  const end = finished ? Date.parse(incident.resolvedAt || incident.closedAt || '') : now;
  if (!Number.isFinite(end)) return { text: 'Final SLA outcome unavailable', active: false, overdue: false };
  const seconds = Math.ceil(Math.abs(deadline - end) / 1000);
  const duration = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  const overdue = end > deadline;
  return { text: finished ? (overdue ? `Resolved ${duration} after deadline` : `Resolved within SLA (${duration} remaining)`)
    : overdue ? `OVERDUE by ${duration}` : `${duration} remaining`, active: !finished, overdue };
}
