import React, { useEffect, useState } from 'react';
import NavIcon from './NavIcon.jsx';
import { apiRequest } from '../api.js';

export default function NotificationShortcut({ live, onOpen }) {
  const [unread, setUnread] = useState(null);
  useEffect(() => {
    if (!live) return;
    let active = true;
    async function load() {
      try {
        const items = await apiRequest('notifications');
        if (active) setUnread(items.filter(item => !item.read).length);
      } catch { if (active) setUnread(null); }
    }
    load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [live]);
  return <button type="button" className="ops-notification-shortcut" onClick={onOpen} title="Notifications" aria-label={unread === null ? 'Open notifications' : `Open notifications, ${unread} unread`}>
    <NavIcon name="bell" />
    {unread > 0 && <span className="ops-notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </button>;
}
