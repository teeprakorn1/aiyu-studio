# 02 — unit tests

Fast, deterministic, no browser, no video renders. Run with `npm test` (node + python).

## Node tests (`node:test` — zero dependencies)

| File | Covers | Representative cases |
|---|---|---|
| `cli-args.test.mjs` | `lib/cli-args.mjs` `parseArgs` — the one CLI parser shared by every engine script | `--key=value` and `--key value` forms, boolean flags, positional collection, `--key value` consumes the next token so it is never mistaken for a positional |
| `engine-cli.test.mjs` | engine CLI behavior that can be tested without rendering | `publish` reads duration from `talk.js`, ceilings overrides, forwards encoding flags, rejects unknown flags; `render` rejects invalid modes, malformed time specs, output paths, and encoding flags before browser launch |
| `loudness.test.mjs` | `lib/loudness.mjs` — ffmpeg filter-graph builders and measurement parsers | loudnorm JSON extraction from noisy stderr (including failure with tail context), `regionSpec` whitespace variants + rejection of malformed/inverted input, first-pass vs final audio graph shape, limiter/bed-gain presence, floating-noise trimming |
| `ffmpeg.test.mjs` | `lib/ffmpeg.mjs` + `lib/mp4-verify.mjs` | nonzero process propagation with stderr tail, stderr capture cap, `parseRational` on ffmpeg fractional rates, `shellQuote` safety, and `scanMp4Boxes` proving moov-before-mdat on a **real faststart mp4 fixture** built in a temp dir |
| `motion.test.mjs` | `core/motion.js` — every easing curve plus reveal behavior | finite output across [0,1] (no NaN ever), exact endpoints, monotonicity where required, `easeBack`/`springy` overshoot-then-settle exactly at 1, parameter sensitivity, and purity |
| `runtime-registry.test.mjs` | the explicit runtime configuration API | character/people registration, unknown-id errors, scene-table shape/order/`Infinity` validation, source chips and footnote registration, portrait-renderer registration |
| `architecture.test.mjs` | static guardrails for layer direction and module shape | cards do not depend on character internals or story globals, cast resolution goes through the registry, core/features are IIFE-wrapped with explicit `globalThis` exports |
| `skills.test.mjs` | structural validation of the scaffolded Agent Skills pack | all three skills exist with valid frontmatter (name matches directory, real description), no broken internal links, the non-negotiable invariants are explicitly taught |

## Python tests (`unittest` — stdlib only)

| File | Covers |
|---|---|
| `mix_studio_test.py` | importable pure functions in `engine/lib/mix_audio.py`: waveform peak extraction, silence trimming, dialogue validation, tempo/gap validation, voice filename/path traversal rejection, safe talk.js script serialization — exercised on synthetic PCM generated inside the test |
| `auto_segment_test.py` | `tools/auto-segment/lib_align.py` pure logic — no whisper needed: normalization keeps Thai vowel/tone marks, perfect/noisy transcript alignment on synthesized word timestamps, monotone position advance, narrator grouping/character solo rules, padding/naming conventions, CLI error paths before any whisper import |

**Rule: never commit real audio fixtures.** Voice material is large, copyrighted-adjacent,
and unnecessary — synthetic PCM with known amplitude envelopes tests the math better
because the expected values are computable exactly.

## The load-script harness (`tests/helpers/load-script.mjs`)

The browser runtime is deliberately **classic scripts, not ES modules** — ES modules
cannot load over `file://`, and preview.html must work by double-clicking. Runtime files
are IIFE-wrapped and export through `globalThis`, so the harness concatenates the same
files inside one function and captures the exported names. This reproduces the browser's
shared classic-script visibility closely enough for logic-only tests that do not touch
the DOM.

```
loadScripts(['core/base.js', 'core/motion.js'], ['springy', 'ease'])
```

When writing tests for runtime files, mirror the script-tag order in
`template/index.html` — `core/` before `features/`, exactly like the browser.

## Adding a new unit test

1. If the logic is inside an executable engine script — **stop**. Move it into
   `engine/lib/` first (law 3), then test the lib module. Untestable placement is a
   design smell, not a test problem.
2. For runtime features: only test what is pure. If the function paints, it belongs to
   golden stills or preview/e2e coverage, not assertions.
3. Use temp directories for anything that writes files (the ffmpeg test builds its
   fixture mp4 in the OS temp dir and cleans up).
4. Name tests as behavior sentences — the existing files are the style guide.
