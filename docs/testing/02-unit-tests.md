# 02 — unit tests

Fast, deterministic, no browser, no video renders. Run with `npm test` (node + python).

## Node tests (`node:test` — zero dependencies)

| File | Covers | Representative cases |
|---|---|---|
| `cli-args.test.mjs` | `lib/cli-args.mjs` `parseArgs` — the one CLI parser shared by every engine script | `--key=value` and `--key value` forms, boolean flags, positional collection, `--key value` consumes the next token so it is never mistaken for a positional |
| `engine-cli.test.mjs` | engine CLI behavior that can be tested without rendering | `publish` reads duration from `talk.js`, ceilings overrides, forwards encoding flags, rejects unknown flags; `render` rejects invalid modes, malformed time specs, output paths, and encoding flags before browser launch |
| `loudness.test.mjs` (incl. ducking graph wiring: sidechaincompress + asplit key, static mode untouched) | `lib/loudness.mjs` — ffmpeg filter-graph builders and measurement parsers | loudnorm JSON extraction from noisy stderr (including failure with tail context), `regionSpec` whitespace variants + rejection of malformed/inverted input, first-pass vs final audio graph shape, limiter/bed-gain presence, floating-noise trimming |
| `ffmpeg.test.mjs` | `lib/ffmpeg.mjs` + `lib/mp4-verify.mjs` | nonzero process propagation with stderr tail, stderr capture cap, `parseRational` on ffmpeg fractional rates, `shellQuote` safety, and `scanMp4Boxes` proving moov-before-mdat on a **real faststart mp4 fixture** built in a temp dir |
| `motion.test.mjs` | `core/motion.js` — every easing curve plus reveal behavior | finite output across [0,1] (no NaN ever), exact endpoints, monotonicity where required, `easeBack`/`springy` overshoot-then-settle exactly at 1, parameter sensitivity, and purity |
| `runtime-registry.test.mjs` | the explicit runtime configuration API | character/people registration, unknown-id errors, scene-table shape/order/`Infinity` validation, source chips and footnote registration, portrait-renderer registration |
| `architecture.test.mjs` | static guardrails for layer direction and module shape | cards do not depend on character internals or story globals, cast resolution goes through the registry, core/features are IIFE-wrapped with explicit `globalThis` exports |
| `skills.test.mjs` | structural validation of the scaffolded Agent Skills pack | all three skills exist with valid frontmatter (name matches directory, real description), no broken internal links, the non-negotiable invariants are explicitly taught |
| `karaoke.test.mjs` | karaoke helpers from `features/subtitles.js` via the load-script harness: char→word mapping is sequential (repeated words don't collapse), missing tokens tolerated, active-word index tracks time-in-line with the intentional small lead and never goes backwards |
| `verify.test.mjs` | `lib/verify.mjs` — the final-file hard gates, one failure per check | frame count within one frame of fps × duration, loudness within 0.25 LU, true peak under the ceiling, bed gap when measured, stream shape, faststart, duration |
| `containment.test.mjs` | `lib/paths.mjs`, `lib/concat.mjs` | paths and concat entries stay inside the project; quoting and escaped apostrophes; absolute and escaping entries rejected |
| `exec.test.mjs` | `lib/exec.mjs` | executables resolve from PATH only; the current directory and relative PATH entries are never searched |
| `chunking.test.mjs` | `lib/chunking.mjs`, `lib/render-spec.mjs` | chunk boundaries and job planning; still and video time specs; output names |
| `base-fit.test.mjs` | `core/base.js` `fitTXT` | shrinks in 2 px steps to fit, never below 24 px (recording canvas stub) |
| `base-color.test.mjs` | `core/base.js` `mixHex`, `hexA` | valid `#rrggbb` output unchanged, endpoints, `p` and alpha clamped to 0..1, any other color, or a non-number or non-finite `p`/alpha, throws `TypeError` |
| `base-noise.test.mjs` | `core/base.js` `noise2` | exact zero at the origin, range about -1..1, smoothness, pinned reference values, agreement with an independent sqrt-based reference, no `Math.sin`/`cos`/`sqrt` calls, `TypeError` on non-finite input |
| `determinism-static.test.mjs` | template core, features, story | no `Math.random`, `Date.now`, `performance.now`, `new Date`, or crypto randomness in render code |
| `globe.test.mjs` | `features/globe.js` via the load-script harness | fibonacci lattice unit-sphere/uniformity/determinism, baked landmask against known geography, lat/lon→3D pins, rotation length preservation, `face`→center-front conversion, projection culling, arc reveal progress, stub-context draw smoke |

## Python tests (`unittest` — stdlib only)

| File | Covers |
|---|---|
| `mix_studio_test.py` | importable pure functions in `engine/lib/mix_audio.py`: waveform peak extraction, silence trimming, dialogue validation, tempo/gap validation, voice filename/path traversal rejection, safe talk.js script serialization — exercised on synthetic PCM generated inside the test |
| `auto_segment_test.py` | `tools/auto-segment/lib_align.py` pure logic — no whisper needed: normalization keeps Thai vowel/tone marks, perfect/noisy transcript alignment on synthesized word timestamps, monotone position advance, narrator grouping/character solo rules, padding/naming conventions, CLI error paths before any whisper import |
| `tts_gen_test.py` | `tools/tts-gen` pure logic — no network: tts.json config validation/defaults, per-line file naming, exact-by-construction segments payload, wordtimes assembly (untimed lines degrade, never break), draft overwrite protection, provider registry honesty (edge, elevenlabs, and gemini are the verified providers; paid providers fail fast without keys) |
| `phoneme_align_test.py` | CTC span merging, whitespace-run chunking, Thai max_chars splitting — trellis/backtrack run in pure Python (no torch) and are checked on synthetic emissions |

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
