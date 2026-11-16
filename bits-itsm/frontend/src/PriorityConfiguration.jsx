import React, { useEffect, useState } from 'react';
import { apiRequest, apiSend } from './api.js';

const levels = ['LOW', 'MEDIUM', 'HIGH'];
const priorities = ['P1', 'P2', 'P3', 'P4'];
const conditions = ['ALL_HIGH', 'HIGH_IMPACT_AND_URGENCY', 'CRITICAL_SERVICE', 'HIGH_IMPACT', 'HIGH_URGENCY'];
const label = value => value.replaceAll('_', ' ');

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
    Promise.all([apiRequest('admin/priority-strategy'), apiRequest('admin/catalog')]).then(([settings, catalog]) => {
      if (active) { setValues(settings); setServices(catalog.filter(item => item.kind === 'SERVICE')); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [retry]);
  function change(next) { setValues(next); setPreview(null); setMessage(''); }
  function changeSample(next) { setSample(next); setPreview(null); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage(''); setPreview(null);
    try {
      if (event.nativeEvent.submitter?.value === 'preview') {
        if (!sample.affectedService) throw new Error('Select a service for the preview.');
        setPreview(await apiSend('admin/priority-strategy/preview', { configuration: values, ...sample }));
      } else {
        setValues(await apiSend('admin/priority-strategy', values, 'PUT'));
        setMessage('Saved. Future classifications use these settings. Existing priorities and SLA deadlines are unchanged.');
      }
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  function changeRule(index, field, value) { change({ ...values, rules: values.rules.map((rule, i) => i === index ? { ...rule, [field]: value } : rule) }); }
  function moveRule(index, direction) {
    const rules = [...values.rules]; [rules[index], rules[index + direction]] = [rules[index + direction], rules[index]];
    change({ ...values, rules });
  }
  const thresholds = values?.strategy === 'MULTIPLICATIVE' ? 'multiplicativeThresholds' : 'weightedThresholds';
  return <section className="report-form admin-section"><h2>Priority Strategy</h2>
    {!values ? <p role="status">{message || 'Loading priority settings…'} <button className="report-clear" onClick={() => setRetry(retry + 1)}>Retry</button></p> : <form onSubmit={submit}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <div className="report-field"><label htmlFor="priority-model">Calculation model</label><select id="priority-model" value={values.strategy} onChange={event => change({ ...values, strategy: event.target.value })}>{['MULTIPLICATIVE', 'WEIGHTED', 'MATRIX', 'RULE_BASED'].map(mode => <option key={mode} value={mode}>{label(mode)}</option>)}</select></div>
        <p>Business criticality comes from IT Services. Priority is calculated in Java when an administrator classifies an incident.</p>
        {['MULTIPLICATIVE', 'WEIGHTED'].includes(values.strategy) && <>
          <p>{values.strategy === 'MULTIPLICATIVE' ? 'Impact × Urgency × Criticality; Low=1, Medium=2, High=3. Score range: 1–27.' : '100 × weighted normalized inputs; Low=0, Medium=0.5, High=1. Score range: 0–100.'} Each threshold is inclusive; scores below P3 use P4. Require P1 &gt; P2 &gt; P3 &gt; 0.</p>
          <div className="report-row">{['p1', 'p2', 'p3'].map(key => <div className="report-field" key={key}><label htmlFor={'threshold-' + key}>{key.toUpperCase()} minimum score</label><input id={'threshold-' + key} type="number" step="any" min="0.000001" max={values.strategy === 'MULTIPLICATIVE' ? 27 : 100} required value={values[thresholds][key]} onChange={event => change({ ...values, [thresholds]: { ...values[thresholds], [key]: Number(event.target.value) } })} /></div>)}</div>
        </>}
        {values.strategy === 'WEIGHTED' && <><p>Non-negative weights must sum to 1.</p><div className="report-row">{['impactWeight', 'urgencyWeight', 'criticalityWeight'].map(key => <div className="report-field" key={key}><label htmlFor={key}>{key.replace('Weight', ' weight')}</label><input id={key} type="number" min="0" max="1" step="any" required value={values[key]} onChange={event => change({ ...values, [key]: Number(event.target.value) })} /></div>)}</div></>}
        {values.strategy === 'MATRIX' && <><p>Rows represent impact; columns represent urgency. HIGH service criticality promotes the result by the configured number of levels, capped at P1.</p><div className="dashboard-table-scroll"><table><thead><tr><th>Impact / Urgency</th>{levels.map(level => <th key={level}>{level}</th>)}</tr></thead><tbody>{levels.map((impact, row) => <tr key={impact}><th>{impact}</th>{levels.map((urgency, column) => { const index = row * 3 + column; return <td key={urgency}><select aria-label={impact + ' impact ' + urgency + ' urgency'} value={values.matrix[index]} onChange={event => change({ ...values, matrix: values.matrix.map((value, i) => i === index ? event.target.value : value) })}>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></td>; })}</tr>)}</tbody></table></div><div className="report-field"><label htmlFor="critical-boost">Critical-service promotion (0 disables)</label><input id="critical-boost" type="number" min="0" max="3" step="1" required value={values.criticalBoost} onChange={event => change({ ...values, criticalBoost: Number(event.target.value) })} /></div></>}
        {values.strategy === 'RULE_BASED' && <><p>First matching rule wins. Conditions compare HIGH levels; CRITICAL SERVICE means service criticality is HIGH. An empty list always uses the fallback.</p>{values.rules.map((rule, index) => <div className="report-row" key={index}><div className="report-field"><label htmlFor={'rule-' + index}>Rule {index + 1}</label><select id={'rule-' + index} value={rule.condition} onChange={event => changeRule(index, 'condition', event.target.value)}>{conditions.map(condition => <option key={condition} value={condition}>{label(condition)}</option>)}</select></div><div className="report-field"><label htmlFor={'rule-priority-' + index}>Priority</label><select id={'rule-priority-' + index} value={rule.priority} onChange={event => changeRule(index, 'priority', event.target.value)}>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></div><div className="report-actions"><button type="button" className="report-clear" disabled={index === 0} onClick={() => moveRule(index, -1)}>Up</button><button type="button" className="report-clear" disabled={index === values.rules.length - 1} onClick={() => moveRule(index, 1)}>Down</button><button type="button" className="report-clear" onClick={() => change({ ...values, rules: values.rules.filter((_, i) => i !== index) })}>Remove</button></div></div>)}<button type="button" className="report-clear" disabled={values.rules.length === conditions.length} onClick={() => change({ ...values, rules: [...values.rules, { condition: conditions.find(condition => !values.rules.some(rule => rule.condition === condition)), priority: 'P2' }] })}>Add Rule</button><div className="report-field"><label htmlFor="priority-fallback">Fallback priority</label><select id="priority-fallback" value={values.fallback} onChange={event => change({ ...values, fallback: event.target.value })}>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></div></>}
        <h3>Preview without saving</h3><div className="report-row">{['impact', 'urgency'].map(key => <div className="report-field" key={key}><label htmlFor={'preview-' + key}>{label(key)}</label><select id={'preview-' + key} value={sample[key]} onChange={event => changeSample({ ...sample, [key]: event.target.value })}>{levels.map(level => <option key={level}>{level}</option>)}</select></div>)}<div className="report-field"><label htmlFor="preview-service">IT service</label><select id="preview-service" value={sample.affectedService} onChange={event => changeSample({ ...sample, affectedService: event.target.value })}><option value="">Select a service</option>{services.map(service => <option key={service.code} value={service.code}>{service.label}</option>)}</select></div></div>
        <div className="report-actions"><button className="report-clear" value="preview">Preview Priority</button><button className="incident-view" value="save">Save Priority Strategy</button></div>
      </fieldset>
      {preview && <p role="status">Preview: {preview.priority}. Service criticality: {preview.criticality}. These settings have not been saved.</p>}
      {message && <p role="status">{message}</p>}
    </form>}
  </section>;
}
