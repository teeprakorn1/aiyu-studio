# Agent Skills for aiyu-studio projects

This folder contains [Agent Skills](https://agentskills.io) — condensed operational knowledge that coding agents (Claude Code, Codex, Cursor, Devin, and others) read to work correctly inside this project. Each skill is one directory with a `SKILL.md`.

| Skill | Teaches the agent |
|---|---|
| `aiyu-authoring` | writing scenes — layer law, registry API, safe zones, cam() trap, motion curves, lip sync contract |
| `aiyu-pipeline` | running the production pipeline — mix/stub/stills/publish/mux, QC gates, versioning rules, troubleshooting |
| `aiyu-cinematic` | cinematic features — personTH humans, atmosphere layers, frame treatments, copying map patterns |

## Why these exist

aiyu-studio has hard invariants (deterministic pure functions of time, talk.js as the only timing truth, layer separation) that generic agents violate by default — `Math.random()` in a scene, hand-editing talk.js, editing `features/` inside a project. The skills front-load exactly the knowledge that prevents those failures, in a form small enough to stay in context.

## Using them

- **Agents that auto-discover skills** — many agents scan `.agents/skills/`, `.claude/skills/`, or a `skills/` folder in the project. If yours does, there is nothing to do: point the agent at the project and it will find them.
- **Agents with explicit skill directories** — copy the skill folders you want into your agent's location, e.g. `.claude/skills/` in this project.
- **Any agent** — paste the contents of the relevant `SKILL.md` into the conversation, or tell the agent: "read `skills/aiyu-authoring/SKILL.md` before touching story/style.js".

## Which skill when

- Writing or editing anything visual → `aiyu-authoring` (always)
- Running commands, rendering, publishing, diagnosing failures → `aiyu-pipeline`
- Historical/cinematic scenes, realistic humans, maps → add `aiyu-cinematic`

The skills are deliberately short and operational. They are not the full documentation — deeper narrative and rationale live in the aiyu-studio repo's `docs/` (not copied into projects).
