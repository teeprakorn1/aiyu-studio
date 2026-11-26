# 01 — test strategy: why this pyramid exists

A template repo has a unique testing problem: **the product is code that other projects
will copy and modify.** A regression here does not break one app — it silently propagates
into every project scaffolded afterwards. The pyramid exists to catch that before it
happens, and to enforce the development laws in [../../AGENTS.md](../../AGENTS.md)
with something stronger than good intentions.

## The shape

```
        ┌───────────────┐
        │   e2e  (3)    │  minutes — real scaffold, real ffmpeg renders, real browser
        ├───────────────┤
        │  unit (~140+) │  seconds — pure logic, no browser, no renders
        └───────────────┘
```

Small on purpose. Every test in this suite exists because it guards a specific,
named failure mode — not because coverage metrics demand it.

## What the tests actually enforce

| AGENTS.md law | Enforced by |
|---|---|
| **Law 1 — determinism** (visual output is a pure function of `t`) | `e2e/determinism.test.mjs` — renders the same timestamp twice and demands identical sha256. A stray `Math.random()` in any feature fails this immediately |
| **Law 3 — logic lives in `engine/lib/`, scripts are thin shells** | the entire unit suite imports lib modules directly; logic that hides inside an executable script is untestable by construction |
| **Verification gate** (mux must prove its own output) | `e2e/pipeline.test.mjs` runs the real pipeline end to end — mux self-verification is part of the asserted behavior |

## The architectural enablers (why these tests are even possible)

1. **Pure logic was extracted into `engine/lib/`** during the v0.3.0 restructure —
   `cli-args`, `loudness`, `ffmpeg`, `mp4-verify`, `chunking` are importable modules.
   Before that, the logic lived inside executable scripts and could not be imported at all.
2. **Motion curves are pure functions** — `ease`/`springy` never touch the DOM, so they
   run in plain Node through the load-script harness.
3. **Classic scripts share global scope the same way script tags do** —
   `tests/helpers/load-script.mjs` reproduces that in Node, so browser runtime files can
   be tested without a browser (details in [02-unit-tests.md](02-unit-tests.md)).
4. **mux self-verifies** — the pipeline e2e does not need to re-implement verification;
   it asserts that the engine's own verification passes.

## What is deliberately NOT tested

| Not tested | Why | What covers it instead |
|---|---|---|
| Visual features by value (`person()`, cards, environments) | asserting pixel values of organic shapes is brittle noise — a 1px anti-alias shift is not a bug | golden stills smoke test (tolerant sampled-pixel comparison) + the determinism hash |
| TTS voice quality | AI cannot hear language — this is written in the QC guide for a reason | human ears, every time, per [../delivery/01-qc-publish.md](../delivery/01-qc-publish.md) |
| ffmpeg itself | we test *our usage* of it (graphs, parsing, box layout), not the tool | — |
| Platform upload behavior | outside the system's control | the phone-watch rule in the QC checklist |

## Cost accounting

- `npm test` (all unit) — seconds. Run it constantly, before every commit.
- `npm run test:e2e` — minutes. It scaffolds real projects and renders real video.
  Run it before merging anything that touches the engine, the runtime, or the scaffold.

When e2e feels too slow to run, that is the signal it is doing real work — the correct
response is to keep unit coverage sharp so e2e runs can be less frequent, never to
delete the slow tests.
