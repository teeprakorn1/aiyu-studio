# testing

v0.3.0 introduced the test pyramid — zero new dependencies, `node:test` + python
`unittest` only. Tests live in `tests/` at the repo root; they test the engine and
template, so scaffolded projects do not carry them.

| File | Contents |
|---|---|
| [01-test-strategy.md](01-test-strategy.md) | why this pyramid exists, what each layer enforces (the AGENTS.md laws with teeth), what is deliberately not tested and why |
| [02-unit-tests.md](02-unit-tests.md) | the unit suite file by file, the load-script harness for classic browser scripts, rules for adding tests |
| [03-e2e-tests.md](03-e2e-tests.md) | pipeline / determinism / preview in detail, golden-still semantics, platform traps (Windows npm, chromium fallback) |
| [04-ci.md](04-ci.md) | workflow anatomy, why unit and e2e are separate jobs, reproducing CI locally, rules for extending it |

## Quick reference

```bash
npm test            # unit only (node + python) — seconds, run constantly
npm run test:e2e    # full end-to-end — minutes, needs ffmpeg + chrome/chromium
```

**The one rule:** logic that cannot be tested is logic in the wrong place — pure logic
belongs in `engine/lib/` where the unit suite can reach it (AGENTS.md law 3).
