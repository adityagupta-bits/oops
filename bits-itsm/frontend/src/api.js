const sessionEvents = new EventTarget();

// App listens here so every page returns to login when the session expires.
export function onSessionExpired(callback) {
  sessionEvents.addEventListener('expired', callback);
  return () => sessionEvents.removeEventListener('expired', callback);
}

export async function apiRequest(path, options = {}) {
  let response;
  let data;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    response = await fetch(`/api/${path}`, { ...options, credentials: 'include', signal: options.signal || controller.signal });
    data = await response.json().catch(() => null);
  } catch {
    if (controller.signal.aborted) throw new Error(options.method && options.method !== 'GET' ? 'The server took too long to respond. The save may have completed. Check the saved records before submitting again.' : 'The server took too long to respond. Please try again.');
    throw new Error('Unable to connect to the BITSolve server.');
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 && path !== 'auth/login' && path !== 'auth/me') {
    sessionEvents.dispatchEvent(new Event('expired'));
  }
  if (!response.ok || !data) {
    const error = new Error(response.status === 401 && path !== 'auth/login' ? 'Please sign in again. Your session may have expired.' : response.status >= 500 || !data ? 'Unable to connect to the BITSolve server.' : data.message || (response.status === 404 ? 'This operation is unavailable on the running backend (HTTP 404). The updated backend must be deployed.' : `The request could not be completed (HTTP ${response.status}).`));
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function apiSend(path, body, method = 'POST') {
  const csrf = await apiRequest('auth/csrf');
  return apiRequest(path, {
    method,
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export const apiPost = apiSend;
