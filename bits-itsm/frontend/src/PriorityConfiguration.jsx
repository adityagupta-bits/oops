import React, { useEffect, useState } from 'react';
import { apiRequest, apiSend } from './api.js';
import Badge from './components/ui/Badge.jsx';
import NavIcon from './components/NavIcon.jsx';

const levels = ['LOW', 'MEDIUM', 'HIGH'];
const priorities = ['P1', 'P2', 'P3', 'P4'];
const conditions = ['ALL_HIGH', 'HIGH_IMPACT_AND_URGENCY', 'CRITICAL_SERVICE', 'HIGH_IMPACT', 'HIGH_URGENCY'];
const label = (value) => value.replaceAll('_', ' ');

export default function PriorityConfiguration() {
  const [values, setValues] = useState(null);
  const [services, setServices] = useState([]);
  const [sample, setSample] = useState({ impact: 'MEDIUM', urgency: 'MEDIUM', affectedService: '' });
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest('admin/priority-strategy'), apiRequest('admin/catalog')])
      .then(([settings, catalog]) => {
        if (active) {
          setValues(settings);
          setServices(catalog.filter((item) => item.kind === 'SERVICE'));
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  function change(next) {
    setValues(next);
    setPreview(null);
    setMessage('');
  }

  function changeSample(next) {
    setSample(next);
    setPreview(null);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setPreview(null);
    try {
      if (event.nativeEvent.submitter?.value === 'preview') {
        if (!sample.affectedService) throw new Error('Select a service for the preview calculation.');
        setPreview(await apiSend('admin/priority-strategy/preview', { configuration: values, ...sample }));
      } else {
        setValues(await apiSend('admin/priority-strategy', values, 'PUT'));
        setMessage('Saved successfully. Future incident classifications will use these rules.');
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function changeRule(index, field, value) {
    change({
      ...values,
      rules: values.rules.map((rule, i) => (i === index ? { ...rule, [field]: value } : rule)),
    });
  }

  function moveRule(index, direction) {
    const rules = [...values.rules];
    [rules[index], rules[index + direction]] = [rules[index + direction], rules[index]];
    change({ ...values, rules });
  }

  const thresholds = values?.strategy === 'MULTIPLICATIVE' ? 'multiplicativeThresholds' : 'weightedThresholds';

  return (
    <section className="report-form admin-section priority-config-card">
      <div className="section-title-with-icon">
        <NavIcon name="sliders" />
        <h2>Incident Priority Calculation Engine (Strategy Pattern)</h2>
      </div>

      {!values ? (
        <div className="loading-state-box" role="status">
          <span className="spinner-border" aria-hidden="true" />
          <span>{message || 'Loading priority calculation strategy…'}</span>
          <button className="report-clear" onClick={() => setRetry(retry + 1)}>Retry</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
            <div className="report-field">
              <label htmlFor="priority-model">Calculation Strategy Model</label>
              <select
                id="priority-model"
                value={values.strategy}
                onChange={(event) => change({ ...values, strategy: event.target.value })}
              >
                {['MULTIPLICATIVE', 'WEIGHTED', 'MATRIX', 'RULE_BASED'].map((mode) => (
                  <option key={mode} value={mode}>{label(mode)}</option>
                ))}
              </select>
            </div>

            <p className="report-guidance">
              Criticality derives from Campus IT Services catalog. Priority is calculated in Java when an incident is submitted or reclassified.
            </p>

            {['MULTIPLICATIVE', 'WEIGHTED'].includes(values.strategy) && (
              <div className="calculation-model-box">
                <p>
                  {values.strategy === 'MULTIPLICATIVE'
                    ? 'Formula: Impact × Urgency × Criticality (Low=1, Medium=2, High=3). Range: 1–27.'
                    : 'Formula: 100 × Weighted Normalized Inputs (Low=0, Medium=0.5, High=1.0). Range: 0–100.'}
                </p>
                <div className="report-row">
                  {['p1', 'p2', 'p3'].map((key) => (
                    <div className="report-field" key={key}>
                      <label htmlFor={'threshold-' + key}>{key.toUpperCase()} Minimum Score</label>
                      <input
                        id={'threshold-' + key}
                        type="number"
                        step="any"
                        min="0.000001"
                        max={values.strategy === 'MULTIPLICATIVE' ? 27 : 100}
                        required
                        value={values[thresholds][key]}
                        onChange={(event) =>
                          change({
                            ...values,
                            [thresholds]: { ...values[thresholds], [key]: Number(event.target.value) },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {values.strategy === 'WEIGHTED' && (
              <div className="report-row">
                {['impactWeight', 'urgencyWeight', 'criticalityWeight'].map((key) => (
                  <div className="report-field" key={key}>
                    <label htmlFor={key}>{key.replace('Weight', ' Weight')}</label>
                    <input
                      id={key}
                      type="number"
                      min="0"
                      max="1"
                      step="any"
                      required
                      value={values[key]}
                      onChange={(event) => change({ ...values, [key]: Number(event.target.value) })}
                    />
                  </div>
                ))}
              </div>
            )}

            {values.strategy === 'MATRIX' && (
              <div className="matrix-model-box">
                <p className="report-guidance">
                  Impact (rows) vs Urgency (columns). Critical services can optionally boost priority by 1 level.
                </p>
                <div className="dashboard-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Impact / Urgency</th>
                        {levels.map((level) => (
                          <th key={level}>{level}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((impact, row) => (
                        <tr key={impact}>
                          <th>{impact}</th>
                          {levels.map((urgency, column) => {
                            const index = row * 3 + column;
                            return (
                              <td key={urgency}>
                                <select
                                  aria-label={`${impact} impact ${urgency} urgency`}
                                  value={values.matrix[index]}
                                  onChange={(event) =>
                                    change({
                                      ...values,
                                      matrix: values.matrix.map((val, i) => (i === index ? event.target.value : val)),
                                    })
                                  }
                                >
                                  {priorities.map((p) => (
                                    <option key={p}>{p}</option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="report-field" style={{ marginTop: '1rem' }}>
                  <label htmlFor="critical-boost">Critical Service Promotion Levels (0 to disable)</label>
                  <input
                    id="critical-boost"
                    type="number"
                    min="0"
                    max="3"
                    step="1"
                    required
                    value={values.criticalBoost}
                    onChange={(event) => change({ ...values, criticalBoost: Number(event.target.value) })}
                  />
                </div>
              </div>
            )}

            {values.strategy === 'RULE_BASED' && (
              <div className="rules-model-box">
                <p className="report-guidance">First matching condition determines priority; fallback applies if no rule matches.</p>
                {values.rules.map((rule, index) => (
                  <div className="report-row rule-row" key={index}>
                    <div className="report-field">
                      <label htmlFor={'rule-' + index}>Rule #{index + 1} Condition</label>
                      <select
                        id={'rule-' + index}
                        value={rule.condition}
                        onChange={(event) => changeRule(index, 'condition', event.target.value)}
                      >
                        {conditions.map((condition) => (
                          <option key={condition} value={condition}>{label(condition)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="report-field">
                      <label htmlFor={'rule-priority-' + index}>Target Priority</label>
                      <select
                        id={'rule-priority-' + index}
                        value={rule.priority}
                        onChange={(event) => changeRule(index, 'priority', event.target.value)}
                      >
                        {priorities.map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rule-reorder-actions">
                      <button type="button" className="report-clear" disabled={index === 0} onClick={() => moveRule(index, -1)}>
                        ↑
                      </button>
                      <button type="button" className="report-clear" disabled={index === values.rules.length - 1} onClick={() => moveRule(index, 1)}>
                        ↓
                      </button>
                      <button type="button" className="danger-button-sm" onClick={() => change({ ...values, rules: values.rules.filter((_, i) => i !== index) })}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="report-clear"
                  disabled={values.rules.length === conditions.length}
                  onClick={() =>
                    change({
                      ...values,
                      rules: [
                        ...values.rules,
                        {
                          condition: conditions.find((cond) => !values.rules.some((r) => r.condition === cond)),
                          priority: 'P2',
                        },
                      ],
                    })
                  }
                >
                  + Add Condition Rule
                </button>

                <div className="report-field" style={{ marginTop: '1rem' }}>
                  <label htmlFor="priority-fallback">Fallback Priority</label>
                  <select
                    id="priority-fallback"
                    value={values.fallback}
                    onChange={(event) => change({ ...values, fallback: event.target.value })}
                  >
                    {priorities.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="preview-calculator-box">
              <h3>Live Preview Calculator (Non-Destructive)</h3>
              <p className="report-guidance">Test priority calculation with sample inputs before saving to database.</p>
              <div className="report-row">
                {['impact', 'urgency'].map((key) => (
                  <div className="report-field" key={key}>
                    <label htmlFor={'preview-' + key}>{label(key)}</label>
                    <select
                      id={'preview-' + key}
                      value={sample[key]}
                      onChange={(event) => changeSample({ ...sample, [key]: event.target.value })}
                    >
                      {levels.map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="report-field">
                  <label htmlFor="preview-service">Campus IT Service</label>
                  <select
                    id="preview-service"
                    value={sample.affectedService}
                    onChange={(event) => changeSample({ ...sample, affectedService: event.target.value })}
                  >
                    <option value="">Select a service…</option>
                    {services.map((s) => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="report-actions">
              <button className="report-clear" value="preview">
                Calculate Preview
              </button>
              <button className="submit-button-sm" value="save">
                Save Strategy to Database
              </button>
            </div>
          </fieldset>

          {preview && (
            <div className="submission-result-card" role="status" style={{ marginTop: '1rem' }}>
              <h4>Preview Calculation Result:</h4>
              <p>
                Calculated Priority: <Badge value={preview.priority} type="priority" /> · Service Criticality: <strong>{preview.criticality}</strong>
              </p>
            </div>
          )}

          {message && <p className="status-message status-success" role="status">{message}</p>}
        </form>
      )}
    </section>
  );
}
