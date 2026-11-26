# Quickstart — zero to first video

## 0. Machine setup (once)

- Node.js 20+, Python 3, ffmpeg + ffprobe on PATH, Chrome **or Chromium**
- No Chrome? Either install Chromium and set env `CHROME_PATH` to its binary, or use playwright's managed build: `npx playwright-core install chromium` (the engine falls back to it automatically). Override anytime with `--browser=path`
- Verify: `node -v && ffmpeg -version`, plus `py --version` on Windows or `python3 --version` on macOS/Linux

## 1. Create a project

> **Python command:** use `py` on Windows, `python3` on macOS/Linux if `python` is not found.

```bash
python new-project.py path/to/my-story
cd path/to/my-story
npm ci             # playwright-core from the committed lockfile
```

You get:

```
my-story/
├── engine/         the pipeline machinery — never edit (mix/render/publish/mux/measure + lib/)
├── core/           runtime kernel — never edit
├── features/       characters, subtitles, cards, atmosphere, people — never edit
├── story/          ← everything you write lives here: style.js, srchips.js, dialogue.txt, segments.json
├── preview.html    live scrubber — open in a browser, no server needed
├── skills/         agent skills — point your coding agent here before it touches story/
├── index.html      the render page
└── vo/             voice files go here
```

## 2. Test the system with the built-in demo (no audio needed)

```bash
npm run stub                    # estimated talk.js from text length
npm run stills -- 1,5,10      # open stills/sheet.jpg
```

Or open **`preview.html` in Chrome** — a live scrubber that plays/scrubs the animation in real time through the exact production render path: waveform timeline (true narration peaks in real mode, envelope synthesis in stub mode), per-line/per-scene markers, click-drag seeking, playback speed, current-line display, a scene-jump menu, and A-B loop marks for repeating a passage. Keys: space, arrows (±1s, shift ±5s), home/end, `[`/`]` set loop A/B, `\` clears the loop. In stub mode there is no narration.wav yet, so it runs on a silent clock — use it to check scene composition and lip-sync timing before any render.

If you see characters + subtitles in the sheet, everything works. Delete the demo content and start your real story.

## 3. Write your story

1. **Dialogue** — `story/dialogue.txt` in `index|spk|text` format, see [02-dialogue-audio.md](../authoring/02-dialogue-audio.md)
2. **Audio mapping** — `story/segments.json` maps voice files to line ranges
3. **Scenes** — `story/style.js`, see [01-scenes.md](../authoring/01-scenes.md) (register characters with `defineCharacters()`, write sc* functions, wire them with `defineScenes()`, set disclosure text with `setFootnote()`)
4. **Source chips** — `story/srchips.js` (delete all rows if unused)

## 4. Real audio

Drop voice files into `vo/` with the exact names from segments.json, then:

```bash
npm run mix                     # real mode — real-timing talk.js + narration.wav
```

Check the log: line count must match the dialogue; `dur` is your approximate runtime.

## 5. Stills before real rendering — never skip

Pull mid-scene timestamps from talk.js, then:

```bash
npm run stills -- 2,8,15,22,30
```

Review every scene in stills/: headings must sit below y≈260, nothing may collide with subtitles, chips must not overlap headings.
**Trap:** cam() zoom shifts real positions — compute `actual = cy + (val − cy) × zoom`, see [01-scenes.md](../authoring/01-scenes.md)

## 6. Full render

```bash
npm run publish -- --chunks=6 --out=v1        # duration is read from talk.js automatically
# or a single range when fixing one scene: npm run render -- video 0,100 --out=v1
```

(arguments after `--` pass straight through to the underlying engine script)

## 7. Mux with audio

```bash
npm run mux -- --concat=out/v1concat.txt --out=final-v1.mp4   # narration.wav/bed.wav are the defaults
```

- `bed.wav` is **required** — the template does not ship a music bed. Put any audio file at `bed.wav` (quiet music or silence; it is looped under the narration). See [02-dialogue-audio.md](../authoring/02-dialogue-audio.md).
- `--out` defaults to `final.mp4` in the project folder.
- Mux normalizes to −15.5 LUFS, applies faststart, and runs ffprobe verification automatically.
- The bed-vs-speech check runs only if you pass `--pause=a-b --speech=c-d` at real regions of your film — see [qc-publish.md](../delivery/01-qc-publish.md).

## 8. QC + publish

Follow [qc-publish.md](../delivery/01-qc-publish.md) completely, then **watch the full video on a real phone once** before publishing — passing numbers don't guarantee what eyes see.

## Fixing one scene without re-rendering everything

Edit `story/style.js` → render only the affected chunk(s) → copy untouched chunks from the previous version → re-mux. Saves half the time (this is exactly how v5d of jensen-legend was produced).
