# Zara AI

A personal AI desktop companion based on the open-source [Alice](https://github.com/pmbstyle/Alice) project.

**Owner / Creator: Aitzaz**

Say "Hi" to Zara 👋 — an open-source AI companion designed to live on your desktop, now speaking your language: **English, Urdu (اردو), Roman Urdu, and Hindi (हिन्दी)**.

Zara addresses you respectfully as **"Sir"** and understands natural code-switching, e.g.:

> User: "Chrome kholo."
> Zara: "Ji Sir, Chrome khol diya."

Zara brings together voice interaction, intelligent context awareness, powerful tooling, and a friendly personality to assist you with everything from daily tasks to deeper creative work.
Zara is more than a chatbot; she's built to feel present, responsive, emotionally engaging, and deeply useful.

## Attribution & License

Zara AI is a modified fork of **[Alice](https://github.com/pmbstyle/Alice)**, created by **Slava Trofimov ([pmbstyle](https://github.com/pmbstyle))** and released under the **MIT License**.

* The original copyright notice and license text are preserved unmodified in [LICENSE](LICENSE).
* All credit for the original application, architecture, and features goes to the Alice authors.
* Zara AI branding, the Zara persona, and Urdu/Hindi/Roman Urdu customizations are maintained by **Aitzaz (Owner / Creator)** — see [NOTICE.md](NOTICE.md).

## ✨ Key Features

### 🌏 Multilingual by design

* Understands and replies in **English, Urdu, Roman Urdu, and Hindi**, including mixed-language (code-switched) speech, e.g. "Chrome kholo aur YouTube open karo."
* Mirrors your language and script: ask in `اردو`, `हिन्दी`, Roman Urdu, or English — Zara answers the same way.
* Hindi and Urdu voices available for the local Piper TTS engine; OpenAI and Google TTS also speak Urdu/Hindi naturally.

### 💻 Local and Cloud use

Zara is designed to work with Cloud(OpenAI / Codex subscription, OpenRouter, Z.ai, Minimax, Deepseek) and Local LLMs (Ollama/LM Studio).
Has built-in speech-to-text, text-to-speech, and embedding services.
While the OpenAI cloud API is preferred and provides the best user experience, Zara can also operate **fully locally** (experimental).

### 🗣️ Voice Interaction

* Fast, VAD-powered voice recognition (via `gpt-4o-transcribe`, `google-tts-voice` or `whisper-large-v3`)
* Natural-sounding responses with OpenAI/Google TTS and optional support for local multilingual text-to-speech via Piper TTS (including Hindi `hi_IN` and Urdu `ur_PK` voices)
* Local Whisper STT with explicit language selection for Urdu (`ur`) and Hindi (`hi`), or auto-detection
* Interruptible speech and streaming response cancellation for smoother flow

### 🧠 Memory & Context

* **Thoughts**: Short-term context stored in Hnswlib vector DB
* **Memories**: Structured long-term facts in local DB
* **Summarization**: Compact message history into context prompts
* **Emotion awareness**: Summaries include mood estimation for more human responses
* **Local RAG**: Add local documents to the LLM context, chat with your docs

### 🎨 Vision & Visual Output

* Screenshot interpretation using Vision API
* Image generation using `gpt-image-2`
* Animated video states (standby/speaking/thinking)

### 🪄 Computer Use Tools

Zara can interact with your local system with user-approved permissions:

* 📂 File system browsing (e.g., listing folders)
* 💻 Shell command execution (`ls`, `mv`, `mkdir`, etc)
* 🔐 Granular command approvals:
  * One-time
  * Session-based
  * Permanent (revocable)
* 🔧 Settings tab "Permissions" lets you review and manage all approved commands

### ⚙️ Function Calling

* Web search (including Searxng support)
* Google Calendar & Gmail integration
* Torrent search & download (via Jackett + qBittorrent)
* Time & date awareness
* Clipboard management
* Task scheduler (reminders and command execution)
* Open applications & URLs
* Image generation
* MCP server support

### 💬 Wake Word Support
With the local STT model, you can set a **wake-up word** (like "Hey, Siri").
- Zara will always listen, but only process requests when the wake word is spoken.
- The default wake word is **"zara"** (configurable).
- Default mode is **auto language detection**, but you can also select a specific language in settings.

### 💻 Dedicated Chrome [Extension](https://github.com/pmbstyle/alice-chrome-extension) (from the original Alice project)

* Ask about your active Chrome tab
* Context menu for selected text on a web page
  - Fact check this
  - Summarize this
  - Tell me more about it

### 🎛️ Flexible Settings

Fully customizable settings interface:

* LLM provider selection between OpenAI, OpenRouter, DeepSeek, Z.ai(coding plan), Minimax(token plan), Ollama, LM Studio
* Cloud or local TTS, STT, Embeddings
* Model choice & parameters (temperature, top\_p, history, etc)
* Prompt and summarization tuning
* Audio/mic toggles & hotkeys
* Available tools & MCP configuration
* Google integrations

### 🔨 Custom Tools

Zara supports [custom tools](./docs/custom-tools.md) that are defined in JSON and backed by local scripts.

1. Open *Settings → Customization → Custom tools*
2. Upload or drop your script (writes to `custom-tool-scripts/`)
3. Click **Add Tool**, fill in metadata, and paste the JSON schema. Saving updates `custom-tools.json`
4. Toggle the tool on/off in the list. Only enabled + valid entries are offered to the model.

### 🎭 Custom Avatars

Swap Zara's appearance with [your own](./docs/custom-avatars.md) video loops:

1. Create a folder under `user-customization/custom-avatars/<AvatarName>/`.
2. Drop `speaking.mp4`, `thinking.mp4`, and `standby.mp4` into that folder (all required).
3. Open **Settings → Customization → Assistant Avatar**, hit **Refresh**, and pick the new avatar.

## 🚀 Download

Check the **[Releases](https://github.com/muhammadlai/P9rsOn_Oi/releases/latest)** page of this repository, or build from source (see below).

Follow the [Setup Instructions](./docs/setupInstructions.md) to configure your API keys and environment.

## 🛠️ Technologies Used

* **Frontend:** [Vue.js](https://vuejs.org/), [TailwindCSS](https://tailwindcss.com/)
* **Desktop Shell:** [Electron](https://www.electronjs.org/)
* **State Management:** [Pinia](https://pinia.vuejs.org/)
* **AI APIs:** [OpenAI](https://platform.openai.com/), [OpenRouter](https://openrouter.ai/), [DeepSeek](https://platform.deepseek.com/), [Groq](https://console.groq.com/)
* **Backend:** [Go](https://go.dev/)
* **Vector search engine**: [hnswlib-node](https://github.com/nmslib/hnswlib)
* **Local storage**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
* **Voice activity detection:** [VAD (Web)](https://github.com/ricky0123/vad)
* **Local STT & TTS:** [whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) & [Piper](https://github.com/rhasspy/piper)
* **Local Embeddings:** [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) (ONNX, 384 dimensions)

Other tools:

* [Jackett](https://github.com/Jackett/Jackett) — Torrent aggregator
* [qBittorrent](https://www.qbittorrent.org/) — Torrent client
* [Searxng](https://github.com/searxng/searxng) - Self-hosted web search

## 🧑‍💻 Getting Started (Development)

```bash
# 1. Clone the repo
$ git clone https://github.com/muhammadlai/P9rsOn_Oi.git

# 2. Install dependencies
$ npm install

# 3. Set up your .env file (see .env-example for reference)
```

Follow [setup instructions](./docs/setupInstructions.md) to obtain required API credentials.

```bash
# 4. Download ONNX Runtime and the pinned multi-lang Memory/RAG model
npm run setup:embeddings

# 5. Compile backend
npm run build:go

# 6. Run dev environment
$ npm run dev
```

### 📦 Production Build

Optionally, create an `app-config.json` file in the root directory for Google integration:

```json
{
  "VITE_GOOGLE_CLIENT_ID": "",
  "VITE_GOOGLE_CLIENT_SECRET": ""
}
```

```bash
# Build the app
$ npm run build
```

Install the output from the `release/` directory.

## 🤝 Contributing

Ideas, bug reports, feature requests - all welcome! Open an issue or PR. For issues that also affect the upstream project, consider reporting them at [pmbstyle/Alice](https://github.com/pmbstyle/Alice) as well.
