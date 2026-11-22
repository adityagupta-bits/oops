import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest, apiPost } from './api.js';
import './IncidentConversation.css';

const STAFF_ROLES = new Set(['ADMIN', 'TECHNICIAN']);

function timeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date);
}

export default function IncidentConversation({ incidentId, role, initialChannel = 'student' }) {
  const staff = STAFF_ROLES.has(role);
  const [channel, setChannel] = useState(initialChannel);
  const [studentConversation, setStudentConversation] = useState(null);
  const [internalConversation, setInternalConversation] = useState(null);
  const [loading, setLoading] = useState({ student: true, internal: staff });
  const [errors, setErrors] = useState({ student: '', internal: '' });
  const [actionError, setActionError] = useState('');
  const [draft, setDraft] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeKey = staff && channel === 'internal' ? 'internal' : 'student';
  const conversation = activeKey === 'internal' ? internalConversation : studentConversation;
  const activeError = errors[activeKey];
  const messages = conversation?.messages || [];
  const pendingUnread = conversation?.unreadCount || 0;
  const panelId = `incident-conversation-${incidentId}-${activeKey}`;

  useEffect(() => {
    let active = true;
    let pending = false;
    const urls = staff
      ? { student: `incidents/${incidentId}/messages`, internal: `incidents/${incidentId}/internal-messages` }
      : { student: `incidents/${incidentId}/messages` };

    const load = async () => {
      if (!active || pending || document.hidden) return;
      pending = true;
      const results = await Promise.allSettled(Object.entries(urls).map(async ([key, url]) => [key, await apiRequest(url)]));
      if (active) {
        const nextErrors = { student: '', internal: '' };
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const [key, data] = result.value;
            if (key === 'student') setStudentConversation(data);
            else setInternalConversation(data);
          } else {
            const key = results.indexOf(result) === 0 ? 'student' : 'internal';
            nextErrors[key] = result.reason?.message || 'Unable to load this conversation.';
          }
        }
        setErrors(nextErrors);
        setLoading({ student: false, internal: false });
      }
      pending = false;
    };

    setLoading({ student: true, internal: staff });
    setErrors({ student: '', internal: '' });
    load();
    const timer = window.setInterval(load, 5000);
    const onVisibilityChange = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [incidentId, role, staff]);

  useEffect(() => { setActionError(''); }, [activeKey]);

  const groupedMessages = useMemo(() => messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const mine = message.senderId === conversation?.viewerId;
    return {
      ...message,
      mine,
      groupedBefore: previous?.senderId === message.senderId,
      groupedAfter: next?.senderId === message.senderId,
    };
  }), [messages, conversation?.viewerId]);

  async function refreshActive() {
    const path = activeKey === 'internal'
      ? `incidents/${incidentId}/internal-messages`
      : `incidents/${incidentId}/messages`;
    setLoading(previous => ({ ...previous, [activeKey]: true }));
    setErrors(previous => ({ ...previous, [activeKey]: '' }));
    try {
      const data = await apiRequest(path);
      if (activeKey === 'internal') setInternalConversation(data);
      else setStudentConversation(data);
    } catch (error) {
      setErrors(previous => ({ ...previous, [activeKey]: error.message }));
    } finally {
      setLoading(previous => ({ ...previous, [activeKey]: false }));
    }
  }

  async function markRead() {
    if (busy || pendingUnread === 0 || messages.length === 0) return;
    setBusy(true);
    setActionError('');
    setErrors(previous => ({ ...previous, [activeKey]: '' }));
    try {
      const path = activeKey === 'internal'
        ? `incidents/${incidentId}/internal-messages/read`
        : `incidents/${incidentId}/messages/read`;
      await apiPost(path, { messageId: messages[messages.length - 1].id });
      await refreshActive();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (busy || !content || content.length > 2000) return;
    setBusy(true);
    setActionError('');
    setErrors(previous => ({ ...previous, [activeKey]: '' }));
    try {
      const path = activeKey === 'internal'
        ? `incidents/${incidentId}/internal-messages`
        : `incidents/${incidentId}/messages`;
      const body = activeKey === 'internal' ? { content, urgent } : { content };
      const saved = await apiPost(path, body);
      if (activeKey === 'internal') setInternalConversation(saved);
      else setStudentConversation(saved);
      setDraft('');
      setUrgent(false);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="student-detail-section incident-conversation" aria-label="Incident communication">
      <header className="conversation-header">
        <div>
          <h3>Communication</h3>
          <p>{staff ? 'Internal chat is visible only to administrators, the assigned technician and collaborators on this incident. Students cannot see internal messages.' : 'Messages are shared with your assigned incident technician.'}</p>
        </div>
        {pendingUnread > 0 && (
          <button type="button" className="conversation-read-action" onClick={markRead} disabled={busy}>
            Mark {pendingUnread} as read
          </button>
        )}
      </header>

      {staff ? (
        <div className="conversation-tabs" role="tablist" aria-label="Incident conversations">
          <button id={`student-tab-${incidentId}`} type="button" role="tab" aria-selected={channel === 'student'}
            aria-controls={`incident-conversation-${incidentId}-student`} onClick={() => setChannel('student')}>
            Student Conversation
          </button>
          <button id={`internal-tab-${incidentId}`} type="button" role="tab" aria-selected={channel === 'internal'}
            aria-controls={`incident-conversation-${incidentId}-internal`} onClick={() => setChannel('internal')}>
            Internal Staff Chat
            {(internalConversation?.unreadCount || 0) > 0 && <span className="conversation-unread-count">{internalConversation.unreadCount}</span>}
          </button>
        </div>
      ) : (
        <div className="conversation-student-label">Student Conversation</div>
      )}

      <div id={panelId} className="conversation-panel" role={staff ? 'tabpanel' : undefined}
        aria-labelledby={staff ? `${activeKey}-tab-${incidentId}` : undefined}>
        {activeError ? (
          <div className="conversation-state conversation-state-error" role="alert">
            <p>{activeError}</p>
            <button type="button" onClick={refreshActive}>Try again</button>
          </div>
        ) : loading[activeKey] && !conversation ? (
          <p className="conversation-state" role="status">Loading conversation…</p>
        ) : (
          <ol className="conversation-messages" aria-label={activeKey === 'internal' ? 'Internal staff messages' : 'Student conversation messages'}>
            {groupedMessages.map(message => (
              <li key={message.id} className={`conversation-message${message.mine ? ' is-mine' : ''}${message.groupedBefore ? ' is-grouped' : ''}`}>
                {!message.groupedBefore && (
                  <div className="conversation-message-meta">
                    <span className="conversation-sender">{message.mine ? 'You' : message.sender}</span>
                    <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
                    {message.unread && <span className="conversation-new-indicator">Unread</span>}
                  </div>
                )}
                <div className="conversation-bubble">
                  {activeKey === 'internal' && message.urgent && <span className="conversation-urgent">Urgent</span>}
                  <p>{message.content}</p>
                </div>
                {message.mine && !message.groupedAfter && activeKey === 'internal' && (
                  <span className="conversation-delivery">{message.readBy?.length ? `Read by ${message.readBy.join(', ')}` : 'Sent'}</span>
                )}
              </li>
            ))}
            {messages.length === 0 && <li className="conversation-empty">No messages yet. Use the message field below to share an update or ask a question.</li>}
          </ol>
        )}

        {conversation?.canSend ? (
          <form className="conversation-composer" onSubmit={send}>
            {activeKey === 'internal' && role === 'ADMIN' && (
              <label className="conversation-urgent-toggle">
                <input type="checkbox" checked={urgent} onChange={event => setUrgent(event.target.checked)} disabled={busy} />
                Mark this instruction urgent
              </label>
            )}
            <label className="visually-hidden" htmlFor={`conversation-draft-${incidentId}-${activeKey}`}>
              {activeKey === 'internal' ? 'Message the incident team' : 'Message the incident team'}
            </label>
            <textarea id={`conversation-draft-${incidentId}-${activeKey}`} rows={2} required maxLength={2000}
              value={draft} onChange={event => setDraft(event.target.value)} disabled={busy}
              placeholder={activeKey === 'internal' ? 'Write a private staff message…' : 'Write a message to the incident team…'} />
            <div className="conversation-composer-footer">
              <span>{draft.length}/2000</span>
              <button type="submit" disabled={busy || !draft.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
            </div>
            {actionError && <p className="conversation-error" role="alert">{actionError}</p>}
          </form>
        ) : conversation && (
          <p className="conversation-closed-note">Messaging is available after technician assignment and before incident closure.</p>
        )}
      </div>
    </section>
  );
}
