import Constants from 'expo-constants';
// Static fallback to read build-time config if runtime extra is unavailable
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore app.json has no types
import appJson from '../app.json';
import { retrieveTopK } from './ideas';
import {
  getDocsByIds,
  getCachedPrompts,
  setCachedPrompts,
  initDb,
  ensureChatTables,
  upsertThread,
  appendMessage,
  getMessages,
  upsertThreadVectors,
  getDocIdsBySource,
  getDocIdsByPrefix,
} from './db';
import { logDebug } from './log';

// Prefer EXPO_PUBLIC_* env first (for .env in Expo Go), then expo-constants.extra, then generic env, then HTTPS default
const extra = ((Constants.expoConfig?.extra ?? appJson?.expo?.extra) ?? {}) as Record<string, unknown>;
const LLM_URL =
  (process.env.EXPO_PUBLIC_LLM_URL as string) ||
  (extra.llmUrl as string) ||
  (process.env.LLM_URL as string) ||
  'https://api.openai.com/v1/chat/completions';
const LLM_TOKEN =
  (process.env.EXPO_PUBLIC_LLM_TOKEN as string) ||
  (extra.llmToken as string) ||
  (process.env.LLM_TOKEN as string) ||
  '';
let MODEL =
  (process.env.EXPO_PUBLIC_LLM_MODEL as string) ||
  (extra.llmModel as string) ||
  (process.env.LLM_MODEL as string) ||
  'gpt-4o-mini';

// Map OpenAI "o4-mini" to chat/completions-compatible model name if needed
if (MODEL === 'o4-mini') {
  console.log('[LLM] mapping model o4-mini -> gpt-4o-mini for chat/completions endpoint');
  MODEL = 'gpt-4o-mini';
}

// Prefer explicit modern model if requested via env/app.json
if (MODEL === 'gpt-4.1-mini') {
  console.log('[LLM] using model gpt-4.1-mini');
}

// Emit config snapshot at module load for visibility
try {
  const tokenPresent = !!(
    (process.env.EXPO_PUBLIC_LLM_TOKEN as string) ||
    (extra.llmToken as string) ||
    (process.env.LLM_TOKEN as string)
  );
  console.log(`[LLM] config url=${LLM_URL} model=${MODEL} token=${tokenPresent ? 'present' : 'missing'}`);
} catch {}

async function postJSON(url: string, body: Record<string, unknown>): Promise<unknown> {
  try {
    console.log(`[LLM] POST ${url} model=${MODEL}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(LLM_TOKEN ? { Authorization: `Bearer ${LLM_TOKEN}` } : {}) },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn(`[LLM] HTTP ${res.status} body=${text.slice(0, 200)}`);
      throw new Error(`LLM_HTTP_${res.status}`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (e) {
      console.warn('[LLM] JSON parse error body head=', text.slice(0, 200));
      throw e;
    }
  } catch (e) {
    console.warn('[LLM] postJSON error:', (e as Error)?.message ?? String(e));
    throw e;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('LLM_TIMEOUT')), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

function parseBullets(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-•\d\.\)]+\s*/, '').trim())
    .filter((l) => l.length > 0 && !/^here are/i.test(l));
  const cleaned = lines
    .map((l) => l.replace(/\s+/g, ' '))
    .filter((l) => l.split(' ').length <= 28)
    .slice(0, 3);
  return cleaned;
}

function sentenceFallback(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => (s.length > 140 ? s.slice(0, 137) + '…' : s));
}

export async function generatePromptsForIdea(
  ideaId: string,
  title: string,
  blurb: string,
  onLog?: (msg: string) => void,
): Promise<string[]> {
  // Ensure tables exist (docs, vectors, prompts)
  try { initDb(); } catch {}
  // Log active config once per invocation for visibility in Metro logs
  try {
    const line = `[LLM] url=${LLM_URL} model=${MODEL}`;
    console.log(line);
    logDebug(line);
    onLog?.(line);
  } catch {}
  const cached = getCachedPrompts(ideaId);
  if (cached && cached.length >= 3) return cached;

  const query = `${title}. ${blurb}`;
  let contextDocs = '';
  try {
    const { embedTextsFallback } = await import('./embeddings');
    const qVec = embedTextsFallback([query])[0];
    const top = retrieveTopK(qVec, 6);
    contextDocs = getDocsByIds(top.map((t) => t.id)).map((d) => d.text).join('\n\n');
    {
      const line = `[LLM] RAG context docs=${top.length} totalLen=${contextDocs.length}`;
      console.log(line);
      logDebug(line);
      onLog?.(line);
    }
  } catch (e) {
    const line = `[LLM] RAG context build failed: ${(e as Error)?.message ?? String(e)}`;
    console.warn(line);
    logDebug(line);
    onLog?.(line);
    contextDocs = '';
  }

  const system = `You are a concise, warm product coach. Produce EXACTLY THREE bullet points that are highly actionable and specific. RULES: (1) Output only three lines, no intro/outro, (2) each line must start with '- ', (3) <= 20 words if possible, (4) no numbering, no generic fluff.`;
  const user = `Idea: ${title}\n\nBlurb: ${blurb}\n\nNotes (from user's history):\n${contextDocs}\n\nRespond with ONLY three lines as specified.`;

  const request = async () =>
    postJSON(LLM_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.6,
      max_tokens: 200,
    });

  try {
    let json: unknown = await withTimeout(request(), 20000);
    // Support providers that return either choices[].message.content or choices[].text
    function extractText(resp: unknown): string {
      if (!resp || typeof resp !== 'object') return '';
      const maybeChoices = (resp as { choices?: unknown }).choices;
      if (!Array.isArray(maybeChoices) || maybeChoices.length === 0) return '';
      const first = maybeChoices[0];
      if (first && typeof first === 'object') {
        const maybeMessage = (first as { message?: unknown }).message;
        const maybeText = (first as { text?: unknown }).text;
        const fromMessage =
          maybeMessage && typeof maybeMessage === 'object'
            ? (maybeMessage as { content?: unknown }).content
            : undefined;
        if (typeof fromMessage === 'string') return fromMessage;
        if (typeof maybeText === 'string') return maybeText;
      }
      return '';
    }
    let text: string = extractText(json);
    {
      const line = `[LLM] resp length=${text.length}`;
      console.log(line);
      logDebug(line);
      onLog?.(line);
    }
    let bullets = parseBullets(text);
    {
      const line = `[LLM] bullets first pass count=${bullets.length}`;
      console.log(line);
      logDebug(line);
      onLog?.(line);
    }

    if (bullets.length < 3) {
      const retryUser = `${user}\n\nYour previous response did not match the format. Respond again with exactly three lines starting with '- ' and nothing else.`;
      json = await withTimeout(postJSON(LLM_URL, {
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: retryUser },
        ],
        temperature: 0.5,
        max_tokens: 200,
      }), 10000);
      text = extractText(json);
      bullets = parseBullets(text);
      {
        const line = `[LLM] bullets retry pass count=${bullets.length}`;
        console.log(line);
        logDebug(line);
        onLog?.(line);
      }
    }

    if (bullets.length < 3 && text) {
      bullets = sentenceFallback(text);
    }

    if (bullets.length >= 3) {
      setCachedPrompts(ideaId, bullets);
      return bullets;
    }
  } catch (e) {
    const line = `[LLM] request failed: ${(e as Error)?.message ?? String(e)}`;
    console.warn(line);
    logDebug(line);
    onLog?.(line);
  }

  return [];
}

export async function continueThread(
  threadId: string,
  userInput: string,
  idea: { title: string; blurb: string },
  onLog?: (msg: string) => void,
): Promise<string> {
  try { initDb(); ensureChatTables(); } catch {}
  try {
    const line = `[ChatLLM] continue thread=${threadId}`;
    console.log(line);
    logDebug(line);
    onLog?.(line);
  } catch {}

  // Ensure thread exists and append user message
  const thread = upsertThread({ id: threadId, title: idea.title });
  const userMsg = appendMessage({ threadId, role: 'user', content: userInput });
  try { onLog?.(`[ChatLLM] appended user message id=${userMsg.id}`); } catch {}

  // Load recent messages and optionally embed them for retrieval
  const recent = getMessages(threadId, 30);
  try { onLog?.(`[ChatLLM] fetched messages count=${recent.length}`); } catch {}

  // Build RAG context: restrict to this idea's project doc + this thread + user's chat history
  let contextDocs = '';
  try {
    const { embedTextsFallback } = await import('./embeddings');
    const qVec = embedTextsFallback([`${idea.title}. ${idea.blurb}. ${userInput}`])[0];
    // Determine root project id from threadId (e.g., p2_s3 -> p2 → proj_p2)
    const rootId = threadId.split('_')[0] ?? threadId;
    const projectIds = rootId.startsWith('p') ? getDocIdsByPrefix(`proj_${rootId}`) : [];
    const chatIds = getDocIdsBySource('chat');
    const threadIds = getDocIdsByPrefix(`thread_${threadId}_`);
    const candidateIds = new Set<string>([...projectIds, ...chatIds, ...threadIds]);
    const allTop = retrieveTopK(qVec, 12);
    const filteredTop = allTop.filter((t) => candidateIds.has(t.id)).slice(0, 6);
    const globals = getDocsByIds(filteredTop.map((t) => t.id)).map((d) => d.text);
    const recentText = recent.slice(-10).map((m) => `[${m.role}] ${m.content}`);
    contextDocs = [...globals, ...recentText].join('\n\n');
    const line = `[ChatLLM] RAG context globals=${globals.length} recent=${recentText.length} pools: proj=${projectIds.length} chat=${chatIds.length} thread=${threadIds.length} totalLen=${contextDocs.length}`;
    console.log(line);
    logDebug(line);
    onLog?.(line);
  } catch (e) {
    const line = `[ChatLLM] RAG context build failed: ${(e as Error)?.message ?? String(e)}`;
    console.warn(line);
    logDebug(line);
    onLog?.(line);
  }

  const system = `You are a concise, warm product coach. Use the idea context, prior messages, and retrieved notes to propose next concrete steps. Always stay consistent with the thread’s history.`;
  const user = `Idea: ${idea.title}\n\nBlurb: ${idea.blurb}\n\nNotes + recent chat:\n${contextDocs}\n\nUser now says: ${userInput}\n\nRespond with a brief, practical next step or two (3-6 sentences max).`;

  function extractText(resp: unknown): string {
    if (!resp || typeof resp !== 'object') return '';
    const maybeChoices = (resp as { choices?: unknown }).choices;
    if (!Array.isArray(maybeChoices) || maybeChoices.length === 0) return '';
    const first = maybeChoices[0];
    if (first && typeof first === 'object') {
      const maybeMessage = (first as { message?: unknown }).message;
      const maybeText = (first as { text?: unknown }).text;
      const fromMessage = maybeMessage && typeof maybeMessage === 'object' ? (maybeMessage as { content?: unknown }).content : undefined;
      if (typeof fromMessage === 'string') return fromMessage;
      if (typeof maybeText === 'string') return maybeText;
    }
    return '';
  }

  try {
    const reqBody = {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.6,
      max_tokens: 400,
    } as const;
    let attempt = 1;
    let text = '';
    while (attempt <= 2) {
      const json = await withTimeout(postJSON(LLM_URL, reqBody as unknown as Record<string, unknown>), 20000);
      text = extractText(json);
      const line = `[ChatLLM] attempt=${attempt} resp length=${text.length}`;
      console.log(line);
      logDebug(line);
      onLog?.(line);
      if (text && text.trim().length > 10) break;
      attempt += 1;
    }

    const assistantText = text?.trim() || 'I have a suggestion, but the model returned no content.';
    const saved = appendMessage({ threadId, role: 'assistant', content: assistantText });
    try { onLog?.(`[ChatLLM] saved assistant message id=${saved.id}`); } catch {}

    // Optionally embed last few messages for retrieval
    try {
      upsertThreadVectors(threadId, recent.slice(-8).map((m) => ({ id: m.id, content: m.content })).concat([{ id: saved.id, content: assistantText }]));
      onLog?.('[ChatLLM] updated thread vectors');
    } catch {}

    return assistantText;
  } catch (e) {
    const line = `[ChatLLM] request failed: ${(e as Error)?.message ?? String(e)}`;
    console.warn(line);
    logDebug(line);
    onLog?.(line);
    const fallback = 'I hit a temporary issue generating a reply. Try again in a moment.';
    appendMessage({ threadId, role: 'assistant', content: fallback });
    return fallback;
  }
}
