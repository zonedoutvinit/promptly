# Promptly

**Promptly** is a powerful AI-powered terminal interface that allows you to seamlessly switch between local LLMs (via Ollama or similar providers) and cloud-based models. Designed for developers who want to integrate AI directly into their shell workflow with privacy and flexibility.

## Features

* **Unified Interface:** A single shell experience for all your LLM needs.
* **Local & Cloud Support:** Toggle effortlessly between your local machine models and cloud APIs.
* **Privacy-First:** Keep sensitive data local by defaulting to private, on-device models.
* **Extensible:** Built with Electron for a snappy, cross-platform desktop experience.

## Installation

### Prerequisites

* Node.js (v18+)
* npm or yarn

### Build from Source

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/promptly.git

# Navigate to the directory
cd promptly

# Install dependencies
npm install

# Build the app
npm run dist

```

*The installer files (`.deb`, `.rpm`) will be generated in the `/dist` folder.*

## Usage

1. **Launch Promptly** from your system applications menu.
2. **Configure Models:** Open Settings to add your API keys (for cloud models) or point to your local LLM service (e.g., Ollama).
3. **Run Commands:** Type your prompts directly into the Promptly shell and watch the AI respond in real-time.

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`.
3. Commit your changes and push the branch.
4. Open a **Pull Request** against the `main` branch.

## License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
