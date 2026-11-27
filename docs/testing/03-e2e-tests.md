# 03 — e2e tests

Slow and worth it. These scaffold real projects into temporary workspaces and run the
actual pipeline — every stage a user would run, asserted the way a user would check it.
Run with `npm run test:e2e` (minutes, needs ffmpeg + Chrome/Chromium).

## The four test files

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
| output protection | `render` and `publish` refuse to overwrite existing versions without `--force` |
| `npm run mux` | the full mux pipeline self-verifies: loudness, faststart moov-before-mdat, output shape per ffprobe, frame count = fps x duration, every hard gate |

### `determinism.test.mjs` — the law with teeth

Renders the same timestamp twice and demands **byte-identical** output (sha256).
This is the enforcement mechanism for AGENTS.md law 1 — visual output must be a pure
function of `t`, because parallel chunks only join seamlessly when every frame is
reproducible. A single `Math.random()` or `Date.now()` reaching any draw path fails
this test.

Includes the inverse sanity check: two **different** timestamps must render different
content — otherwise "identical" proves nothing.
It also checks render-order independence, optional-module determinism, and visual goldens.

### `preview.test.mjs` — the browser harness

Opens `preview.html` in a real browser and tests the transport like a user:

- page loads without errors
- seek updates the time display and current line
- the video canvas paints non-black content
- optional atmosphere/people/globe/tree modules execute real drawing paths rather than merely loading
- the waveform layer is painted on the timeline
- clicking at 75% of the timeline seeks to ~75% of duration
- A-B loop marks appear in the transport and playback wraps back to A instead of running past B
- the scene-jump menu lists scenes from the registered scene table and seeks to their first line

### `mix-real.test.mjs` — real-audio mixing

Generates temporary voice files, runs `npm run mix`, and checks real envelopes, trimmed
word timing, tempo adjustment, and narration duration.

## Fixtures and golden stills

Audio inputs are generated with ffmpeg inside each test and never committed. `tests/e2e/fixtures/golden/` holds the reference stills for the visual smoke test.

**Golden semantics — read this before the first run:**

- A missing golden **fails the run**. Goldens are written only on purpose, with `AIYU_WRITE_GOLDENS=1`.
  Review the written stills with your eyes before committing them.
- Subsequent runs decode the JPEGs in a browser canvas and compare sampled RGB pixels.
  The current tolerance is mean channel difference ≤ 8 plus no more than 15% of sampled
  pixels differing by more than 8 intensity levels. This is deliberately tolerant rather
  than pixel-perfect: anti-aliasing differs across GPUs, OSes, and browser builds, and a
  flaky test teaches people to ignore tests. It is still much stronger than the old
  byte-size comparison because structural visual changes move the pixel metrics.
- When an **intentional** visual change breaks the comparison, rerun with `AIYU_WRITE_GOLDENS=1`
  and record the reason in CHANGELOG.md in the same change. Review the new goldens with your eyes before
  committing them.

## Platform notes (learned the hard way)

- **Windows npm spawn:** tests run npm through `cmd.exe /d /s /c` as one static command line. Plain
  `spawn('npm')` is unreliable there, while `shell: true` triggers Node's DEP0190 warning
  and adds an unnecessary shell-parsing layer.
- **Python resolution:** scaffolded projects use `engine/run-py.mjs`; tests use the same PATH-only resolver (`py`, `python`, `python3` on Windows; `python3`, `python`, `py` elsewhere).
  CI sets `PYTHON=python` to make resolution explicit.
- **Browser fallback chain:** playwright's default chromium target may be the headless
  shell, a separate binary. `launchBrowser` chains installed Chrome → headless shell →
  full chromium build. The preview test exercises whichever the machine has.
- **Isolation:** every e2e test scaffolds into a temporary workspace and cleans up (`AIYU_KEEP_WORKSPACES=1` keeps them). Nothing
  writes into the repo except intentional golden-fixture updates — if you find a test that
  does otherwise, that is a bug in the test.
