# Guide: QC and publishing

## 7-point QC checklist — complete every time before sending to phone

| # | Check | Passes when |
|---|---|---|
| 1 | ffprobe on the final file (mux runs it automatically) | 1080×1920, 30fps, H.264, yuv420p, BT.709 tv, AAC 48kHz, faststart, frames = fps×dur |
| 2 | 2-pass loudness in mux log | integrated ≈ −15.5 LUFS, true peak ≤ the verify ceiling (default −1.5 dBTP; −2.0 recommended — see caveats) |
| 3 | music bed below speech | 20–24 dB — **only checked if you pass `--pause=a-b --speech=c-d`** at real regions, see caveats below |
| 4 | chunk seams | extract frames before/after each boundary, compare by eye — differences are acceptable if the boundary coincides with a scene cut |
| 5 | color vs stills | extract a frame from the mp4 at the same timestamp as a still — 1–2 RGB levels off is normal |
| 6 | subs/headings/chips | re-scan every scene against safe zones on the **final file** |
| 7 | character voices | listen to every character-spk source file — correct language/content (production almost shipped with this unverified) |

### Audio measurement caveats (real false positives)

- **The bed check is opt-in.** Without `--pause` and `--speech`, mux prints a skip note. Pick a region that is really silent in your narration (e.g. between two scenes). A window inside speech gives a meaningless reading.
- **True-peak ceiling:** AAC encoding adds 0.1–0.3 dB of overshoot, so a −1.5 dBTP target can fail verification by a hair. Use `--loudness-tp=-2.0` (sets the target and the verify ceiling together) or set `--verify-tp` separately.
- **Auto-ducking (`--bed-duck`)** changes bed semantics by design: the bed dips under speech and rises in pauses, so the static-mode 20–24 dB pause-vs-speech window no longer applies — read the printed values as information, and judge the balance by ear in a real pause. Ducking is driven by the narration energy itself (ffmpeg `sidechaincompress`), so it works equally for recorded and synthesized voices.
- **A chunk boundary coinciding with a scene cut** always measures high frame difference because the picture genuinely changes — it's not a broken seam; verify continuity of audio/props within the scene instead

## File versioning

- Name outputs with `--out`, e.g. `final-v1.mp4, final-v2.mp4` — **never overwrite**; you'll want to roll back or compare pacing
- Chunks in `out/` eat disk fast (an 8-minute film ≈ 1+ GB) — keep them until the project closes, then clean up
- Fixing only some scenes: render just the affected chunks, copy the rest from the previous version — saves half the time

## Publishing — Facebook Reels / TikTok

### Verified compatible specs

- Vertical 9:16 1080×1920 — both platforms accept natively
- 8–10 minute uploads work in-app, but **Facebook's scheduling/API tools cap at 90 seconds** — if you need a scheduler, produce a separate short cut
- Short videos always finish stronger — consider a 60–90 s teaser edit

### Required at upload time (legal/platform policy)

1. **Tick "AI-generated content" during upload** — both Meta and TikTok require disclosure of synthetic media; skipping risks distribution limits or takedown
2. **The caption must state** that visuals/characters are simulated + character voices are synthetic (when imitating real people)
3. The in-video footnote (registered with `setFootnote()`) — never remove it; it's your disclosure evidence inside the media itself
4. Real-person stories: unverified allegations must be phrased as "reported/unverified" in the script itself, not just in disclaimers

### Final check before publishing — on a real phone only

- Watch the whole film in the actual app (or transfer to phone) — top headings may collide with the account-name bar, subs with UI buttons; passing QC numbers doesn't cover this
- Listen to the pacing — can a general audience keep up with your chosen tempo, not just you who wrote the script
