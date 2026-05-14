// Shared request helpers for serverless functions.

export const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-User-Role, X-User-Name');
};

export const handleOptions = (req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.status(204).end();
    return true;
  }
  setCors(res);
  return false;
};

export const json = (res, status, body) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(status).send(JSON.stringify(body));
};

export const readBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
};

// Best-effort identity lifted from headers set by the SPA. The mock-login
// model means we trust the client here — this is fine for the in-house demo
// scope; swap for Supabase Auth JWT verification before any real deployment.
export const requireUser = (req) => ({
  id:   req.headers['x-user-id']   || null,
  name: req.headers['x-user-name'] || 'Unknown',
  role: req.headers['x-user-role'] || 'Submitter',
});
