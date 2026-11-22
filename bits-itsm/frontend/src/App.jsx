import React, { useEffect, useState } from 'react';
import StudentDashboard from './pages/StudentDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import TechnicianDashboard from './pages/TechnicianDashboard.jsx';
import { apiRequest, apiPost, onSessionExpired } from './api.js';
import PasswordSettings from './PasswordSettings.jsx';

const loginNotice = 'Sign in with your institutional email and password to access campus IT support.';

export default function App() {
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [showSignedIn, setShowSignedIn] = useState(false);

  useEffect(() => {
    if (!user) { setShowSignedIn(false); return; }
    setShowSignedIn(true);
    const timer = setTimeout(() => setShowSignedIn(false), 4000);
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSessionExpired(() => {
      active = false;
      setUser(null);
      setChecking(false);
      setMessage('Please sign in again. Your session has expired or your account is unavailable.');
    });
    apiRequest('auth/me')
      .then((account) => { if (active) setUser(account); })
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

  if (checking) {
    return (
      <main className="session-loading" role="status" aria-live="polite">
        <div className="spinner-border" aria-hidden="true" />
        <span>Checking your session…</span>
      </main>
    );
  }

  if (!user) {
    return (
      <LoginPage
        initialMessage={message}
        onLogin={(account) => {
          setMessage('');
          setUser(account);
        }}
      />
    );
  }

  const Dashboard = {
    STUDENT: StudentDashboard,
    TECHNICIAN: TechnicianDashboard,
    ADMIN: AdminDashboard,
  }[user.role];

  return Dashboard ? (
    <>
      {showSignedIn && <div className="signed-in-toast" role="status"><strong>Signed in as {user.name}</strong><span>{user.email}</span></div>}
      {message && <p className="status-message" role="alert">{message}</p>}
      <Dashboard sessionUser={user} onLogout={logout} signingOut={signingOut} />
    </>
  ) : (
    <main className="portal-error">
      <p role="alert">Your account role is not supported.</p>
    </main>
  );
}

function LoginPage({ onLogin, initialMessage }) {
  const [role, setRole] = useState('STUDENT');
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(initialMessage || '');
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name: fieldName, value } = event.target;
    if (fieldName === 'email') setEmail(value);
    else setPassword(value);
    setErrors((previous) => ({ ...previous, [fieldName]: '' }));
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = {};
    if (registering) {
      if (!name.trim()) {
        nextErrors.name = 'Please enter your full name.';
      }
      if (password !== confirmPassword) {
        nextErrors.confirmPassword = 'Passwords do not match.';
      }
      if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        nextErrors.password = 'Password must be at least 12 characters with a letter and a number.';
      }
    }

    //*regex used here to identify to allow bits official id to have access to it portal
    if (!email) {
      nextErrors.email = 'Please enter your institutional email address.';
    } else if (email !== email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address.';
    } else if (email.length > 254 || !/^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@hyderabad\.bits-pilani\.ac\.in$/i.test(email)) {
      nextErrors.email = 'Use your @hyderabad.bits-pilani.ac.in email address.';
    }

    if (!password.trim()) {
      if (!nextErrors.password) nextErrors.password = 'Please enter your password.';
    } else if (new TextEncoder().encode(password).length > 72) {
      nextErrors.password = 'Password must be at most 72 bytes.';
    }

    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidKey = nextErrors.name ? 'name' : nextErrors.email ? 'email' : nextErrors.password ? 'password' : 'confirmPassword';
      event.currentTarget.elements.namedItem(firstInvalidKey)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (registering) {
        await apiPost('auth/register', { name: name.trim(), email: email.trim(), password, confirmPassword });
        setRegistering(false);
        setPassword('');
        setConfirmPassword('');
        setMessage('Registration successful. Please sign in with your credentials.');
        return;
      }
      const account = await apiPost('auth/login', { email: email.trim(), password, role });
      setPassword('');
      onLogin(account);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Password requirements calculation for student registration feedback
  const hasLength = password.length >= 12;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return (
    <main className="portal">
      <section className="welcome-panel" aria-labelledby="portal-title">
        <div className="brand">
          <div className="brand-logo-mark" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <span className="brand-name">BITSolve</span>
            <span className="brand-caption">Smart Campus IT Support</span>
          </div>
        </div>

        <div className="welcome-content">
          <span className="eyebrow">
            <span className="eyebrow-dot" aria-hidden="true" />
            YOUR CAMPUS. CONNECTED.
          </span>
          <h1 id="portal-title">
            Intelligent IT Support<br />
            <span>for BITS Hyderabad</span>
          </h1>
          <p className="description">
            Welcome to your campus support hub. Get help with everyday IT issues, track progress in real time, and stay focused on what matters.
          </p>

          <ul className="highlights">
            <li>
              <span className="highlight-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </span>
              <div>
                <strong>Report IT Problems</strong>
                <span>One place to raise your Wi-Fi, ERP, and lab concerns.</span>
              </div>
            </li>
            <li>
              <span className="highlight-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </span>
              <div>
                <strong>Track Support Requests</strong>
                <span>Follow investigation notes, SLAs, and resolution steps.</span>
              </div>
            </li>
            <li>
              <span className="highlight-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </span>
              <div>
                <strong>Intelligent Automation</strong>
                <span>Automatic classification, priority calculation, and skill-based assignment.</span>
              </div>
            </li>
          </ul>
        </div>

        <p className="panel-footer">Birla Institute of Technology &amp; Science, Pilani — Hyderabad Campus</p>
      </section>

      <section className="signin-panel" aria-labelledby="signin-title">
        <div className="signin-content">
          <div className="login-card">
            <span className="card-label">CAMPUS IT PORTAL</span>
            <h2 id="signin-title">{registering ? 'Create Student Account' : 'Welcome Back'}</h2>
            <p className="signin-subtitle">
              {registering
                ? 'Register with your institutional BITS Hyderabad email'
                : `Sign in as ${role === 'STUDENT' ? 'a Student' : role === 'TECHNICIAN' ? 'a Support Technician' : 'an Administrator'}`}
            </p>

            <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
              <div className="auth-options" role="group" aria-label="Portal role selection">
                {Object.entries({
                  STUDENT: 'Student',
                  TECHNICIAN: 'Technician',
                  ADMIN: 'Administrator',
                }).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`auth-role-tab ${role === value ? 'active' : ''}`}
                    disabled={submitting}
                    aria-pressed={role === value}
                    onClick={() => {
                      setRole(value);
                      setRegistering(false);
                      setMessage('');
                      setErrors({});
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {registering && (
                <div className="field">
                  <div className="floating-input">
                    <input
                      id="name"
                      name="name"
                      placeholder=" "
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      autoComplete="name"
                      required
                      maxLength={100}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'name-error' : undefined}
                    />
                    <label htmlFor="name">Full Name</label>
                  </div>
                  {errors.name && <p className="field-error" id="name-error" role="alert">{errors.name}</p>}
                </div>
              )}

              <div className="field">
                <div className="floating-input">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder=" "
                    value={email}
                    onChange={handleChange}
                    required
                    spellCheck={false}
                    autoCapitalize="none"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : 'email-hint'}
                  />
                  <label htmlFor="email">Institutional Email</label>
                </div>
                {errors.email ? (
                  <p className="field-error" id="email-error" role="alert">{errors.email}</p>
                ) : (
                  <p className="field-hint" id="email-hint">Must end with @hyderabad.bits-pilani.ac.in</p>
                )}
              </div>

              <div className="field">
                <div className="floating-input password-input">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    placeholder=" "
                    value={password}
                    onChange={handleChange}
                    required
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <label htmlFor="password">Password</label>
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-controls="password"
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className="field-error" id="password-error" role="alert">{errors.password}</p>}
              </div>

              {registering && (
                <>
                  <div className="field">
                    <div className="floating-input">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        placeholder=" "
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                        }}
                        autoComplete="new-password"
                        required
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                      />
                      <label htmlFor="confirmPassword">Confirm Password</label>
                    </div>
                    {errors.confirmPassword && <p className="field-error" id="confirm-error" role="alert">{errors.confirmPassword}</p>}
                  </div>

                  <div className="password-rules" aria-label="Password complexity checklist">
                    <span className={`rule-item ${hasLength ? 'valid' : ''}`}>
                      <span aria-hidden="true">{hasLength ? '✓' : '○'}</span> 12+ characters
                    </span>
                    <span className={`rule-item ${hasLetter ? 'valid' : ''}`}>
                      <span aria-hidden="true">{hasLetter ? '✓' : '○'}</span> Contains a letter
                    </span>
                    <span className={`rule-item ${hasNumber ? 'valid' : ''}`}>
                      <span aria-hidden="true">{hasNumber ? '✓' : '○'}</span> Contains a number
                    </span>
                  </div>
                </>
              )}

              <button className="submit-button" type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-sm" aria-hidden="true" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <span>{registering ? 'Create Account' : `Sign In as ${role === 'STUDENT' ? 'Student' : role === 'TECHNICIAN' ? 'Technician' : 'Administrator'}`}</span>
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>

              {role === 'STUDENT' && (
                <p className="auth-switch">
                  {!registering ? 'New to BITSolve? ' : 'Already have an account? '}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setRegistering(!registering);
                      setPassword('');
                      setConfirmPassword('');
                      setErrors({});
                      setMessage('');
                    }}
                  >
                    {registering ? 'Sign In to existing account' : 'Create a student account'}
                  </button>
                </p>
              )}

              {message && (
                <div className={`status-message ${message.includes('successful') ? 'status-success' : 'status-alert'}`} role={message.includes('successful') ? 'status' : 'alert'}>
                  <span>{message}</span>
                </div>
              )}
              {!message && <p className="status-notice">{loginNotice}</p>}
            </form>

            <PasswordSettings reset />
            <p className="access-note">
              <span aria-hidden="true">◇</span> Only authorized BITS Hyderabad accounts can access this portal. Technicians and administrators must be provisioned by the system administrator.
            </p>
          </div>
          <p className="signin-footer">BITSolve <span aria-hidden="true">·</span> Smart Campus IT Support</p>
        </div>
      </section>
    </main>
  );
}
