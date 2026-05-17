// Chat orchestrator with tool-use loop and Groq → Gemini fallback.
//
// The loop:
//   1. Send messages + tool schemas to the model.
//   2. If the response has tool_calls, execute each one locally, append
//      the results as role:"tool" messages, and loop.
//   3. If the response is plain text, stop.
//   4. Hard cap on iterations to prevent runaway loops.
//
// On a retryable provider failure (429, 5xx, timeout, network), we restart
// the loop on Gemini with the conversation so far intact.

import * as groq   from './providers/groq.js';
import * as gemini from './providers/gemini.js';
import { TOOL_SCHEMAS, dispatch } from './tools/index.js';

const MAX_ITERATIONS = 4;
const TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 8000);

const withTimeout = (fn, ms) => {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error(`timeout after ${ms}ms`)), ms);
  return Promise.resolve(fn(ac.signal)).finally(() => clearTimeout(t));
};

const runLoop = async (provider, providerName, conversation) => {
  const toolTrace = [];   // every tool call + result, for audit/UI
  let messages = conversation.slice();
  let model = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const resp = await withTimeout(
      (signal) => provider.chat({ messages, tools: TOOL_SCHEMAS, signal }),
      TIMEOUT_MS,
    );
    model = resp?.model || model;
    const msg = resp?.choices?.[0]?.message;
    if (!msg) throw new provider.ProviderError(`${providerName} returned no message`, { retryable: true });

    // Plain answer → done.
    if (!Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0) {
      return { provider: providerName, model, message: msg, messages, toolTrace };
    }

    // Append the assistant's tool-call turn and the tool results.
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

  // Loop exhausted — return the last assistant message as best-effort.
  return {
    provider: providerName,
    model,
    message: { role: 'assistant', content: 'I had to stop after multiple tool calls without a final answer. Please rephrase or narrow the question.' },
    messages,
    toolTrace,
  };
};

export const chatComplete = async ({ messages }) => {
  const attempts = [];
  if (groq.isConfigured()) {
    try { return await runLoop(groq, 'groq', messages); }
    catch (e) { attempts.push({ provider: 'groq', message: e.message, retryable: !!e.retryable }); }
  } else {
    attempts.push({ provider: 'groq', message: 'GROQ_API_KEY not set', retryable: true });
  }
  if (gemini.isConfigured()) {
    try { return await runLoop(gemini, 'gemini', messages); }
    catch (e) { attempts.push({ provider: 'gemini', message: e.message, retryable: !!e.retryable }); }
  } else {
    attempts.push({ provider: 'gemini', message: 'GEMINI_API_KEY not set', retryable: true });
  }
  const err = new Error('All AI providers failed');
  err.code = 'AI_ALL_PROVIDERS_FAILED';
  err.attempts = attempts;
  throw err;
};
