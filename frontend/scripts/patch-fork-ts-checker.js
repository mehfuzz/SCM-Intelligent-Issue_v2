/* eslint-disable */
// Replaces fork-ts-checker-webpack-plugin's main entry with a no-op stub.
//
// react-scripts 5.0.1 always require()s fork-ts-checker-webpack-plugin at the
// top of its webpack config. The v6.x plugin pulls in schema-utils@3 +
// ajv-keywords@3 which are incompatible with the newer ajv-keywords@5 that
// terser-webpack-plugin's schema-utils@4 needs — and npm cannot satisfy both
// in a single tree, so the build crashes with `Error: Unknown keyword
// formatMinimum`.
//
// This is a JavaScript-only codebase, so the plugin is never instantiated
// (CRA only constructs it when a tsconfig.json exists). Short-circuiting the
// module entirely removes the require-time crash without changing behaviour.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgDir = path.join(root, 'node_modules', 'fork-ts-checker-webpack-plugin');

if (!fs.existsSync(pkgDir)) {
  // Not installed (yet) — nothing to patch.
  process.exit(0);
}

let pkg = {};
try {
  pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
} catch (e) {
  console.warn('[patch-fork-ts-checker] could not read package.json:', e.message);
  process.exit(0);
}

const mainRel = pkg.main || 'lib/index.js';
const mainAbs = path.join(pkgDir, mainRel);

const stub = `'use strict';
// Patched at install time: this codebase does not use TypeScript so the
// fork-ts-checker-webpack-plugin is intentionally no-op'd to avoid
// require-time crashes in CRA 5.0.1's dependency tree.
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
  console.log('[patch-fork-ts-checker] stubbed', path.relative(root, mainAbs));
} catch (e) {
  console.warn('[patch-fork-ts-checker] failed to write stub:', e.message);
}
