# Promptly 🚀

**Promptly** is a high-performance, web-based chat interface designed to bridge the gap between your local LLMs and cloud-based AI providers. Built with Electron for a snappy, cross-platform experience, it gives developers a private, flexible, and powerful AI terminal experience.

## ✨ Key Features

* **Universal AI Interface:** A unified chat wrapper supporting **Ollama, LM Studio, ChatGPT, Gemini,** and more.
* **Hybrid Workflow:** Seamlessly toggle between private, on-device local models and powerful cloud-based APIs.
* **Privacy-First:** Keep your sensitive data local by defaulting to private, on-device models. API keys are encrypted at rest.
* **Context Management:** Take control of your conversation with **Context Pinning/Pruning**.
* **Intelligent Interaction:** Improve your flow with dynamic/static follow-up suggestions and fine-tuned AI responses.
* **Cross-Platform:** Built with Node.js/Electron for consistent performance across Windows, macOS, and Linux.

---

## 🛠️ Requirements

* **Node.js:** v24+
* **npm:** Latest

## 📥 Installation

```bash
# Clone the repository
git clone https://github.com/zonedoutvinit/promptly.git

# Navigate to the project
cd promptly

# Install dependencies
npm install

# Run the application
npm start

```

## 🏗️ Build for Distribution

To generate native installers (`.deb`, `.rpm`, `.dmg`, `.exe`) for your platform:

```bash
npm run dist

```

*Artifacts will be generated in the `/dist` folder.*

---

## 💡 Usage

1. **Launch:** Open the application via your system’s application menu.
2. **Configure:** Navigate to **Settings** to:
* Connect your local LLM providers (e.g., Ollama or LM Studio).
* Enter and encrypt your cloud API keys.


3. **Chat:** Start prompting directly in the terminal interface. Use the context tools to pin important threads or prune irrelevant data to maintain focus.

---

## 🤝 Contributing

We welcome all contributions! To help improve Promptly:

1. **Fork** the repository.
2. Create your **feature branch**: `git checkout -b feature/your-feature-name`.
3. **Commit** your changes and **push** the branch.
4. Open a **Pull Request** against the `master` branch.

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See the [LICENSE](https://www.google.com/search?q=https://github.com/zonedoutvinit/promptly/blob/master/LICENSE) file for details.
