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

## The production crucible

The pipeline was hardened through real production (`jensen-legend` v3–v7, documented in [examples/v010-jensen-legend/01-jensen-pipeline.md](examples/v010-jensen-legend/01-jensen-pipeline.md)): tempo scaling, safe-zone discipline for Reels/TikTok, parallel chunk rendering, and loudness-standardized muxing are lessons paid for with actual published iterations — the kind of knowledge no amount of reading other people's code provides.

## Fonts

The bundled Kanit fonts in `template/assets/fonts/` are by **Cadson Demak**, licensed under the [SIL Open Font License 1.1](../template/assets/fonts/OFL.txt). Everything else in this repository is MIT — see [LICENSE](../LICENSE).
