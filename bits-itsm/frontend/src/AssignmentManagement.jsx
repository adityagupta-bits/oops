import Modal from './components/ui/Modal.jsx';
import DirectCollaborators from './DirectCollaborators.jsx';
import './incidentManagement.css';
import React, { useEffect, useRef, useState } from 'react';
import { apiRequest, apiPost, apiSend } from './api.js';
import { readableLabel } from './MyIncidents.jsx';
import PriorityConfiguration from './PriorityConfiguration.jsx';
import AssignmentPreview from './AssignmentPreview.jsx';
import Badge from './components/ui/Badge.jsx';
import NavIcon from './components/NavIcon.jsx';

const skills = [
  'NETWORK',
  'HARDWARE',
  'SOFTWARE',
  'DATABASE',
  'AUTHENTICATION',
  'SECURITY',
  'APPLICATION_SUPPORT',
  'CLOUD',
  'STORAGE',
];
const date = (value) => (value ? new Date(value).toLocaleString() : 'Not reviewed');

function Table({ title, headers, rows, className = '' }) {
  return (
    <section className={`dashboard-incidents admin-section ${className}`}>
      <div className="dashboard-section-heading">
        <h2>{title}</h2>
        <span className="results-counter-pill">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
      </div>
      {rows.length ? (
        <div className="dashboard-table-scroll" role="region" aria-label={title} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {headers.map((label) => (
                  <th scope="col" key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, column) => (
                    <td key={column}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state-panel">
          <NavIcon name="search" />
          <h3>No matching records</h3>
          <p>No records match the active criteria.</p>
        </div>
      )}
    </section>
  );
}

function ProfileForm({ technician, onSaved }) {
  const [values, setValues] = useState({
    skills: technician.skills,
    availability: technician.availability,
    maxWorkload: technician.maxWorkload,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await apiSend(`admin/technicians/${technician.id}/assignment-profile`, values, 'PUT');
      onSaved();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="report-form admin-section" onSubmit={submit}>
      <h3>Assignment Profile · {technician.name}</h3>
      <div className="report-field">
        <label htmlFor="technician-skills">Technical Skills (select one or more)</label>
        <select
          id="technician-skills"
          multiple
          required
          value={values.skills}
          onChange={(event) =>
            setValues({
              ...values,
              skills: [...event.target.selectedOptions].map((option) => option.value),
            })
          }
        >
          {skills.map((skill) => (
            <option key={skill} value={skill}>{readableLabel(skill)}</option>
          ))}
        </select>
        <p className="report-guidance">Use Ctrl or Command to select multiple skills.</p>
      </div>

      <div className="report-row">
        <div className="report-field">
          <label htmlFor="technician-availability">Availability</label>
          <select
            id="technician-availability"
            value={values.availability}
            onChange={(event) => setValues({ ...values, availability: event.target.value })}
          >
            {['AVAILABLE', 'BUSY', 'UNAVAILABLE'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label htmlFor="technician-capacity">Maximum Active Workload Limit</label>
          <input
            id="technician-capacity"
            type="number"
            min="1"
            max="100"
            required
            value={values.maxWorkload}
            onChange={(event) => setValues({ ...values, maxWorkload: Number(event.target.value) })}
          />
        </div>
      </div>

      <div className="report-actions">
        <button className="submit-button-sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save Assignment Profile'}
        </button>
      </div>
      {message && <p className="report-error" role="alert">{message}</p>}
    </form>
  );
}

function StrategyForm({ current, onSaved }) {
  const [strategy, setStrategy] = useState(current.strategy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await apiSend('admin/assignment-strategy', { strategy }, 'PUT');
      onSaved();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="report-form admin-section" onSubmit={submit}>
      <h2>Assignment Strategy</h2>
      <p>
        Active Strategy: <strong>{readableLabel(current.strategy)}</strong>
      </p>
      <div className="report-row strategy-cards-grid">
        <div className={`strategy-card ${strategy === 'SKILL_BASED' ? 'selected' : ''}`}>
          <h3>Skill-Based Assignment</h3>
          <p>
            Matches incident category to technician specialization first, then prioritizes lowest active workload among qualified staff.
          </p>
        </div>
        <div className={`strategy-card ${strategy === 'LOAD_BASED' ? 'selected' : ''}`}>
          <h3>Load-Based Assignment</h3>
          <p>
            Chooses the technician with lowest active workload among eligible staff to balance queue load across team.
          </p>
        </div>
      </div>
      <p className="report-guidance">
        Both strategies enforce required skills, active status, availability, and capacity limit. Changes apply to future automatic assignments.
      </p>

      <div className="report-field">
        <label htmlFor="assignment-strategy">Select Active Assignment Strategy</label>
        <select
          id="assignment-strategy"
          value={strategy}
          onChange={(event) => setStrategy(event.target.value)}
        >
          <option value="SKILL_BASED">Skill-Based Assignment</option>
          <option value="LOAD_BASED">Load-Based Assignment</option>
        </select>
      </div>

      <div className="report-actions">
        <button className="submit-button-sm" disabled={busy}>
          {busy ? 'Saving Strategy…' : 'Save Active Strategy'}
        </button>
      </div>
      {message && <p className="report-error" role="alert">{message}</p>}
    </form>
  );
}

function Review({ request, collaboration, admin, userId, onClose, onSaved }) {
  const dialog = useRef(null);
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState(null);
  const [loads, setLoads] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [destinationId, setDestinationId] = useState(
    request.proposedTechnician?.id ? String(request.proposedTechnician.id) : ''
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    dialog.current.showModal();
    Promise.all([
      apiRequest(`incidents/${request.incidentId}`),
      admin ? apiRequest('admin/technicians/workloads') : Promise.resolve([]),
      admin && !collaboration
        ? apiRequest(`incidents/${request.incidentId}/eligible-technicians`)
        : Promise.resolve([]),
    ])
      .then(([incident, workloads, eligible]) => {
        if (active) {
          setDetails(incident);
          setLoads(workloads);
          setDestinations(eligible);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [request, admin, collaboration]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const decision = event.nativeEvent.submitter.value;
    if (admin && !collaboration && decision === 'approve' && !destinationId) {
      setError('Choose an eligible destination technician before approving.');
      return;
    }
    setBusy(true);
    try {
      if (admin && decision === 'approve' && !window.confirm(collaboration ? 'Approve this collaboration request?' : 'Approve this transfer and reassign the incident?')) {
        setBusy(false);
        return;
      }
      await apiPost(
        `${admin ? 'admin' : 'technician'}/${collaboration ? 'collaboration' : 'transfer'}-requests/${request.id}/${decision}`,
        {
          notes,
          ...(admin && !collaboration && decision === 'approve' ? { technicianId: Number(destinationId) } : {}),
        }
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="incident-dialog incident-management-dialog"
      aria-labelledby="request-review-title"
      onClose={onClose}
    >
      <div className="dashboard-section-heading dialog-header">
        <h2 id="request-review-title">
          {collaboration ? 'Collaboration' : 'Transfer'} Request #{request.id}
        </h2>
        <button className="dialog-close-btn" autoFocus onClick={onClose}>
          ✕
        </button>
      </div>

      <dl className="incident-details">
        {[
          ['Incident', `#${request.incidentId} · ${request.incidentTitle}`],
          ['Request Status', readableLabel(request.status)],
          ['Origin Technician', request.primaryTechnician.name],
          ['Suggested Technician', request.proposedTechnician?.name || 'Not specified'],
          ...(!collaboration
            ? [['Assigned Technician', request.assignedTechnician?.name || 'Not assigned yet']]
            : []),
          ['Reason', request.reason],
          ['Requested', date(request.requestedAt)],
          ...(collaboration
            ? [
                ['Required Skill', readableLabel(request.requiredSkill)],
                ['Responsibility Task', request.responsibility],
              ]
            : [['Handover Notes', request.handoverNotes]]),
          ['Reviewed By', request.reviewedBy?.name || 'Pending Review'],
          ['Review Notes', request.reviewNotes || 'None'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {admin &&
        loads
          .filter((load) => [request.primaryTechnician.id, request.proposedTechnician?.id].includes(load.id))
          .map((load) => (
            <section className="student-detail-section" key={load.id}>
              <h3>{load.name} Workload Status</h3>
              <p>
                {load.skills.map(readableLabel).join(', ')} · <Badge value={load.availability} type="status" />
              </p>
              <p>
                Workload: {load.activePrimary} primary + {load.activeCollaboration} collaboration / {load.maxWorkload} capacity.
              </p>
            </section>
          ))}

      {request.status === 'PENDING' && (admin || request.primaryTechnician.id === userId) && (
        <form className="report-form admin-section" onSubmit={submit}>
          {admin && !collaboration && (
            <div className="report-field">
              <label htmlFor="transfer-destination">
                Destination Technician (required to approve) <span className="field-required-mark">*</span>
              </label>
              <select
                id="transfer-destination"
                value={destinationId}
                onChange={(event) => setDestinationId(event.target.value)}
              >
                <option value="">Choose an eligible destination technician</option>
                {destinations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.skills.map(readableLabel).join(', ')} · {p.total}/{p.maxWorkload} workload
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="report-field">
            <label htmlFor="request-review-notes">
              {admin ? 'Review Notes / Decision Rationale' : 'Cancellation Reason'}
            </label>
            <textarea
              id="request-review-notes"
              rows={3}
              required
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="report-actions">
            {admin ? (
              <>
                <button className="submit-button-sm" value="approve" disabled={busy || !details}>
                  Approve Request
                </button>
                <button className="danger-button-sm" value="reject" disabled={busy}>
                  Reject Request
                </button>
              </>
            ) : (
              <button className="danger-button-sm" value="cancel" disabled={busy}>
                Cancel Request
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="report-error" role="alert">{error}</p>}
    </dialog>
  );
}

export default function AssignmentManagement({ mode, role, userId, incidentId, onSaved }) {
  const admin = role === 'ADMIN';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const [teamIncident, setTeamIncident] = useState(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamOpen, setTeamOpen] = useState(false);
  async function manageTeam(id) {
    setTeamOpen(true); setTeamIncident(null); setTeamError(''); setTeamLoading(true);
    try { setTeamIncident(await apiRequest(`incidents/${id}`)); }
    catch (e) { setTeamError(e.message); }
    finally { setTeamLoading(false); }
  }
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const path =
      mode === 'strategy'
        ? 'admin/assignment-strategy'
        : mode === 'workload'
        ? admin
          ? 'admin/technicians/workloads'
          : 'technician/workload'
        : `${admin ? 'admin' : 'technician'}/${mode}-requests`;
    apiRequest(path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, admin, refresh]);

  function saved() {
    setMessage('Saved successfully.');
    onSaved?.();
    setProfile(null);
    setRefresh((value) => value + 1);
  }

  const rows = mode === 'workload' && data ? (admin ? data : [data]) : [];
  const requests = Array.isArray(data)
    ? data.filter(
        (item) =>
          (!incidentId || item.incidentId === incidentId) && (!status || item.status === status) &&
          `${item.id} ${item.incidentId} ${item.reason}`.toLowerCase().includes(search.trim().toLowerCase())
      )
    : [];

  return (
    <>
      {mode === 'strategy' && <PriorityConfiguration />}

      <div className={`report-actions ${mode === 'workload' && !admin ? 'technician-workload-toolbar' : ''}`} style={{ marginBottom: '1rem' }}>
        <button className="report-clear" disabled={loading} onClick={() => setRefresh((v) => v + 1)}>
          Refresh {mode === 'workload' ? 'Workload' : mode === 'strategy' ? 'Strategy' : 'Requests'}
        </button>
      </div>

      {message && <p className="status-message status-success" role="status">{message}</p>}

      {loading ? (
        <div className="loading-state-box" role="status">
          <span className="spinner-border" aria-hidden="true" />
          <span>Loading {mode}…</span>
        </div>
      ) : error ? (
        <p className="report-error" role="alert">{error}</p>
      ) : mode === 'strategy' ? (
        <React.Fragment key={refresh}><StrategyForm current={data} onSaved={saved} /><AssignmentPreview /></React.Fragment>
      ) : mode === 'workload' ? (
        <div className={admin ? undefined : 'technician-workload-page'}>
          <p className="report-guidance workload-guidance">
            <span>Active work includes Assigned, Acknowledged, and In Progress incidents. Primary and collaboration counts are shown separately.</span>
            <span>Load levels: Low below 50%; Moderate 50–79%; High 80–99%; Overloaded at or above capacity.</span>
          </p>

          {!admin && (
            <section className="dashboard-summary workload-summary" aria-label="Workload summary">
              {[
                ['Active Primary', data.activePrimary],
                ['Active Collaboration', data.activeCollaboration],
                ['Total Active', data.total],
                ['High Priority', data.highPriority],
                ['Resolved', data.resolvedCount],
                ['Remaining Capacity', data.remainingCapacity],
              ].map(([label, count]) => (
                <div className="dashboard-summary-card" key={label}>
                  <h3>{label}</h3>
                  <p>{count}</p>
                </div>
              ))}
            </section>
          )}

          {!admin && <p className="workload-mobile-hint">Swipe the table to see all capacity details.</p>}
          <Table
            className={admin ? '' : 'technician-workload-table'}
            title={admin ? 'Technician Workloads' : 'Availability & Capacity'}
            headers={[
              'Technician',
              'Skills',
              'Availability',
              'Primary',
              'Collaboration',
              'Total / Capacity',
              'Remaining',
              'Workload Level',
              ...(admin ? ['Action'] : []),
            ]}
            rows={rows.map((item) => [
              item.name,
              item.skills.map(readableLabel).join(', '),
              item.enabled ? <span className={`workload-state workload-state-${String(item.availability).toLowerCase()}`}>{readableLabel(item.availability)}</span> : 'Disabled',
              item.activePrimary,
              item.activeCollaboration,
              `${item.total} / ${item.maxWorkload}`,
              item.remainingCapacity,
              <span className={`workload-level workload-level-${String(item.level).toLowerCase()}`}>{readableLabel(item.level)}</span>,
              ...(admin
                ? [
                    <button className="incident-view" onClick={() => setProfile(item)}>
                      Edit Profile
                    </button>,
                  ]
                : []),
            ])}
          />
          {profile && <ProfileForm key={profile.id} technician={profile} onSaved={saved} />}
        </div>
      ) : (
        <>
          <div className="incident-filters admin-filters" style={{ marginBottom: '1.25rem' }}>
            <div className="report-field search-field">
              <label htmlFor="request-search">Search Requests</label>
              <div className="input-with-icon">
                <NavIcon name="search" />
                <input
                  id="request-search"
                  placeholder="Request ID, incident, or reason…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="report-field">
              <label htmlFor="request-status">Request Status</label>
              <select id="request-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All Statuses</option>
                {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <button className="report-clear" onClick={() => { setSearch(''); setStatus(''); }}>
              Clear Filters
            </button>
          </div>

          <Table
            title={mode === 'transfer' ? 'Transfer Requests' : 'Collaboration Requests'}
            headers={[
              'Request ID',
              'Incident',
              'Primary Technician',
              'Suggested Technician',
              ...(mode === 'transfer' ? ['Assigned Technician'] : []),
              'Reason',
              'Status',
              'Requested Date',
              'Action',
            ]}
            rows={requests.map((item) => [
              `#${item.id}`,
              `#${item.incidentId} · ${item.incidentTitle}`,
              item.primaryTechnician.name,
              item.proposedTechnician?.name || 'Not suggested',
              ...(mode === 'transfer' ? [item.assignedTechnician?.name || 'Not assigned'] : []),
              item.reason,
              readableLabel(item.status),
              date(item.requestedAt),
              <div className="report-actions"><button className="incident-view" onClick={() => setSelected(item)}>
                {admin && item.status === 'PENDING' ? 'Approve / Reject' : 'View request'}
              </button>{admin && <button className="incident-view" onClick={() => manageTeam(item.incidentId)}>Manage collaborators</button>}</div>,
            ])}
          />
        </>
      )}

      <Modal isOpen={teamOpen} onClose={() => setTeamOpen(false)} title="Manage collaborators" className="incident-management-dialog">
        {teamLoading && <p role="status">Loading incident team...</p>}
        {teamError && <p role="alert">{teamError}</p>}
        {teamIncident && <><p>Incident #{teamIncident.id}: {teamIncident.title}</p><DirectCollaborators key={teamIncident.id} incident={teamIncident} onSaved={async () => { setTeamIncident(await apiRequest(`incidents/${teamIncident.id}`)); saved(); }} /></>}
      </Modal>
      {selected && (
        <Review
          request={selected}
          collaboration={mode === 'collaboration'}
          admin={admin}
          userId={userId}
          onClose={() => setSelected(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
