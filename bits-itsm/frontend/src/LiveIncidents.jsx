import React, { useEffect, useState } from 'react';
import MyIncidents from './MyIncidents.jsx';
import { apiRequest, apiPost } from './api.js';

export default function LiveIncidents({ role, team = false, initialIncidentId, title, dashboard = false }) {
  const [incidents, setIncidents] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    // Ignore a late response if the user has already left this page.
    let active = true;
    setLoading(true); setError('');
    Promise.all([apiRequest(team ? 'technician/team-incidents' : role === 'STUDENT' ? 'incidents/my' : 'incidents'), apiRequest('incidents/options')])
      .then(([records, choices]) => { if (active) { setIncidents(records); setOptions(choices); } })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, team, refresh]);

  useEffect(() => {
    let active = true;
    let pending = false;
    const timer = setInterval(async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const records = await apiRequest(team ? 'technician/team-incidents' : role === 'STUDENT' ? 'incidents/my' : 'incidents');
        if (active) { setIncidents(records); setError(''); }
      } catch (failure) { if (active) setError(failure.message); }
      finally { pending = false; }
    }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [role, team]);

  async function action(id, name, payload) {
    const result = await apiPost(`incidents/${id}/${name}`, payload);
    // Transfer and collaboration APIs return a request, so fetch the incident again.
    const isRequest = name.endsWith('-requests');
    const updated = isRequest ? await apiRequest(`incidents/${id}`) : result;
    setIncidents(previous => previous.map(incident => incident.id === updated.id ? updated : incident));
    return { incident: updated, request: isRequest ? result : null };
  }

  return <>
    <div className="report-actions live-incidents-actions"><button className="report-clear" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh Incidents</button></div>
    {role === 'ADMIN' && !loading && !error && <div className="report-actions" aria-label="Incident queues">
      <span>Awaiting classification: {incidents.filter(i => i.needsClassificationReview).length}</span>
      <span>Awaiting eligible technician: {incidents.filter(i => i.status === 'CLASSIFIED' && !i.assignedTechnician).length}</span>
      <span>Critical priority: {incidents.filter(i => i.priority === 'P1' && !['RESOLVED','VERIFIED','CLOSED'].includes(i.status)).length}</span>
    </div>}
    {loading ? <p role="status">Loading incidents…</p> : error ? <p className="report-error" role="alert">{error}</p> : <MyIncidents initialIncidentId={initialIncidentId} incidents={incidents} liveRole={role} team={team} options={options} onAction={action} titleOverride={title} dashboard={dashboard} />}
  </>;
}
