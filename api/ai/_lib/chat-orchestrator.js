// Chat orchestrator — uses Gemini only.

import * as gemini from './providers/gemini.js';
import { TOOL_SCHEMAS, dispatch } from './tools/index.js';

const MAX_ITERATIONS = 4;
const TIMEOUT_MS = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 8000);

const GEMINI_PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.0-flash';

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

export const chatComplete = async ({ messages }) => {
  if (!gemini.isConfigured()) {
    const err = new Error('All AI providers failed');
    err.code = 'AI_ALL_PROVIDERS_FAILED';
    err.attempts = [{ provider: 'gemini', message: 'GEMINI_API_KEY not set', retryable: true }];
    throw err;
  }
  try {
    return await runLoop(gemini, 'gemini', messages, GEMINI_PRIMARY_MODEL);
  } catch (e) {
    const err = new Error('All AI providers failed');
    err.code = 'AI_ALL_PROVIDERS_FAILED';
    err.attempts = [{ provider: 'gemini', message: e.message, retryable: !!e.retryable }];
    throw err;
  }
};