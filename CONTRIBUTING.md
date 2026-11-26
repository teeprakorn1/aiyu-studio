# Contributing to aiyu-studio

Thank you for your interest in contributing. This guide covers the workflow; **AGENTS.md is the binding architecture and quality contract**.

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/aiyu-studio.git
cd aiyu-studio

# fast verification layer
npm test

# full verification layer (minutes; needs ffmpeg + Chrome/Chromium)
npm run test:e2e
```

For manual exploration, scaffold a scratch project outside the repo:

```bash
python new-project.py ../my-test      # use py on Windows, python3 on macOS/Linux if needed
cd /tmp/my-test
npm ci                               # uses the committed package-lock.json
npm run stub
npm run stills -- 1,3,5
```

The scaffolded npm scripts are the stable user interface. Use them in docs and examples instead of raw `node engine/...` commands.

## What to contribute

Especially welcome:

- reusable scene/card patterns for `template/core/` or `template/features/`
- TTS provider integrations
- clearer documentation, examples, and translations
- bug fixes with a reproduction case

Please open an issue first for anything beyond a small fix so direction can be agreed before implementation.

## Project structure rules

| Path | Rule |
|---|---|
| `engine/` | Conservative — these scripts ship into every generated project. Shared logic belongs in `engine/lib/`. |
| `template/core/` | Kernel primitives and runtime registry. Never project-specific. |
| `template/features/` | Reusable feature systems. Features must not depend on one another. Optional modules must remain IIFE-wrapped with explicit `globalThis`/`window` exports. |
| `template/story/` | Author-editable demo configuration: dialogue, segment mapping, source chips, and scenes. |
| `template/skills/` | Agent-facing operational rules scaffolded into every project. Must stay in sync with AGENTS.md and the runtime API in the same change. |
| `tools/` | Optional tooling with its own dependency isolation (e.g. whisper auto-segmentation). Must never become required by the core pipeline. |
| `docs/` | Documentation — English is the primary language. Update docs in the same change as behavior. |
| `examples/legacy/` | Frozen historical productions. Do not edit or modernize them. |

## Coding guidelines

- JavaScript: plain ES2020+, no build step. Runtime files must remain classic scripts because projects are opened over `file://`.
- Python: the core pipeline is stdlib only; keep `mix-studio.py` dependency-free. Optional tools under `tools/` may declare their own dependencies, but they must remain strictly opt-in — nothing in `engine/` or `template/` may require them.
- Public/exported engine and runtime functions need JSDoc with units (`seconds`, `px`, `0..1`).
- Comments and docs in English. Sample dialogue may be any language.
- Follow the existing compact style: no over-engineering and no unnecessary comments.

## Testing your changes

```bash
# syntax for touched JavaScript files
node --check engine/render.mjs
node --check template/core/runtime.js

# unit layer: node:test + python unittest
npm test

# full user-journey tests: scaffold, render, mux, determinism, preview
npm run test:e2e
```

Rules:

- Put new pure logic in an importable `engine/lib/` module first, then unit-test it. Do not test production logic by extracting source text with regex/`eval`.
- Runtime visual behavior belongs in golden stills and preview/e2e coverage, not brittle pixel-value assertions.
- If a visual change is intentional, delete `tests/e2e/fixtures/golden/`, run e2e once to reinitialize it, review the new stills visually, then commit them.
- If the change affects subtitles, timing, or layout, include before/after stills in the PR.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add transition support to chartCard
fix: reject reversed render ranges
docs: clarify cam zoom safe-zone trap
refactor: move runtime configuration into registry
```

- `feat` new capability · `fix` bug fix · `docs` documentation · `refactor` no behavior change · `chore` maintenance
- Subject lowercase, no trailing period, under ~72 characters

## Pull requests

1. Branch from `main`: `git checkout -b feat/my-change`
2. Keep PRs focused — one concern per PR
3. Describe **why**, not just what
4. Attach rendered stills for visual changes
5. Never commit generated media (`.wav`, `.mp4`, render stills output). `.gitignore` covers them; do not weaken it.

## Reporting bugs

Open an issue with:

- exact commands run, what happened, and what was expected
- OS plus Node/Python/ffmpeg/browser versions
- render-related output stills or screenshots when available

## License and conduct

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE). All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Architecture and conventions

See **AGENTS.md** — it defines the dependency-direction law, the five development laws (determinism, talk.js truth, DRY engine, no per-project engine edits, verification gate), the mandatory JSDoc policy, and file naming rules. It binds all contributors, human or AI.
