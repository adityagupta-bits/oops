import React, { useEffect, useRef, useState } from 'react';
import NavIcon from '../NavIcon.jsx';
import { apiRequest } from '../../api.js';
import './ActivityDropdown.css';

const getActivityIcon = (type = '') => {
  if (/SLA|ESCALAT|DUPLICATE|CRITICAL|DISRUPTION/i.test(type)) return 'alert';
  if (/ASSIGN|COLLABOR|TRANSFER|TECHNICIAN/i.test(type)) return 'team';
  if (/RESOLV|CLOSED|ACKNOWLEDGED|VERIFIED/i.test(type)) return 'check';
  return 'file';
};

function timeAgo(value) {
  const timestamp = Date.parse(value || '');
  if (!timestamp) return 'Earlier';
  const minutes = Math.round((timestamp - Date.now()) / 60000);
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(minutes) < 1) return 'Just now';
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return relative.format(days, 'day');
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp);
}

export default function ActivityDropdown({ live, onOpen }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(Boolean(live));
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const refreshRef = useRef(() => {});

  useEffect(() => {
    if (!live) {
      setActivities([]);
      setLoading(false);
      return undefined;
    }

    let active = true;
    let hasLoaded = false;
    async function load() {
      try {
        const result = await apiRequest('notifications', { cache: 'no-store' });
        if (active) {
          setActivities(Array.isArray(result) ? result : []);
          setError('');
        }
      } catch {
        if (active) setError('Could not load your latest notifications.');
      } finally {
        if (active) {
          hasLoaded = true;
          setLoading(false);
        }
      }
    }

    refreshRef.current = () => {
      if (!hasLoaded) setLoading(true);
      load();
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);

    return () => {
      active = false;
      refreshRef.current = () => {};
      clearInterval(timer);
    };
  }, [live]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const sortedActivities = [...activities].sort((a, b) => Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''));
  const unreadCount = activities.filter((item) => !item.read).length;
  const visibleActivities = sortedActivities.slice(0, 5);
  const openInbox = () => {
    setIsOpen(false);
    onOpen?.();
  };

  return (
    <div className="activity-dropdown" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="ops-notification-shortcut activity-dropdown-trigger"
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen && live) refreshRef.current();
        }}
        title="Notifications"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="activity-dropdown-panel"
      >
        <NavIcon name="bell" />
        {unreadCount > 0 && <span className="ops-notification-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <section className="activity-dropdown-panel" id="activity-dropdown-panel" role="dialog" aria-labelledby="activity-dropdown-title">
          <header className="activity-dropdown-header">
            <div>
              <h2 id="activity-dropdown-title">Notifications</h2>
              <p>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'Updates about your support requests'}</p>
            </div>
            {unreadCount > 0 && <span className="activity-dropdown-count">{unreadCount} new</span>}
          </header>

          {!live ? (
            <p className="activity-dropdown-state">Sign in to see your latest updates.</p>
          ) : loading && !activities.length ? (
            <p className="activity-dropdown-state" role="status">Loading notifications…</p>
          ) : error && !activities.length ? (
            <div className="activity-dropdown-state" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => refreshRef.current()}>Try again</button>
            </div>
          ) : visibleActivities.length ? (
            <ul className="activity-dropdown-list">
              {visibleActivities.map((activity) => {
                const subject = activity.incidentTitle || activity.title || 'Support update';
                const description = activity.message || 'There is a new update on your support request.';
                return (
                  <li key={activity.id}>
                    <button
                      type="button"
                      className={`activity-dropdown-item${activity.read ? '' : ' is-unread'}`}
                      onClick={openInbox}
                      aria-label={`${activity.read ? '' : 'Unread notification: '}${subject}. ${description}. ${timeAgo(activity.timestamp)}. Open notifications`}
                    >
                      <span className="activity-dropdown-icon"><NavIcon name={getActivityIcon(activity.type)} size={16} /></span>
                      <span className="activity-dropdown-copy">
                        <span className="activity-dropdown-subject">{subject}</span>
                        <span className="activity-dropdown-description">{description}</span>
                      </span>
                      <time className="activity-dropdown-time" dateTime={activity.timestamp || undefined} title={activity.timestamp ? new Date(activity.timestamp).toLocaleString() : undefined}>
                        {timeAgo(activity.timestamp)}
                      </time>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="activity-dropdown-state">You’re all caught up. New support updates will appear here.</p>
          )}

          {live && error && activities.length > 0 && <p className="activity-dropdown-refresh-note" role="status">Showing saved updates. Refresh failed.</p>}
          <footer className="activity-dropdown-footer">
            <button type="button" onClick={openInbox}>View all notifications</button>
          </footer>
        </section>
      )}
    </div>
  );
}
