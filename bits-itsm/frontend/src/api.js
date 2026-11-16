export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, { ...options, credentials: 'include' });
  } catch {
    throw new Error('Unable to connect to the BITSolve server.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(response.status === 401 && path !== 'auth/login' ? 'Please sign in again. Your session may have expired.' : response.status >= 500 || !data ? 'Unable to connect to the BITSolve server.' : data.message || 'The request could not be completed.');
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
