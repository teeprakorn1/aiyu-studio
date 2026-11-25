# Contributing to aiyu-studio

Thank you for your interest in contributing! This guide covers everything you need to get started.

---

## Quick start

```bash
# 1. Fork & clone
git clone https://github.com/YOUR_USERNAME/aiyu-studio.git
cd aiyu-studio

# 2. Scaffold a test project — this is your dev sandbox
python new-project.py /tmp/my-test
cd /tmp/my-test
npm install

# 3. Verify the pipeline end-to-end
python mix_studio.py --stub
node render.mjs stills 1,5,10 --page=index.html
# open stills/sheet.jpg — characters + subtitles visible = setup works
```

> **Python command:** use `py` on Windows, `python3` on macOS/Linux if `python` is not found.

> Chrome must be installed (scripts use `channel: 'chrome'`), along with Node.js, Python 3, and ffmpeg/ffprobe on PATH.

## What to contribute

Especially welcome:

- **New rig card/scene patterns** — reusable visual components in `template/rig.js`
- **TTS provider integrations** — making voice generation easier
- **Documentation improvements** — clearer guides, more examples, translations
- **Bug fixes** — with a reproduction case

Please **open an issue first** for anything beyond a small fix so we can agree on direction.

## Project structure rules

| Path | Rule |
|---|---|
| `engine/` | **Conservative** — these scripts ship into every generated project. Changes affect all users. |
| `template/rig.js` | **Conservative** — the reusable machinery. Never project-specific content here. |
| `template/style.js` | Demo scenes — improvements welcome, keep it small and renderable. |
| `template/atmos.js`, `template/people.js` | Optional cinematic modules. Keep them IIFE-wrapped with `window` exports, so copied code that redeclares a helper name shadows it instead of crashing. |
| `docs/` | Documentation — keep English as the primary language. |
| `examples/` | Reference implementations (`jensen-legend`, `thai-origins`). Code only; media is generated per project. Keep `rig.js` identical to `template/rig.js`. |

## Coding guidelines

- **JavaScript:** plain ES2020+, no build step. Everything must run directly in Chrome via playwright-core.
- **JSDoc** on all public rig/engine functions — see `template/rig.js` for the established style.
- **Python:** stdlib only where possible; `mix_studio.py` must stay dependency-free.
- **Comments and docs in English.** Sample dialogue content may be any language.
- Follow the existing style — compact, no over-engineering, no unnecessary comments.

## Testing your changes

There is no test framework — verification is end-to-end rendering:

```bash
# 1. Syntax
node --check engine/render.mjs
node --check template/rig.js
node --check template/atmos.js
node --check template/people.js

# 2. Full pipeline in a scratch project
python new-project.py /tmp/verify && cd /tmp/verify
cp path/to/repo/engine/* .   # copy YOUR modified engine
npm install
python mix_studio.py --stub
node render.mjs stills 1,5,10 --page=index.html

# 3. Open stills/sheet.jpg and visually confirm nothing broke
```

If your change affects subtitles, timing, or layout — include before/after stills in your PR.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add transition support to chartCard
fix: subtitle wrapping orphans punctuation at line start
docs: clarify cam() zoom trap in guide-scenes
refactor: extract loudnorm pass into function
```

- `feat` new capability · `fix` bug fix · `docs` documentation · `refactor` no behavior change · `chore` maintenance
- Subject lowercase, no trailing period, under ~72 characters

## Pull requests

1. Branch from `main`: `git checkout -b feat/my-change`
2. Keep PRs focused — one concern per PR
3. Describe **why**, not just what
4. If the change is visual, attach rendered stills
5. Never commit media files (.wav/.mp4/stills output) — .gitignore covers them; do not weaken it

## Reporting bugs

Open an issue with:

- What you ran (exact commands) and what happened vs. expected
- Your OS, Node/Python/ffmpeg versions
- If render-related: the stills output or a screenshot

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).

## Code of Conduct

All participants are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).
