import type { Idea } from './ingest';

const STOP = new Set([
  'the','a','an','and','or','for','to','of','in','on','with','by','at','from','is','are','be','as','it','this','that','these','those','your','my','our','their','about','into','over','under','after','before','how','what','why','when','where'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w) && w.length > 2);
}

function topKeywords(text: string, k = 5): string[] {
  const freq = new Map<string, number>();
  for (const t of tokenize(text)) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([w]) => w);
}

function topicHints(text: string): { topic: string; tags: string[] } {
  const t = text.toLowerCase();
  const tags: string[] = [];
  if (/(client|customer|lead|sales|market|growth|prospect)/.test(t)) tags.push('growth');
  if (/(learn|research|read|study|notes|summary)/.test(t)) tags.push('learning');
  if (/(risk|unknown|block|issue|bug|spike)/.test(t)) tags.push('risk');
  if (/(ship|build|design|prototype|mvp|launch)/.test(t)) tags.push('shipping');
  if (/(religion|belief|ethic|philosophy)/.test(t)) tags.push('reflection');
  return { topic: tags[0] || 'general', tags };
}

export function generateQuestionsForIdea(idea: Idea): string[] {
  const base = `${idea.title}. ${idea.blurb}`;
  const keys = topKeywords(base, 5);
  const { topic, tags } = topicHints(base);
  const primary = keys[0] || 'this';
  const secondary = keys[1] || 'it';

  const prompts: string[] = [];

  // Topic-aware prompts
  if (topic === 'growth') {
    prompts.push(`Who is one real person affected by ${secondary}? Send them a 3‑line value DM.`);
    prompts.push(`What offer can you deliver this week to validate demand for ${primary}?`);
  } else if (topic === 'risk') {
    prompts.push(`What’s the smallest experiment to de‑risk ${primary} today?`);
    prompts.push(`If ${secondary} fails, how would you notice fast? Add that check now.`);
  } else if (topic === 'learning') {
    prompts.push(`What is the single question about ${primary} you can answer in 30 minutes?`);
    prompts.push(`Draft a 5‑bullet summary for ${secondary}; what’s missing?`);
  } else if (topic === 'shipping') {
    prompts.push(`Define “done” for ${primary} in one sentence. What’s the smallest shippable step?`);
    prompts.push(`Sketch a 1‑hour prototype for ${secondary}; what will you show?`);
  } else if (topic === 'reflection') {
    prompts.push(`Which belief around ${primary} is most uncertain? What evidence would move you?`);
    prompts.push(`Note one insight that surprised you about ${secondary}. Why?`);
  }

  // Generic prompts to ensure at least 3
  prompts.push(`What is blocking ${primary} right now—and what is the first move to unblock it?`);
  while (prompts.length < 3) prompts.push(`What would “done” look like for ${primary} tomorrow?`);

  // De‑duplicate and cap at 3
  const seen = new Set<string>();
  const unique = prompts.filter((p) => (seen.has(p) ? false : (seen.add(p), true))).slice(0, 3);
  return unique;
}
