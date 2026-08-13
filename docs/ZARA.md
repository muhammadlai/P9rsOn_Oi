# ZARA — Aitzaz's Personal AI

ZARA is a standalone desktop AI companion built on Electron + Vue 3 + Vite,
with a Go sidecar for local speech.

- **Assistant:** ZARA
- **Owner:** AITZAZ

---

## 1. Quick start

```bash
npm install            # native modules need a compiler toolchain
cp .env.example .env   # then add your own key when you're ready
npm run dev            # launches the desktop app
```

**ZARA launches with no API key.** She reports `AI API NOT CONFIGURED`,
still answers local commands (open sites, search, time, memory, app launching),
and activates the AI brain the moment you add a key — no rebuild needed.

---

## 2. Adding your API key (whenever you want)

Two options — pick either.

**Option A — `.env` file**

```env
AI_API_KEY=sk-your-real-key
AI_MODEL=gpt-4o
AI_PROVIDER=openai
```

**Option B — in-app**

Settings → **Core** tab → paste the key. It is encrypted at rest with
Electron `safeStorage`.

Then Settings → **ZARA** tab → **Test Connection**.

### How the key is protected

| Guarantee | Where it's enforced |
|---|---|
| Never hard-coded | No literal key anywhere in the repo |
| Never committed | `.env` + `.env.*` are git-ignored |
| Never in the frontend bundle | Read only by the main process (`zaraConfig.ts`) |
| Never displayed | UI shows a fixed `••••••••••••••••` mask |
| Never leaks length | Mask is constant regardless of key size |
| Never logged | Activity log runs every entry through `redact()` |
| Never in error messages | Connection test returns generic failure text |

---

## 3. Architecture

```
ZARA AI
├── Desktop Application ....... electron/main/*        Electron 43 shell
├── AI Brain .................. src/services/llmProviders/
├── Voice Engine .............. src/composables/useAudioProcessing.ts (VAD)
├── Speech Recognition ........ Go backend (Whisper) / cloud STT
├── Text-to-Speech ............ src/services/zaraSpeech.ts (Piper → cloud → browser)
├── Memory .................... electron/main/memoryManager.ts (SQLite, persistent)
├── Command Router ............ src/zara/commandRouter.ts
├── Browser Controller ........ src/zara/browserController.ts + browser-extension/
├── Computer Controller ....... src/zara/computerController.ts + electron/main/zaraManager.ts
├── Vision .................... src/components/ZaraCamera.vue + screenshot pipeline
├── Permissions ............... src/zara/permissions.ts
├── Settings .................. src/components/settings/ZaraProfileTab.vue
└── Activity Logs ............. src/stores/activityStore.ts
```

### Request flow — voice and text share one pipeline

```
VOICE ──┐
        ├──> COMMAND ROUTER ──> TOOL ──> HONEST RESULT ──> REPLY ──> TTS
TEXT  ──┘                          │
                                   └──> AI BRAIN (only if not deterministic)
```

Deterministic commands never need the network, so they work offline and
before any key exists.

---

## 4. Real browser control

| Command | Works standalone | Needs extension |
|---|:---:|:---:|
| Open Google / YouTube / Gmail / ChatGPT | ✅ | |
| Search the web / YouTube | ✅ | |
| Open a new tab | ✅ (fallback) | ✅ (true new tab) |
| Go back / forward / refresh / close tab | | ✅ |
| Read the current page | | ✅ |

Tab control is **impossible** from outside a browser — that's a browser
security boundary, not a limitation of the app. So ZARA ships a real
extension in `browser-extension/`.

**Install:** `chrome://extensions` → Developer mode → Load unpacked →
select `browser-extension/`. Badge shows **ON** when connected.

Without it, ZARA says `BROWSER CONTROL NOT CONNECTED`. She never pretends.

---

## 5. Honest status reporting

Every action returns one of:

```
SUCCESS · FAILED · PERMISSION_REQUIRED · NOT_CONNECTED · UNSUPPORTED
```

ZARA only says "Done" on `SUCCESS`. This is enforced by
`speakResult()` and covered by tests in
`src/zara/__tests__/acceptance.test.ts`.

---

## 6. Safety model

**Computer control is a fixed catalogue, not a shell.** The AI picks an app
*id* from an allowlist (`APP_CATALOGUE` in `zaraManager.ts`); it can never
assemble a command string. A prompt injection cannot execute arbitrary code
through this surface.

**Destructive actions require confirmation** — deleting, sending mail,
purchases, password changes, destructive system commands. The gate runs
*before* AI delegation, so unclassified destructive requests are caught too.

---

## 7. Wake word

Say **"Zara"**, **"Hey Zara"**, or **"Zara, open Google."**

- Wake-word gating is **opt-in** (`wakeWordEnabled`). Off by default, so the
  mic button is the trigger.
- Once engaged, follow-ups within **45 s** don't need the wake word again —
  this is what makes conversation continuous.
- `"Zaragoza"` and similar will not trigger it (word-boundary checked).

---

## 8. Continuous conversation

The old build answered once and stopped. Fixed in
`useAudioPlayback.ts`: when the audio queue empties, ZARA returns to
`LISTENING` instead of `IDLE` while a mic session is active.

```
LISTENING → UNDERSTANDING → THINKING → ACTION → RESPONSE → SPEAKING → LISTENING
```

**Interruption:** say "Stop" or tap the mic and TTS halts immediately —
no waiting for the sentence to finish.

---

## 9. Development

```bash
npm test                                  # 194 tests
npx vue-tsc --noEmit -p tsconfig.json     # typecheck
npm run build:web                         # renderer build
npm run build                             # full desktop package
npx vite --config vite.preview.config.ts  # UI-only preview in a browser
```

### Adding a new command

1. Add the intent to `ZaraIntent` in `src/zara/types.ts`.
2. Add a pattern in `src/zara/intentParser.ts`.
3. Add a handler case in `CommandRouter.execute()`.
4. Add a test.

---

## 10. Sandbox notes

Two things could not be exercised in the build sandbox and should be checked
on your machine:

- `better-sqlite3` / `hnswlib-node` need a native toolchain (the sandbox had
  no network access to Node headers). Run a plain `npm install` locally.
- The Electron binary couldn't be downloaded, so the desktop shell wasn't
  launched here. The renderer was verified in browser mode, and the main
  process compiles cleanly.
