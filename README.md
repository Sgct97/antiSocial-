# AntiSocial (MVP)

Premium, text-first TikTok-style feed of your own ideas. Parse your ChatGPT export + manual projects, build on-device embeddings, rank with an Intrigue Engine, and open an intimate chat that moves each idea forward.

## What you provide
- ChatGPT export: `conversations.json` (standard export)
- Your projects: a short list with `{ title, blurb (<=140 chars), tags[] }`
- Optional: any must-avoid topics; tone/style notes for card copy

## Local run
Prereqs: Node 20+, npm 10+, Xcode for iOS Simulator, Expo CLI.

- Install deps: `npm install`
- Start: `npm run ios` (Expo)

Notes
- For on-device embeddings we’ll ship a Dev Build (includes ONNX Runtime). The UI runs in Expo Go; embeddings/clustering require the Dev Build (simulator works without Apple account).

## App structure (Expo Router)
- `app/(setup)/index.tsx` – upload wizard (ChatGPT export + manual projects)
- `app/(tabs)/feed.tsx` – vertical swipe feed of idea cards
- `app/chat/[id].tsx` – per-idea chat (modal sheet)
- `app/_layout.tsx` – theme + fonts

## Design tokens
`assets/theme.json`
- spacing: xs 4, sm 8, md 12, lg 20, xl 32
- radii: card 18, button 12
- fonts: Inter + Inter Tight (400–700)
- palette: obsidian #0B0D10, ink #14161B, electric #00E8D1, gold #FFD66B
- shadows: cardShadow = rgba(0,0,0,0.45) 0 4 16 -4

## Data layer
- SQLite (expo-sqlite + Drizzle) for text/meta
- Vector BLOBs in SQLite; cosine similarity in JS
- Embeddings: MiniLM (ONNX Runtime RN), download on first run and cache
- K-Means: k ≈ floor(sqrt(n)/2), clamp [3,24]

## Intrigue Engine (score S)
- Relevance R: cos_sim(current_focus, idea_vec)
- Novelty N: 1 – max_sim(idea_vec, recently_seen)
- Freshness F: clamp(days_since_last_touch / 30, 0–1)
- VR boost V: random(0–0.25) every 4–7 swipes
- Score S = 0.4R + 0.25N + 0.2F + V

## Tests
- Unit: ingest, embeddings, intrigue (`npm test`)
- Snapshots: `react-native-view-shot` + `pixelmatch` (≤ 2% diff) for `feed_light.png`, `feed_dark.png`, `chat_dark.png`
- E2E: Detox script runs setup → feed → chat → back → progress saved

## Autonomous workflow
After every milestone:
1) Re-read `@rules.md` and `AGENT_OPERATIONS.md`
2) Run unit/snapshot/e2e gates (commands in `AGENT_OPERATIONS.md`)
3) Capture/attach screenshots & artifacts
4) Write Reviewer Report (in PR body or notes)

## Privacy
- Your export and derived data stay on-device. No analytics.

## Next steps (you)
- Drop `conversations.json` when ready
- Send your project list (title, blurb, tags)
- I will scaffold the setup screen and ingest pipeline, then push a simulator-ready Dev Build instructions.
