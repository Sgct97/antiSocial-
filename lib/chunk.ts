export type Doc = { id: string; text: string; source: 'chat' | 'project'; meta?: Record<string, unknown> };

export function chunkMessages(messages: { id: string; text: string }[], maxLen = 600): Doc[] {
  const docs: Doc[] = [];
  for (const m of messages) {
    const parts = splitByLength(m.text, maxLen);
    parts.forEach((t, i) => {
      docs.push({ id: `${m.id}_${i}`, text: t, source: 'chat' });
    });
  }
  return docs;
}

export function chunkProjects(projects: { id: string; title: string; blurb: string }[]): Doc[] {
  return projects.map((p) => ({ id: `proj_${p.id}`, text: `${p.title}. ${p.blurb}`, source: 'project' }));
}

function splitByLength(input: string, maxLen: number): string[] {
  if (input.length <= maxLen) return [input.trim()];
  const sentences = input.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur.length + s.length + 1 > maxLen) {
      if (cur) chunks.push(cur.trim());
      cur = s;
    } else {
      cur += (cur ? ' ' : '') + s;
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}
