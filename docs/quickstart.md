# Quickstart — zero to first video

## 0. Machine setup (once)

- Node.js, Python 3, ffmpeg + ffprobe on PATH, Chrome
- Verify: `node -v && py --version && ffmpeg -version`

## 1. Create a project

> **Python command:** use `py` on Windows, `python3` on macOS/Linux if `python` is not found.

```bash
python new-project.py path/to/my-story
cd path/to/my-story
npm install        # playwright-core
```

You get: 5 engine scripts + rig.js + example style.js + fonts + starter configs + empty `vo/`

## 2. Test the system with the built-in demo (no audio needed)

```bash
python mix_studio.py --stub                          # estimated talk.js from text length
node render.mjs stills 1,5,10 --page=index.html  # open stills/sheet.jpg
```

If you see characters + subtitles in the sheet, everything works. Delete the demo content and start your real story.

## 3. Write your story

1. **Dialogue** — `dialogue.txt` in `index|spk|text` format, see [guide-audio.md](guide-audio.md)
2. **Audio mapping** — `segments.json` maps voice files to line ranges
3. **Scenes** — `style.js`, see [guide-scenes.md](guide-scenes.md) (edit CH, write sc* functions, set SC, FOOTNOTE_TEXT)
4. **Source chips** — `srchips.js` (delete all rows if unused)

## 4. Real audio

Drop voice files into `vo/` with the exact names from segments.json, then:

```bash
python mix_studio.py     # real mode — real-timing talk.js + narration.wav
```

Check the log: line count must match the dialogue; `dur` is your approximate runtime.

## 5. Stills before real rendering — never skip

Pull mid-scene timestamps from talk.js, then:

```bash
node render.mjs stills 2,8,15,22,30 --page=index.html
```

Review every scene in stills/: headings must sit below y≈260, nothing may collide with subtitles, chips must not overlap headings.
**Trap:** cam() zoom shifts real positions — compute `actual = cy + (val − cy) × zoom`, see [guide-scenes.md](guide-scenes.md#safe-zone)

## 6. Full render

```bash
node publish-v4.mjs --duration=<TALK.dur+1> --chunks=6 --page=index.html --out=v1
# or a single range when fixing one scene: node render.mjs video 0,100 --out=v1 --page=index.html
```

## 7. Mux with audio

```bash
node mux-v4.mjs --concat=out/v1concat.txt --narration=narration.wav --bed=bed.wav --out=final-v1.mp4
```

`--bed` is optional but recommended — mux normalizes to −15.5 LUFS + faststart + runs ffprobe verification automatically.

## 8. QC + publish

Follow [qc-publish.md](qc-publish.md) completely, then **watch the full video on a real phone once** before publishing — passing numbers don't guarantee what eyes see.

## Fixing one scene without re-rendering everything

Edit style.js → render only the affected chunk(s) → copy untouched chunks from the previous version → re-mux. Saves half the time (this is exactly how v5d of jensen-legend was produced).
