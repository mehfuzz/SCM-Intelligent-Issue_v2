// GET /api/health — diagnostic endpoint for Oracle DB connectivity.

import { handleOptions, json } from './_lib/http.js';
import { isConfigured, query } from './_lib/oracle.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  const configured = isConfigured();
  const missing = [];
  if (!process.env.ORACLE_USER)           missing.push('ORACLE_USER');
  if (!process.env.ORACLE_PASSWORD)       missing.push('ORACLE_PASSWORD');
  if (!process.env.ORACLE_CONNECT_STRING) missing.push('ORACLE_CONNECT_STRING');

  let dbReachable = false;
  let userCount   = null;
  let dbError     = null;

  if (configured) {
    try {
      const rows = await query('SELECT COUNT(*) AS cnt FROM app_users', {});
      dbReachable = true;
      userCount = Number(rows[0]?.cnt ?? 0);
    } catch (e) {
      dbError = e?.message || String(e);
    }
  }

  let hint;
  if (!configured) {
    hint = 'Set ORACLE_USER, ORACLE_PASSWORD, and ORACLE_CONNECT_STRING in Vercel project settings, then redeploy.';
  } else if (!dbReachable) {
    hint = 'Oracle env vars set but database is unreachable. Check your connection string and that your ADB instance is running.';
  } else if ((userCount ?? 0) === 0) {
    hint = 'Connected to Oracle but app_users is empty. Run oracle/schema.sql then oracle/seed.sql in your ADB SQL Worksheet.';
  } else {
    hint = 'OK';
  }

  json(res, 200, {
    ok: true,
    dbConfigured:       configured,
    supabaseConfigured: configured,   // alias so frontend hydrate check still works
    dbType:             'oracle',
    connectString:      process.env.ORACLE_CONNECT_STRING
      ? process.env.ORACLE_CONNECT_STRING.slice(0, 40) + '…'
      : null,
    missingEnvVars:     missing,
    dbReachable,
    userCount,
    dbError,
    schemaApplied:      dbReachable && (userCount ?? 0) > 0,
    time:               new Date().toISOString(),
    hint,
  });
}
