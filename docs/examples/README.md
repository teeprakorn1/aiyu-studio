# examples — real productions, frozen in time

This folder documents [../../examples/](../../examples/) — the complete code of real
productions, captured exactly as each was at release time. They are **historical
documents, not templates.** Each production has a version-prefixed doc folder here.

## The productions

| Doc folder | Production | Era | What it gave the template |
|---|---|---|---|
| [v010-jensen-legend/](v010-jensen-legend/) | 8:30 vertical documentary, 19 scenes | v0.1.0 | the entire engine + runtime — this is the production the template was extracted from |
| [v020-thai-origin/](v020-thai-origin/) | 2:06 cinematic map-driven short | v0.2.0 | the cinematic modules (`atmosphere`, `people`), the map system, `rv()` — production notes in the folder |

## The code layout

```
examples/
├── active/    productions built on the current architecture — empty until the first
│              post-v0.3.0 production ships
└── legacy/    pre-0.3.0 snapshots, kept unchanged on purpose
    ├── jensen-legend/   v0.1.0 era — runtime embedded in the style-v4.js monolith
    └── thai-origins/    v0.2.0 era — flat rig.js + people.js
```

**Reading them is safe; copying their structure is not.** The scene code uses the same
global functions the current runtime still provides (`person()`, `cam()`, `subs()`,
`shot()`, …), so everything you see is still valid API usage — but new projects must be
scaffolded with `new-project.py`, which lays out the 3-layer runtime
(`core/` ← `features/` ← `story/`). Each legacy folder carries a banner stating its era.

Future productions built on the current template will join `examples/active/` as
modern-era references, and get their own versioned doc folder here.
