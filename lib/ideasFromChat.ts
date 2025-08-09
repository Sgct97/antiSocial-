import type { Message, Idea } from './ingest';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreSentence(s: string, idxFromEnd: number): number {
  const len = s.length;
  if (len < 40 || len > 180) return 0; // card copy window
  const verbs = ['build', 'ship', 'learn', 'design', 'plan', 'fix', 'research', 'write', 'explore', 'define', 'clarify', 'organize', 'market', 'launch', 'measure'];
  const verbHit = verbs.some((v) => s.toLowerCase().includes(v));
  const imperative = /^[A-Z][a-z]+\s/.test(s) || /\bshould\b|\bneed to\b|\bnext\b|\btry\b|\bconsider\b/i.test(s);
  const recencyBoost = 1 + Math.max(0, 0.7 - idxFromEnd * 0.005); // last ~140 sentences boosted
  return (1 + (verbHit ? 0.5 : 0) + (imperative ? 0.25 : 0)) * recencyBoost;
}

export function ideasFromMessages(messages: Message[], max = 60): Idea[] {
  // Consider the last ~2000 paragraphs for recency
  const recent = messages.slice(-2000);
  const candidates: { text: string; score: number }[] = [];

  const sentences: string[] = [];
  for (const m of recent) {
    const parts = m.text.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter(Boolean);
    sentences.push(...parts);
  }

  const total = sentences.length;
  sentences.forEach((s, i) => {
    const score = scoreSentence(s, total - i);
    if (score > 0) candidates.push({ text: s, score });
  });

  // Deduplicate by normalized stem and by first 100 chars
  const seen = new Set<string>();
  const unique = candidates
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const key = normalize(c.text).slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);

  const ideas: Idea[] = unique.map((c, idx) => {
    const title = c.text.length > 80 ? c.text.slice(0, 77).trimEnd() + '…' : c.text;
    const blurb = c.text.length > 160 ? c.text.slice(0, 157).trimEnd() + '…' : c.text;
    return { id: `c${idx + 1}`, title, blurb, tags: ['chat'] };
  });

  return ideas;
}
