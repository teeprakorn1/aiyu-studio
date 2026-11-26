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

Reference for TTS integration and render-pipeline patterns by the same author: LLM-written scripts + TTS + vertical rendering + automated publishing. aiyu-studio adopts the script→voice→render pipeline shape, but keeps TTS generation outside the repo (bring your own voice files) rather than binding to one provider.

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

And one honest inversion: the auto-ducking music bed in v0.4.0 is **not** from MoneyPrinterTurbo — it exists precisely because studying it revealed the absence. Its bed mixing is a static volume multiply with no ducking and no loudness standardization at all; the ducking here (ffmpeg `sidechaincompress` driven by the narration itself) was the user's idea, prompted by that gap.

The divergences dominate and are deliberate: footage-matching pipelines, LLM-inside-the-pipeline script generation, auto-upload to platforms, Streamlit/FastAPI/Redis service surfaces, sixty-provider integration sprawl — none of it fits a zero-dependency, author-driven, single-purpose tool.

### [MN-Lizard-Team/aiyu-multi-agent](https://github.com/MN-Lizard-Team/aiyu-multi-agent) (Apache-2.0)

A different kind of source — and a disclosure is owed first: this framework is by the same author as aiyu-studio itself, which is precisely why its patterns were close at hand. It is not a video project at all, but a multi-agent AI framework whose skill system treats LLM agents as fallible operators that need enforcement, not just information. When the v0.4.0 Agent Skills pack was written, its structure came from the open Agent Skills format (see the Remotion section above), but its **teaching style** was adapted from patterns proven in this framework: mandatory self-check tables before declaring completion, pre-action gates ("publishing without the gate = burning render time"), wrong/right pattern pairs over abstract rules, and violation framing that names the failure consequence instead of the virtue. The adaptation is selective — the Socratic-questioning protocols and orchestration machinery were deliberately left behind, because a video pipeline's workflow is already fixed and skills here teach correct execution rather than requirements discovery.

## The production crucible

The pipeline was hardened through real production (`jensen-legend` v3–v7, documented in [examples/v010-jensen-legend/01-jensen-pipeline.md](examples/v010-jensen-legend/01-jensen-pipeline.md)): tempo scaling, safe-zone discipline for Reels/TikTok, parallel chunk rendering, and loudness-standardized muxing are lessons paid for with actual published iterations — the kind of knowledge no amount of reading other people's code provides.

## Fonts

The bundled Kanit fonts in `template/assets/fonts/` are by **Cadson Demak**, licensed under the [SIL Open Font License 1.1](../template/assets/fonts/OFL.txt). Everything else in this repository is MIT — see [LICENSE](../LICENSE).

## m-bain/whisperX — studied for v0.5.0

[whisperX](https://github.com/m-bain/whisperX) (BSD-4-Clause) — batched whisper transcription
with wav2vec2 forced phoneme alignment, VAD preprocessing, and pyannote speaker diarization.

**Adopted:**

- **Forced alignment of KNOWN transcripts** — the core insight: when the text is already known
  exactly (our dialogue.txt), you do not transcribe at all; you align. `tools/phoneme-align`
  implements this with torchaudio-tutorial CTC trellis/backtracking directly on torch+transformers.
- The inspiration for word-granular creative use: karaoke-grade timing feeding `rvw()` keyword reveals.

**Adapted away from:**

- **Did not depend on whisperx itself** — its pinned chain (ctranslate2==4.4.0, pyannote.audio==3.1.1)
  is heavyweight and pyannote drags in a model-license acceptance flow. We implement the alignment
  math directly (trellis/backtrack/merge is ~100 lines); deps shrink to torch+transformers.
- **Diarization rejected for now** — auto-segment's one-file-per-speaker recording discipline already
  solves speaker separation at zero cost. Revisit if users actually record multi-speaker single takes.
- **Batched inference / VAD preprocessing rejected** — narration-scale audio (minutes per production)
  gains nothing from 70x batching; VAD guards against hallucination in transcription, which we do not do.

**Thai gap:** whisperX's built-in align-model table covers 30+ languages but not Thai; the VISTEC
`airesearch/wav2vec2-large-xlsr-53-th` model fills it via the tool's `--model` flag.
## rough-stuff/rough — studied for the sketch layer (v0.4.0)

[rough.js](https://github.com/rough-stuff/rough) (MIT) — the hand-drawn graphics library.

**Adopted as technique, not dependency** (no code copied — the MIT license is noted for provenance
only): the double-stroke tell, perpendicular endpoint jitter with proven magnitude ratios
(~1-2px at roughness 1), bowing ~2% of length, and seed-parameterized randomness as a first-class
option — which maps perfectly onto our existing `srnd` hash and determinism law.

**Rejected:** the library itself as a vendored dependency (template stays zero-runtime-deps);
scan-line hachure/cross-hatch/dot fills (dense texture shimmers badly under video compression);
the SVG backend (the engine is canvas-only); whole-scene sketch styling (readability).
