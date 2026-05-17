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

// Convert OpenAI-shaped tools to Gemini's functionDeclarations shape and
// strip unsupported JSON-Schema keywords (additionalProperties, $schema).
const stripSchema = (s) => {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s)) return s.map(stripSchema);
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'additionalProperties' || k === '$schema') continue;
    if (k === 'type' && typeof v === 'string') out.type = v.toUpperCase();
    else if (k === 'properties' || k === 'items' || k === 'required') out[k] = stripSchema(v);
    else if (typeof v === 'object' && v !== null) out[k] = stripSchema(v);
    else out[k] = v;
  }
  return out;
};

const toGeminiTools = (tools) => {
  if (!Array.isArray(tools) || !tools.length) return undefined;
  return [{
    functionDeclarations: tools.map((t) => ({
      name:        t.function.name,
      description: t.function.description,
      parameters:  stripSchema(t.function.parameters),
    })),
  }];
};

// Translate OpenAI-shaped messages → Gemini contents.
// Gemini doesn't have a `system` role; we hoist that into systemInstruction.
const toGeminiContents = (messages) => {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: m.name || m.tool_name || 'tool', response: tryJSON(m.content) } }],
      });
      continue;
    }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      contents.push({
        role: 'model',
        parts: m.tool_calls.map((tc) => ({
          functionCall: { name: tc.function?.name, args: tryJSON(tc.function?.arguments) || {} },
        })),
      });
      continue;
    }
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    });
  }
  return { sys, contents };
};

const tryJSON = (s) => {
  if (s == null) return null;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch { return s; }
};

// Generic Gemini chat. Returns an OpenAI-shaped response for the
// orchestrator: { choices: [{ message: { content, tool_calls? } }], model }.
export const chat = async ({ messages, tools, signal, model = MODEL_PRIMARY, jsonMode = false, temperature = 0.4, maxTokens = 2048 }) => {
  if (!isConfigured()) throw new ProviderError('GEMINI_API_KEY not set', { retryable: true });

  const { sys, contents } = toGeminiContents(messages);
  const body = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  if (jsonMode) body.generationConfig.responseMimeType = 'application/json';
  const tcfg = toGeminiTools(tools);
  if (tcfg) body.tools = tcfg;

  const url = `${URL_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) { throw new ProviderError(`Gemini network error: ${e?.message || e}`, { retryable: true }); }
  if (res.status === 429) throw new ProviderError('Gemini rate-limit / quota exceeded', { retryable: true, status: 429 });
  if (res.status >= 500)  throw new ProviderError(`Gemini server error ${res.status}`, { retryable: true, status: res.status });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ProviderError(`Gemini ${res.status}: ${text || res.statusText}`, { retryable: false, status: res.status });
  }
  const json = await res.json();
  // Translate back to OpenAI shape so the orchestrator is provider-agnostic.
  const cand = json?.candidates?.[0];
  const parts = cand?.content?.parts || [];
  const toolCalls = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({
      id: `call_${i}`,
      type: 'function',
      function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) },
    }));
  const text = parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join('').trim();
  return {
    model,
    choices: [{
      message: {
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
    }],
  };
};

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
