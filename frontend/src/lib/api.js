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
  login: (email, password) => request('/users', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', email, password }),
  }),
  createUser: (payload) => request('/users', {
    method: 'POST',
    body: JSON.stringify({ action: 'create_user', ...payload }),
  }),
  changePassword: (userId, currentPassword, newPassword) => request('/users', {
    method: 'POST',
    body: JSON.stringify({ action: 'change_password', userId, currentPassword, newPassword }),
  }),
  deactivateUser: (userId) => request('/users', {
    method: 'POST',
    body: JSON.stringify({ action: 'deactivate_user', userId }),
  }),
  activateUser: (userId) => request('/users', {
    method: 'POST',
    body: JSON.stringify({ action: 'activate_user', userId }),
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
  // Fan-out post: { recipients: ['u1','u2'], type, title, message, ticketId }
  postNotification:  (payload) => request('/notifications', {
    method: 'POST', body: JSON.stringify(payload),
  }),

  // Test evidence
  listTestEvidence: (ticketId) => request(`/test-evidence?ticket_id=${encodeURIComponent(ticketId)}`),
  postTestEvidence: (ticketId, label, url) => request('/test-evidence', {
    method: 'POST',
    body: JSON.stringify({ ticket_id: ticketId, label, url }),
  }),

  // ──────────────────────────────────────────────────────────────────────
  // AI
  // ──────────────────────────────────────────────────────────────────────
  // POST /api/ai/generate-brd
  generateBrd: (ticketId, ticket) => request('/ai/generate-brd', {
    method: 'POST',
    body: JSON.stringify({ ticketId, ticket }),
  }),

  // Insights (Feature 1)
  listInsights:        ()           => request('/insights'),
  refreshInsights:     ()           => request('/insights', { method: 'POST', body: JSON.stringify({ action: 'refresh' }) }),
  postInsightFeedback: (payload)    => request('/insights', { method: 'POST', body: JSON.stringify(payload) }),

  // Leadership chat (Feature 2). Sessions list + messages now live on the
  // same endpoint as the chat POST to keep us under Vercel Hobby's
  // function-count cap.
  chatSessions:        ()           => request('/ai/leadership-chat'),
  chatMessages:        (sessionId)  => request(`/ai/leadership-chat?session_id=${encodeURIComponent(sessionId)}`),
  chat:                ({ session_id, message }) => request('/ai/leadership-chat', {
    method: 'POST',
    body: JSON.stringify({ session_id, message }),
  }),
};

// Best-effort check used by the boot-time data hydrator. Returns the full
// /api/health payload so the SPA can both decide whether to hydrate from
// live data and surface a clear diagnostic banner when it can't.
export const fetchHealth = async () => {
  try {
    const r = await fetch(`${BASE}/health`);
    if (!r.ok) return { ok: false, reason: `health endpoint returned ${r.status}` };
    const j = await r.json();
    return j;
  } catch (e) {
    return { ok: false, reason: e?.message || 'network error contacting /api/health' };
  }
};

export const isApiAvailable = async () => {
  const h = await fetchHealth();
  return Boolean(h?.ok && h?.supabaseConfigured && h?.dbReachable && h?.schemaApplied);
};
