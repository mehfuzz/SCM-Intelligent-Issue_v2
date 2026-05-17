// Google Gemini generateContent adapter.
//
// We use the v1beta REST endpoint with `responseMimeType: application/json`
// and an inline `responseSchema` so the model is constrained to the exact
// 6-section BRD shape. No SDK dependency — we POST JSON directly.
//
// Gemini's free tier MAY use prompts for product improvement. The
// orchestrator only invokes this provider as a fallback when Groq is
// unavailable, so day-to-day SCM data stays out of Gemini's training pool.

import { BRD_JSON_SCHEMA } from '../prompts.js';

const MODEL_PRIMARY = process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.0-flash';
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class ProviderError extends Error {
  constructor(message, { retryable = false, status = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = retryable;
    this.status = status;
  }
}

export const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

// Gemini's structured-output schema is JSON-Schema-ish but trims a few
// keywords (no $schema, no additionalProperties). Strip the unsupported
// bits before sending.
const geminiSchema = (s) => ({
  type: s.type?.toUpperCase() || 'OBJECT',
  required: s.required,
  properties: Object.fromEntries(
    Object.entries(s.properties || {}).map(([k, v]) => [
      k,
      { type: (v.type || 'string').toUpperCase() },
    ]),
  ),
});

export const generate = async ({ systemPrompt, userPrompt, signal, model = MODEL_PRIMARY }) => {
  if (!isConfigured()) {
    throw new ProviderError('GEMINI_API_KEY not set', { retryable: true });
  }

  const url = `${URL_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: geminiSchema(BRD_JSON_SCHEMA),
    },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ProviderError(`Gemini network error: ${e?.message || e}`, { retryable: true });
  }

  if (res.status === 429) {
    throw new ProviderError('Gemini rate-limit / quota exceeded', { retryable: true, status: 429 });
  }
  if (res.status >= 500) {
    throw new ProviderError(`Gemini server error ${res.status}`, { retryable: true, status: res.status });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ProviderError(`Gemini ${res.status}: ${text || res.statusText}`, {
      retryable: false,
      status: res.status,
    });
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new ProviderError('Gemini returned empty completion', { retryable: true });

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (e) {
    throw new ProviderError(`Gemini returned non-JSON: ${e.message}`, { retryable: true });
  }

  return { sections: parsed, model };
};
