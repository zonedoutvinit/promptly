# Promptly

**Promptly** is a high-performance, cross-platform desktop application designed to provide a unified, multi-model interface for interacting with both local and cloud-based Large Language Models (LLMs). Built with Electron, React, TypeScript, and Tailwind CSS v4, it offers a fast, private environment to manage, compare, and switch between your favorite AI engines seamlessly.

## ✨ Key Features

- **Universal Multi-Model Interface:** A single, streamlined hub for interacting with **Ollama, Google Gemini, OpenAI, LM Studio,** and custom OpenAI-compatible endpoints.
- **Quick-Switch Engine & Model Pills:** Effortlessly toggle between local and cloud engines or swap active models directly from the refined pill controls right beneath the prompt input box.
- **Privacy-First & OS-Level Encryption:** Prioritize your data security by running models locally without API keys. Cloud provider API keys are encrypted at rest using Electron's native OS keychain integration (`safeStorage`), complete with graceful fallbacks for headless or minimal Linux environments.
- **Smart Context Management:** Maintain conversation focus, stay within token limits, and optimize model performance with **Context Pinning**, **Pruning**, and **Custom Personas**.
- **Web Search & Dynamic Thinking States:** Enrich responses with integrated web search context injection, live reasoning/thinking blocks, and checkpoint regeneration.
- **Cross-Platform:** Built with `electron-vite` for consistent, snappy performance across Windows, macOS, and Linux.

---

## 🛠️ Requirements

- **Node.js:** v24+
- **npm:** Latest

## 📥 Installation & Development

```bash
# Clone the repository
git clone [https://github.com/zonedoutvinit/promptly.git](https://github.com/zonedoutvinit/promptly.git)

# Navigate to the project
cd promptly

# Install dependencies
npm install

# Start the development server
npm run dev
```

## 🏗️ Build for Distribution

To compile the source code into `/out` or package native installers (`.AppImage`, `.dmg`, `.exe`) for your platform:

```bash
# Compile production source files only (outputs to /out)
npm run build

# Build and package native desktop installers (outputs to /dist)
npm run dist

```

_Packaged artifacts and auto-updater metadata will be generated in the `/dist` folder._

---

## 💡 Usage

1. **Launch:** Open the application via your system’s application menu or run `npm run dev` in development.
2. **Configure:** Navigate to **Settings** to:

- Connect local LLM providers (e.g., Ollama at `http://localhost:11434`—no API key required).
- Enter and securely encrypt your cloud API keys (e.g., Google Gemini, OpenAI).
- Customize system personas and context preferences.

3. **Prompt:** Use the **Engine** and **Model** pills directly below the chat input to pick your active model and start prompting. Use message controls to pin key context, prune noise, or regenerate from checkpoints.

---

## 🤝 Contributing

We welcome all contributions! To help improve Promptly:

1. **Fork** the repository.
2. Create your **feature branch**: `git checkout -b feature/your-feature-name`.
3. **Commit** your changes and **push** the branch.
4. Open a **Pull Request** against the `master` branch.

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See the [LICENSE](https://github.com/zonedoutvinit/promptly/blob/master/LICENSE) file for details.
