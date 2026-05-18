// Oracle DB client for Vercel serverless (oracledb 6.x Thin mode — no Oracle Client needed).
// Thin mode is the default when initOracleClient() is NOT called.
//
// Supports mTLS via wallet: set ORACLE_WALLET_PEM (base64 of ewallet.pem)
// and ORACLE_WALLET_PASSWORD. The PEM is written to /tmp/oracle-wallet/ on
// first call so the wallet survives within a single serverless invocation.

import oracledb from 'oracledb';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export { randomUUID };

// Force CLOBs returned as plain strings (safe for data < 1GB).
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Write ewallet.pem to /tmp once per cold start if ORACLE_WALLET_PEM is set.
let walletDir = null;
const ensureWallet = () => {
  if (walletDir) return walletDir;
  // Support splitting across up to 3 env vars to stay under Vercel's 4096-char limit.
  const b64 = (process.env.ORACLE_WALLET_PEM_1 || '') +
              (process.env.ORACLE_WALLET_PEM_2 || '') +
              (process.env.ORACLE_WALLET_PEM_3 || '') ||
              process.env.ORACLE_WALLET_PEM || '';
  if (!b64) return null;
  const dir = '/tmp/oracle-wallet';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const pemPath = path.join(dir, 'ewallet.pem');
  if (!fs.existsSync(pemPath)) {
    fs.writeFileSync(pemPath, Buffer.from(b64, 'base64'));
  }
  walletDir = dir;
  return dir;
};

const cfg = () => {
  const base = {
    user:          process.env.ORACLE_USER,
    password:      process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  };
  const wallet = ensureWallet();
  if (wallet) {
    base.walletLocation = wallet;
    if (process.env.ORACLE_WALLET_PASSWORD) {
      base.walletPassword = process.env.ORACLE_WALLET_PASSWORD;
    }
  }
  return base;
};

export const isConfigured = () =>
  Boolean(process.env.ORACLE_USER && process.env.ORACLE_PASSWORD && process.env.ORACLE_CONNECT_STRING);

// ---------------------------------------------------------------------------
// Row normalisation
// ---------------------------------------------------------------------------

// JSON CLOB fields — parsed on read
const JSON_FIELDS = new Set([
  'tags', 'sections', 'versions', 'supporting_numbers', 'cited_ticket_ids',
  'tool_calls', 'tool_args', 'tool_result',
]);

// NUMBER(1) booleans — coerced on read
const BOOL_FIELDS = new Set([
  'must_change_password', 'is_active', 'superseded', 'read',
]);

const processRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, raw] of Object.entries(row)) {
    const key = k.toLowerCase();
    let val = raw instanceof Date ? raw.toISOString() : raw;
    if (BOOL_FIELDS.has(key))  val = val === 1 || val === true;
    if (JSON_FIELDS.has(key)) {
      if (typeof val === 'string') {
        try { val = JSON.parse(val); } catch { /* keep string */ }
      } else if (val === null) {
        val = key === 'sections' ? {} : [];
      }
    }
    out[key] = val;
  }
  return out;
};

// Prepare bind values: arrays/objects → JSON strings, booleans → 0/1
const prepareBinds = (binds) => {
  if (!binds || typeof binds !== 'object') return binds;
  const out = {};
  for (const [k, v] of Object.entries(binds)) {
    if (v === undefined) { out[k] = null; continue; }
    if (typeof v === 'boolean') { out[k] = v ? 1 : 0; continue; }
    if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
      out[k] = JSON.stringify(v);
      continue;
    }
    out[k] = v;
  }
  return out;
};

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

export const query = async (sql, binds = {}) => {
  const conn = await oracledb.getConnection(cfg());
  try {
    const result = await conn.execute(sql, prepareBinds(binds));
    return (result.rows || []).map(processRow);
  } finally {
    await conn.close();
  }
};

export const execute = async (sql, binds = {}) => {
  const conn = await oracledb.getConnection(cfg());
  try {
    return await conn.execute(sql, prepareBinds(binds), { autoCommit: true });
  } finally {
    await conn.close();
  }
};

// INSERT a row then immediately SELECT it back.
// `fetchSql` + `fetchBinds` identify the inserted row.
export const insertAndFetch = async (table, row, fetchSql, fetchBinds) => {
  const cols = Object.keys(row).filter((k) => row[k] !== undefined);
  const placeholders = cols.map((c) => `:${c}`).join(', ');
  const insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  await execute(insertSql, row);
  const [fetched] = await query(fetchSql, fetchBinds);
  return fetched || null;
};

// INSERT many rows (for fan-out notifications etc.)
export const insertMany = async (table, rows) => {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]).filter((k) => rows[0][k] !== undefined);
  const placeholders = cols.map((c) => `:${c}`).join(', ');
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  const conn = await oracledb.getConnection(cfg());
  try {
    await conn.executeMany(sql, rows.map(prepareBinds), { autoCommit: true });
  } finally {
    await conn.close();
  }
};
