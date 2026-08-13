# Changelog

All notable changes to **Zara AI 2070** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-08-13

### Zara AI 2070 — Personal AI Operating System

Zara is now architected as Aitzaz's personal AI operating system and companion.
The futuristic Zara avatar, voice pipeline, persistent memory, chat, and tools are
preserved and upgraded — not replaced with a generic chatbot.

### Added

- **ZARA identity layer** (`src/modules/identity.ts`) — single source of truth for
  the assistant (ZARA), owner (AITZAZ), role, primary goals, tone, and real
  offline/online system status.
- **Agent registry & orchestrator** (`src/modules/agents/registry.ts`) — modular,
  data-driven multi-agent system: Core, Memory, Productivity, System, Browser,
  Research, Job, Client, Communication, Coding, GitHub, Vision. Each agent declares
  its capabilities, tool allowlist, and an honest readiness state. Includes a
  local keyword intent router so the app works without an API key.
- **Permission engine** (`src/modules/permissions/engine.ts`) — central, extensible
  approval system. Safe/read-only actions run automatically; consequential actions
  (send, push, delete, purchase, submit, edit) require explicit approval.
- **Activity log** (`src/modules/activity/log.ts`) — secret-safe action log
  (time, command, intent, tool, action, result). Keys, tokens and credentials are
  scrubbed before storage.
- **Task manager** (`src/modules/tasks/manager.ts`) — persistent to-dos, priorities,
  and due-date tracking that survives restarts.
- **Client / lead CRM** (`src/modules/crm/manager.ts`) — persistent leads with
  NEW/CONTACTED/REPLIED/NEGOTIATING/WON/LOST/FOLLOW_UP statuses and follow-up reminders.
- **Personal Dashboard** (`src/components/Dashboard.vue`) — reachable from the app
  menu: Today, System status, Agents, Tasks, Clients/Leads, and Activity.
- **No-key graceful mode** — the app launches and shows a dashboard without an API
  key. Provide a key via `.env`/Settings, restart, and Zara becomes operational —
  no rebuild required. `.env-example` documents this.
- **Strengthened Zara persona** (`src/prompts/defaultPersonaPrompt.ts`) — includes
  natural phrases, honesty rules (real SUCCESS/FAILED/PERMISSION_REQUIRED/
  NOT_CONNECTED/UNSUPPORTED statuses), context awareness, and safety approval rules.

### Changed

- Version bumped from `1.5.0` to `2.0.0`; product name updated to **Zara AI 2070**.
- User commands are routed through the orchestrator and recorded in the activity log.

### Security

- Confirmed no API keys or secrets are exposed in tracked files. `.env` is
  git-ignored. Secrets are never written to logs, console, or activity history.

### Not yet wired (requires configuration)

These features have their architecture in place but need real configuration or a
native/browser bridge before they are operational — they are reported honestly as
`requires-config` / `unavailable` rather than faked:

- Browser tab control (back/forward/tabs) — needs the browser/desktop bridge.
- Computer control / window switching — desktop bridge.
- Screen & camera vision — needs a vision-capable model and camera permission.
- GitHub agent (push/commit/branch) — needs a GitHub token and git in the environment.
- Job search & client finding — needs a web-search provider; results are never fabricated.
- Autonomous code editing — runs in the desktop app only; edits always require approval.
- Wake word always-on detection — VAD exists; true always-on listening needs a native
  audio path and is gated by permission.
