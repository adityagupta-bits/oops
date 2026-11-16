import React, { useEffect, useState } from 'react';
import StudentDashboard from './pages/StudentDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import TechnicianDashboard from './pages/TechnicianDashboard.jsx';
import { apiRequest, apiPost, onSessionExpired } from './api.js';

const loginNotice = 'Sign in with your institutional email and password to access campus IT support.';

export default function App() {
  // Development previews only; these do not authenticate a user.
  if (import.meta.env.DEV) {
    const preview = new URLSearchParams(window.location.search).get('preview');
    if (preview === 'student') return <StudentDashboard />;
    if (preview === 'admin') return <AdminDashboard />;
    if (preview === 'technician') return <TechnicianDashboard />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSessionExpired(() => {
      active = false;
      setUser(null);
      setChecking(false);
      setMessage('Please sign in again. Your session has expired or your account is unavailable.');
    });
    apiRequest('auth/me').then((account) => { if (active) setUser(account); })
      .catch((error) => { if (active && error.status !== 401) setMessage(error.message); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; unsubscribe(); };
  }, []);

  async function logout() {
    setSigningOut(true);
    setMessage('');
    try {
      await apiPost('auth/logout');
      setUser(null);
    } catch (error) {
      if (error.status === 401) setUser(null);
      else setMessage(error.message);
    } finally {
      setSigningOut(false);
    }
  }

  if (checking) return <main className="session-loading" role="status">Checking your session…</main>;
  if (!user) return <LoginPage initialMessage={message} onLogin={(account) => { setMessage(''); setUser(account); }} />;

  const Dashboard = { STUDENT: StudentDashboard, TECHNICIAN: TechnicianDashboard, ADMIN: AdminDashboard }[user.role];
  const sessionNotice = <div className="dashboard-preview-note">
    <div><p><strong>Signed in as {user.name}</strong> · {user.email}</p>{message && <p role="alert">{message}</p>}</div>
    <button className="report-clear" type="button" disabled={signingOut} onClick={logout}>{signingOut ? 'Signing out…' : 'Sign Out'}</button>
  </div>;
  return Dashboard ? <Dashboard sessionUser={user} sessionNotice={sessionNotice} /> : <main>{sessionNotice}<p role="alert">Your account role is not supported.</p></main>;
}

function LoginPage({ onLogin, initialMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialMessage || '');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    if (name === 'email') setEmail(value);
    else setPassword(value);
    setErrors((previous) => ({ ...previous, [name]: '' }));
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = {};
    //*regex used here to identify to allow bits official id to have access to it portal
    if (!email) {
      nextErrors.email = 'Please enter your institutional email address.';
    } else if (email !== email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address.';
    } else if (email.length > 254 || !/^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@hyderabad\.bits-pilani\.ac\.in$/i.test(email)) {
      nextErrors.email = 'Use your @hyderabad.bits-pilani.ac.in email address.';
    }

    if (!password.trim()) nextErrors.password = 'Please enter your password.';
    else if (new TextEncoder().encode(password).length > 72) nextErrors.password = 'Password must be at most 72 bytes.';

    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0) {
      event.currentTarget.elements.namedItem(nextErrors.email ? 'email' : 'password').focus();
      return;
    }

    setSubmitting(true);
    try {
      const account = await apiPost('auth/login', { email, password });
      setPassword('');
      onLogin(account);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="portal">
      <section className="welcome-panel" aria-labelledby="portal-title">
        <div className="brand">
          <div><span className="brand-name">BITSolve</span><span className="brand-caption">Smart Campus IT Support</span></div>
        </div>

        <div className="welcome-content">
          <span className="eyebrow"><span aria-hidden="true" /> YOUR CAMPUS. CONNECTED.</span>
          <h1 id="portal-title">Intelligent IT Support<br /><span>for BITS Hyderabad</span></h1>
          <p className="description">Welcome to your campus support hub. Get help with everyday IT issues and stay focused on what matters.</p>

          <ul className="highlights">
            <li><span className="highlight-icon" aria-hidden="true">↗</span><div><strong>Report IT Problems</strong><span>One place to raise your IT concerns.</span></div></li>
            <li><span className="highlight-icon" aria-hidden="true">≡</span><div><strong>Track Support Requests</strong><span>Follow your requests, every step of the way.</span></div></li>
            <li><span className="highlight-icon" aria-hidden="true">✧</span><div><strong>Get Technical Assistance</strong><span>Connect with your campus support team.</span></div></li>
          </ul>
        </div>

        <p className="panel-footer">BITS Pilani Hyderabad Campus</p>
      </section>

      <section className="signin-panel" aria-labelledby="signin-title">
        <div className="signin-content">
          <div className="login-card">
            <span className="card-label">CAMPUS PORTAL</span>
            <h2 id="signin-title">Welcome Back</h2>
            <p className="signin-subtitle">Sign in using your BITS Hyderabad account</p>

            <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <div className="field">
                <div className="floating-input">
                  <input id="email" name="email" type="email" autoComplete="username" placeholder=" " value={email} onChange={handleChange} required spellCheck={false} autoCapitalize="none" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : 'email-hint'} />
                  <label htmlFor="email">Institutional email</label>
                </div>
                {errors.email ? <p className="field-error" id="email-error" role="alert">{errors.email}</p> : <p className="field-hint" id="email-hint">Use your Hyderabad campus email address.</p>}
              </div>

              <div className="field">
                <div className="floating-input password-input">
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder=" " value={password} onChange={handleChange} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} />
                  <label htmlFor="password">Password</label>
                  <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="password" aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
                <p className="field-error" id="password-error" role="alert">{errors.password}</p>
              </div>

              <button className="submit-button" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign In'} <span aria-hidden="true">→</span></button>
              <p className="status-message" role="status" aria-hidden={!message}>{message || loginNotice}</p>
            </form>

            <p className="access-note"><span aria-hidden="true">◇</span> Only authorized BITS Hyderabad accounts can access this portal.</p>
          </div>
          <p className="signin-footer">BITSolve <span aria-hidden="true">·</span> Smart Campus IT Support</p>
        </div>
      </section>
    </main>
  );
}
