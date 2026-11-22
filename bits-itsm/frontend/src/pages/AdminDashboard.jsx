import AdminManagement from '../AdminManagement.jsx';
import PasswordSettings from '../PasswordSettings.jsx';
import React, { useEffect, useRef, useState } from 'react';
import Button27 from '../components/ui/button-27.jsx';
import Notifications from '../Notifications.jsx';
import LiveIncidents from '../LiveIncidents.jsx';
import OperationsDashboard from '../OperationsDashboard.jsx';
import AssignmentManagement from '../AssignmentManagement.jsx';
import { incidentStatuses, readableLabel } from '../MyIncidents.jsx';
import Badge from '../components/ui/Badge.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import NavIcon from '../components/NavIcon.jsx';
import {
  demoIncidents,
  users,
  technicians,
  technicianSkills,
  transferRequests,
  collaborationRequests,
  services,
  incidentCategories,
  slaPolicies,
  auditLogs,
  investigationNotes,
  adminNotifications,
  relatedIncidentExamples,
  recommendationExamples,
  isActive,
  technicianWorkload,
} from '../demoData.js';

const pages = [
  'Dashboard',
  'All Incidents',
  'Classification Review',
  'Transfer Requests',
  'Collaboration Requests',
  'Manage Technicians',
  'Manage Users',
  'Manage IT Problem Templates',
  'IT Services',
  'Incident Categories',
  'Urgency & Impact Rules',
  'SLA Policies',
  'Assignment Strategies',
  'Escalations',
  'Reports & Analytics',
  'Audit Logs',
  'Notifications',
  'Settings',
  'Profile',
];

const navGroups = [
  {
    group: 'Operations',
    items: [
      { name: 'Dashboard', icon: 'dashboard' },
      { name: 'All Incidents', icon: 'incidents' },
      { name: 'Notifications', icon: 'notifications' },
    ],
  },
  {
    group: 'Ticket Operations',
    items: [
      { name: 'Classification Review', icon: 'sliders' },
      { name: 'Transfer Requests', icon: 'git-pull-request' },
      { name: 'Collaboration Requests', icon: 'users' },
      { name: 'Escalations', icon: 'arrow-up-right' },
    ],
  },
  {
    group: 'Automation & Catalog',
    items: [
      { name: 'Urgency & Impact Rules', icon: 'alert-circle' },
      { name: 'Assignment Strategies', icon: 'sliders' },
      { name: 'SLA Policies', icon: 'clock' },
      { name: 'Manage IT Problem Templates', icon: 'layers' },
      { name: 'IT Services', icon: 'server' },
      { name: 'Incident Categories', icon: 'layers' },
    ],
  },
  {
    group: 'People',
    items: [
      { name: 'Manage Technicians', icon: 'users' },
      { name: 'Manage Users', icon: 'users' },
    ],
  },
  {
    group: 'Governance & System',
    items: [
      { name: 'Reports & Analytics', icon: 'trending-up' },
      { name: 'Audit Logs', icon: 'shield' },
      { name: 'Settings', icon: 'settings' },
      { name: 'Profile', icon: 'profile' },
    ],
  },
];

const person = (id) => users.find((user) => user.id === id)?.name || 'Unassigned';
const incidentById = (id) => demoIncidents.find((incident) => incident.id === id);
const technicianById = (id) => technicians.find((technician) => technician.id === id);
const dateText = (value) => (value ? value.replace('T', ' ') : 'Not recorded');
const statusText = (value) => incidentStatuses[value]?.label || readableLabel(value);
const optionsFor = (values) => values.map((value) => ({ value, label: readableLabel(value) }));
const technicianOptions = technicians.map((technician) => ({
  value: technician.id,
  label: `${technician.id} · ${technician.name} · ${readableLabel(technician.availability)}`,
}));
const requestStates = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
const slaStates = ['ON_TRACK', 'AT_RISK', 'BREACHED', 'MET'];
const priorities = ['P1', 'P2', 'P3', 'P4'];
const userRoles = ['STUDENT', 'TECHNICIAN', 'ADMIN'];
const accountStates = ['ACTIVE', 'DISABLED'];

function AdminBadge({ value }) {
  if (priorities.includes(value)) {
    return <Badge value={value} type="priority" />;
  }
  return <Badge value={value} type="status" />;
}

function Table({ title, headers, rows }) {
  return (
    <section className="dashboard-incidents admin-section" aria-label={title}>
      <div className="dashboard-section-heading">
        <h2>{title}</h2>
        <span>Demo data</span>
      </div>
      {rows.length ? (
        <div className="dashboard-table-scroll" role="region" aria-label={title} tabIndex={0}>
          <table>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th scope="col" key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, column) => (
                    <td key={column}>{cell ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="dashboard-empty">No matching records.</p>
      )}
    </section>
  );
}

function Facts({ items }) {
  return (
    <dl className="incident-details admin-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? 'Not recorded'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cards({ items }) {
  const tones = ['navy', 'amber', 'blue', 'purple', 'red', 'emerald', 'cyan', 'indigo'];
  return (
    <div className="dashboard-summary">
      {items.map(([label, count], idx) => (
        <StatCard key={label} title={label} value={count} tone={tones[idx % tones.length]} />
      ))}
    </div>
  );
}

function Filter({ label, name, value, onChange, options, type = 'search' }) {
  return (
    <div className="report-field">
      <label htmlFor={`admin-filter-${name}`}>{label}</label>
      {options ? (
        <select id={`admin-filter-${name}`} name={name} value={value} onChange={onChange}>
          <option value="">All</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input id={`admin-filter-${name}`} type={type} name={name} value={value} onChange={onChange} />
      )}
    </div>
  );
}

function textField(name, label, value = '') {
  return { name, label, value, type: 'text', required: true };
}

function selectField(name, label, options, value = '') {
  return { name, label, options, value, type: 'select', required: true };
}

function skillsField(values = []) {
  return { name: 'skills', label: 'Technical skills', options: technicianSkills, value: values, type: 'multiselect', required: true };
}

const reasonField = { name: 'reason', label: 'Reason for action', type: 'textarea', required: true };

function PreviewForm({ specification }) {
  const [values, setValues] = useState(
    Object.fromEntries(
      specification.fields.map((field) => [
        field.name,
        field.value ?? (field.type === 'multiselect' ? [] : field.type === 'checkbox' ? false : ''),
      ])
    )
  );
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const proposal = useRef(null);
  const fields = specification.fields.filter((field) => !field.when || field.when(values));

  useEffect(() => {
    if (preview) proposal.current?.focus();
  }, [preview]);

  function change(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setPreview(false);
    setError('');
  }

  function submit(event) {
    event.preventDefault();
    setPreview(false);
    for (const field of fields) {
      const value = values[field.name];
      const empty = Array.isArray(value) ? !value.length : typeof value === 'boolean' ? !value : !String(value).trim();
      let problem = '';
      if (field.required !== false && empty) problem = `Complete ${field.label.toLowerCase()}.`;
      else if (
        field.options &&
        !empty &&
        !(Array.isArray(value) ? value : [value]).every((entry) => field.options.some((option) => option.value === entry))
      )
        problem = 'Select an available option.';
      else if (field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) <= 0))
        problem = 'Targets must be positive numbers.';
      else if (field.type === 'email' && !/^[^\s@]+@hyderabad\.bits-pilani\.ac\.in$/i.test(String(value).trim()))
        problem = 'Use a BITS Hyderabad institutional email.';
      else if (field.readOnly && value !== field.value)
        problem = `${field.label} cannot be changed in this preview.`;
      if (problem) {
        setError(problem);
        event.currentTarget.querySelector(`[name="${field.name}"]`)?.focus();
        return;
      }
    }
    const problem = specification.validate?.(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setPreview(true);
  }

  return (
    <section className="admin-preview-form">
      <h3>{specification.title}</h3>
      <p className="report-guidance">{specification.subject} · Proposed values only. No changes will be saved.</p>
      <form onSubmit={submit} noValidate>
        <div className="report-row">
          {fields.map((field) => {
            const props = {
              id: `preview-${field.name}`,
              name: field.name,
              value: values[field.name],
              required: field.required !== false,
              readOnly: field.readOnly,
              'aria-describedby': 'admin-proposal-error',
              onChange: (event) => change(field.name, event.target.value),
            };
            if (field.type === 'multiselect')
              return (
                <fieldset className="admin-skill-options" key={field.name}>
                  <legend>{field.label}</legend>
                  {field.options.map((option) => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        name={field.name}
                        value={option.value}
                        checked={values[field.name].includes(option.value)}
                        aria-describedby="admin-proposal-error"
                        onChange={(event) =>
                          change(
                            field.name,
                            event.target.checked
                              ? [...values[field.name], option.value]
                              : values[field.name].filter((val) => val !== option.value)
                          )
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              );
            if (field.type === 'checkbox')
              return (
                <label key={field.name} className="admin-confirmation">
                  <input
                    type="checkbox"
                    name={field.name}
                    checked={values[field.name]}
                    onChange={(event) => change(field.name, event.target.checked)}
                    aria-describedby="admin-proposal-error"
                  />
                  {field.label}
                </label>
              );
            return (
              <div className="report-field" key={field.name}>
                <label htmlFor={props.id}>{field.label}</label>
                {field.options ? (
                  <select {...props}>
                    <option value="">Select an option</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea {...props} rows={3} maxLength={1000} />
                ) : (
                  <input
                    {...props}
                    type={field.type || 'text'}
                    min={field.type === 'number' ? 0 : undefined}
                    step={field.type === 'number' ? 'any' : undefined}
                    maxLength={200}
                  />
                )}
              </div>
            );
          })}
        </div>
        <button className="incident-view" type="submit">Preview proposal</button>
        <p id="admin-proposal-error" className="report-error" role="alert">{error}</p>
      </form>
      {preview && (
        <div ref={proposal} tabIndex={-1} className="admin-proposal" role="status">
          <strong>Proposal preview — not saved</strong>
          <p>Changes validated. Saving will be available after Java backend integration.</p>
          <Facts
            items={fields.map((field) => [
              field.label,
              Array.isArray(values[field.name])
                ? values[field.name].map((value) => field.options.find((option) => option.value === value)?.label || value).join(', ')
                : typeof values[field.name] === 'boolean'
                ? 'Confirmed for preview only'
                : field.options?.find((option) => option.value === values[field.name])?.label || String(values[field.name]).trim(),
            ])}
          />
          <p>{specification.outcome || 'Java authorization and persistence are required before this proposal can take effect.'}</p>
        </div>
      )}
    </section>
  );
}

function WorkloadTable({ title = 'Technician workload', ids = technicians.map((technician) => technician.id), open }) {
  return (
    <Table
      title={title}
      headers={['Technician', 'Active primary', 'Active collaborations', 'Total active', 'Availability', 'Workload status', 'Skills']}
      rows={ids.filter(Boolean).map((id) => {
        const technician = technicianById(id);
        const workload = technicianWorkload(id);
        return [
          open ? (
            <button className="incident-view" onClick={() => open('technician', id)}>
              {id} · {technician.name}
            </button>
          ) : (
            `${id} · ${technician.name}`
          ),
          workload.activePrimary,
          workload.activeCollaboration,
          workload.total,
          readableLabel(technician.availability),
          workloadLevel(technician, workload),
          technician.skills.map(readableLabel).join(', '),
        ];
      })}
    />
  );
}

function workloadLevel(technician, workload) {
  if (workload.total > technician.workloadLimit) return 'OVERLOADED';
  if (workload.total === technician.workloadLimit) return 'HIGH';
  return workload.total >= technician.workloadLimit / 2 ? 'MODERATE' : 'LOW';
}

function AuditTable({ records = auditLogs, title = 'Audit history' }) {
  return (
    <Table
      title={title}
      headers={['Event ID', 'Timestamp', 'Actor', 'Incident', 'Action', 'Previous', 'New', 'Description']}
      rows={records.map((record) => [
        record.id,
        dateText(record.timestamp),
        person(record.userId),
        record.incidentId,
        readableLabel(record.actionType),
        record.previous,
        record.next,
        record.description,
      ])}
    />
  );
}

function IncidentList({ records, title, open }) {
  return (
    <Table
      title={title}
      headers={['Incident', 'Title', 'Priority', 'Status', 'Primary technician', 'SLA', 'Action']}
      rows={records.map((incident) => [
        incident.id,
        incident.title,
        <AdminBadge value={incident.priority} />,
        <AdminBadge value={incident.status} />,
        person(incident.primaryTechnicianId),
        <AdminBadge value={incident.slaStatus} />,
        <button className="incident-view" onClick={() => open('incident', incident.id)}>View {incident.id}</button>,
      ])}
    />
  );
}

function DashboardHome({ open, navigate }) {
  const active = demoIncidents.filter(isActive);
  const pendingTransfers = transferRequests.filter((request) => request.status === 'PENDING');
  const pendingCollaborations = collaborationRequests.filter((request) => request.status === 'PENDING');
  return (
    <>
      <Cards
        items={[
          ['Total Incidents', demoIncidents.length],
          ['Active Incidents', active.length],
          ['Critical Incidents', active.filter((incident) => incident.priority === 'P1').length],
          ['Resolved Incidents', demoIncidents.length - active.length],
          ['SLA Violations', demoIncidents.filter((incident) => incident.slaStatus === 'BREACHED').length],
          ['Available Technicians', technicians.filter((technician) => technician.availability === 'AVAILABLE').length],
          ['Pending Transfer Requests', pendingTransfers.length],
          ['Pending Collaboration Requests', pendingCollaborations.length],
        ]}
      />
      <p className="report-guidance">
        Active excludes Resolved, Verified and Closed. Critical means active P1. SLA labels and deadlines are calculated against live policy.
      </p>
      <IncidentList
        title="Critical incident monitoring"
        records={demoIncidents.filter(
          (incident) => (isActive(incident) && ['P1', 'P2'].includes(incident.priority)) || incident.slaStatus === 'BREACHED' || incident.escalation
        )}
        open={open}
      />
      <Table
        title="Pending administrative actions"
        headers={['Type', 'Reference', 'Incident', 'Action']}
        rows={[
          ...pendingTransfers.map((request) => [
            'Transfer',
            request.id,
            request.incidentId,
            <button className="incident-view" onClick={() => open('transfer', request.id)}>Review {request.id}</button>,
          ]),
          ...pendingCollaborations.map((request) => [
            'Collaboration',
            request.id,
            request.incidentId,
            <button className="incident-view" onClick={() => open('collaboration', request.id)}>Review {request.id}</button>,
          ]),
          ...demoIncidents
            .filter((incident) => incident.escalation)
            .map((incident) => [
              'Escalation',
              incident.escalation.level,
              incident.id,
              <button className="incident-view" onClick={() => navigate('Escalations')}>Review escalations</button>,
            ]),
        ]}
      />
      <WorkloadTable open={open} />
      <AuditTable title="Recent activity" records={auditLogs.slice(0, 6)} />
    </>
  );
}

function AllIncidents({ open }) {
  const initial = { search: '', date: '', status: '', priority: '', category: '', service: '', technician: '', sla: '' };
  const [filters, setFilters] = useState(initial);
  const change = (event) => setFilters({ ...filters, [event.target.name]: event.target.value });
  const query = filters.search.trim().toLowerCase();
  const records = demoIncidents.filter(
    (incident) =>
      `${incident.id} ${incident.title}`.toLowerCase().includes(query) &&
      (!filters.date || incident.createdAt.startsWith(filters.date)) &&
      (!filters.status || incident.status === filters.status) &&
      (!filters.priority || incident.priority === filters.priority) &&
      (!filters.category || incident.category === filters.category) &&
      (!filters.service || incident.affectedService === filters.service) &&
      (!filters.technician || (filters.technician === 'UNASSIGNED' ? !incident.primaryTechnicianId : incident.primaryTechnicianId === filters.technician)) &&
      (!filters.sla || incident.slaStatus === filters.sla)
  );
  return (
    <>
      <div className="incident-filters admin-filters">
        <Filter label="Incident ID or title" name="search" value={filters.search} onChange={change} />
        <Filter label="Created date" name="date" type="date" value={filters.date} onChange={change} />
        {[
          ['Status', 'status', Object.entries(incidentStatuses).map(([value, status]) => ({ value, label: status.label }))],
          ['Priority', 'priority', priorities.map((value) => ({ value, label: value }))],
          ['Category', 'category', optionsFor([...new Set(demoIncidents.map((incident) => incident.category))])],
          ['Service', 'service', services.map((service) => ({ value: service.name, label: service.name }))],
          ['Primary technician', 'technician', [{ value: 'UNASSIGNED', label: 'Unassigned' }, ...technicianOptions]],
          ['SLA status', 'sla', optionsFor(slaStates)],
        ].map(([label, name, options]) => (
          <Filter key={name} label={label} name={name} options={options} value={filters[name]} onChange={change} />
        ))}
        <button className="report-clear" onClick={() => setFilters(initial)}>Clear Filters</button>
      </div>
      <p className="report-guidance" role="status">{records.length} of {demoIncidents.length} demo incidents</p>
      <Table
        title="All incidents"
        headers={['ID', 'Reporter', 'Title', 'Category', 'Service', 'Priority', 'Status', 'Primary Technician', 'Collaborators', 'Created', 'SLA', 'Action']}
        rows={records.map((incident) => [
          incident.id,
          person(incident.reporterId),
          incident.title,
          readableLabel(incident.category),
          incident.affectedService,
          <AdminBadge value={incident.priority} />,
          <AdminBadge value={incident.status} />,
          person(incident.primaryTechnicianId),
          incident.collaborators.map((member) => person(member.technicianId)).join(', ') || 'None',
          dateText(incident.createdAt),
          <AdminBadge value={incident.slaStatus} />,
          <button className="incident-view" onClick={() => open('incident', incident.id)}>View {incident.id}</button>,
        ])}
      />
    </>
  );
}

function Requests({ type, open }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const transfer = type === 'transfer';
  const requests = (transfer ? transferRequests : collaborationRequests).filter(
    (request) => (!status || status === request.status) && `${request.id} ${request.incidentId} ${request.reason}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <>
      <div className="incident-filters">
        <Filter label="Request, incident or reason" name="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Filter label="Request status" name="status" options={optionsFor(transfer ? requestStates : ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'])} value={status} onChange={(event) => setStatus(event.target.value)} />
        <button className="report-clear" onClick={() => { setSearch(''); setStatus(''); }}>Clear Filters</button>
      </div>
      <Table
        title={transfer ? 'Transfer requests' : 'Collaboration requests'}
        headers={
          transfer
            ? ['Request', 'Incident', 'Current Technician', 'Suggested Receiver', 'Reason', 'Current / Receiver Workload', 'Priority', 'SLA', 'Requested', 'Status', 'Action']
            : ['Request', 'Incident', 'Primary Technician', 'Requested Collaborator', 'Required Skills', 'Reason', 'Priority', 'SLA', 'Requested', 'Status', 'Action']
        }
        rows={requests.map((request) => {
          const incident = incidentById(request.incidentId);
          return transfer
            ? [
                request.id,
                request.incidentId,
                person(request.currentTechnicianId),
                person(request.suggestedTechnicianId),
                request.reason,
                `${technicianWorkload(request.currentTechnicianId).total} / ${technicianWorkload(request.suggestedTechnicianId).total}`,
                incident.priority,
                <AdminBadge value={incident.slaStatus} />,
                dateText(request.requestedAt),
                <AdminBadge value={request.status} />,
                <button className="incident-view" onClick={() => open(type, request.id)}>Review {request.id}</button>,
              ]
            : [
                request.id,
                request.incidentId,
                person(request.primaryTechnicianId),
                person(request.requestedTechnicianId),
                request.skills.join(', '),
                request.reason,
                incident.priority,
                <AdminBadge value={incident.slaStatus} />,
                dateText(request.requestedAt),
                <AdminBadge value={request.status} />,
                <button className="incident-view" onClick={() => open(type, request.id)}>Review {request.id}</button>,
              ];
        })}
      />
    </>
  );
}

function Technicians({ open, preview, navigate }) {
  return (
    <>
      <Table
        title="Technician availability & workload"
        headers={['ID', 'Technician', 'Email', 'Specializations', 'Availability', 'Primary', 'Collaboration', 'High Priority', 'Total Active', 'Status', 'Action']}
        rows={technicians.map((technician) => {
          const workload = technicianWorkload(technician.id);
          return [
            technician.id,
            technician.name,
            technician.email,
            technician.skills.map((skill) => technicianSkills.find((option) => option.value === skill)?.label || skill).join(', '),
            <AdminBadge value={technician.availability} />,
            workload.activePrimary,
            workload.activeCollaboration,
            workload.active.filter((incident) => ['P1', 'P2'].includes(incident.priority)).length,
            workload.active.length,
            <AdminBadge value={workloadLevel(technician, workload)} />,
            <button className="incident-view" onClick={() => open('technician', technician.id)}>View {technician.id}</button>,
          ];
        })}
      />
      <div className="admin-actions">
        <button className="incident-view" onClick={() => navigate('All Incidents')}>Review All Incidents</button>
        <button className="incident-view" onClick={() => navigate('Transfer Requests')}>Review Transfer Requests</button>
      </div>
    </>
  );
}

function Users({ open, preview }) {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const records = users.filter(
    (user) => (!role || user.role === role) && (!status || user.status === status) && `${user.id} ${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  return (
    <>
      <div className="incident-filters">
        <Filter label="Search name or institutional email" name="user-search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Filter label="Role" name="role" value={role} options={optionsFor(userRoles)} onChange={(event) => setRole(event.target.value)} />
        <Filter label="Account status" name="account-status" value={status} options={optionsFor(accountStates)} onChange={(event) => setStatus(event.target.value)} />
        <button className="report-clear" onClick={() => { setSearch(''); setRole(''); setStatus(''); }}>Clear Filters</button>
      </div>
      <p className="report-guidance" role="status">{records.length} of {users.length} sample users</p>
      {[['STUDENT', 'Students'], ['TECHNICIAN', 'Technicians'], ['ADMIN', 'Administrators']]
        .filter(([sectionRole]) => !role || sectionRole === role)
        .map(([sectionRole, title]) => (
          <Table
            key={sectionRole}
            title={title}
            headers={['User ID', 'Full Name', 'Institutional Email', 'Account Status', 'Created Date', 'Action']}
            rows={records
              .filter((user) => user.role === sectionRole)
              .map((user) => [
                user.id,
                user.name,
                user.email,
                <AdminBadge value={user.status} />,
                dateText(user.createdAt),
                <button className="incident-view" onClick={() => open('user', user.id)}>View {user.id}</button>,
              ])}
          />
        ))}
    </>
  );
}

function Services({ preview }) {
  return (
    <Table
      title="Campus IT services"
      headers={['Service ID', 'Service Name', 'Category', 'Description', 'Business Criticality', 'Service Status', 'Related Incidents']}
      rows={services.map((service) => [
        service.id,
        service.name,
        readableLabel(service.category),
        service.description,
        readableLabel(service.criticality),
        <AdminBadge value={service.status} />,
        demoIncidents.filter((incident) => incident.affectedService === service.name).length,
      ])}
    />
  );
}

function Categories({ preview }) {
  return (
    <Table
      title="Incident categories"
      headers={['Category Name', 'Description', 'Related Technical Skills', 'Status', 'Related Incidents']}
      rows={incidentCategories.map((category) => [
        category.name,
        category.description,
        category.skills.map((skill) => technicianSkills.find((item) => item.value === skill)?.label || skill).join(', '),
        category.status,
        demoIncidents.filter((incident) => incident.category === category.name).length,
      ])}
    />
  );
}

function SlaPolicies({ open }) {
  return (
    <>
      <p className="report-guidance">
        Response SLA measures time to initial acknowledgment; resolution SLA measures time to resolution. Java determines deadlines from priority and policy.
      </p>
      <Table
        title="SLA policies"
        headers={['Policy ID', 'Priority', 'Response Target', 'Resolution Target', 'Policy Status']}
        rows={slaPolicies.map((policy) => [policy.id, policy.priority, policy.response, policy.resolution, policy.status])}
      />
      <Cards items={slaStates.map((status) => [readableLabel(status), demoIncidents.filter((incident) => incident.slaStatus === status).length])} />
      <IncidentList title="SLA monitoring: seeded snapshots" records={demoIncidents} open={open} />
    </>
  );
}

function Escalations({ open }) {
  const records = demoIncidents.filter((incident) => incident.escalation);
  return (
    <>
      <p className="report-guidance">
        Demonstration hierarchy: Technician → Team Lead → System Administrator → IT Manager. These are escalation tiers.
      </p>
      <Table
        title="Escalated incidents"
        headers={['Incident', 'Priority', 'Assigned Technician', 'Reason', 'SLA', 'Level', 'Time Escalated', 'Action']}
        rows={records.map((incident) => [
          incident.id,
          incident.priority,
          person(incident.primaryTechnicianId),
          incident.escalation.reason,
          <AdminBadge value={incident.slaStatus} />,
          incident.escalation.level,
          dateText(incident.escalation.escalatedAt),
          <button className="incident-view" onClick={() => open('incident', incident.id)}>Review Escalation</button>,
        ])}
      />
    </>
  );
}

function Reports() {
  const active = demoIncidents.filter(isActive);
  const compliant = demoIncidents.filter((incident) => ['ON_TRACK', 'MET'].includes(incident.slaStatus)).length;
  return (
    <>
      <Cards
        items={[
          ['Total Incidents', demoIncidents.length],
          ['Active Incidents', active.length],
          ['Critical (active P1)', active.filter((incident) => incident.priority === 'P1').length],
          ['Resolved Incidents', demoIncidents.length - active.length],
          ['Closed Incidents', demoIncidents.filter((incident) => incident.status === 'CLOSED').length],
        ]}
      />
      <Table
        title="Incident status distribution"
        headers={['Status', 'Incidents']}
        rows={Object.entries(incidentStatuses).map(([status, details]) => [
          details.label,
          demoIncidents.filter((incident) => incident.status === status).length,
        ])}
      />
      <Table
        title="Category distribution"
        headers={['Category', 'Incidents']}
        rows={incidentCategories.map(({ name }) => [
          readableLabel(name),
          demoIncidents.filter((incident) => incident.category === name).length,
        ])}
      />
      <Table
        title="Priority analysis"
        headers={['Priority', 'Incidents']}
        rows={priorities.map((priority, index) => [
          `${priority} ${['Critical', 'High', 'Medium', 'Low'][index]}`,
          demoIncidents.filter((incident) => incident.priority === priority).length,
        ])}
      />
      <Table
        title="Technician performance"
        headers={['Technician', 'Active primary', 'Active collaborations', 'Resolved primary', 'Availability']}
        rows={technicians.map((technician) => {
          const workload = technicianWorkload(technician.id);
          return [
            technician.name,
            workload.activePrimary,
            workload.activeCollaboration,
            workload.resolved,
            readableLabel(technician.availability),
          ];
        })}
      />
      <Table
        title="SLA monitoring"
        headers={['Measure', 'Incidents']}
        rows={[
          ['Compliant (On track + Met)', compliant],
          ['At risk', demoIncidents.filter((incident) => incident.slaStatus === 'AT_RISK').length],
          ['Breached', demoIncidents.filter((incident) => incident.slaStatus === 'BREACHED').length],
        ]}
      />
    </>
  );
}

function AuditLogs() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [date, setDate] = useState('');
  const records = auditLogs.filter(
    (record) =>
      (!action || record.actionType === action) &&
      (!date || record.timestamp.startsWith(date)) &&
      `${record.incidentId} ${person(record.userId)} ${record.action} ${record.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
  );
  return (
    <>
      <div className="incident-filters">
        <Filter label="Search audit history" name="audit-search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Filter
          label="Action"
          name="audit-action"
          value={action}
          options={[...new Set(auditLogs.map((record) => record.actionType))].map((value) => ({
            value,
            label: readableLabel(value),
          }))}
          onChange={(event) => setAction(event.target.value)}
        />
        <Filter label="Event date" type="date" name="audit-date" value={date} onChange={(event) => setDate(event.target.value)} />
        <button className="report-clear" onClick={() => { setSearch(''); setAction(''); setDate(''); }}>Clear Filters</button>
      </div>
      <AuditTable records={records} />
    </>
  );
}

export default function AdminDashboard({ sessionUser, sessionNotice, onLogout, signingOut = false }) {
  const [page, setPage] = useState('Dashboard');
  const [readIds, setReadIds] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(() => window.matchMedia('(min-width: 901px)').matches);
  const [selection, setSelection] = useState(null);
  const [action, setAction] = useState(null);
  const dialog = useRef(null);

  const admin = sessionUser || users.find((user) => user.role === 'ADMIN');
  const initials = admin?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'AD';

  function open(type, id) {
    setSelection({ type, id });
    setAction(null);
    if (!dialog.current.open) dialog.current.showModal();
  }

  function preview(specification) {
    setSelection({ type: 'preview', id: specification.title });
    setAction(specification);
    if (!dialog.current.open) dialog.current.showModal();
  }

  function close() {
    dialog.current.close();
  }

  function navigate(nextPage) {
    if (dialog.current.open) close();
    setPage(nextPage);
    if (window.matchMedia('(max-width: 900px)').matches) setIsMenuOpen(false);
  }

  let content;
  switch (page) {
    case 'All Incidents':
      content = <AllIncidents open={open} />;
      break;
    case 'Classification Review':
      content = <AdminManagement page="Classification Review" onNavigate={navigate} />;
      break;
    case 'Transfer Requests':
      content = <Requests key="transfers" type="transfer" open={open} />;
      break;
    case 'Collaboration Requests':
      content = <Requests key="collaborations" type="collaboration" open={open} />;
      break;
    case 'Manage Technicians':
      content = <Technicians open={open} preview={preview} navigate={navigate} />;
      break;
    case 'Manage Users':
      content = <Users open={open} preview={preview} />;
      break;
    case 'IT Services':
      content = <Services preview={preview} />;
      break;
    case 'Incident Categories':
      content = <Categories preview={preview} />;
      break;
    case 'Urgency & Impact Rules':
      content = <AdminManagement page="Urgency & Impact Rules" />;
      break;
    case 'Assignment Strategies':
      content = <AssignmentManagement mode="strategy" role="ADMIN" userId={sessionUser?.id} />;
      break;
    case 'SLA Policies':
      content = <SlaPolicies open={open} />;
      break;
    case 'Escalations':
      content = <Escalations open={open} preview={preview} />;
      break;
    case 'Reports & Analytics':
      content = <Reports />;
      break;
    case 'Audit Logs':
      content = <AuditLogs />;
      break;
    case 'Notifications':
      content = (
        <Notifications
          records={adminNotifications}
          readIds={readIds}
          onRead={(id) => setReadIds((previous) => (previous.includes(id) ? previous : [...previous, id]))}
          onOpen={(item) => open(item.target, item.referenceId)}
        />
      );
      break;
    case 'Settings':
      content = (
        <section className="report-form admin-section">
          <h2>System Configuration</h2>
          <p>Manage classification policies, technician assignment strategies, and SLA targets.</p>
          <div className="report-actions">
            <button className="incident-view" onClick={() => navigate('Assignment Strategies')}>
              Open Assignment &amp; Priority Strategies
            </button>
            <button className="report-clear" onClick={() => navigate('Urgency & Impact Rules')}>
              Classification Engine Rules
            </button>
            <button className="report-clear" onClick={() => navigate('SLA Policies')}>
              SLA Policies
            </button>
          </div>
        </section>
      );
      break;
    case 'Profile':
      content = (
        <section className="profile-container" aria-labelledby="admin-profile-title">
          <div className="dashboard-welcome">
            <div>
              <h2 id="admin-profile-title">Administrator Account Profile</h2>
              <p>System administrative credentials and session controls.</p>
            </div>
          </div>
          <div className="profile-card">
            <div className="profile-header">
              <span className="profile-avatar-large" aria-hidden="true">{initials}</span>
              <div className="profile-meta">
                <h3>{admin.name}</h3>
                <p className="profile-role">System Administrator · BITS Pilani, Hyderabad Campus</p>
                <AdminBadge value="ACTIVE" />
              </div>
            </div>
            <dl className="incident-details profile-grid">
              {[
                ['Full Name', admin.name],
                ['Institutional Email', admin.email],
                ['Administrative Role', sessionUser ? 'ADMIN' : 'ADMIN (Demo)'],
                ['Campus', 'BITS Pilani, Hyderabad Campus'],
                ['Access Scope', 'Full IT Operations &amp; Configuration'],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {sessionUser?.passwordManagement && <PasswordSettings />}
            <div className="profile-security-box">
              <h4>System Security &amp; Audit</h4>
              <p className="report-guidance">
                All administrative configuration changes, reclassifications, and policy updates are permanently audited in the PostgreSQL audit log.
              </p>
            </div>
            {sessionUser && (
              <div className="profile-actions-bar">
                <button className="danger-button" type="button" disabled={signingOut} onClick={onLogout}>
                  <NavIcon name="profile" />
                  <span>{signingOut ? 'Signing out…' : 'Sign Out of BITSolve'}</span>
                </button>
              </div>
            )}
          </div>
        </section>
      );
      break;
    default:
      content = <DashboardHome open={open} navigate={navigate} />;
  }

  const managementPages = [
    'Manage Users',
    'IT Services',
    'Incident Categories',
    'Classification Review',
    'Urgency & Impact Rules',
    'SLA Policies',
    'Escalations',
    'Reports & Analytics',
    'Audit Logs',
  ];
  if (sessionUser && (managementPages.includes(page) || page === 'Manage IT Problem Templates')) {
    content = <AdminManagement key={page} page={page} onNavigate={navigate} />;
  }
  if (sessionUser && page === 'Settings') {
    content = (
      <section className="report-form admin-section">
        <h2>System Configuration</h2>
        <p>Manage persisted priority models, assignment strategies, and SLA targets.</p>
        <div className="report-actions">
          <button className="incident-view" onClick={() => navigate('Assignment Strategies')}>
            Open Assignment &amp; Priority Strategies
          </button>
        </div>
      </section>
    );
  }
  if (sessionUser && page === 'Notifications') content = <Notifications live role="ADMIN" />;
  if (sessionUser && ['Dashboard', 'All Incidents'].includes(page)) {
    content = page === 'Dashboard' ? <OperationsDashboard role="ADMIN" onNavigate={navigate} /> : <LiveIncidents role="ADMIN" />;
  }
  const assignmentPages = {
    'Transfer Requests': 'transfer',
    'Collaboration Requests': 'collaboration',
    'Manage Technicians': 'workload',
    'Assignment Strategies': 'strategy',
  };
  if (sessionUser && assignmentPages[page]) {
    content = (
      <AssignmentManagement
        key={page}
        mode={assignmentPages[page]}
        role="ADMIN"
        userId={sessionUser.id}
      />
    );
  }

  return (
    <div className={`student-dashboard admin-portal${isMenuOpen ? '' : ' menu-collapsed'}`}>
      <aside className="dashboard-sidebar" id="admin-sidebar" hidden={!isMenuOpen}>
        <div className="dashboard-brand">
          <div className="brand-logo-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <span className="brand-name">BITSolve</span>
            <span className="brand-caption">Administrator Portal</span>
          </div>
        </div>

        <nav aria-label="Administrator navigation">
          {navGroups.map((group) => (
            <div key={group.group} className="nav-group-section">
              <span className="nav-group-heading">{group.group}</span>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  className={page === item.name ? 'dashboard-nav-active' : ''}
                  aria-current={page === item.name ? 'page' : undefined}
                  onClick={() => navigate(item.name)}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="dashboard-sidebar-footer">
          <p className="dashboard-sidebar-note">
            <strong>BITS Pilani</strong><br />System Administration
          </p>
        </div>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div className="dashboard-heading">
            <Button27 isOpen={isMenuOpen} onToggle={() => setIsMenuOpen(!isMenuOpen)} controls="admin-sidebar" />
            <h1>{page === 'Dashboard' ? 'Administrator Dashboard' : page}</h1>
          </div>
          <button type="button" className="dashboard-profile" onClick={() => navigate('Profile')} title="View Profile" aria-label="View administrator profile">
            <span className="dashboard-avatar" aria-hidden="true">{initials}</span>
            <div>
              <strong>{admin.name}</strong>
              <span>{sessionUser ? 'Administrator' : 'Administrator · Demo'}</span>
            </div>
          </button>
        </header>

        <main className="dashboard-content">
          {!sessionUser && (
            <div className="dashboard-preview-note">
              <p><strong>Development preview</strong> · Viewing sample administrative records.</p>
              <div className="preview-links">
                <a href="?preview=student">Student preview</a>
                <a href="?preview=technician">Technician preview</a>
                <a href="/">Back to login</a>
              </div>
            </div>
          )}

          {!sessionUser && (
            <div className="dashboard-welcome">
              <div>
                <h2>{page === 'Dashboard' ? 'Campus IT Support Overview' : page}</h2>
                <p>Manage incidents, campus IT services, classification engines, and technician workloads.</p>
              </div>
            </div>
          )}

          {content}
        </main>

        <footer className="dashboard-footer">
          <span>BITSolve — BITS Hyderabad IT Support</span>
          <span>Single Source of Truth · Production ITSM</span>
        </footer>
      </div>

      <dialog
        ref={dialog}
        className="incident-dialog admin-dialog"
        aria-labelledby="admin-dialog-title"
        onClose={() => {
          setSelection(null);
          setAction(null);
        }}
      >
        <div className="dashboard-section-heading dialog-header">
          <h2 id="admin-dialog-title">
            {selection?.type === 'preview' ? selection.id : `${selection?.id || ''} · Review`}
          </h2>
          <button className="dialog-close-btn" type="button" autoFocus onClick={close}>
            ✕
          </button>
        </div>
        <p className="report-guidance">Inspection and proposal review.</p>
        {selection?.type === 'preview' && action && (
          <PreviewForm key={`${action.title}-${action.subject}`} specification={action} />
        )}
      </dialog>
    </div>
  );
}
