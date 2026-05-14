/* eslint-disable */
// Postinstall patches to neutralise CRA 5.0.1's tangled ajv/schema-utils tree.
//
// 1) Stub fork-ts-checker-webpack-plugin's main entry. CRA always require()s
//    it, but with no tsconfig.json present the plugin is never instantiated.
//    Its v6.x require chain pulls schema-utils@3 + ajv-keywords@3, which
//    conflicts with the modern stack pulled by terser-webpack-plugin.
//
// 2) Stub the validate() entry of every schema-utils@3 instance under
//    node_modules. schema-utils@3's only job is to verify plugin option
//    shapes against a JSON schema — useful in development, irrelevant for
//    the production build. The crash happens because schema-utils@3 calls
//    ajv-keywords@3 with the `formatMinimum` keyword, which the hoisted
//    ajv-keywords@5 (forced by the ajv@8 override needed for terser-
//    webpack-plugin) does not understand. Replacing schema-utils@3's main
//    file with a no-op short-circuits that chain on every offending plugin.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nodeModules = path.join(root, 'node_modules');

if (!fs.existsSync(nodeModules)) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 1) fork-ts-checker-webpack-plugin stub
// ---------------------------------------------------------------------------
function stubForkTsChecker() {
  const pkgDir = path.join(nodeModules, 'fork-ts-checker-webpack-plugin');
  if (!fs.existsSync(pkgDir)) return;

  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  } catch (e) {
    console.warn('[patch] could not read fork-ts-checker package.json:', e.message);
    return;
  }

  const mainRel = pkg.main || 'lib/index.js';
  const mainAbs = path.join(pkgDir, mainRel);

  const stub = `'use strict';
class ForkTsCheckerWebpackPlugin {
  constructor(options) { this.options = options || {}; }
  apply() { /* no-op */ }
}
ForkTsCheckerWebpackPlugin.issuesFromDiagnostics = () => [];
ForkTsCheckerWebpackPlugin.formatter = { default: { codeframe: () => '' } };
module.exports = ForkTsCheckerWebpackPlugin;
module.exports.default = ForkTsCheckerWebpackPlugin;
module.exports.ForkTsCheckerWebpackPlugin = ForkTsCheckerWebpackPlugin;
`;

  try {
    fs.mkdirSync(path.dirname(mainAbs), { recursive: true });
    fs.writeFileSync(mainAbs, stub);
    console.log('[patch] stubbed', path.relative(root, mainAbs));
  } catch (e) {
    console.warn('[patch] failed to write fork-ts-checker stub:', e.message);
  }
}

// ---------------------------------------------------------------------------
// 2) schema-utils@3 → no-op validate
//    ajv-keywords@3 → no-op augmenter (silently accepts unknown keywords)
// ---------------------------------------------------------------------------
const SCHEMA_UTILS_STUB = `'use strict';
// Patched at install time. schema-utils@3's options validation is a dev-time
// nicety; bypassing it avoids a require-chain crash caused by the CRA 5.0.1
// dependency mismatch between ajv@8 (forced for terser-webpack-plugin) and
// ajv-keywords@3 (needed by older plugins like workbox-* and webpack-dev-
// server). The production build does not need schema validation to run.
Object.defineProperty(exports, '__esModule', { value: true });
const noop = () => {};
class ValidationError extends Error {
  constructor(errors, schema, options) {
    super('schema-utils validation skipped (stubbed)');
    this.name = 'ValidationError';
    this.errors = errors || [];
    this.schema = schema;
    this.options = options;
  }
}
exports.validate = noop;
exports.default = noop;
exports.ValidationError = ValidationError;
`;

const AJV_KEYWORDS_STUB = `'use strict';
// Patched at install time. ajv-keywords@3 expects ajv@6's internal API
// (\`ajv._formats\`), but the tree is forced to ajv@8 by the CRA fix for
// terser-webpack-plugin. Replacing the augmenter with a no-op prevents the
// "Cannot read properties of undefined (reading 'date')" crash without
// affecting build behaviour — schemas that referenced legacy keywords like
// \`formatMinimum\` will just see those keywords ignored.
function ajvKeywords(ajv, keyword) {
  return ajv;
}
ajvKeywords.get = function () { return undefined; };
module.exports = ajvKeywords;
module.exports.default = ajvKeywords;
`;

function walkAndPatch(dir, depth = 0) {
  if (depth > 12) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === 'schema-utils') {
      patchSchemaUtilsIfV3(full);
    } else if (entry.name === 'ajv-keywords') {
      patchAjvKeywordsIfV3(full);
    } else if (entry.name === 'node_modules' || entry.name.startsWith('@')) {
      walkAndPatch(full, depth + 1);
    } else {
      const nested = path.join(full, 'node_modules');
      if (fs.existsSync(nested)) walkAndPatch(nested, depth + 1);
    }
  }
}

function patchSchemaUtilsIfV3(pkgDir) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  const version = String(pkg.version || '');
  if (!version.startsWith('3.')) return;

  const mainRel = pkg.main || 'dist/index.js';
  const mainAbs = path.join(pkgDir, mainRel);
  try {
    fs.mkdirSync(path.dirname(mainAbs), { recursive: true });
    fs.writeFileSync(mainAbs, SCHEMA_UTILS_STUB);
    console.log('[patch] stubbed', path.relative(root, mainAbs), `(schema-utils@${version})`);
  } catch (e) {
    console.warn('[patch] failed to stub', mainAbs, ':', e.message);
  }
}

function patchAjvKeywordsIfV3(pkgDir) {
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  } catch {
    return;
  }
  const version = String(pkg.version || '');
  if (!version.startsWith('3.')) return;

  const mainRel = pkg.main || 'index.js';
  const mainAbs = path.join(pkgDir, mainRel);
  try {
    fs.mkdirSync(path.dirname(mainAbs), { recursive: true });
    fs.writeFileSync(mainAbs, AJV_KEYWORDS_STUB);
    console.log('[patch] stubbed', path.relative(root, mainAbs), `(ajv-keywords@${version})`);
  } catch (e) {
    console.warn('[patch] failed to stub', mainAbs, ':', e.message);
  }
}

stubForkTsChecker();
walkAndPatch(nodeModules);
