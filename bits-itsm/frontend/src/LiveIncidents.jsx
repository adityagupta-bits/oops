import React, { useEffect, useState } from 'react';
import MyIncidents from './MyIncidents.jsx';
import { apiRequest, apiPost } from './api.js';

export default function LiveIncidents({ role, team = false, initialIncidentId }) {
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

  async function action(id, name, payload) {
    const result = await apiPost(`incidents/${id}/${name}`, payload);
    // Transfer and collaboration APIs return a request, so fetch the incident again.
    const isRequest = name.endsWith('-requests');
    const updated = isRequest ? await apiRequest(`incidents/${id}`) : result;
    setIncidents(previous => previous.map(incident => incident.id === updated.id ? updated : incident));
    return { incident: updated, request: isRequest ? result : null };
  }

  return <>
    <div className="report-actions"><button className="report-clear" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Refresh Incidents</button></div>
    {loading ? <p role="status">Loading incidents…</p> : error ? <p className="report-error" role="alert">{error}</p> : <MyIncidents initialIncidentId={initialIncidentId} incidents={incidents} liveRole={role} team={team} options={options} onAction={action} />}
  </>;
}
