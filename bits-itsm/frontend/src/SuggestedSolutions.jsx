import React, { useEffect, useState } from 'react';
import { apiRequest } from './api.js';
import NavIcon from './components/NavIcon.jsx';

const readableLabel = (value) =>
  value
    ? value
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Not provided';

export default function SuggestedSolutions({ incidentId }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSuggestions([]);
    apiRequest(`incidents/${incidentId}/suggested-solutions`)
      .then((data) => {
        if (active) setSuggestions(data);
      })
      .catch((problem) => {
        if (active) setError(problem.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [incidentId]);

  return (
    <section className="suggested-solutions report-form admin-section" aria-labelledby="suggested-solutions-title">
      <div className="dashboard-section-heading">
        <div className="section-title-with-icon">
          <NavIcon name="lightbulb" />
          <h3 id="suggested-solutions-title">AI Suggested Solutions &amp; Knowledge Base</h3>
        </div>
        <span className="results-counter-pill">Verified resolution history</span>
      </div>

      {loading ? (
        <div className="loading-state-box" role="status">
          <span className="spinner-border spinner-sm" aria-hidden="true" />
          <span>Finding similar resolved campus incidents…</span>
        </div>
      ) : error ? (
        <p className="report-guidance text-warning" role="alert">
          Suggestions unavailable: {error}. You can continue investigating normally.
        </p>
      ) : !suggestions.length ? (
        <div className="empty-state-panel compact">
          <p>No similar historical resolutions found for this incident type.</p>
        </div>
      ) : (
        <div className="suggested-solution-list">
          {suggestions.map((item) => (
            <article className="suggested-solution-card" key={item.incidentId}>
              <div className="suggested-header">
                <h4>{item.title}</h4>
                <span className={`match-badge match-${item.relevance?.toLowerCase() || 'medium'}`}>
                  {readableLabel(item.relevance || 'MEDIUM')} Match
                </span>
              </div>
              <p className="report-guidance">
                Incident #{item.incidentId}
                {item.service ? ` · ${readableLabel(item.service)}` : ''}
                {item.category ? ` · ${readableLabel(item.category)}` : ''}
              </p>
              {item.symptoms && (
                <p className="suggested-symptoms">
                  <strong>Previous Symptoms:</strong> {item.symptoms}
                </p>
              )}
              <details className="suggested-details-disclosure">
                <summary>Expand Verified Resolution Details</summary>
                {item.summary && (
                  <p className="suggested-summary">
                    <strong>Resolution Summary:</strong> {item.summary}
                  </p>
                )}
                {item.steps && (
                  <div>
                    <strong>Troubleshooting Steps:</strong>
                    <p className="suggested-resolution-steps">{item.steps}</p>
                  </div>
                )}
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
