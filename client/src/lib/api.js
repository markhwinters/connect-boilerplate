const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return data;
}

// ─── Users (ephemeral sessions) ───────────────────────────────────────────────

export function joinSession({ email, displayName, role, jobTitle, keywords }) {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify({ email, displayName, role, jobTitle, keywords }),
  });
}

export function getUser(id) {
  return request(`/users/${id}`);
}

export function updateUser(id, updates) {
  return request(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export function deleteUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' });
}

export function heartbeat(userId) {
  return request(`/heartbeat/${userId}`, { method: 'POST' });
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export function discover(userId) {
  return request(`/discover/${userId}`);
}

// ─── Swipe ────────────────────────────────────────────────────────────────────

export function swipe(initiatorId, receiverId) {
  return request('/swipe', {
    method: 'POST',
    body: JSON.stringify({ initiatorId, receiverId }),
  });
}
