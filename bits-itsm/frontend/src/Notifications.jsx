import React, { useState } from 'react';
import { readableLabel } from './MyIncidents.jsx';

export default function Notifications({ records, readIds, onRead, onOpen, canOpen = () => true }) {
  const [filter, setFilter] = useState('all');
  const notifications = [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const filtered = notifications.filter((item) => filter === 'all' || (filter === 'read' ? readIds.includes(item.id) : !readIds.includes(item.id)));
  return <>
    <div className="dashboard-welcome"><div><h2>Notifications</h2><p>Fictional in-app notification history.</p></div></div>
    <p className="report-guidance">Mark as Read changes this UI only and resets on refresh. Future Java delivery will support in-app notifications and simulated email. No email is sent here.</p>
    <div className="report-field technician-selector"><label htmlFor="notification-filter">Show notifications</label><select id="notification-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option></select></div>
    <p className="report-guidance technician-sla-note" role="status">{filtered.length} of {notifications.length} notifications</p>
    <ul className="technician-notifications">
      {filtered.map((item) => {
        const read = readIds.includes(item.id);
        return <li key={item.id} className={read ? '' : 'notification-unread'} data-notification-id={item.id}>
          <div className="technician-notification-heading"><h3>{item.title}</h3><span className={`incident-status ${read ? 'status-resolved' : 'status-open'}`}>{read ? 'Read' : 'Unread'}</span></div>
          <p>{item.message}</p><p className="report-guidance">{item.id} · {readableLabel(item.type)} · {item.incidentId || 'General'} · <time dateTime={item.timestamp}>{item.timestamp.replace('T', ' ')}</time></p>
          <div className="technician-resource-links">
            {onOpen && (canOpen(item) ? <button type="button" className="incident-view" onClick={() => onOpen(item)}>Review {item.referenceId || item.incidentId}</button> : <span>Incident details are unavailable for your current demo assignments.</span>)}
            {!read && <button type="button" className="report-clear" onClick={() => onRead(item.id)} aria-label={`Mark ${item.id} as read`}>Mark as Read</button>}
          </div>
        </li>;
      })}
    </ul>
    {!filtered.length && <p className="dashboard-empty">{notifications.length ? 'No notifications match this filter.' : 'No notifications for this demo account.'}</p>}
  </>;
}
