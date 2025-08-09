import Constants from 'expo-constants';
import { retrieveTopK } from './ideas';
import { getDocsByIds, getCachedPrompts, setCachedPrompts } from './db';

// Prefer runtime config via expo-constants.extra, then env, then 127.0.0.1 default
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const LLM_URL = (extra.llmUrl as string) || process.env.LLM_URL || 'http://127.0.0.1:11434/v1/chat/completions';
const LLM_TOKEN = (extra.llmToken as string) || process.env.LLM_TOKEN || '';
const MODEL = (extra.llmModel as string) || process.env.LLM_MODEL || 'llama3.1:8b-instruct-q4_K_M';

async function postJSON(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(LLM_TOKEN ? { Authorization: `Bearer ${LLM_TOKEN}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  return res.json();
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

// No fallback: if formatting fails or LLM is unavailable, we return an empty array

export async function generatePromptsForIdea(ideaId: string, title: string, blurb: string): Promise<string[]> {
  const cached = getCachedPrompts(ideaId);
  if (cached && cached.length >= 3) return cached;

  const query = `${title}. ${blurb}`;
  const getEmbedding = async (text: string) => {
    const { embedTextsFallback } = await import('./embeddings');
    return embedTextsFallback([text])[0];
  };

  const qVec = await getEmbedding(query);
  const top = retrieveTopK(qVec, 6);
  const contextDocs = getDocsByIds(top.map((t) => t.id)).map((d) => d.text).join('\n\n');

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
    let json = await request();
    let text: string = (json as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || '';
    let bullets = parseBullets(text);

    if (bullets.length < 3) {
      const retryUser = `${user}\n\nYour previous response did not match the format. Respond again with exactly three lines starting with '- ' and nothing else.`;
      json = await postJSON(LLM_URL, {
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: retryUser },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });
      text = (json as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || '';
      bullets = parseBullets(text);
    }

    if (bullets.length >= 3) {
      setCachedPrompts(ideaId, bullets);
      return bullets;
    }
  } catch (_e) {
    // No fallback; return empty list on error
  }

  return [];
}
