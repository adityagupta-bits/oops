export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, { ...options, credentials: 'include' });
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(response.status === 401 && path !== 'auth/login' ? 'Please sign in again. Your session may have expired.' : response.status >= 500 || !data ? 'Service unavailable. Please try again.' : data.message);
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
