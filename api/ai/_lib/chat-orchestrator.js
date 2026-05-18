// Chat orchestrator.
//
// Fallback chain — tried in order:
//   1. Groq primary  (Llama 3.3 70B Versatile  — 100k tokens/day free)
//   2. Groq fast     (Llama 3.1 8B Instant     — 500k tokens/day free)
//   3. Gemini        (gemini-2.0-flash         — 1500 req/day free)
//
// On `tool_use_failed` from any Groq call we get one corrective retry
// against the same provider with a stronger type hint prepended.
// On rate-limit / 5xx / network / non-JSON we fall through to the next
// link in the chain. If everything fails we throw a structured error
// listing every attempt so the UI can show the exact reason.

import * as groq   from './providers/groq.js';
import * as gemini from './providers/gemini.js';
import { TOOL_SCHEMAS, dispatch } from './tools/index.js';

const MAX_ITERATIONS = 4;
const TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 8000);

const GROQ_PRIMARY_MODEL = process.env.GROQ_PRIMARY_MODEL || 'llama-3.3-70b-versatile';
const GROQ_FAST_MODEL    = process.env.GROQ_FAST_MODEL    || 'llama-3.1-8b-instant';
const GEMINI_PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.0-flash';

const TOOL_RETRY_HINT = {
  role: 'system',
  content:
    'IMPORTANT: when calling tools, all numeric parameters (n, weeks, limit) MUST be encoded as JSON numbers, not strings. ' +
    'Send "n": 5, never "n": "5". The previous tool call was rejected because of a string-vs-number type mismatch.',
};

const withTimeout = (fn, ms) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error(`timeout after ${ms}ms`)), ms);
  return Promise.resolve(fn(ac.signal)).finally(() => clearTimeout(t));
};

const runLoop = async (provider, providerName, conversation, model) => {
  const toolTrace = [];
  let messages = conversation.slice();
  let resolvedModel = model || null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const resp = await withTimeout(
      (signal) => provider.chat({ messages, tools: TOOL_SCHEMAS, signal, model }),
      TIMEOUT_MS,
    );
    resolvedModel = resp?.model || resolvedModel;
    const msg = resp?.choices?.[0]?.message;
    if (!msg) throw new provider.ProviderError(`${providerName} returned no message`, { retryable: true });

    if (!Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0) {
      return { provider: providerName, model: resolvedModel, message: msg, messages, toolTrace };
    }

    messages = [...messages, { role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls }];
    for (const tc of msg.tool_calls) {
      const name = tc.function?.name;
      let args = {};
      try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}
      const result = await dispatch(name, args);
      toolTrace.push({ name, args, result });
      messages = [...messages, {
        role: 'tool',
        tool_call_id: tc.id,
        name,
        content: JSON.stringify(result),
      }];
    }
  }

  return {
    provider: providerName,
    model: resolvedModel,
    message: { role: 'assistant', content: 'I had to stop after multiple tool calls without a final answer. Please rephrase or narrow the question.' },
    messages, toolTrace,
  };
};

// Each link is [name, providerModule, model]. Add / reorder here to change
// the cost-vs-quality tradeoff.
const CHAIN = [
  ['groq',      groq,   GROQ_PRIMARY_MODEL],
  ['groq-fast', groq,   GROQ_FAST_MODEL],
  ['gemini',    gemini, GEMINI_PRIMARY_MODEL],
];

const isToolValidationError = (msg) =>
  /tool_use_failed|tool call validation/i.test(msg || '');

export const chatComplete = async ({ messages }) => {
  const attempts = [];
  let retriedToolError = false;

  for (const [name, provider, model] of CHAIN) {
    if (!provider.isConfigured()) {
      const keyHint = name.startsWith('gemini') ? 'GEMINI_API_KEY' : 'GROQ_API_KEY';
      attempts.push({ provider: name, message: `${keyHint} not set`, retryable: true });
      continue;
    }
    try {
      return await runLoop(provider, name, messages, model);
    } catch (e) {
      attempts.push({ provider: name, message: e.message, retryable: !!e.retryable });
      // tool_use_failed → one corrective retry on the SAME provider, just
      // once total across the whole chain (don't keep nagging the model).
      if (!retriedToolError && isToolValidationError(e.message)) {
        retriedToolError = true;
        try {
          return await runLoop(provider, name, [TOOL_RETRY_HINT, ...messages], model);
        } catch (e2) {
          attempts.push({ provider: name, message: `retry: ${e2.message}`, retryable: !!e2.retryable });
        }
      }
    }
  }

  const err = new Error('All AI providers failed');
  err.code = 'AI_ALL_PROVIDERS_FAILED';
  err.attempts = attempts;
  throw err;
};