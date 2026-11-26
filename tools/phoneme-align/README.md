# tools/phoneme-align — phoneme-grade word timing (optional, heavy deps)

**This tool is optional and isolated.** The core pipeline, tts-gen, and auto-segment never
import it. It exists for one job: maximum-precision `wordtimes.json` for voices that have
none — recorded voices, or TTS voices that refuse to emit word boundaries.

## What it does

Forced alignment is NOT transcription. `segments.json` already says exactly which dialogue
lines each `vo/*.wav` contains — the text is *known*. The tool runs a wav2vec2 CTC model
over each file and aligns the known characters against the audio (trellis/backtracking,
torchaudio-tutorial style), emitting `story/wordtimes.phoneme.json` in the exact schema
`mix-studio.py` merges into talk.js for karaoke subtitles and `rvw()` keyword reveals.

```
vo/*.wav + story/segments.json + story/dialogue.txt
      │
      ▼  python align_phoneme.py path/to/project
story/wordtimes.phoneme.json   — rename to wordtimes.json, re-run npm run mix
```

## Install — heavy by design, isolated by law

torch alone is gigabytes. **Never** install into the core environment:

```
python -m venv .venv-phoneme
.venv-phoneme/Scripts/pip install -r tools/phoneme-align/requirements.txt   # Windows
# .venv-phoneme/bin/pip install ...                                          # macOS/Linux
```

## Usage

```
.venv-phoneme/Scripts/python tools/phoneme-align/align_phoneme.py path/to/project
# options:
#   --model HF_ID   wav2vec2 CTC model (default: airesearch/wav2vec2-large-xlsr-53-th)
#   --write         write story/wordtimes.json directly instead of the .phoneme draft
#   --force         overwrite an existing target
```

Then: rename/copy the draft to `story/wordtimes.json` (or use `--write`), `npm run mix`,
enable `SUB_KARAOKE` and/or use `rvw()` in scenes.

## Models and languages

- Default Thai model: `airesearch/wav2vec2-large-xlsr-53-th` (VISTEC — strong CommonVoice benchmark).
- Other languages: pass any wav2vec2 CTC model id via `--model` — e.g. `jonatasgrosman/wav2vec2-large-xlsr-53-english`.
- Characters outside the model vocab are dropped with a warning (alignment interpolates across them).

## Honest caveats

- **Spaceless scripts yield subword chunks, not words.** Thai runs split every 6 characters —
  same documented caveat as edge-tts Thai timing. Fine for karaoke/reveals, not linguistic analysis.
- Output precision depends on the model's language match. A mismatched model degrades gracefully
  into noise — sanity-check one line in preview before batch-trusting it.
- **End-of-file tail smearing (verified behavior):** forced alignment must distribute every audio
  frame across the transcript — trailing silence gets absorbed into the final chunk, stretching it
  (observed: last chunk smearing ~0.5s into silence). Median precision stays karaoke-grade
  (verified: 79-98ms median vs edge-tts word boundaries on Thai speech), and the mixer's silence
  trimming re-tightens the tail in production. For maximum precision keep vo files tightly cut.
- Requires `ffmpeg` on PATH (already a hard dependency of the whole pipeline).
- Windows note: some machines enforce Application Control policies that block DLLs under `%TEMP%` —
  create the venv in a normal directory (e.g. the project root or user home), not under Temp.
