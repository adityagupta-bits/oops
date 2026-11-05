import React, { useEffect, useRef, useState } from 'react';
import Notifications from '../Notifications.jsx';
import { readableLabel } from '../MyIncidents.jsx';
import { knowledgeArticles, technicianNotifications } from '../demoData.js';

export function KnowledgeBase({ incidents, accessibleIds, onView }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const heading = useRef(null);
  const article = knowledgeArticles.find((item) => item.id === selectedId);
  const query = search.trim().toLowerCase();
  const filtered = knowledgeArticles.filter((item) => (!category || item.category === category) &&
    `${item.title} ${item.category} ${item.keywords.join(' ')} ${item.relatedService}`.toLowerCase().includes(query));
  const verified = incidents.filter((incident) => ['VERIFIED', 'CLOSED'].includes(incident.status) && incident.resolution);

  useEffect(() => { heading.current?.focus(); }, [selectedId]);

  function incidentLink(id) {
    return accessibleIds.includes(id)
      ? <button key={id} type="button" className="incident-view" onClick={() => onView(id)}>View {id}</button>
      : <span key={id}>{id} · Not assigned to this demo technician</span>;
  }

  if (article) return <>
    <div className="dashboard-welcome"><div><h2 ref={heading} tabIndex={-1}>{article.title}</h2><p>{article.id} · Approved demonstration article</p></div><button type="button" className="report-clear" onClick={() => setSelectedId(null)}>Back to Knowledge Base</button></div>
    <section className="report-form technician-section" aria-label="Knowledge article details">
      <dl className="incident-details">
        <div><dt>Category</dt><dd>{readableLabel(article.category)}</dd></div><div><dt>Related Service</dt><dd>{article.relatedService}</dd></div>
        <div><dt>Verification / Approval Status</dt><dd>{readableLabel(article.approvalStatus)} · Fictional example</dd></div><div><dt>Last Updated</dt><dd><time dateTime={article.updatedAt}>{article.updatedAt}</time></dd></div>
      </dl>
      <h3>Problem Summary</h3><p className="technician-description">{article.problem}</p>
      <h3>Troubleshooting Steps</h3><ol className="technician-updates">{article.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <h3>Related Incidents</h3><div className="technician-resource-links">{article.relatedIncidentIds.length ? article.relatedIncidentIds.map(incidentLink) : <p className="report-guidance">No linked demo incidents.</p>}</div>
    </section>
  </>;

  return <>
    <div className="dashboard-welcome"><div><h2 ref={heading} tabIndex={-1}>IT Knowledge Base</h2><p>Find previous solutions and troubleshooting information for common campus IT problems.</p></div></div>
    <div className="incident-filters" role="search" aria-label="Search knowledge articles">
      <div className="report-field"><label htmlFor="knowledge-search">Search articles</label><input id="knowledge-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, category, keywords or service" /></div>
      <div className="report-field"><label htmlFor="knowledge-category">Category</label><select id="knowledge-category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{[...new Set(knowledgeArticles.map((item) => item.category))].sort().map((value) => <option key={value} value={value}>{readableLabel(value)}</option>)}</select></div>
      <button type="button" className="report-clear" onClick={() => { setSearch(''); setCategory(''); }}>Clear Filters</button>
    </div>
    <p className="report-guidance" role="status">{filtered.length} of {knowledgeArticles.length} approved demo articles</p>
    <div className="technician-articles">
      {filtered.map((item) => <article key={item.id} className="report-form technician-section"><p className="report-guidance">{item.id} · {readableLabel(item.category)} · {item.relatedService}</p><h3>{item.title}</h3><p className="technician-description">{item.problem}</p><p className="report-guidance">Updated <time dateTime={item.updatedAt}>{item.updatedAt}</time></p><button type="button" className="incident-view" onClick={() => setSelectedId(item.id)} aria-label={`Read ${item.title}`}>Read Article</button></article>)}
    </div>
    {!filtered.length && <p className="dashboard-empty">No articles match your search or filters.</p>}
    <section className="report-form technician-section" aria-labelledby="verified-solutions-title">
      <h2 id="verified-solutions-title">Previously Resolved Incidents</h2><p className="report-guidance">Verified or closed examples from the shared incident records. Details open for your primary or collaboration assignments.</p>
      {verified.length ? <ul className="technician-updates">{verified.map((incident) => <li key={incident.id}><strong>{incident.id} · {incident.title}</strong><p>{incident.resolution}</p><p>{readableLabel(incident.status)}</p>{incidentLink(incident.id)}</li>)}</ul> : <p className="report-guidance">No verified solutions recorded yet.</p>}
    </section>
    <section className="report-form technician-section" aria-labelledby="rag-preview-title">
      <h2 id="rag-preview-title">AI-Assisted Resolution Suggestions</h2><p className="technician-description">Find relevant solutions from previous incidents and approved troubleshooting documents.</p><button type="button" className="report-clear" disabled>Generate Suggested Resolution — Coming Soon</button><p className="report-guidance technician-sla-note">Future integration: Spring AI and PostgreSQL with pgvector. No suggestions are generated in this preview.</p>
    </section>
  </>;
}

export function NotificationCenter({ technicianId, accessibleIds, readIds, onRead, onView }) {
  return <Notifications records={technicianNotifications.filter((item) => item.technicianId === technicianId)} readIds={readIds} onRead={onRead} onOpen={(item) => onView(item.incidentId)} canOpen={(item) => accessibleIds.includes(item.incidentId)} />;
}
