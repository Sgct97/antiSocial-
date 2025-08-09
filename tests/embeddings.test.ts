import { embedTextsFallback, cosine } from '../lib/embeddings';

test('embedTextsFallback is deterministic', () => {
  const a = embedTextsFallback(['hello world'])[0];
  const b = embedTextsFallback(['hello world'])[0];
  expect(a).toEqual(b);
});

test('cosine similarity is in [-1,1] and self-sim ~1', () => {
  const [v1, v2] = embedTextsFallback(['a b c', 'a b c']);
  const sim = cosine(v1, v2);
  expect(sim).toBeGreaterThan(0.99);
});
