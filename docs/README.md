# aiyu-video-template documentation

## Structure — organized by production journey

```
docs/
├── README.md            ← you are here (the hub)
│
├── Stage 1: start a project
│   └── quickstart.md        zero to first video, step by step + scaffolded file structure
│
├── Stage 2: build content (both in parallel)
│   ├── guide-audio.md       dialogue · segments.json · TTS · tempo
│   ├── guide-scenes.md      scenes in style.js · rig API · safe zones
│   ├── guide-cinematic.md   realistic humans · layered backgrounds · water · frame treatments
│   └── guide-map.md         animated data-driven maps · flow paths · hachure mountains
│
├── Stage 3: before publishing
│   └── qc-publish.md        7-point QC · Reels/TikTok specs · legal/platform rules
│
└── reference
    └── pipeline.md          real production notes from jensen-legend v3–v7 (where the system came from)
```

## Recommended path

**First project:** quickstart → (audio + scenes interleaved) → qc-publish before release

**Later projects:** jump straight into whichever guide you need

**Choosing a character style:** mascot / presenter formats use rig's `person()` (see guide-scenes). Historical or cinematic stories use `personTH()` from `people.js` together with `atmos.js` (see guide-cinematic). The two can be mixed in one film.

**Copying code from examples:** examples are code only. Check [guide-scenes.md §11](guide-scenes.md) for global-name collisions before pasting.
## Related docs elsewhere in the repo

| File | Use when |
|---|---|
| [../README.md](../README.md) | repo overview + golden rules |
| [../template/README.md](../template/README.md) | scene cheatsheet + complete person() params — keep open next to guide-scenes while writing |
| [../examples/jensen-legend/README.md](../examples/jensen-legend/README.md) | see how complex scenes are written in the real 19-scene implementation |
| [../examples/thai-origins/README.md](../examples/thai-origins/README.md) | the cinematic production the map/humans/atmosphere modules were extracted from |
| [../CHANGELOG.md](../CHANGELOG.md) | version history |

## Three rules that will save you even if you read nothing else

1. **Everything derives from the single `talk.js`** — subtitles, scene boundaries, mouth envelopes, video duration all scale with the audio automatically. Never hand-edit talk.js; always re-run `mix_studio.py`
2. **Always check safe zones with stills before a real render** — cam() zooms constantly, so on-screen positions never match the coordinates you wrote
3. **Never overwrite older video versions** — always increment v1/v2/v3
