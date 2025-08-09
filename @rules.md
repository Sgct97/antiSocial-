# AntiSocial – Engineering Rules and Milestone Gates

These rules are binding. After every milestone: re-read this file and `AGENT_OPERATIONS.md`, run the gates, attach a Reviewer Report, and only then mark the milestone complete.

## Non‑negotiables
- Privacy: parsing, embeddings, clustering, ranking stay on-device. No analytics.
- Local-first: runs on simulator/phone; no Apple account required for development.
- Design: dark-first, brutal-clean, soft glass; Electric Teal only as accent.
- Performance: cold start ≤ 2.5s (iPhone 12+ target), 60fps gestures, no jank.
- Snapshot fidelity: golden views must be ≤ 2% pixel diff.

## Locked stack
- Expo SDK 53 • RN 0.79 • TS 5.5+
- Expo Router v3 • NativeWind • Zustand
- Data: expo-sqlite (+ Drizzle); vectors as BLOB, cosine in JS
- Embeddings: MiniLM on-device via ONNX Runtime RN (download on first run)
- Anim: Reanimated 3 • Gesture Handler 2
- QA: Jest • Detox • react-native-view-shot • jest-image-snapshot/pixelmatch

## Product invariants
- Feed = your ideas only (ChatGPT export + manual projects).
- Card → Chat loop: one elite question at a time; progressive summary; persistence.
- Intrigue Engine: variable-ratio boost without breaking relevance.

## Decision defaults
- current_focus: centroid of last 3 engaged ideas
- recently_seen: window 50 with gentle decay
- VR cadence: boost after a random 4–7 swipes per session
- K-Means: k = floor(sqrt(n)/2), clamp [3, 24]
- Spaced review: SM‑2‑lite [1d, 3d, 7d, 14d, 30d], scaled by progress
- Progress: 0–1 per idea, weekly micro‑decay

## Milestones and Done gates
- M0 Kick-off
  - Repo scaffolded; Router + NativeWind configured; lint/format in place
  - `@rules.md`, `AGENT_OPERATIONS.md`, and `README.md` committed
  - Reviewer Report written
- M1 Scaffold
  - Routes: `app/(setup)/index.tsx`, `app/(tabs)/feed.tsx`, `app/chat/[id].tsx`, `app/_layout.tsx`
  - `assets/theme.json` with tokens; fonts wired; Reanimated + gestures configured
  - Lint passes; basic unit tests run
  - Reviewer Report + screenshots
- M2 Data & Ingest
  - Parse ChatGPT export + manual projects into Idea nodes
  - Embeddings (ONNX) + K-Means clustering
  - SQLite persistence (text + vector BLOB) + cosine utilities
  - Jest tests for ingest, embeddings, clustering
  - Reviewer Report + screenshots
- M3 Feed UI
  - Vertical swipe feed (Reanimated physics), Card component, parallax, CTA reveal
  - Intrigue Engine scoring + Zustand state
  - Snapshot tests for feed (≤ 2% diff)
  - Reviewer Report
- M4 Chat UI
  - Per-idea chat: progressive summary + one elite question
  - Persist progress + schedule spaced review → feeds S
  - Configurable LLM endpoint; offline fallback question generator
  - Reviewer Report + screenshots
- M5 Polish & QA
  - Detox e2e: setup → feed → chat → back → progress saved
  - README polished; golden snapshots locked
  - Final Reviewer Report

## Reviewer Report (attach each milestone)
- Functionality gaps / edge cases
- Performance (jank/bloat)
- Design alignment (tokens/motion/typography)
- Accessibility (contrast, hit areas)
- Tests (coverage, flakiness, snapshot diffs)
- Risks/Next actions

## Test gates
- Unit: ingest, embeddings, intrigue score (deterministic fixtures)
- Snapshots: `feed_light`, `feed_dark`, `chat_dark` via view-shot + pixelmatch (≤ 2%)
- E2E: Detox happy path (upload → feed → open chat → save progress)
- Follow `AGENT_OPERATIONS.md` for exact commands, environment, and artifact handling.

## Operating rules
- Ship text-first perfection before media.
- Don’t change tokens/copy without cause.
- No broad refactors inside feature edits.
- If blocked by external service, stub locally and keep flow moving.

## Data handling
- ChatGPT export stays on-device only.
- Redact sensitive strings in dev logs.

## Acceptance check (before marking complete)
- All gates green; Reviewer Report added; screenshots attached; re-read `@rules.md` and `AGENT_OPERATIONS.md`.
