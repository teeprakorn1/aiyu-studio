# Security Policy

## Supported Versions

aiyu-studio is pre-1.0 and evolves quickly. Only the latest release receives security fixes — there is no long-term support line.

| Version | Supported |
|---|---|
| latest release | ✅ |
| anything older  | ❌ |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Report them privately through GitHub's [private vulnerability reporting](https://github.com/teeprakorn1/aiyu-studio/security/advisories/new) on the repository's Security tab. You should receive an acknowledgment within a few days; if the report is confirmed, a fix ships in the next release and you will be credited (unless you prefer otherwise).

## Scope notes specific to this project

aiyu-studio is a local authoring pipeline, not a network service — its trust model differs from a web app's:

- **The engine executes local commands by design.** `engine/` shells out to ffmpeg/ffprobe, python, and drives a browser via playwright. File paths and flags flow into those invocations; the engine assumes it operates on a project the user controls.
- **Scaffolded projects are code you run.** Treat a project scaffolded or modified by someone else like any third-party code: review `story/` scripts (they execute inside the render page) before rendering.
- **Voice files and dialogue are content inputs**, not trusted system input — but they are never executed; they are data for ffmpeg and the timing system.
- **No network service, no credentials, no user database.** The pipeline makes no network calls beyond what the author explicitly adds; there is nothing server-side to attack.

Issues in scope for a security report: command injection through engine arguments or file paths, unsafe browser automation defaults, malicious-input handling in the parsers (`talk.js`, `segments.json`, ffmpeg output), and supply-chain concerns in the dependency surface (deliberately small: `playwright-core` + system ffmpeg/python). The optional tool in `tools/auto-segment/` carries its own heavier dependency tree (faster-whisper and its transitive packages); it is strictly opt-in, never installed by the core pipeline, and reports about it should still follow the same private process.

Issues out of scope: the fact that a local rendering pipeline can execute local commands (that is its purpose), and vulnerabilities in upstream tools themselves (report those to ffmpeg/playwright/python).
