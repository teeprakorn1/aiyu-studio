# 03 — e2e tests

Slow and worth it. These scaffold real projects into temporary workspaces and run the
actual pipeline — every stage a user would run, asserted the way a user would check it.
Run with `npm run test:e2e` (minutes, needs ffmpeg + chrome/chromium).

## The three files

### `pipeline.test.mjs` — the whole assembly line

Scaffolds a fresh project with `new-project.py`, then walks the real user journey:

| Stage | Asserts |
|---|---|
| scaffold | the 3-layer structure exists (`core/`, `features/`, `story/`, `engine/`) |
| `npm run stub` | stub-mode mix produces a valid `talk.js` without any audio |
| `npm run stills` | rendered frames are not black |
| `npm run check-subs` | subtitle acceptance passes on the template's own demo |
| `npm run publish` | parallel chunks render **disjoint** frame ranges — no overlap, no gap |
| `npm run mux` | the full mux pipeline self-verifies: loudness, faststart moov-before-mdat, output shape per ffprobe |

### `determinism.test.mjs` — the law with teeth

Renders the same timestamp twice and demands **byte-identical** output (sha256).
This is the enforcement mechanism for AGENTS.md law 1 — visual output must be a pure
function of `t`, because parallel chunks only join seamlessly when every frame is
reproducible. A single `Math.random()` or `Date.now()` reaching any draw path fails
this test.

Includes the inverse sanity check: two **different** timestamps must render different
content — otherwise "identical" proves nothing.

### `preview.test.mjs` — the browser harness

Opens `preview.html` in a real browser and tests the transport like a user:

- page loads without errors
- seek updates the time display and current line
- the video canvas paints non-black content
- the waveform layer is painted on the timeline
- clicking at 75% of the timeline seeks to ~75% of duration

## Fixtures and golden stills

`tests/e2e/fixtures/` holds synthetic inputs (generated wavs — never real audio) and
`fixtures/golden/` holds reference stills for the visual smoke test.

**Golden semantics — read this before the first run:**

- The first run finds no goldens, **writes them, and skips** the comparison. This is
  initialization, not a pass — the suite is honest about it.
- Subsequent runs compare within **15% byte-size tolerance**. This is deliberately a
  smoke test, not pixel-perfect equality: anti-aliasing differs across GPUs, OSes and
  browser builds, and a flaky test teaches people to ignore tests.
- When an **intentional** visual change breaks the comparison, delete `fixtures/golden/`
  and re-run once to re-initialize — then review the new goldens with your eyes before
  committing them.

## Platform notes (learned the hard way)

- **Windows npm spawn:** engine scripts must invoke npm as `npm.cmd` with `shell: true` —
  plain `spawn('npm')` fails on Windows (CVE-2024-27980 mitigation). The e2e suite runs
  the real npm commands, so it catches this class of bug.
- **Browser fallback chain:** playwright's default chromium target may be the headless
  shell, a separate binary. `launchBrowser` chains installed Chrome → headless shell →
  full chromium build. The preview test exercises whichever the machine has.
- **`PYTHON` env var:** CI sets `PYTHON=python`; locally the fallback chain tries
  `py`/`python3`/`python`. Engine scripts and tests share this resolution.
- **Isolation:** every e2e test scaffolds into the OS temp dir and cleans up. Nothing
  writes into the repo — if you find a test that does, that is a bug in the test.
