# AGENTS.md — development rules for aiyu-studio

These rules bind humans and AI agents equally. See CONTRIBUTING.md for the contribution workflow.

## Architecture (the dependency direction is the law)

```
story/dialogue.txt + story/segments.json
      │
      ▼  mix-studio.py
talk.js + narration.wav            ← single timing truth: subs, mouths, scene bounds,
      │                              waveform all derive from talk.js and nothing else
      ▼  index.html (render) + preview.html (scrubber) load the same files in fixed order:
core/  ←  features/  ←  story/style.js + srchips.js
kernel    no cross-    the only layer an author edits
          feature deps
      │
      ▼  driven headless by the engine (thin shells over engine/lib/, run from project root)
render.mjs        stills / single-range video
publish.mjs       parallel chunks ─→ out/*.mp4
mux.mjs           chunks + narration.wav + bed ─→ final.mp4 (loudness + self-verification)
measure-subs.mjs  subtitle QC — reads the same runtime
```

- Template runtime layers: `core/` (kernel — base/motion/camera/runtime) ← `features/` (character/subtitles/environment/cards + optional atmosphere/people) ← `story/` (style.js, srchips.js, dialogue.txt, segments.json — everything an author edits). Lower layers never know about upper ones; features must not depend on each other (shared primitives belong in `core/base.js`). Classic scripts only — ES modules are impossible over file://.
- `preview.html` loads the exact same scripts as `index.html` and drives the same `render(t)` — it is a debugging surface, not a second render path. Never implement preview-only rendering logic.
- `engine/lib/` — shared infrastructure: `cli-args.mjs` (the one CLI parser), `playwright-env.mjs` (browser resolution + launch fallback chain), `ffmpeg.mjs` (process helpers), `loudness.mjs` (filter graphs + measurement), `mp4-verify.mjs` (container structure), `chunking.mjs` (parallel boundary math). Never duplicate logic that lives here.
- Engine scripts are thin shells over `engine/lib/` and run from the **project root** (CWD); npm scripts in package.json are the stable user interface — documentation must teach them, not raw `node engine/...` invocations.

## The five laws

1. **Determinism law** — every visual function must be a pure function of time `t`. No `Math.random()`/`Date.now()` in render paths; use seeded randomness (`srnd` in `core/base.js`). Violating this breaks parallel chunk rendering — enforced by `tests/e2e/determinism.test.mjs`.
2. **talk.js is the only timing truth** — scenes, subtitles, mouths, waveform all derive from it. Never invent a second timing source. Never hand-edit talk.js; always re-run `mix-studio.py`.
3. **DRY across engine** — logic used by 2+ engine scripts lives in `engine/lib/`. Copy-paste between scripts is a defect. Logic trapped inside an executable script is equally a defect — it is untestable by construction.
4. **Never edit engine inside a production project** — fix the template, re-copy. Otherwise projects drift.
5. **Verification gate** — a change is done only when: `npm test` is green (unit: node + python), `node --check` passes for every touched engine script, and `npm run test:e2e` passes for changes touching the engine, runtime, or scaffold. Visual output must be unchanged unless intended — intended visual changes re-initialize the golden stills (delete `tests/e2e/fixtures/golden/`, re-run once, review with eyes before committing).

## JSDoc policy (mandatory)

- Every exported/public function in `core/`, `features/`, `engine/**`: full JSDoc with `@param`/`@returns` **including units** (seconds, px, 0..1).
- Every file: `@file` header — one-line purpose + usage example for CLI scripts.
- Internal one-line helpers may use a plain comment instead.

## Naming

- Engine scripts: kebab-case, no version suffixes (`publish.mjs` not `publish-v4.mjs`). Version fossils are forbidden in new files — and in defaults: `--out` defaults to `v1`.
- `engine/lib/` modules: kebab-case `.mjs`, one concern per file.

## Testing (see docs/testing/ for the full guide)

- Tests live in `tests/` at the repo root and are **not** copied into scaffolded projects.
- Zero new dependencies: `node:test` + python `unittest` only.
- New pure logic → unit test. New visual behavior → golden stills cover it; do not write pixel-value assertions. Uncertain placement → read `docs/testing/01-test-strategy.md` first.

## Documentation and examples

- Docs live in `docs/` in topical folders (`getting-started/`, `authoring/`, `delivery/`, `examples/`, `testing/`) — each folder has a README index, files are numbered in reading order. A change that alters behavior must update the matching doc in the same change.
- `examples/legacy/` is frozen history — never edit the productions there, not even to "fix" them to current conventions. Their file layouts are fossils on purpose. Modern references belong in `examples/active/`.
