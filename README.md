# Promptly

**Promptly** is a high-performance, cross-platform utility application designed to provide a unified, multi-model interface for interacting with both local and cloud-based Large Language Models (LLMs). Built with Electron, it offers a seamless and private environment to manage, compare, and switch between your favorite AI models.

## ✨ Key Features

* **Universal Multi-Model Interface:** A single, streamlined hub for interacting with **Ollama, LM Studio, ChatGPT, Gemini,** and more.
* **Hybrid Workflow:** Easily toggle between private, on-device local models and powerful cloud-based APIs within one interface.
* **Privacy-First:** Prioritize your data security by running models locally. API keys for cloud providers are encrypted at rest.
* **Smart Context Management:** Maintain focus and optimize performance with **Context Pinning** and **Pruning**.
* **Intelligent Interaction:** Improve your productivity with dynamic follow-up suggestions and refined AI response handling.
* **Cross-Platform:** Built with Node.js/Electron for consistent, snappy performance across Windows, macOS, and Linux.

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
* Enter and securely encrypt your cloud API keys.


3. **Prompt:** Start interacting with your chosen models. Use the context tools to pin important threads or prune irrelevant data to maintain conversation focus.

---

## 🤝 Contributing

We welcome all contributions! To help improve Promptly:

1. **Fork** the repository.
2. Create your **feature branch**: `git checkout -b feature/your-feature-name`.
3. **Commit** your changes and **push** the branch.
4. Open a **Pull Request** against the `master` branch.

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See the [LICENSE](https://github.com/zonedoutvinit/promptly/blob/master/LICENSE) file for details.
