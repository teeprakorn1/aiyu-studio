# 02 — unit tests

Fast, deterministic, no browser, no video renders. Run with `npm test` (node + python).

## Node tests (`node:test` — zero dependencies)

| File | Covers | Representative cases |
|---|---|---|
| `cli-args.test.mjs` | `lib/cli-args.mjs` `parseArgs` — the one CLI parser shared by every engine script | `--key=value` and `--key value` forms, boolean flags, positional collection, `--key value` must consume the next token so it is never mistaken for a positional |
| `loudness.test.mjs` | `lib/loudness.mjs` — the ffmpeg filter-graph builders and measurement parsers | loudnorm JSON extraction from noisy stderr (including failure with tail context), `regionSpec` whitespace variants + rejection of malformed input, first-pass vs final audio graph shape, limiter/bed-gain presence, floating-noise trimming in duration formatting |
| `ffmpeg.test.mjs` | `lib/ffmpeg.mjs` + `lib/mp4-verify.mjs` | `parseRational` on ffmpeg fractional rates (`30000/1001`), `shellQuote` safety, and `scanMp4Boxes` proving moov-before-mdat on a **real faststart mp4 fixture** (built with actual ffmpeg in a temp dir during the test) |
| `motion.test.mjs` | `core/motion.js` — every easing curve | finite output across all of [0,1] (no NaN ever), exact endpoints, monotonicity where required, `easeBack`/`springy` overshoot-then-settle exactly at 1, parameter sensitivity, and **purity** — same input, same output, always |

## Python tests (`unittest` — stdlib only)

| File | Covers |
|---|---|
| `mix_studio_test.py` | `wave_peaks` / `trim_edges` from `mix-studio.py` — the audio math behind the waveform and silence trimming, exercised on **synthetic PCM generated inside the test** |

**Rule: never commit real audio fixtures.** Voice material is large, copyrighted-adjacent,
and unnecessary — synthetic PCM with known amplitude envelopes tests the math better
because the expected values are computable exactly.

## The load-script harness (`tests/helpers/load-script.mjs`)

The browser runtime is deliberately **classic scripts, not ES modules** — ES modules
cannot load over `file://`, and preview.html must work by double-clicking. But classic
scripts cannot be `import`ed in Node either.

The harness reproduces what script tags do: it evaluates the file's source in a shared
context, so top-level `const`/`function` declarations land in the same lexical scope the
browser would give them — including cross-file visibility when several files are loaded
in order. This is what lets `motion.test.mjs` call `springy()` directly and assert on
`rv()`'s line-scoped reveal behavior.

```
loadScript('template/core/base.js')   // primitives first — same order as index.html
loadScript('template/core/motion.js') // now ease/springy/rv exist in the shared scope
```

When writing tests for runtime files, mirror the script-tag order in
`template/index.html` — `core/` before `features/`, exactly like the browser.

## Adding a new unit test

1. If the logic is inside an executable engine script — **stop**. Move it into
   `engine/lib/` first (law 3), then test the lib module. Untestable placement is a
   design smell, not a test problem.
2. For runtime features: only test what is pure. If the function paints, it belongs to
   golden stills, not assertions.
3. Use temp directories for anything that writes files (the ffmpeg test builds its
   fixture mp4 in the OS temp dir and cleans up).
4. Name tests as behavior sentences — the existing files are the style guide.
