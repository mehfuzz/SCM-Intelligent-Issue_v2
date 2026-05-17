// LLM orchestrator.
//
// Tries Groq first; on retryable failure (429 / 5xx / network / non-JSON),
// falls back to Gemini. If both are unavailable, throws a clear error —
// never silently returns a worse-quality output the caller didn't pick.

import * as groq   from './providers/groq.js';
import * as gemini from './providers/gemini.js';
import { BRD_SECTION_KEYS } from './prompts.js';

// Hard per-provider timeout. Vercel free-tier serverless functions have a
// 10s budget; setting each call to 8s leaves room for sequential fallback
// on Pro plans (60s budget) without giving up too quickly on free.
const TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 8000);

const withTimeout = (fn, ms) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error(`timeout after ${ms}ms`)), ms);
  return Promise.resolve(fn(ac.signal)).finally(() => clearTimeout(t));
};

// ---------------------------------------------------------------------------
// Output normalisation
//
// Free-tier LLMs do not always honour the exact key casing or value shape
// our schema asks for. Common patterns we've observed:
//   * camelCase keys ("functionalRequirements")
//   * snake_case keys ("acceptance_criteria")
//   * array values for list-y sections ("Functional Requirements": ["1.", "2."])
//   * nested objects ("Risks & Dependencies": { "risk1": "...", "risk2": "..." })
// Rather than reject the whole response, we normalise here so the BRD
// editor always gets a usable string per section.
// ---------------------------------------------------------------------------

const keyShape = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const KEY_ALIASES = {
  'Background':              ['background'],
  'Objective':               ['objective', 'objectives', 'goal'],
  'Scope':                   ['scope', 'scopeofwork', 'inscope'],
  'Functional Requirements': ['functionalrequirements', 'functionalreqs', 'requirements', 'functional'],
  'Acceptance Criteria':     ['acceptancecriteria', 'acceptance', 'successcriteria', 'doneCriteria', 'donecriteria'],
  'Risks & Dependencies':    ['risksanddependencies', 'risksdependencies', 'risksdependency', 'risksandassumptions', 'risks'],
};

// Recursively flatten any JSON value to a single plain-text string.
const flatten = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v
      .map((item, i) => {
        const s = flatten(item);
        if (!s) return '';
        // If items don't already start with a bullet/number, prefix one.
        return /^\s*([-•*]|\d+[.)])/.test(s) ? s : `${i + 1}. ${s}`;
      })
      .filter(Boolean).join('\n');
  }
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => {
        const s = flatten(val);
        return s ? `${k}: ${s}` : '';
      })
      .filter(Boolean).join('\n');
  }
  return String(v);
};

// Pull out the best matching value for a canonical section name.
const pickSection = (sections, canonical) => {
  if (!sections || typeof sections !== 'object') return '';
  const canonicalShape = keyShape(canonical);
  const aliasShapes = new Set([
    canonicalShape,
    ...(KEY_ALIASES[canonical] || []).map(keyShape),
  ]);
  for (const k of Object.keys(sections)) {
    if (aliasShapes.has(keyShape(k))) return flatten(sections[k]);
  }
  return '';
};

const normaliseSections = (raw) => {
  const out = {};
  for (const k of BRD_SECTION_KEYS) out[k] = pickSection(raw, k);
  return out;
};

const validateSections = (sections) => {
  if (!sections || typeof sections !== 'object') return 'response is not an object';
  for (const k of BRD_SECTION_KEYS) {
    if (typeof sections[k] !== 'string' || sections[k].trim().length < 5) {
      return `missing or too-short section "${k}"`;
    }
  }
  return null;
};

export const generateBrd = async ({ systemPrompt, userPrompt }) => {
  const attempts = [];

  const tryProvider = async (name, mod) => {
    if (!mod.isConfigured()) {
      attempts.push({ provider: name, message: `${name.toUpperCase()}_API_KEY not set`, retryable: true });
      return null;
    }
    try {
      const out = await withTimeout(
        (signal) => mod.generate({ systemPrompt, userPrompt, signal }),
        TIMEOUT_MS,
      );
      const normalised = normaliseSections(out.sections);
      const invalid = validateSections(normalised);
      if (invalid) {
        // Surface which keys WERE present so the next debug round is easier.
        const presentKeys = Object.keys(out.sections || {});
        throw new mod.ProviderError(
          `${name} output invalid: ${invalid}. Keys present: [${presentKeys.join(', ')}]`,
          { retryable: true },
        );
      }
      return { provider: name, model: out.model, sections: normalised };
    } catch (e) {
      attempts.push({ provider: name, message: e.message, retryable: !!e.retryable });
      return null;
    }
  };

  // 1. Try Groq.
  const groqResult = await tryProvider('groq', groq);
  if (groqResult) return { ...groqResult, fallbackUsed: false };

  // 2. Try Gemini.
  const geminiResult = await tryProvider('gemini', gemini);
  if (geminiResult) return { ...geminiResult, fallbackUsed: groq.isConfigured() };

  // Both providers failed.
  const err = new Error('All AI providers failed');
  err.code = 'AI_ALL_PROVIDERS_FAILED';
  err.attempts = attempts;
  throw err;
};
