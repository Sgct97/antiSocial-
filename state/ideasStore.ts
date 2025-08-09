import { create } from 'zustand';
import type { Idea, IngestData } from '../lib/ingest';
import { scoreIdea } from '../lib/intrigue';
import { ideasFromMessages } from '../lib/ideasFromChat';

function expandProject(p: { id: string; title: string; blurb: string; tags: string[] }): Idea[] {
  const subs: Idea[] = [];
  const prompts = [
    `Tiny next step for ${p.title}`,
    `Unblockers for ${p.title} (what's unknown?)`,
    `One‑day spike to de‑risk ${p.title}`,
    `Next milestone for ${p.title} (what good looks like)`,
  ];
  for (let i = 0; i < prompts.length; i++) {
    const t = prompts[i];
    subs.push({ id: `${p.id}_s${i}`, title: t, blurb: `${p.blurb}`, tags: [...p.tags, 'sub'] });
  }
  return subs;
}

function normalizeKey(idea: Idea): string {
  const s = `${idea.title} ${idea.blurb}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, 120);
}

export type IdeasState = {
  ideas: Idea[];
  loadFromIngest: (data: IngestData) => void;
};

export const useIdeasStore = create<IdeasState>((set) => ({
  ideas: [],
  loadFromIngest: (data) => {
    const projectIdeas: Idea[] = data.projects.map((p) => ({ id: p.id, title: p.title, blurb: p.blurb, tags: p.tags }));
    const projectSubs = data.projects.flatMap(expandProject);
    const chatIdeas = ideasFromMessages(data.messages, 40);

    // Merge + dedup
    const merged: Idea[] = [...projectIdeas, ...projectSubs, ...chatIdeas];
    const seen = new Set<string>();
    const unique: Idea[] = [];
    for (const idea of merged) {
      const key = normalizeKey(idea);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(idea);
    }

    const scored = unique
      .map((idea) => ({ idea, score: scoreIdea(idea) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.idea)
      .slice(0, 60);

    set({ ideas: scored });
  },
}));
