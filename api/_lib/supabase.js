// This file previously held the Supabase client.
// The project now uses Oracle Autonomous Database via oracledb (Thin mode).
// All imports should use ./_lib/oracle.js directly.
// This file is kept as a redirect shim to avoid breaking any missed import.
export { isConfigured, query, execute, insertAndFetch, insertMany, randomUUID } from './oracle.js';
