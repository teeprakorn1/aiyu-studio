# aiyu-studio documentation

Organized by production journey. Every folder has its own README indexing its files.

```
docs/
├── README.md                     ← you are here (the hub)
├── acknowledgements.md           lineage · influences · deliberate divergences (why the design is what it is)
├── getting-started/
│   └── 01-quickstart.md          zero to first video, step by step + scaffolded structure
├── authoring/
│   ├── 01-scenes.md              scenes in style.js · runtime API · safe zones
│   ├── 02-dialogue-audio.md      dialogue · segments.json · TTS · tempo
│   ├── 03-cinematic.md           realistic humans · layered backgrounds · water · frame treatments
│   └── 04-maps.md                animated data-driven maps · flow paths · hachure mountains
├── delivery/
│   └── 01-qc-publish.md          7-point QC · Reels/TikTok specs · legal/platform rules
├── examples/
│   ├── README.md                 what the examples/ folders are — active vs legacy archaeology
│   ├── v010-jensen-legend/       the first production — pipeline notes v3–v7
│   └── v020-thai-origin/         the cinematic production — where the modules came from
├── testing/
│   ├── README.md                 index + quick reference
│   ├── 01-test-strategy.md       why the pyramid exists · what is enforced · what is not tested
│   ├── 02-unit-tests.md          unit suite · load-script harness · adding tests
│   ├── 03-e2e-tests.md           pipeline · determinism · preview · golden stills · platform traps
│   └── 04-ci.md                  workflow anatomy · reproducing CI locally
└── images/                       demo screenshots + pipeline diagram used by the repo READMEs
```

## Recommended path

**First project:** quickstart → (audio + scenes interleaved) → qc-publish before release

**Later projects:** jump straight into whichever guide you need

**Choosing a character style:** mascot / presenter formats use the runtime's `person()` (see authoring/01-scenes). Historical or cinematic stories use `personTH()` from `features/people.js` together with `features/atmosphere.js` (see authoring/03-cinematic). The two can be mixed in one film.

**Copying code from examples:** examples are code only. Check [authoring/01-scenes.md §12](authoring/01-scenes.md) for global-name collisions before pasting.

## Related docs elsewhere in the repo

| File | Use when |
|---|---|
| [../README.md](../README.md) | repo overview + golden rules |
| [../template/README.md](../template/README.md) | scene cheatsheet + complete person() params — keep open next to authoring/01-scenes while writing |
| [../AGENTS.md](../AGENTS.md) | the five development laws, dependency direction, JSDoc policy — read before contributing |
| [../examples/legacy/jensen-legend/README.md](../examples/legacy/jensen-legend/README.md) | see how complex scenes are written in the real 19-scene implementation |
| [../examples/legacy/thai-origins/README.md](../examples/legacy/thai-origins/README.md) | the cinematic production the map/humans/atmosphere modules were extracted from |
| [../CHANGELOG.md](../CHANGELOG.md) | version history |

## Three rules that will save you even if you read nothing else

1. **Everything derives from the single `talk.js`** — subtitles, scene boundaries, mouth envelopes, video duration all scale with the audio automatically. Never hand-edit talk.js; always re-run `mix-studio.py`
2. **Always check safe zones with stills before a real render** — cam() zooms constantly, so on-screen positions never match the coordinates you wrote
3. **Never overwrite older video versions** — always increment v1/v2/v3
