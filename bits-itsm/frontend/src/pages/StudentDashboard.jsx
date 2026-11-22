import NotificationShortcut from '../components/NotificationShortcut.jsx';
import React, { useState } from 'react';
import PasswordSettings from '../PasswordSettings.jsx';
import ReportIncident from '../ReportIncident.jsx';
import Button27 from '../components/ui/button-27.jsx';
import Notifications from '../Notifications.jsx';
import LiveIncidents from '../LiveIncidents.jsx';
import OperationsDashboard from '../OperationsDashboard.jsx';
import MyIncidents, { IncidentSummary, incidentStatuses, readableLabel } from '../MyIncidents.jsx';
import NavIcon from '../components/NavIcon.jsx';
import Badge from '../components/ui/Badge.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import { demoIncidents as sampleIncidents, users, studentNotifications } from '../demoData.js';
export default function StudentDashboard({ incidents: allIncidents = sampleIncidents, sessionUser, sessionNotice, onLogout, signingOut = false }) {
  const [page, setPage] = useState('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(() => window.matchMedia('(min-width: 901px)').matches);
  const [studentId, setStudentId] = useState('S101');
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [readIds, setReadIds] = useState([]);
  const student = users.find((user) => user.id === studentId);
  const incidents = allIncidents.filter((incident) => incident.reporterId === studentId);

  function navigate(nextPage) {
    setPage(nextPage);
    setSelectedIncidentId(null);
    if (window.matchMedia('(max-width: 900px)').matches) setIsMenuOpen(false);
  }

  const currentUser = sessionUser || student;
  const initials = currentUser?.name?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'ST';

  return (
    <div className={`student-dashboard${isMenuOpen ? '' : ' menu-collapsed'}`}>
      <aside className="dashboard-sidebar" id="student-sidebar" hidden={!isMenuOpen}>
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
            <span className="brand-caption">Student Portal</span>
          </div>
        </div>

        <nav aria-label="Student navigation">
          <button
            type="button"
            className={page === 'dashboard' ? 'dashboard-nav-active' : ''}
            aria-current={page === 'dashboard' ? 'page' : undefined}
            onClick={() => navigate('dashboard')}
          >
            <NavIcon name="dashboard" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={page === 'report' ? 'dashboard-nav-active' : ''}
            aria-current={page === 'report' ? 'page' : undefined}
            onClick={() => navigate('report')}
          >
            <NavIcon name="report" />
            <span>Report Incident</span>
          </button>
          <button
            type="button"
            className={page === 'incidents' ? 'dashboard-nav-active' : ''}
            aria-current={page === 'incidents' ? 'page' : undefined}
            onClick={() => navigate('incidents')}
          >
            <NavIcon name="incidents" />
            <span>My Incidents</span>
          </button>
          <button
            type="button"
            className={page === 'notifications' ? 'dashboard-nav-active' : ''}
            aria-current={page === 'notifications' ? 'page' : undefined}
            onClick={() => navigate('notifications')}
          >
            <NavIcon name="notifications" />
            <span>Notifications</span>
          </button>
          <button
            type="button"
            className={page === 'profile' ? 'dashboard-nav-active' : ''}
            aria-current={page === 'profile' ? 'page' : undefined}
            onClick={() => navigate('profile')}
          >
            <NavIcon name="profile" />
            <span>Profile &amp; Settings</span>
          </button>
        </nav>

        <div className="dashboard-sidebar-footer">
          <p className="dashboard-sidebar-note">
            <strong>BITS Pilani</strong><br />Hyderabad Campus
          </p>
        </div>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div className="dashboard-heading">
            <Button27 isOpen={isMenuOpen} onToggle={() => setIsMenuOpen(!isMenuOpen)} />
            <h1>
              {page === 'report'
                ? 'Report Incident'
                : page === 'incidents'
                ? 'My Incidents'
                : page === 'notifications'
                ? 'Notifications'
                : page === 'profile'
                ? 'Student Profile & Settings'
                : 'Student Dashboard'}
            </h1>
          </div>
          <div className="dashboard-user-area"><NotificationShortcut live={Boolean(sessionUser)} onOpen={() => navigate('notifications')} /><button type="button" className="dashboard-profile" onClick={() => navigate('profile')} title="View Profile" aria-label="View student profile">
            <span className="dashboard-avatar" aria-hidden="true">{initials}</span>
            <div>
              <strong>{currentUser?.name}</strong>
              <span>{sessionUser ? 'Student' : 'Student · Demo'}</span>
            </div>
          </button></div>
        </header>

        <main className="dashboard-content">
          {!sessionUser && (
            <div className="dashboard-preview-note">
              <p><strong>Development preview</strong> · Viewing sample student data. This preview does not authenticate an account.</p>
              <div className="preview-links">
                <a href="?preview=technician">Technician preview</a>
                <a href="?preview=admin">Administrator preview</a>
                <a href="/">Back to login</a>
              </div>
            </div>
          )}

          {!sessionUser && (
            <div className="report-field technician-selector">
              <label htmlFor="demo-student">Demo student (preview only)</label>
              <select
                id="demo-student"
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  navigate('dashboard');
                }}
              >
                {users.filter((user) => user.role === 'STUDENT').map((user) => (
                  <option key={user.id} value={user.id}>{user.name} ({user.studentId})</option>
                ))}
              </select>
            </div>
          )}

          {sessionUser && ['dashboard', 'incidents'].includes(page) ? (
            page === 'dashboard' ? <OperationsDashboard role="STUDENT" onNavigate={navigate} /> : <LiveIncidents
              role="STUDENT"
              dashboard={page === 'dashboard'}
              initialIncidentId={selectedIncidentId || Number(new URLSearchParams(window.location.search).get('incident')) || undefined}
            />
          ) : (
            <>
              {page === 'report' ? (
                <ReportIncident onOpenIncident={(id) => { navigate('incidents'); setSelectedIncidentId(id); }} live={Boolean(sessionUser)} onCancel={() => navigate('dashboard')} />
              ) : page === 'incidents' ? (
                <MyIncidents key={studentId} incidents={incidents} initialIncidentId={selectedIncidentId} />
              ) : page === 'notifications' ? (
                <Notifications
                  live={Boolean(sessionUser)}
                  records={studentNotifications.filter((item) => item.studentId === studentId)}
                  readIds={readIds}
                  onRead={(id) => setReadIds((previous) => previous.includes(id) ? previous : [...previous, id])}
                  canOpen={(item) => incidents.some((incident) => incident.id === item.incidentId)}
                  onOpen={sessionUser ? undefined : (item) => {
                    navigate('incidents');
                    setSelectedIncidentId(item.incidentId);
                  }}
                />
              ) : page === 'profile' ? (
                <section className="profile-container" aria-labelledby="student-profile-title">
                  <div className="dashboard-welcome">
                    <div>
                      <h2 id="student-profile-title">Account Profile</h2>
                      <p>View your BITS Hyderabad institutional account details and session controls.</p>
                    </div>
                  </div>

                  <div className="profile-card">
                    <div className="profile-header">
                      <span className="profile-avatar-large" aria-hidden="true">{initials}</span>
                      <div className="profile-meta">
                        <h3>{currentUser.name}</h3>
                        <p className="profile-role">Student · BITS Pilani, Hyderabad Campus</p>
                        <Badge value="ACTIVE" type="status" />
                      </div>
                    </div>

                    <dl className="incident-details profile-grid">
                      {(sessionUser
                        ? [
                            ['Full Name', sessionUser.name],
                            ['Institutional Email', sessionUser.email],
                            ['Account Role', sessionUser.role],
                            ['Campus', 'BITS Pilani, Hyderabad Campus'],
                          ]
                        : [
                            ['Full Name', student.name],
                            ['Student ID', student.studentId],
                            ['Institutional Email', student.email],
                            ['Campus', 'BITS Pilani, Hyderabad Campus'],
                            ['Reported Incidents', `${incidents.length} incidents`],
                          ]
                      ).map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>

                    {sessionUser?.passwordManagement && <PasswordSettings />}
                    <div className="profile-security-box">
                      <h4>Security &amp; Privacy</h4>
                      <p className="report-guidance">
                        Your account credentials are valid for campus IT services. If you suspect unauthorized access, contact the IT administration desk immediately.
                      </p>
                    </div>

                    {sessionUser && (
                      <div className="profile-actions-bar">
                        <button
                          className="danger-button"
                          type="button"
                          disabled={signingOut}
                          onClick={onLogout}
                        >
                          <NavIcon name="profile" />
                          <span>{signingOut ? 'Signing out…' : 'Sign Out of BITSolve'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <>
                  <section className="dashboard-welcome" aria-labelledby="dashboard-welcome-title">
                    <div>
                      <h2 id="dashboard-welcome-title">Welcome back, {sessionUser?.name?.split(' ')[0] || student?.name?.split(' ')[0] || 'Student'}!</h2>
                      <p>Manage and track your campus IT support requests in real time.</p>
                    </div>
                    <button className="dashboard-report" type="button" onClick={() => navigate('report')}>
                      <NavIcon name="report" />
                      <span>Report New Incident</span>
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
                            <tr>
                              {['Incident ID', 'Issue Title', 'Category', 'Priority', 'Status', 'Date'].map((heading) => (
                                <th key={heading} scope="col">{heading}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {incidents.map((incident) => (
                              <tr key={incident.id}>
                                <td className="dashboard-incident-id">{incident.id}</td>
                                <td className="dashboard-incident-title">{incident.title}</td>
                                <td>{readableLabel(incident.category)}</td>
                                <td><Badge value={incident.priority} type="priority" /></td>
                                <td><Badge value={incident.status} type="status" /></td>
                                <td><time dateTime={incident.createdAt}>{incident.createdAt.slice(0, 10)}</time></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>

        <footer className="dashboard-footer">
          <span>BITSolve — BITS Hyderabad IT Support</span>
          <span>Single Source of Truth · Production ITSM</span>
        </footer>
      </div>
    </div>
  );
}
