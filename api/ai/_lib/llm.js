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

  // 1. Try Groq.
  if (groq.isConfigured()) {
    try {
      const out = await withTimeout(
        (signal) => groq.generate({ systemPrompt, userPrompt, signal }),
        TIMEOUT_MS,
      );
      const v = validateSections(out.sections);
      if (v) throw new groq.ProviderError(`Groq output invalid: ${v}`, { retryable: true });
      return { provider: 'groq', model: out.model, sections: out.sections, fallbackUsed: false };
    } catch (e) {
      attempts.push({ provider: 'groq', message: e.message, retryable: !!e.retryable });
      // Non-retryable Groq failure (bad key, 400, etc.) still triggers
      // fallback — if the operator misconfigured Groq we'd rather serve a
      // BRD via Gemini than refuse outright.
    }
  } else {
    attempts.push({ provider: 'groq', message: 'GROQ_API_KEY not set', retryable: true });
  }

  // 2. Try Gemini.
  if (gemini.isConfigured()) {
    try {
      const out = await withTimeout(
        (signal) => gemini.generate({ systemPrompt, userPrompt, signal }),
        TIMEOUT_MS,
      );
      const v = validateSections(out.sections);
      if (v) throw new gemini.ProviderError(`Gemini output invalid: ${v}`, { retryable: true });
      return {
        provider: 'gemini',
        model: out.model,
        sections: out.sections,
        fallbackUsed: groq.isConfigured(),   // we only fell back if Groq was actually tried
      };
    } catch (e) {
      attempts.push({ provider: 'gemini', message: e.message, retryable: !!e.retryable });
    }
  } else {
    attempts.push({ provider: 'gemini', message: 'GEMINI_API_KEY not set', retryable: true });
  }

  // Both providers failed. Surface every attempt so the UI can show a
  // precise reason.
  const err = new Error('All AI providers failed');
  err.code = 'AI_ALL_PROVIDERS_FAILED';
  err.attempts = attempts;
  throw err;
};
