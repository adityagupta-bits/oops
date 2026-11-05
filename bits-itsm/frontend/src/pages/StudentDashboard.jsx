import React, { useState } from 'react';
import ReportIncident from '../ReportIncident.jsx';
import Button27 from '../components/ui/button-27.jsx';
import Notifications from '../Notifications.jsx';
import MyIncidents, { IncidentSummary, incidentStatuses, readableLabel } from '../MyIncidents.jsx';
//* some of the sample entries 
import { demoIncidents as sampleIncidents, users, studentNotifications } from '../demoData.js';
//* gives basic overview of present status of incidents 
export default function StudentDashboard({ incidents: allIncidents = sampleIncidents }) {
  const [page, setPage] = useState('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  const [studentId, setStudentId] = useState('S101');
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [readIds, setReadIds] = useState([]);
  const student = users.find((user) => user.id === studentId);
  const incidents = allIncidents.filter((incident) => incident.reporterId === studentId);
  function navigate(nextPage) { setPage(nextPage); setSelectedIncidentId(null); if (window.matchMedia('(max-width: 700px)').matches) setIsMenuOpen(false); }

  return (
    <div className={`student-dashboard${isMenuOpen ? '' : ' menu-collapsed'}`}>
      <aside className="dashboard-sidebar" id="student-sidebar" hidden={!isMenuOpen}>
        <div className="dashboard-brand">
          <span className="brand-name">BITSolve</span>
          <span className="brand-caption">Smart Campus IT Support</span>
        </div>
        <nav aria-label="Student navigation">
          <button type="button" className={page === 'dashboard' ? 'dashboard-nav-active' : ''} aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => navigate('dashboard')}>Dashboard</button>
          <button type="button" className={page === 'report' ? 'dashboard-nav-active' : ''} aria-current={page === 'report' ? 'page' : undefined} onClick={() => navigate('report')}>Report Incident</button>
          <button type="button" className={page === 'incidents' ? 'dashboard-nav-active' : ''} aria-current={page === 'incidents' ? 'page' : undefined} onClick={() => navigate('incidents')}>My Incidents</button>
          {['Notifications', 'Profile'].map((label) => (
            <button key={label} type="button" className={page === label.toLowerCase() ? 'dashboard-nav-active' : ''} aria-current={page === label.toLowerCase() ? 'page' : undefined} onClick={() => navigate(label.toLowerCase())}>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <p className="dashboard-sidebar-note">BITS Pilani<br />Hyderabad Campus</p>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div className="dashboard-heading">
            <Button27 isOpen={isMenuOpen} onToggle={() => setIsMenuOpen(!isMenuOpen)} />
            <h1>{page === 'report' ? 'Report Incident' : page === 'incidents' ? 'My Incidents' : page === 'notifications' ? 'Notifications' : page === 'profile' ? 'Student Profile' : 'Student Dashboard'}</h1>
          </div>
          <div className="dashboard-profile">
            <span className="dashboard-avatar" aria-hidden="true">{student.name.split(' ').map((part) => part[0]).join('')}</span>
            <div><strong>{student.name}</strong><span>Student · Demo</span></div>
          </div>
        </header>

        <main className="dashboard-content">
          <div className="dashboard-preview-note">
            <p><strong>Development preview</strong> · Fictional demo data. No authenticated session.</p>
            <div className="preview-links"><a href="?preview=technician">Technician preview</a><a href="?preview=admin">Administrator preview</a><a href="/">Back to login</a></div>
          </div>

          <div className="report-field technician-selector"><label htmlFor="demo-student">Demo student (preview only)</label><select id="demo-student" value={studentId} onChange={(event) => { setStudentId(event.target.value); navigate('dashboard'); }}>{users.filter((user) => user.role === 'STUDENT').map((user) => <option key={user.id} value={user.id}>{user.name} ({user.studentId})</option>)}</select></div>
          {page === 'report' ? <ReportIncident onCancel={() => navigate('dashboard')} /> : page === 'incidents' ? <MyIncidents key={studentId} incidents={incidents} initialIncidentId={selectedIncidentId} /> : page === 'notifications' ? <Notifications records={studentNotifications.filter((item) => item.studentId === studentId)} readIds={readIds} onRead={(id) => setReadIds((previous) => previous.includes(id) ? previous : [...previous, id])} canOpen={(item) => incidents.some((incident) => incident.id === item.incidentId)} onOpen={(item) => { navigate('incidents'); setSelectedIncidentId(item.incidentId); }} /> : page === 'profile' ? <section className="report-form student-detail-section"><h2>Student Profile</h2><dl className="incident-details">{[['Name', student.name], ['Student ID', student.studentId], ['Institutional Email', student.email], ['Reported Incidents', incidents.length]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="report-guidance">Read-only sample profile. No authenticated account session.</p></section> : <>
          <section className="dashboard-welcome" aria-labelledby="dashboard-welcome-title">
            <div>
              <h2 id="dashboard-welcome-title">Welcome back, Student!</h2>
              <p>Manage and track your IT support requests in one place.</p>
            </div>
            <button className="dashboard-report" type="button" onClick={() => navigate('report')}>
              Report New Incident
            </button>
          </section>

          <IncidentSummary incidents={incidents} />

          <section className="dashboard-incidents" aria-labelledby="recent-incidents-title">
            <div className="dashboard-section-heading">
              <h2 id="recent-incidents-title">Recent Incidents</h2>
              <span>Demo data</span>
            </div>
            {incidents.length === 0 ? (
              <p className="dashboard-empty">No incidents reported yet.</p>
            ) : (
              <div className="dashboard-table-scroll" role="region" aria-labelledby="recent-incidents-title" tabIndex={0}>
                <table>
                  <thead>
                    <tr>{['Incident ID', 'Issue title', 'Category', 'Priority', 'Status', 'Date'].map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident) => (
                      <tr key={incident.id}>
                        <td className="dashboard-incident-id">{incident.id}</td>
                        <td className="dashboard-incident-title">{incident.title}</td>
                        <td>{readableLabel(incident.category)}</td>
                        <td><span className={`incident-priority priority-${incident.priority.toLowerCase()}`}>{incident.priority}</span></td>
                        <td><span className={`incident-status status-${incidentStatuses[incident.status]?.group}`}>{incidentStatuses[incident.status]?.label || readableLabel(incident.status)}</span></td>
                        <td><time dateTime={incident.createdAt}>{incident.createdAt.slice(0, 10)}</time></td>
                       </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </>}
        </main>

        <footer className="dashboard-footer">BITSolve — BITS Hyderabad IT Support</footer>
      </div>
    </div>
  );
}
