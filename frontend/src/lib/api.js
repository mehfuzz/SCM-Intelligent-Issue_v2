// Thin fetch wrapper around the Vercel serverless API. When the API is
// unreachable (e.g. running the SPA without Supabase configured), callers can
// fall back to the bundled mock data in src/data/mockData.js.

const BASE = process.env.REACT_APP_API_BASE || '/api';

const authHeaders = () => {
  try {
    const raw = localStorage.getItem('airtel_scm_auth_user');
    if (!raw) return {};
    const u = JSON.parse(raw);
    return {
      'X-User-Id':   u.id || '',
      'X-User-Name': u.name || '',
      'X-User-Role': u.role || '',
    };
  } catch { return {}; }
};

const request = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
};

export const api = {
  // Health
  health: () => request('/health'),

  // Auth
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  // Tickets
  listTickets: ({ role, userId } = {}) => {
    const params = new URLSearchParams();
    if (role)   params.set('role', role);
    if (userId) params.set('user_id', userId);
    const qs = params.toString();
    return request(`/tickets${qs ? `?${qs}` : ''}`);
  },
  getTicket:    (id)       => request(`/tickets/${encodeURIComponent(id)}`),
  createTicket: (payload)  => request('/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  patchTicket:  (id, body) => request(`/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),

  // Users
  listUsers: () => request('/users'),

  // Audit
  listAudit:  ({ ticketId } = {}) => {
    const qs = ticketId ? `?ticket_id=${encodeURIComponent(ticketId)}` : '';
    return request(`/audit${qs}`);
  },
  logAudit:   (entry) => request('/audit', { method: 'POST', body: JSON.stringify(entry) }),

  // Comments
  listComments:  (ticketId) => request(`/comments?ticket_id=${encodeURIComponent(ticketId)}`),
  postComment:   (ticketId, body) => request('/comments', {
    method: 'POST',
    body: JSON.stringify({ ticket_id: ticketId, body }),
  }),

  // Notifications
  listNotifications: (userId) => request(`/notifications?user_id=${encodeURIComponent(userId)}`),
  markNotification:  (id, read = true) => request('/notifications', {
    method: 'PATCH', body: JSON.stringify({ id, read }),
  }),

  // Test evidence
  listTestEvidence: (ticketId) => request(`/test-evidence?ticket_id=${encodeURIComponent(ticketId)}`),
  postTestEvidence: (ticketId, label, url) => request('/test-evidence', {
    method: 'POST',
    body: JSON.stringify({ ticket_id: ticketId, label, url }),
  }),
};

// Best-effort check used by the boot-time data hydrator. Treats any error as
// "use the mock data baked into the bundle" so local dev without Supabase
// keeps working.
export const isApiAvailable = async () => {
  try {
    const r = await fetch(`${BASE}/health`);
    if (!r.ok) return false;
    const j = await r.json();
    return Boolean(j.ok && j.supabaseConfigured);
  } catch { return false; }
};
