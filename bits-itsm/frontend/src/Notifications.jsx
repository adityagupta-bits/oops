import React, { useEffect, useState } from 'react';
import LiveIncidents from './LiveIncidents.jsx';
import { apiRequest, apiSend } from './api.js';
import { readableLabel } from './MyIncidents.jsx';
import NavIcon from './components/NavIcon.jsx';

const internalReferencePattern = /\b(?:INC|NT|ADMIN|ST|TR|CR|REPLY|T|S|A|KB)-?\d+\b|\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b|#\d+\b/gi;

function removeInternalReferences(value) {
  return String(value || '').replace(internalReferencePattern, '').replace(/\s{2,}/g, ' ').trim();
}

function notificationTime(value) {
  const time = Date.parse(value || '');
  return Number.isNaN(time) ? 0 : time;
}

function dateGroup(value) {
  const timestamp = notificationTime(value);
  if (!timestamp) return 'Earlier';
  const date = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (day.getTime() === today.getTime()) return 'Today';
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return 'Earlier';
}

function formatNotificationTime(value) {
  const timestamp = notificationTime(value);
  if (!timestamp) return 'Date unavailable';
  const date = new Date(timestamp);
  const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
  const group = dateGroup(value);
  if (group === 'Today') return `Today, ${time}`;
  if (group === 'Yesterday') return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function notificationDescription(item) {
  if (item.type === 'INCIDENT_CREATED') return 'A new support incident was submitted.';
  if (item.type === 'CRITICAL_INCIDENT') return 'This incident was marked critical.';
  if (item.type === 'TECHNICIAN_OVERLOADED') return 'A technician exceeded the active workload limit.';
  const message = removeInternalReferences(item.message)
    .replace(/\bpriority of\s+(?=changed)/i, 'Priority ')
    .replace(/\bincident\s+(?=(?:was|is|has|entered)\b)/i, 'Incident ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return message || readableLabel(item.type);
}

function notificationIcon(type = '') {
  if (/SLA|ESCALAT|DUPLICATE|CRITICAL|DISRUPTION/i.test(type)) return 'alert';
  if (/ASSIGN|COLLABOR|TRANSFER|TECHNICIAN/i.test(type)) return 'team';
  if (/RESOLV|CLOSED|ACKNOWLEDGED|VERIFIED/i.test(type)) return 'check';
  return 'file';
}

function notificationKind(type) {
  const labels = {
    INCIDENT_CREATED: 'Incident reported',
    INCIDENT_CLASSIFIED: 'Classified',
    PRIORITY_CHANGED: 'Priority updated',
    INCIDENT_ASSIGNED: 'Technician assigned',
    INCIDENT_ACKNOWLEDGED: 'Acknowledged',
    INCIDENT_UPDATED: 'Incident updated',
    INCIDENT_RESOLVED: 'Resolved',
    INCIDENT_CLOSED: 'Closed',
    SLA_WARNING: 'SLA warning',
    SLA_BREACHED: 'SLA breached',
    INCIDENT_ESCALATED: 'Escalated',
    DUPLICATE_DETECTED: 'Possible duplicate',
  };
  return labels[type] || readableLabel(type);
}

function notificationSubject(item) {
  const subject = item.incidentTitle || (
    ['INCIDENT_CREATED', 'CRITICAL_INCIDENT'].includes(item.type) ? item.message : item.title
  );
  return removeInternalReferences(subject) || notificationKind(item.type);
}

function NotificationRow({ item, isRead, busy, live, canOpen, onOpen, onSelect, onRead }) {
  const hasIncident = Boolean(item.incidentId);
  const canView = live ? hasIncident : Boolean(onOpen && canOpen(item));
  const viewLabel = !live && (item.target === 'transfer' || item.target === 'collaboration')
    ? 'View request'
    : hasIncident ? 'View incident' : 'View details';

  return (
    <li className={`notification-row ${isRead ? 'is-read' : 'is-unread'} ${item.type === 'SLA_BREACHED' ? 'is-critical' : ''}`} aria-label={`${isRead ? 'Read' : 'Unread'}: ${notificationSubject(item)}`}>
      <span className="notification-row-icon" aria-hidden="true">
        <NavIcon name={notificationIcon(item.type)} size={16} className="notification-row-icon-svg" />
        {!isRead && <span className="notification-unread-dot" />}
      </span>

      <div className="notification-row-copy">
        <div className="notification-row-heading">
          <h3 title={notificationSubject(item)}>{notificationSubject(item)}</h3>
          <span className="notification-row-kind">{notificationKind(item.type)}</span>
        </div>
        <p title={notificationDescription(item)}>{notificationDescription(item)}</p>
      </div>

      <time className="notification-row-time" dateTime={item.timestamp}>
        {formatNotificationTime(item.timestamp)}
      </time>

      <div className="notification-row-actions">
        {canView && (
          <button
            type="button"
            className="notification-action-link"
            onClick={() => (live ? onSelect(item.incidentId) : onOpen(item))}
          >
            {viewLabel}
          </button>
        )}
        {!isRead && onRead && (
          <button
            type="button"
            className="notification-mark-read"
            disabled={busy !== null}
            onClick={() => onRead(item.id)}
            aria-label={`Mark ${notificationSubject(item)} as read`}
          >
            {busy === item.id ? 'Saving…' : 'Mark read'}
          </button>
        )}
      </div>
    </li>
  );
}

export default function Notifications({
  records = [],
  readIds = [],
  onRead,
  onOpen,
  canOpen = () => true,
  live = false,
  role = 'STUDENT',
}) {
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(live);
  const [busy, setBusy] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('notifications', { cache: 'no-store' });
      if (!Array.isArray(result)) throw new Error('The notification list could not be loaded.');
      setSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (live) load();
  }, [live]);

  const currentRecords = live ? saved : records;
  const currentReadIds = live ? saved.filter((item) => item.read).map((item) => item.id) : readIds;
  const notificationRead = (item) => Boolean(item.read || currentReadIds.includes(item.id));
  const notifications = [...currentRecords].sort((a, b) => notificationTime(b.timestamp) - notificationTime(a.timestamp));
  const unreadItems = notifications.filter((item) => !notificationRead(item));
  const unreadCount = unreadItems.length;
  const initialLoading = live && loading && saved.length === 0;
  const canMarkRead = live || typeof onRead === 'function';
  const filtered = notifications.filter(
    (item) => filter === 'all' || (filter === 'read' ? notificationRead(item) : !notificationRead(item))
  );

  async function markRead(id) {
    if (!live) return onRead?.(id);
    setBusy(id);
    setError('');
    try {
      await apiSend('notifications/' + encodeURIComponent(id) + '/read');
      setSaved((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    if (!unreadItems.length || !canMarkRead) return;
    setBusy('all');
    setError('');
    if (!live) {
      unreadItems.forEach((item) => onRead?.(item.id));
      setBusy(null);
      return;
    }
    try {
      await apiSend('notifications/read-all');
      setSaved((items) => items.map((item) => ({ ...item, read: true })));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const groupMap = new Map();
  for (const item of filtered) {
    const group = dateGroup(item.timestamp);
    if (!groupMap.has(group)) groupMap.set(group, []);
    groupMap.get(group).push(item);
  }
  const showDateGroups = groupMap.size > 1;
  const groups = ['Today', 'Yesterday', 'Earlier']
    .filter((group) => groupMap.has(group))
    .map((label) => ({ label: showDateGroups ? label : null, items: groupMap.get(label) }));

  if (live && selectedId) {
    return (
      <>
        <div className="notification-detail-back">
          <button type="button" className="notification-action-link" onClick={() => setSelectedId(null)}>
            ← Back to Notifications
          </button>
        </div>
        <LiveIncidents role={role} team={role === 'TECHNICIAN'} initialIncidentId={selectedId} />
      </>
    );
  }

  return (
    <section className="notifications-container" aria-labelledby="notifications-title">
      <header className="notification-inbox-header">
        <h2 id="notifications-title">Notifications</h2>
        {unreadCount > 0 && (
          <span className="notification-unread-count" aria-label={`${unreadCount} unread notifications`}>
            {unreadCount} unread
          </span>
        )}
      </header>

      <div className="notifications-toolbar">
        <div className="filter-pill-group" role="group" aria-label="Notification filter">
          {[
            ['all', 'All'],
            ['unread', 'Unread'],
            ['read', 'Read'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-pill ${filter === value ? 'active' : ''}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="notification-toolbar-actions">
          {live && (
            <button type="button" className="notification-mark-read" onClick={load} disabled={loading || busy !== null}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          {unreadCount > 0 && canMarkRead && (
            <button type="button" className="notification-mark-read" onClick={markAllRead} disabled={loading || busy !== null}>
              {busy === 'all' ? 'Marking…' : 'Mark all as read'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="notification-error" role="alert">
          <span>{error}</span>
          <button type="button" className="notification-action-link" onClick={load}>Retry</button>
        </div>
      )}

      {initialLoading && <p className="notification-feedback" role="status">Loading notifications…</p>}

      {!initialLoading && groups.map(({ label, items }) => (
        <section className="notification-group" key={label || 'notifications'} aria-label={label || 'Notifications'}>
          {label && <h3 className="notification-group-heading">{label}</h3>}
          <ul className="notification-list">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                isRead={notificationRead(item)}
                busy={loading ? 'refresh' : busy}
                live={live}
                canOpen={canOpen}
                onOpen={onOpen}
                onSelect={setSelectedId}
                onRead={canMarkRead ? markRead : undefined}
              />
            ))}
          </ul>
        </section>
      ))}

      {!loading && !error && filtered.length === 0 && (
        <p className="notification-empty-state">
          {notifications.length ? 'No notifications match this filter.' : 'No notifications yet. Updates about your incidents and support requests will appear here.'}
        </p>
      )}
    </section>
  );
}
