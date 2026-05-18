// Groq chat-completions adapter (OpenAI-compatible API).
//
// Groq exposes Llama, Mixtral, etc. behind an OpenAI-shaped endpoint. We use
// JSON mode (`response_format: { type: "json_object" }`) and rely on the
// system prompt's strict instructions to keep output schema-conformant.
//
// On rate limit (429) or 5xx, throws a typed error so the orchestrator can
// fall through to Gemini.

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_PRIMARY = process.env.GROQ_PRIMARY_MODEL || 'llama-3.3-70b-versatile';

// Generic chat completion that accepts a full messages array and optional
// tool schemas. Used by:
//   * generate-insights (no tools, JSON mode)
//   * leadership-chat   (tools, no JSON mode — model decides)
// Returns the raw OpenAI-shaped response so the caller can inspect tool calls.
export const chat = async ({ messages, tools, signal, model = MODEL_PRIMARY, jsonMode = false, temperature = 0.4, maxTokens = 2048 }) => {
  if (!isConfigured()) {
    throw new ProviderError('GROQ_API_KEY not set', { retryable: true });
  }
  const body = { model, messages, temperature, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: 'json_object' };
  if (Array.isArray(tools) && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ProviderError(`Groq network error: ${e?.message || e}`, { retryable: true });
  }
  if (res.status === 429) throw new ProviderError('Groq rate-limit / quota exceeded', { retryable: true, status: 429 });
  if (res.status >= 500)  throw new ProviderError(`Groq server error ${res.status}`, { retryable: true, status: res.status });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // tool_use_failed is a 400 whose root cause is the *model's* output,
    // not our request. Treat as retryable so the orchestrator can fall
    // through to Gemini or a second attempt.
    const retryable = /tool_use_failed|tool call validation/i.test(text || '');
    throw new ProviderError(`Groq ${res.status}: ${text || res.statusText}`, {
      retryable, status: res.status,
    });
  }
  return await res.json();
};

export class ProviderError extends Error {
  constructor(message, { retryable = false, status = 0 } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.retryable = retryable;
    this.status = status;
  }
}

export const isConfigured = () => Boolean(process.env.GROQ_API_KEY);

export const generate = async ({ systemPrompt, userPrompt, signal, model = MODEL_PRIMARY }) => {
  if (!isConfigured()) {
    throw new ProviderError('GROQ_API_KEY not set', { retryable: true, status: 0 });
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,    // deterministic-ish for BRD drafting
    max_tokens: 2048,
  };

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ProviderError(`Groq network error: ${e?.message || e}`, { retryable: true });
  }

  if (res.status === 429) {
    throw new ProviderError('Groq rate-limit / quota exceeded', { retryable: true, status: 429 });
  }
  if (res.status >= 500) {
    throw new ProviderError(`Groq server error ${res.status}`, { retryable: true, status: res.status });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const retryable = /tool_use_failed|tool call validation/i.test(text || '');
    throw new ProviderError(`Groq ${res.status}: ${text || res.statusText}`, {
      retryable,
      status: res.status,
    });
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError('Groq returned empty completion', { retryable: true });

  let parsed;
  try { parsed = JSON.parse(content); }
  catch (e) {
    throw new ProviderError(`Groq returned non-JSON: ${e.message}`, { retryable: true });
  }

  return { sections: parsed, model: json?.model || model };
};
