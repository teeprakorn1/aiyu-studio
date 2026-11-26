# 03 — e2e tests

Slow and worth it. These scaffold real projects into temporary workspaces and run the
actual pipeline — every stage a user would run, asserted the way a user would check it.
Run with `npm run test:e2e` (minutes, needs ffmpeg + Chrome/Chromium).

## The three files

### `pipeline.test.mjs` — the whole assembly line

Scaffolds a fresh project with `new-project.py`, installs dependencies with `npm ci`,
then walks the real user journey through the public npm interface:

| Stage | Asserts |
|---|---|
| scaffold | the 3-layer structure exists (`core/`, `features/`, `story/`, `engine/`) |
| `npm run stub` | stub-mode mix produces a valid `talk.js` without any audio |
| `npm run stills` | rendered frames are not black |
| `npm run check-subs` | subtitle acceptance passes on the template's own demo |
| `npm run publish` | parallel chunks render **disjoint** frame ranges — no overlap, no gap |
| invalid render input | reversed/invalid video ranges fail loudly and never print a success message |
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
- optional atmosphere/people modules execute real drawing paths rather than merely loading
- the waveform layer is painted on the timeline
- clicking at 75% of the timeline seeks to ~75% of duration
- A-B loop marks appear in the transport and playback wraps back to A instead of running past B
- the scene-jump menu lists scenes from the registered scene table and seeks to their first line

## Fixtures and golden stills

`tests/e2e/fixtures/` holds synthetic inputs (generated wavs — never real audio) and
`fixtures/golden/` holds reference stills for the visual smoke test.

**Golden semantics — read this before the first run:**

- The first run finds no goldens, **writes them, and skips** the comparison. This is
  initialization, not a pass — the suite is honest about it.
- Subsequent runs decode the JPEGs in a browser canvas and compare sampled RGB pixels.
  The current tolerance is mean channel difference ≤ 8 plus no more than 15% of sampled
  pixels differing by more than 8 intensity levels. This is deliberately tolerant rather
  than pixel-perfect: anti-aliasing differs across GPUs, OSes, and browser builds, and a
  flaky test teaches people to ignore tests. It is still much stronger than the old
  byte-size comparison because structural visual changes move the pixel metrics.
- When an **intentional** visual change breaks the comparison, delete `fixtures/golden/`
  and re-run once to re-initialize — then review the new goldens with your eyes before
  committing them.

## Platform notes (learned the hard way)

- **Windows npm spawn:** tests invoke npm as `npm.cmd` on Windows without a shell. Plain
  `spawn('npm')` is unreliable there, while `shell: true` triggers Node's DEP0190 warning
  and adds an unnecessary shell-parsing layer.
- **Python resolution:** scaffolded projects use `engine/run-py.mjs`; tests use the same
  `py`/`python3`/`python` fallback order. CI sets `PYTHON=python` to make resolution explicit.
- **Browser fallback chain:** playwright's default chromium target may be the headless
  shell, a separate binary. `launchBrowser` chains installed Chrome → headless shell →
  full chromium build. The preview test exercises whichever the machine has.
- **Isolation:** every e2e test scaffolds into a temporary workspace and cleans up. Nothing
  writes into the repo except intentional golden-fixture updates — if you find a test that
  does otherwise, that is a bug in the test.
