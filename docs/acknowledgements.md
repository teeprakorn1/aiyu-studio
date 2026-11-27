# Acknowledgements — lineage, influences, and deliberate divergences

aiyu-studio is original code, but no design happens in a vacuum. This document records where the ideas came from, what was adopted, what was deliberately rejected, and why — because "why not" is usually the more useful half of the story.

A note on method first: **no code was copied from any project below.** What travelled was ideas, architecture patterns, and hard-won negative knowledge (approaches examined and rejected). Everything here is open source; the specific licenses belong to their respective repositories.

## Direct lineage

### [Yiyu5331/chibi-history-explainer](https://github.com/Yiyu5331/chibi-history-explainer) (MIT)

The core inspiration: drawing every frame procedurally with canvas code instead of video editing, character rigs assembled from code, and the project-per-story workflow. This is where the "video-as-code" philosophy of aiyu-studio comes from.

Deliberate divergences:

- **Voiced narration with a generated timing backbone** — chibi-history-explainer produces silent theatre. aiyu-studio generates `talk.js` from real voice audio and derives every visual timing decision from it. This single difference is the reason the engine exists at all.
- **Vertical 9:16** — the target is Reels/TikTok/Shorts, not landscape video platforms.
- **Speaker-aware lip sync** — mouth shapes follow per-line energy envelopes rather than being static or decorative.

### [Yiyu5331/dafeiyu-bili-workflow](https://github.com/Yiyu5331/dafeiyu-bili-workflow) (MIT)

Reference for TTS integration and render-pipeline patterns by the same author: LLM-written scripts + TTS + vertical rendering + automated publishing. aiyu-studio adopts the script→voice→render pipeline shape, but never binds to a single provider: bring-your-own-voice remains a first-class workflow, and the optional in-repo `tools/tts-gen` is multi-provider.

## Studied deeply, diverged deliberately

### [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas) (MIT)

Motion Canvas is the most complete "video-as-code" implementation in the JavaScript ecosystem: a TypeScript framework with reactive signals, generator-thread scenes, a visual editor, and a ffmpeg export pipeline. It was studied in depth — full source read, not just documentation — and three ideas in aiyu-studio trace directly to that study:

1. **The master-clock player.** `preview.html` drives playback and scrubbing from `audio.currentTime`, the same approach as Motion Canvas's `PlaybackManager`/`Player` — the media element is the clock, everything else follows it. The preview scrubber as a concept (see the real render while dragging the timeline) exists because Motion Canvas proved how much faster iteration becomes when you stop rendering to check your work.
2. **Spring physics as first-class motion.** Motion Canvas's `spring()` showed that physical motion beats hand-tuned easing for UI-like pop-ins. aiyu-studio's cards (`nameCard`, `newsCard`, `emailCard`, `pop`) all use spring response internally because of this.
3. **The exporter architecture as a reference point.** Its ffmpeg exporter (browser streams raw frames over a websocket, server pipes them into ffmpeg as `rawvideo`) was studied as one answer to "how do you turn a canvas animation into an mp4" — before aiyu chose a different answer.

The divergences are deliberate and load-bearing:

| Motion Canvas | aiyu-studio | Why |
|---|---|---|
| Iterative spring **simulation** — position/velocity state advanced per frame | `springy()` is a **closed-form** damped-harmonic pure function of progress | Parallel chunk rendering. Every chunk must be able to start mid-timeline and produce bit-identical frames. Stateful simulation makes that impossible; a pure function of t makes it trivial |
| Scenes as **generator threads** with reactive signals | Scenes as **plain pure functions of t** | Same reason, plus: a `yield`-based scene cannot be sampled at arbitrary t without simulating everything before it |
| TypeScript framework + Vite + editor + heavy dependency tree | Zero-dependency vanilla JS, classic scripts, runs over `file://` | The template must be readable and hackable by a single author, and scaffolded projects must not rot with upstream dependency churn |
| Timing authored in the editor/DSL | Timing **generated from real narration audio** | aiyu films are voiced documentaries; the voice recording is the timeline, not an input to it |

In short: Motion Canvas is the right tool for motion graphics and explainer animation; aiyu-studio is a narrower machine built for one job — voiced vertical documentaries — and the narrower machine could only be designed after understanding exactly what the general one does and why.

### [remotion-dev/remotion](https://github.com/remotion-dev/remotion) (custom license)

Remotion is the largest "video-as-code" project in the ecosystem — React compositions rendered through headless Chrome, backed by a company with real products (Player, Lambda, Editor). It was studied in v0.4.0 not for its rendering core (which solves a problem aiyu-studio doesn't have) but for its **product surface** — what it teaches about how these tools get adopted and lived with. Three ideas travelled:

1. **Agent Skills as a distribution channel.** Remotion's `skills` repository — condensed operational knowledge installed into projects for coding agents to read — demonstrated that in this era the first "user" to write scene code is often an agent, and feeding it the rules up front beats correcting its mistakes. aiyu-studio adopted the idea in its own shape: skills scaffolded into every project (matching the copy-template model), written fresh around this pipeline's specific invariants (determinism law, talk.js timing truth, layer separation), with enforcement structures — gates, self-checks, wrong/right pattern tables — the content, not just the format, is original.
2. **Parameterized videos as a named pattern.** Remotion's "render many videos from one template plus data" validated a workflow aiyu-studio users would naturally want for recurring formats. What travelled is the framing — the implementation here is a documentation pattern (`story/data.js` + batch loop) honest about a constraint Remotion doesn't have: in an audio-first pipeline the narration cannot be parameterized without becoming a new production.
3. **Editor-transport QoL as a quality bar.** Reviewing Remotion Studio's transport motivated the v0.4.0 preview pass (A-B loop, scene jump). The scrubber itself predates that study and traces to the Motion Canvas lineage above — these additions are ordinary editor features, credited here because the review is what prompted them.

The divergences are again deliberate:

| Remotion | aiyu-studio | Why |
|---|---|---|
| React + DOM + bundler as the render surface | raw canvas, classic scripts, zero dependencies | same reasons as the Motion Canvas divergence — hackability and resistance to dependency rot |
| Cloud render farms (Lambda) | parallel local chunks | single-author productions don't need elastic compute; the machine that edits the film is already idle during muxing |
| Open-core license — free below a company-size threshold, paid above | MIT, everything | the template only spreads if nobody ever has to think about this |
| General-purpose platform ambition | narrow machine for voiced vertical documentaries | the constraint is the feature — see the Motion Canvas section |

### [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (MIT)

A different beast entirely: a fully-automatic short-video factory — topic in, LLM script, stock footage, TTS, auto-publish — philosophically opposite to aiyu-studio's authored procedural canvas. It was studied in v0.4.0 mostly as divergence, but three specific things travelled:

1. **The edge-tts `SubMaker` discovery.** Buried in its voice service was the fact that free, keyless TTS returns word-boundary timestamps inside the synthesis stream — exact timing with no alignment step. This restructured the v0.4.0 TTS tool design around capability tiers: word timing is a provider capability, never an assumption (even MoneyPrinterTurbo itself only gets real timing from edge-tts; everything else falls back to whisper).
2. **Word-by-word karaoke subtitles as a validated form.** Its sentence/word display modes confirmed that word-level subtitle animation is a real short-form vocabulary worth having — implemented here as a pure function of time over canvas, not a moviepy frame hack.
3. **Spring-animated subtitle entrances.** Small, but the pop is part of why short-form feels alive.

And one honest inversion: the auto-ducking music bed in v0.4.0 is **not** from MoneyPrinterTurbo — it exists precisely because studying it revealed the absence. Its bed mixing is a static volume multiply with no ducking and no loudness standardization at all; the ducking here (ffmpeg `sidechaincompress` driven by the narration itself) was the author's idea, prompted by that gap.

The divergences dominate and are deliberate: footage-matching pipelines, LLM-inside-the-pipeline script generation, auto-upload to platforms, Streamlit/FastAPI/Redis service surfaces, sixty-provider integration sprawl — none of it fits a zero-dependency, author-driven, single-purpose tool.

### [MN-Lizard-Team/aiyu-multi-agent](https://github.com/MN-Lizard-Team/aiyu-multi-agent) (Apache-2.0)

A different kind of source — and a disclosure is owed first: this framework is by the same author as aiyu-studio itself, which is precisely why its patterns were close at hand. It is not a video project at all, but a multi-agent AI framework whose skill system treats LLM agents as fallible operators that need enforcement, not just information. When the v0.4.0 Agent Skills pack was written, its structure came from the open Agent Skills format (see the Remotion section above), but its **teaching style** was adapted from patterns proven in this framework: mandatory self-check tables before declaring completion, pre-action gates ("publishing without the gate = burning render time"), wrong/right pattern pairs over abstract rules, and violation framing that names the failure consequence instead of the virtue. The adaptation is selective — the Socratic-questioning protocols and orchestration machinery were deliberately left behind, because a video pipeline's workflow is already fixed and skills here teach correct execution rather than requirements discovery.

### [m-bain/whisperX](https://github.com/m-bain/whisperX) (BSD-4-Clause) — studied for v0.4.0

Batched whisper transcription with wav2vec2 forced phoneme alignment, VAD preprocessing, and pyannote speaker diarization.

**Adopted:**

- **Forced alignment of KNOWN transcripts** — the core insight: when the text is already known exactly (our dialogue.txt), you do not transcribe at all; you align. `tools/phoneme-align` implements this with torchaudio-tutorial CTC trellis/backtracking directly on torch+transformers.
- The inspiration for word-granular creative use: karaoke-grade timing feeding `rvw()` keyword reveals.

**Adapted away from:**

- **Did not depend on whisperx itself** — its pinned chain (ctranslate2==4.4.0, pyannote.audio==3.1.1) is heavyweight and pyannote drags in a model-license acceptance flow. We implement the alignment math directly (trellis/backtrack/merge is ~100 lines); deps shrink to torch+transformers.
- **Diarization rejected for now** — auto-segment's one-file-per-speaker recording discipline already solves speaker separation at zero cost. Revisit if users actually record multi-speaker single takes.
- **Batched inference / VAD preprocessing rejected** — narration-scale audio (minutes per production) gains nothing from 70x batching; VAD guards against hallucination in transcription, which we do not do.

**Thai gap:** whisperX's built-in align-model table covers 30+ languages but not Thai; the VISTEC `airesearch/wav2vec2-large-xlsr-53-th` model fills it via the tool's `--model` flag.

### [rough-stuff/rough](https://github.com/rough-stuff/rough) (MIT) — studied for the sketch layer (v0.4.0)

The hand-drawn graphics library.

**Adopted as technique, not dependency** (no code copied — the MIT license is noted for provenance only): the double-stroke tell, perpendicular endpoint jitter with proven magnitude ratios (~1-2px at roughness 1), bowing ~2% of length, and seed-parameterized randomness as a first-class option — which maps perfectly onto our existing `srnd` hash and determinism law.

**Rejected:** the library itself as a vendored dependency (template stays zero-runtime-deps); scan-line hachure/cross-hatch/dot fills (dense texture shimmers badly under video compression); the SVG backend (the engine is canvas-only); whole-scene sketch styling (readability).

### [mattdesl/canvas-sketch-util](https://github.com/mattdesl/canvas-sketch-util) (MIT) — studied for noise2 (unreleased)

v1.10.0 (© 2017 Matt DesLauriers) — generative-art utilities. Its `random.noise2D` wraps the [simplex-noise](https://github.com/jwagner/simplex-noise.js) package (MIT, Jonas Wagner).

**Adopted as technique, not code:** a deterministic 2D simplex field as a pure function of coordinates, so organic motion can stay within the determinism law. `noise2` is written from the published simplex method (Ken Perlin, 2001; Stefan Gustavson's 2005 explanation). It uses a fixed permutation built from integer hashing and only IEEE arithmetic, so it has no trigonometry and no sqrt; its skew factors are precomputed constants, and its gradient table is the standard 12-entry simplex table projected to 2D (eight distinct directions). No code was copied from either package.

**Rejected:** the library as a dependency (CommonJS, 19 runtime packages including a WebGL stack; the template stays zero-runtime-deps and classic scripts); its stateful helpers (the `createRandom` value stream and `damp`), whose results depend on call order or on earlier frames; the WebGL `shader` and pen-plotter `penplot` modules, which sit outside the Canvas 2D video pipeline; `createHatchLines`, a uniform-angle hatch, against our rule on dense hatch fills.

### [gka/chroma.js](https://github.com/gka/chroma.js) (BSD-3-Clause) — studied for color mixing (unreleased)

v3.3.0 (© 2011-2025 Gregor Aisch) — the data-visualization color library: perceptual spaces (LAB/LCh/OKLab), interpolation in eleven color spaces, contrast ratios, color scales. It was studied as the obvious candidate for one question: should mixing in a perceptual space replace the sRGB lerp inside `mixHex`? The measured answer is **no** — recorded here so the question stays answered:

- **sRGB lerp is already near-perceptually-uniform for this pipeline's palettes.** Measured on real project color families (hazed hills, dusk skies, dark walls), equal steps of `p` produce perceptual steps (CIE76) within 9–34% of even — because sRGB gamma encoding is itself perceptually motivated. The naive choice was validated by evidence, not luck.
- **LAB mixing buys nothing measurable for actual use.** For the documented haze mixing (`mixHex` toward horizon colors), LAB and RGB results differ by CIE76 0.5–1.0, below the just-noticeable difference (~2.3). Differences grow only for saturated cross-hue pairs (red↔blue: 12–30), which the cinematic palette discipline avoids.
- **The exactly-deterministic alternative is worse.** Square/sqrt mixing (chroma's `lrgb` mode) is the only variant built solely on exactly-specified ECMA-262 math (`Math.sqrt` is exact per §21.3.2.33; `pow`/`atan2` are implementation-approximated) — and it measured 4–10× *less* uniform in practice (step deviation 67–143%) because it front-loads brightness. LAB conversion requires implementation-approximated `Math.pow` with fractional exponents, against the engine-exactness direction `noise2` established.

**Rejected:** all runtime adoption — no code copied, no technique adopted. Also evaluated and rejected: WCAG/APCA contrast QC (subtitles are fixed-color with stroke — nothing to check), deltaE-based golden comparison (the channel-mean tolerance is empirically calibrated and works), color scales/bezier interpolation (skies use native canvas gradients; the ~3 CIE76 gain does not justify densified stops), `temperature2rgb` and ColorBrewer palettes (no need in this pipeline). If cross-hue mixing ever becomes necessary, the shortest-path hue interpolation in chroma's `_hsx.js` is the reference shape.

### [anvaka/city-roads](https://github.com/anvaka/city-roads) (MIT) — studied for geographic visuals (unreleased)

A Vue 3 web application — not a library — that renders every road in a city from OpenStreetMap data, projected with d3-geo and drawn as WebGL polylines. Studied as the representative of "real geography in video" and rejected entire, because it collides with every constraint of this pipeline at once: WebGL rendering (the engine is Canvas 2D, and GPU output is not cross-machine deterministic), runtime network data (the Overpass API and nominatim are fetched live — the determinism law forbids it), ODbL-licensed data (real map data drags attribution obligations into produced videos), a Vue/Vite/d3/pbf dependency stack, and no temporal dimension at all — it is an interactive static visualization, not a time-based renderer.

Even the aesthetic does not transfer: the beauty of city-roads is thousands of dense thin lines, the same class of dense texture already rejected with rough.js — it shimmers badly under video compression.

One thing the study did confirm, as convergent evidence rather than a new idea: anvaka built an offline protobuf cache of ~3,000 cities precisely because live Overpass queries are slow and rate-limited — the same lesson this pipeline already lives by (prepare data offline, render offline). If a production ever needs real geography, the pipeline-shaped answer is offline-prepared polylines baked into story assets — exactly how narration audio is treated — rendered deterministically with canvas strokes. No such need exists today.

### [shuding/cobe](https://github.com/shuding/cobe) (MIT) — adopted as technique (unreleased)

v2.0.1 — a ~5 KB zero-dependency WebGL globe rendered as a dot matrix: fibonacci-lattice points on a sphere, a 1-bit equirectangular landmask texture, lat/lon → 3D → orthographic projection, quadratic-bezier great-circle arcs lifted off the surface, and a rim-darkened diffuse shading recipe. Studied as the reference for `features/globe.js` — the rotating-Earth visual for globalization and "from X to Y" stories.

**Adopted as technique, not code** (the MIT license is noted for provenance; nothing was copied verbatim — the Canvas 2D implementation is an original reimplementation of the same mathematics):

- **Fibonacci sphere lattice** — even dot distribution from the golden angle, precomputed once and cached.
- **The 1-bit 256×128 landmask** — decoded from `texture.png` and baked into the module as ~5 KB of base64, so geography ships inside the file with zero assets and zero network.
- **The arc recipe** — great-circle interpolation with a control point lifted along the mid-direction, drawn segment-by-segment with silhouette culling.
- **The shading recipe** — brightness as a power of view-space depth, bucketed into ~24 alpha levels so thousands of dots batch into a few `fill()` calls.

**Rejected:** the WebGL implementation itself (the engine is Canvas 2D, and GPU output is not cross-machine deterministic — the CPU port measured ~2 ms/frame, fast enough that no GPU was ever needed); pointer-drag rotation and inertia (the globe is driven by `t`, never by input); DOM-anchored HTML markers (markers are canvas dots pinned to lat/lon instead); the texture's runtime PNG loading (the mask is baked, not fetched).

## The production crucible

The pipeline was hardened through real production (`jensen-legend` v3–v7, documented in [examples/v010-jensen-legend/01-jensen-pipeline.md](examples/v010-jensen-legend/01-jensen-pipeline.md)): tempo scaling, safe-zone discipline for Reels/TikTok, parallel chunk rendering, and loudness-standardized muxing are lessons paid for with actual published iterations — the kind of knowledge no amount of reading other people's code provides.

## Fonts

The bundled Kanit fonts in `template/assets/fonts/` are by **Cadson Demak**, licensed under the [SIL Open Font License 1.1](../template/assets/fonts/OFL.txt). Everything else in this repository is MIT — see [LICENSE](../LICENSE).
