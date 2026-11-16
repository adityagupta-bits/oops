import React, { useEffect, useState } from 'react';
import LiveIncidents from './LiveIncidents.jsx';
import { apiRequest, apiSend } from './api.js';
import { readableLabel } from './MyIncidents.jsx';

export default function Notifications({ records = [], readIds = [], onRead, onOpen, canOpen = () => true, live = false, role = 'STUDENT' }) {
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(live);
  const [busy, setBusy] = useState(null);
  async function load() {
    setLoading(true); setError('');
    try { setSaved(await apiRequest('notifications')); }
    catch (error) { setError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (live) load(); }, [live]);
  async function markRead(id) {
    if (!live) return onRead(id);
    setBusy(id); setError('');
    try {
      await apiSend('notifications/' + encodeURIComponent(id) + '/read');
      setSaved(items => items.map(item => item.id === id ? { ...item, read: true } : item));
    } catch (error) { setError(error.message); }
    finally { setBusy(null); }
  }
  if (live) { records = saved; readIds = saved.filter(item => item.read).map(item => item.id); }
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const notifications = [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const filtered = notifications.filter((item) => filter === 'all' || (filter === 'read' ? readIds.includes(item.id) : !readIds.includes(item.id)));
  if (live && selectedId) return <><button className="report-clear" onClick={() => setSelectedId(null)}>Back to notifications</button><LiveIncidents role={role} team={role === 'TECHNICIAN'} initialIncidentId={selectedId} /></>;
  return <>
    <div className="dashboard-welcome"><div><h2>Notifications</h2><p>{live ? 'Your account notifications.' : 'Fictional in-app notification history.'}</p></div></div>
    {!live && <p className="report-guidance">Mark as Read changes this UI only and resets on refresh. Future Java delivery will support in-app notifications and simulated email. No email is sent here.</p>}
    {loading && <p role="status">Loading notifications?</p>}
    {error && <p role="alert">{error} <button className="report-clear" onClick={load}>Retry</button></p>}
    <div className="report-field technician-selector"><label htmlFor="notification-filter">Show notifications</label><select id="notification-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option></select></div>
    <p className="report-guidance technician-sla-note" role="status">{filtered.length} of {notifications.length} notifications</p>
    <p role="status">{readIds.length < records.length ? records.length - readIds.length : 0} unread</p>
    <ul className="technician-notifications">
      {filtered.map((item) => {
        const read = readIds.includes(item.id);
        return <li key={item.id} className={read ? '' : 'notification-unread'} data-notification-id={item.id}>
          <div className="technician-notification-heading"><h3>{item.title}</h3><span className={`incident-status ${read ? 'status-resolved' : 'status-open'}`}>{read ? 'Read' : 'Unread'}</span></div>
          <p>{item.message}</p><p className="report-guidance">{item.id} · {readableLabel(item.type)} · {item.incidentId || 'General'} · <time dateTime={item.timestamp}>{item.timestamp.replace('T', ' ')}</time></p>
          <div className="technician-resource-links">
            {live && item.incidentId && <button type="button" className="incident-view" onClick={() => setSelectedId(item.incidentId)}>Review incident {item.incidentId}</button>}
            {!live && onOpen && (canOpen(item) ? <button type="button" className="incident-view" onClick={() => onOpen(item)}>Review {item.referenceId || item.incidentId}</button> : <span>Incident details are unavailable for your current demo assignments.</span>)}
            {!read && <button type="button" className="report-clear" disabled={busy === item.id} onClick={() => markRead(item.id)} aria-label={`Mark ${item.id} as read`}>Mark as Read</button>}
          </div>
        </li>;
      })}
    </ul>
    {!loading && !error && !filtered.length && <p className="dashboard-empty">{notifications.length ? 'No notifications match this filter.' : 'No notifications for this account.'}</p>}
  </>;
}
