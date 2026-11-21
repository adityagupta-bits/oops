import React, { useEffect, useState } from 'react';
import { apiRequest } from './api.js';
import { readableLabel } from './MyIncidents.jsx';

const categories = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'DATABASE', 'CLOUD', 'SECURITY', 'AUTHENTICATION', 'APPLICATION', 'STORAGE', 'OTHER'];
const services = ['CAMPUS_WIFI', 'STUDENT_PORTAL', 'LIBRARY', 'LAB_COMPUTERS', 'EMAIL', 'CAMPUS_NETWORK', 'AUTHENTICATION', 'OTHER'];

export default function AdminKnowledgeBase() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [service, setService] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(event) {
    event?.preventDefault();
    setLoading(true); setError('');
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (category) params.set('category', category);
    if (service) params.set('service', service);
    try { setRecords(await apiRequest(`admin/knowledge${params.size ? `?${params}` : ''}`)); }
    catch (problem) { setError(problem.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return <section aria-labelledby="admin-knowledge-title">
    <div className="dashboard-welcome"><div><h2 id="admin-knowledge-title">Knowledge Base</h2><p>Browse sanitized fixes from verified and closed incidents. This view is read-only.</p></div></div>
    <form className="incident-filters" role="search" onSubmit={load}>
      <div className="report-field"><label htmlFor="admin-kb-search">Search historical fixes</label><input id="admin-kb-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Title, symptoms or resolution" /></div>
      <div className="report-field"><label htmlFor="admin-kb-category">Category</label><select id="admin-kb-category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{readableLabel(value)}</option>)}</select></div>
      <div className="report-field"><label htmlFor="admin-kb-service">Affected service</label><select id="admin-kb-service" value={service} onChange={event => setService(event.target.value)}><option value="">All services</option>{services.map(value => <option key={value} value={value}>{readableLabel(value)}</option>)}</select></div>
      <button className="incident-view" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
    </form>
    {error && <p className="report-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading documented fixes…</p> : records.length ? <div className="technician-articles">{records.map(item => <article className="report-form admin-section" key={item.incidentId}>
      <p className="report-guidance">Incident {item.incidentId}{item.category ? ` · ${readableLabel(item.category)}` : ''}{item.service ? ` · ${readableLabel(item.service)}` : ''}</p>
      <h3>{item.title}</h3>{item.symptoms && <p><strong>Symptoms:</strong> {item.symptoms}</p>}
      {item.summary && <p><strong>Resolution:</strong> {item.summary}</p>}
      {item.steps && <details><summary>View troubleshooting steps</summary><p>{item.steps}</p></details>}
    </article>)}</div> : <p className="dashboard-empty">No verified resolutions match these filters.</p>}
  </section>;
}
