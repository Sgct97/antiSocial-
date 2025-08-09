# AntiSocial – Agent Operations Manual (SOP)

This manual is binding. During development and testing, always:
- Re-read `@rules.md` and this `AGENT_OPERATIONS.md` before executing tests or marking a milestone.
- Follow the checklists and only proceed when all boxes are checked.

## Scope
- Local-only workflow (simulator/phone). No Apple account required to run.
- On-device processing for parsing, embeddings, clustering, and ranking.
- Text-first MVP with swipe feed → chat → progress memory.

## Test Ritual (run every time before/after tests)
1) Re-read `@rules.md` (Non-negotiables, Test gates) and this SOP.
2) Ensure working tree is clean (commit or stash).
3) Run: Lint → Typecheck → Unit → Snapshots → E2E (when available).
4) Capture artifacts: screenshots, snapshot diffs, logs to `artifacts/`.
5) Write/append the Reviewer Report for the current milestone.

## Commands (canonical)
Until scripts are added, use these commands directly:
- Lint: `npx eslint .`
- Typecheck: `npx tsc --noEmit`
- Unit tests: `npx jest --passWithNoTests`
- Update snapshots (when intentionally updating goldens): `npx jest -u`
- Detox (when configured): `npx detox test -c ios.sim.debug`

Notes
- Pixel snapshots rely on `react-native-view-shot` and `pixelmatch` via a test harness. Goldens live in `tests/__image_snapshots__/`.
- For deterministic pixels, use iPhone 15 Pro simulator @ 100% scale and disable Dynamic Type scaling.

## Golden Snapshots Procedure
- Baselines: `feed_light.png`, `feed_dark.png`, `chat_dark.png`.
- Generation:
  1) Boot the app to the target screen and trigger the snapshot harness (test ID or menu).
  2) Capture via `react-native-view-shot` at 3x scale.
  3) Store under `tests/__image_snapshots__/`.
- Verification: run `npx jest` to compare; must be ≤ 2% pixel diff.
- Updates: only with explicit intent; include reasoning in Reviewer Report.

## E2E (Detox) Happy Path
- Flow: setup (upload/export) → feed scroll → open a card → chat → back → progress saved.
- Device: iPhone 15 Pro simulator.
- Env: stable locale (en-US), dark mode enabled.

## Artifacts & Logs
- Place screenshots and diffs in `artifacts/` and `tests/__image_snapshots__/__diff_output__/`.
- Save failing test logs to `artifacts/logs/` with timestamp.

## Data Handling
- ChatGPT export is `chat.html` at the app root (or `assets/chat.html`). Parsed on-device only.
- Manual projects are saved alongside in SQLite; vectors are BLOBs.
- Never upload personal data; redact sensitive strings in dev logs.

## Reviewer Report Template
- Functionality: what works/what’s missing
- Performance: any jank or slow paths
- Design: adherence to tokens, spacing, motion
- Accessibility: contrast, hit targets, motion settings
- Tests: coverage gaps and any snapshot diffs
- Risks/Next: prioritized list

## Milestone Close Checklist (must pass)
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Unit tests pass
- [ ] Snapshot tests ≤ 2% diff (or intentional update documented)
- [ ] Detox happy path passes (once enabled)
- [ ] Reviewer Report written and linked
- [ ] Re-read `@rules.md` and `AGENT_OPERATIONS.md`

## Notes on Embeddings (Dev Build)
- Embeddings require ONNX Runtime RN and a Dev Build for simulator.
- When enabling embeddings: run `npx expo prebuild`, `npx pod-install`, `npx expo run:ios`.
- Keep a fallback mock for tests to avoid long model downloads in CI.
