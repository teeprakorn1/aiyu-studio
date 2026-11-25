# Guide: QC and publishing

## 7-point QC checklist — complete every time before sending to phone

| # | Check | Passes when |
|---|---|---|
| 1 | ffprobe on the final file (mux runs it automatically) | 1080×1920, 30fps, H.264, yuv420p, BT.709 tv, AAC 48kHz, faststart, frames = fps×dur |
| 2 | 2-pass loudness in mux log | integrated ≈ −15.5 LUFS, true peak ≤ −1.5 dBTP |
| 3 | music bed below speech | 20–24 dB — **measure at a real narration pause**, see caveats below |
| 4 | chunk seams | extract frames before/after each boundary, compare by eye — differences are acceptable if the boundary coincides with a scene cut |
| 5 | color vs stills | extract a frame from the mp4 at the same timestamp as a still — 1–2 RGB levels off is normal |
| 6 | subs/headings/chips | re-scan every scene against safe zones on the **final file** |
| 7 | character voices | listen to every character-spk source file — correct language/content (production almost shipped with this unverified) |

### Audio measurement caveats (real false positives)

- **The bed warning in mux log** measures a fixed time window (`--pause=40.4-41.4`) — if that window isn't a real pause in your film, the reading is meaningless: find a real pause and pass `--pause=a-b` yourself
- **A chunk boundary coinciding with a scene cut** always measures high frame difference because the picture genuinely changes — it's not a broken seam; verify continuity of audio/props within the scene instead

## File versioning

- Name outputs `final-v1.mp4, final-v2.mp4` — **never overwrite**; you'll want to roll back or compare pacing
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
3. The in-video footnote (`FOOTNOTE_TEXT`) — never remove it; it's your disclosure evidence inside the media itself
4. Real-person stories: unverified allegations must be phrased as "reported/unverified" in the script itself, not just in disclaimers

### Final check before publishing — on a real phone only

- Watch the whole film in the actual app (or transfer to phone) — top headings may collide with the account-name bar, subs with UI buttons; passing QC numbers doesn't cover this
- Listen to the pacing — can a general audience keep up with your chosen tempo, not just you who wrote the script
