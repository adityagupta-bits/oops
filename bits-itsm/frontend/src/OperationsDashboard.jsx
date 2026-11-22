import React, { useEffect, useState } from 'react';
import { apiRequest } from './api.js';
import IncidentReportsChart from './IncidentReportsChart.jsx';
import SlaCountdown from './components/SlaCountdown.jsx';
import Badge from './components/ui/Badge.jsx';
import NavIcon from './components/NavIcon.jsx';
import './operationsDashboard.css';

const label = value => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const active = incident => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(incident.status);
function Panel({ title, action, children, className = '' }) {
  return <section className={`ops-panel ${className}`}><header><h3>{title}</h3>{action}</header>{children}</section>;
}

export default function OperationsDashboard({ role, onNavigate, availability }) {
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [updated, setUpdated] = useState(null);
  const admin = role === 'ADMIN', tech = role === 'TECHNICIAN';
  const incidentPage = admin ? 'All Incidents' : tech ? 'assigned' : 'incidents';
  const notificationsPage = admin ? 'Notifications' : 'notifications';
  useEffect(() => {
    let mounted = true, pending = false;
    const endpoints = { incidents: role === 'STUDENT' ? 'incidents/my' : 'incidents', notifications: 'notifications',
      ...(admin ? { workforce: 'admin/technicians/workloads', catalog: 'admin/catalog', users: 'admin/users', audit: 'admin/audit', transfers: 'admin/transfer-requests', collaborations: 'admin/collaboration-requests', escalations: 'admin/escalations' }
        : tech ? { workforce: 'technician/workload', transfers: 'technician/transfer-requests', collaborations: 'technician/collaboration-requests' } : { options: 'incidents/options' }) };
    async function load() {
      if (pending) return;
      pending = true;
      const entries = Object.entries(endpoints);
      const results = await Promise.allSettled(entries.map(([, endpoint]) => apiRequest(endpoint)));
      if (mounted) {
        const next = {}, failures = {};
        results.forEach((result, i) => { const key = entries[i][0]; if (result.status === 'fulfilled') next[key] = result.value; else failures[key] = result.reason.message; });
        setData(next); setErrors(failures); setUpdated(new Date()); setLoading(false);
      }
      pending = false;
    }
    setLoading(true); load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => { mounted = false; clearInterval(timer); };
  }, [role, refresh]);
  const go = page => <button type="button" onClick={() => onNavigate(page)}>View all <span aria-hidden="true">→</span></button>;
  const failure = key => errors[key] ? <p className="ops-error" role="alert">Unable to load this section: {errors[key]}</p> : null;
  const incidents = data.incidents || [];
  const open = incidents.filter(active);
  const breaches = open.filter(i => i.responseSla === 'BREACHED' || i.resolutionSla === 'BREACHED');
  const atRisk = open.filter(i => !breaches.includes(i) && (i.responseSla === 'AT_RISK' || i.resolutionSla === 'AT_RISK'));
  const workforce = admin ? data.workforce || [] : data.workforce ? [{ ...data.workforce, availability: availability ?? data.workforce.availability }] : [];
  const available = workforce.filter(t => t.enabled && t.availability === 'AVAILABLE');
  const services = (data.catalog || []).filter(c => c.kind === 'SERVICE');
  const configured = services.filter(s => s.enabled && s.criticality);
  const unread = (data.notifications || []).filter(n => !n.read).length;
  const metrics = admin ? [
    ['Open incidents', open.length, 'Across campus', incidentPage, 'incidents', 'list'],
    ['Available technicians', available.length, `${workforce.length} technicians in total`, 'Manage Technicians', 'workforce', 'team'],
    ['Enabled services', configured.length, `${services.length} services in the catalog`, 'IT Services', 'catalog', 'server'],
    ['Active accounts', (data.users || []).filter(u => u.enabled).length, `${(data.users || []).length} accounts in total`, 'Manage Users', 'users', 'user'],
  ] : [
    [tech ? 'Active assignments' : 'Open reports', open.length, tech ? 'Your assigned workload' : 'Your support requests', incidentPage, 'incidents', 'list'],
    ['Awaiting verification', incidents.filter(i => i.status === 'RESOLVED').length, 'Resolution ready for review', incidentPage, 'incidents', 'review'],
    tech ? ['SLA at risk', atRisk.length, `${breaches.length} currently overdue`, incidentPage, 'incidents', 'alert'] : ['Completed reports', incidents.filter(i => ['VERIFIED', 'CLOSED'].includes(i.status)).length, 'Your verified and closed reports', incidentPage, 'incidents', 'check'],
    ['Unread notifications', unread, 'Updates for your account', notificationsPage, 'notifications', 'bell'],
  ];
  const queue = [...open].sort((a, b) => {
    const rank = i => breaches.includes(i) ? 0 : i.priority === 'P1' ? 1 : i.needsClassificationReview ? 2 : 3;
    return rank(a) - rank(b) || new Date(a.createdAt) - new Date(b.createdAt);
  }).slice(0, 5);
  if (loading) return <div className="ops-loading" role="status">Loading your support overview…</div>;
  if (role === 'STUDENT') {
    const awaiting = incidents.filter(i => i.status === 'RESOLVED');
    const recent = [...incidents].sort((a,b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0,5);
    return <div className="ops-dashboard student-support-home">
      <header className="student-support-heading"><div><h2>Your IT support</h2><p>Get help and keep track of your requests.</p></div><button type="button" className="ops-primary" onClick={() => onNavigate('report')}>Report a problem</button></header>
      <div className="student-support-summary">
        <div><span>Open requests</span><strong>{errors.incidents ? '-' : open.length}</strong></div>
        <div><span>Ready to review</span><strong>{errors.incidents ? '-' : awaiting.length}</strong></div>
        <div><span>Closed requests</span><strong>{errors.incidents ? '-' : incidents.filter(i => ['VERIFIED','CLOSED'].includes(i.status)).length}</strong></div>
      </div>
      {awaiting.length > 0 && !errors.incidents && <section className="student-resolution-notice"><div className="student-resolution-body"><span className="student-resolution-icon"><NavIcon name="review" size={17} /></span><div><h3>{awaiting.length === 1 ? 'A resolution is ready for your review' : 'You have resolutions to review'}</h3><p>Check whether the suggested fix worked and let your technician know.</p></div></div><button type="button" className="report-clear" onClick={() => onNavigate('incidents')}>Review resolutions</button></section>}
      <div className="student-support-columns">
        <Panel title="Your recent requests" action={go('incidents')}>
          {failure('incidents') || (recent.length ? <ul className="student-request-list">{recent.map(i => <li key={i.id}><div><strong>{i.title}</strong><small>Reported {new Date(i.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</small></div><Badge status={i.status} /></li>)}</ul> : <p className="ops-empty">No requests yet. Report a problem when you need help with campus IT.</p>)}
        </Panel>
        <Panel title="Support updates" action={go('notifications')}>
          {failure('notifications') || ((data.notifications || []).length ? <div className="ops-updates">{[...data.notifications].sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp)).slice(0,4).map(n => <button type="button" key={n.id} onClick={() => onNavigate('notifications')}><i className={`ops-dot ${n.read ? '' : 'ops-dot-blue'}`} /><div><strong>{n.incidentTitle || n.title}</strong><small>{n.title}</small></div></button>)}</div> : <p className="ops-empty">Updates from your support team will appear here.</p>)}
        </Panel>
      </div>
      <details className="student-report-history"><summary>Your reporting history</summary>{failure('incidents') || <IncidentReportsChart incidents={incidents} role={role} />}</details>
      <div className="student-support-footer"><span>Updated {updated?.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span><button type="button" onClick={() => setRefresh(n => n+1)}>Refresh</button></div>
    </div>;
  }
  return <div className="ops-dashboard">
    <header className="ops-heading"><div><span className="ops-eyebrow">{admin ? 'CAMPUS OPERATIONS' : tech ? 'YOUR WORKSPACE' : 'CAMPUS IT SUPPORT'}</span><h2>{admin ? 'Support overview' : tech ? 'Your support workspace' : 'Your support overview'}</h2><p>{admin ? 'Service readiness, team capacity and the work that needs attention.' : tech ? 'Your assignments, deadlines and team requests in one place.' : 'Track your requests, support updates and next steps.'}</p></div><div className="ops-header-actions"><div className="ops-refresh"><button type="button" onClick={() => setRefresh(n => n + 1)}>Refresh overview</button><small>Updated {updated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div></div></header>
    <div className="ops-metrics">{metrics.map(([title, count, detail, page, source, icon]) => <button type="button" className="ops-metric" key={title} onClick={() => onNavigate(page)}><span className="ops-metric-heading"><span className="ops-metric-icon"><NavIcon name={icon} size={16} /></span><span>{title}</span></span><strong>{errors[source] ? '—' : count}</strong><small>{errors[source] ? 'Data unavailable' : detail}</small><span className="ops-metric-arrow" aria-hidden="true">↗</span></button>)}</div>
    <div className={`ops-main-grid${admin || tech ? '' : ' ops-main-grid--single'}`}>
      <div className="ops-trend">{failure('incidents') || <IncidentReportsChart incidents={incidents} role={role} />}</div>
      {(admin || tech) && <Panel title="Needs attention" className="ops-attention" action={!errors.incidents && breaches.length + atRisk.length > 0 ? <span className="ops-attention-status"><i className="ops-dot ops-dot-amber" />{breaches.length + atRisk.length} active</span> : null}>
        {failure('incidents') || <><button className={breaches.length ? 'ops-attention-critical' : ''} onClick={() => onNavigate(incidentPage)}><span><i className="ops-dot ops-dot-red" />SLA breached</span><strong>{breaches.length}</strong></button><button className={atRisk.length ? 'ops-attention-warning' : ''} onClick={() => onNavigate(incidentPage)}><span><i className="ops-dot ops-dot-amber" />SLA at risk</span><strong>{atRisk.length}</strong></button><button onClick={() => onNavigate(admin ? 'Classification Review' : incidentPage)}><span>Classification review</span><strong>{open.filter(i => i.needsClassificationReview).length}</strong></button><button onClick={() => onNavigate(incidentPage)}><span>Pending assignment</span><strong>{open.filter(i => i.status === 'CLASSIFIED' && !i.assignedTechnician).length}</strong></button><button onClick={() => onNavigate(incidentPage)}><span>Critical priority · P1</span><strong>{open.filter(i => i.priority === 'P1').length}</strong></button></>}
        {admin && (failure('escalations') || <button onClick={() => onNavigate('Escalations')}><span>Recorded escalations</span><strong>{(data.escalations || []).length}</strong></button>)}
      </Panel>}
    </div>
    <div className={`ops-main-grid${admin || tech ? '' : ' ops-main-grid--single'}`}>
      <Panel title={admin ? 'Technician availability & capacity' : tech ? 'Your capacity' : 'Support services'} action={go(admin ? 'Manage Technicians' : tech ? 'workload' : 'report')}>
        {admin || tech ? failure('workforce') || <><div className="ops-team-summary"><span><b>{available.length}</b> available</span><span><b>{workforce.filter(t => t.enabled && t.availability === 'BUSY').length}</b> busy</span><span><b>{workforce.filter(t => !t.enabled || t.availability === 'UNAVAILABLE').length}</b> unavailable / inactive</span></div><div className="ops-team-list">{workforce.length ? workforce.map(t => <div className="ops-team-row" key={t.id}><div className="ops-avatar" aria-hidden="true">{t.name.slice(0, 2).toUpperCase()}</div><div className="ops-team-name"><strong>{t.name}</strong><small>{(t.skills || []).map(label).join(' · ')}</small></div><div className="ops-capacity"><small>{label(t.enabled ? t.availability : 'INACTIVE')} · {t.total}/{t.maxWorkload}</small><progress value={t.total} max={Math.max(t.maxWorkload, t.total, 1)} aria-label={`${t.name}: ${t.total} active assignments, capacity ${t.maxWorkload}`} /></div></div>) : <p className="ops-empty">No technician accounts available.</p>}</div></> : failure('options') || <><p className="ops-muted">Choose Report an Incident to get help with an available campus service.</p><div className="ops-service-list">{(data.options?.services || []).map(s => <span key={s.value}>{s.label}</span>)}</div>{!data.options?.services?.length && <p className="ops-empty">No configured services are currently available.</p>}<button className="ops-primary" onClick={() => onNavigate('report')}>Report an incident →</button></>}
      </Panel>
      {(admin || tech) && <Panel title="Priority distribution" action={go(incidentPage)}>{failure('incidents') || <><p className="ops-muted">Current open incidents · {open.length} total</p>{[['P1', 'Critical'], ['P2', 'High'], ['P3', 'Medium'], ['P4', 'Low'], ['PENDING', 'Pending classification']].map(([key, name]) => { const count = open.filter(i => (i.priority || 'PENDING') === key).length; return <div className="ops-distribution" key={key}><div><span>{key === 'PENDING' ? name : `${key} · ${name}`}</span><strong>{count}</strong></div><progress value={count} max={Math.max(open.length, 1)} aria-label={`${name}: ${count}`} /></div>; })}</>}</Panel>}
    </div>
    <div className={`ops-main-grid${admin || tech ? '' : ' ops-main-grid--single'}`}>
      {(admin || tech) && <Panel title="Work queue" action={go(incidentPage)}>{failure('incidents') || (queue.length ? <div className="ops-queue">{queue.map(i => <button key={i.id} onClick={() => onNavigate(incidentPage)}><div><strong>{i.title}</strong><small>#{i.id} · {label(i.status)} · {i.assignedTechnician?.name || 'Unassigned'}</small></div><span><b>{i.priority === 'PENDING' ? 'Pending' : i.priority}</b><SlaCountdown incident={i} /></span></button>)}</div> : <div className="ops-empty"><strong>No open work</strong><p>New requests will appear here when they are reported.</p></div>)}</Panel>}
      <Panel title="Latest notifications" action={go(notificationsPage)}>{failure('notifications') || ((data.notifications || []).length ? <div className="ops-updates">{[...data.notifications].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4).map(n => <button key={n.id} onClick={() => onNavigate(notificationsPage)}><i className={`ops-dot ${n.read ? '' : 'ops-dot-blue'}`} /><div><strong>{n.incidentTitle || n.title}</strong><small>{n.title} · {new Date(n.timestamp).toLocaleString()}</small></div></button>)}</div> : <p className="ops-empty">No updates yet. Incident and support notifications will appear here.</p>)}</Panel>
    </div>
    <div className={`ops-main-grid${admin || tech ? '' : ' ops-main-grid--single'}`}>
      {admin ? <Panel title="Service readiness" action={go('IT Services')}>{failure('catalog') || <div className="ops-service-readiness">{services.map(s => <div key={s.code}><strong>{s.label}</strong><span className={s.enabled && s.criticality ? 'ops-ready' : 'ops-muted'}>{s.enabled ? s.criticality ? `Enabled · ${label(s.criticality)} criticality` : 'Criticality required' : 'Disabled'}</span></div>)}</div>}</Panel> : <Panel title="Request progress" action={go(incidentPage)}>{failure('incidents') || <div className="ops-service-readiness">{['NEW','CLASSIFIED','ASSIGNED','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','VERIFIED','CLOSED'].map(status => <div key={status}><span>{label(status)}</span><strong>{incidents.filter(i => i.status === status).length}</strong></div>)}</div>}</Panel>}
      {admin || tech ? <Panel title="Team requests" action={go(admin ? 'Transfer Requests' : 'transfers')}><div className="ops-request-counts">{failure('transfers') || <div><strong>{(data.transfers || []).filter(r => r.status === 'PENDING').length}</strong><span>Pending transfers</span></div>}{failure('collaborations') || <div><strong>{(data.collaborations || []).filter(r => r.status === 'PENDING').length}</strong><span>Pending collaborations</span></div>}</div><p className="ops-muted">Requests requiring a decision. Normal incident processing continues automatically.</p><div className="ops-shortcuts"><button onClick={() => onNavigate(admin ? 'Transfer Requests' : 'transfers')}>Review transfers →</button><button onClick={() => onNavigate(admin ? 'Collaboration Requests' : 'team')}>View collaboration →</button></div></Panel> : null}
    </div>
    {admin && <Panel title="Recent administration activity" action={go('Audit Logs')}>{failure('audit') || ((data.audit || []).length ? <div className="ops-audit">{[...data.audit].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5).map(a => <div key={a.id}><span>{label(a.action)}</span><p>{a.description}</p><time>{new Date(a.timestamp).toLocaleString()}</time></div>)}</div> : <p className="ops-empty">No recorded activity.</p>)}</Panel>}
  </div>;
}
