import React, { useEffect, useState } from 'react';
import { apiRequest } from './api.js';
const readableLabel = value => value ? value.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'Not provided';

export default function SuggestedSolutions({ incidentId }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setSuggestions([]);
    apiRequest(`incidents/${incidentId}/suggested-solutions`)
      .then(data => { if (active) setSuggestions(data); })
      .catch(problem => { if (active) setError(problem.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [incidentId]);

  return <section className="suggested-solutions report-form" aria-labelledby="suggested-solutions-title">
    <div className="dashboard-section-heading"><h3 id="suggested-solutions-title">Suggested Solutions / Knowledge Base</h3><span>Verified incident history</span></div>
    {loading ? <p role="status">Finding similar resolved incidents…</p>
      : error ? <p className="report-error" role="alert">Suggestions are unavailable: {error} You can continue investigating normally.</p>
        : !suggestions.length ? <p className="dashboard-empty">No similar resolved incidents found.</p>
          : <div className="suggested-solution-list">{suggestions.map(item => <article className="suggested-solution" key={item.incidentId}>
            <div className="dashboard-section-heading"><h4>{item.title}</h4><span className={`match-badge match-${item.relevance.toLowerCase()}`}>{readableLabel(item.relevance)} match</span></div>
            <p className="report-guidance">Incident {item.incidentId}{item.service ? ` · ${readableLabel(item.service)}` : ''}{item.category ? ` · ${readableLabel(item.category)}` : ''}</p>
            {item.symptoms && <p><strong>Previous symptoms:</strong> {item.symptoms}</p>}
            <details><summary>Expand resolution details</summary>
              {item.summary && <p><strong>Resolution summary:</strong> {item.summary}</p>}
              {item.steps && <div><strong>Troubleshooting steps</strong><p className="suggested-resolution-steps">{item.steps}</p></div>}
            </details>
          </article>)}</div>}
  </section>;
}
