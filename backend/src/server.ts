import express from "express";
import cors from "cors";
import http from "http";

const app = express();
const PORT = 5001; // Using 5001 to avoid common system conflicts

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// Main streaming endpoint
app.post("/api/chat", async (req, res) => {
  const { messages, model = "llama3.2:3b" } = req.body;

  // Set up Server-Sent Events headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Forward request directly to local Ollama instance
    const ollamaResponse = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true,
      }),
    });

    if (!ollamaResponse.body) {
      throw new Error("No response body received from Ollama");
    }

    const reader = ollamaResponse.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      // Ollama returns individual JSON objects separated by newlines
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.trim() !== "") {
          const parsed = JSON.parse(line);
          const content = parsed.message?.content || "";

          // Format data specifically for SSE browser consumption
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    }
  } catch (error) {
    console.error("Ollama Stream Error:", error);
    res.write(
      `data: ${JSON.stringify({ error: "Failed to communicate with local LLM" })}\n\n`,
    );
  } finally {
    res.end();
  }
});

// Listing API to discover locally installed models
app.get("/api/models", async (req, res) => {
  try {
    const ollamaResponse = await fetch("http://127.0.0.1:11434/api/tags");

    if (!ollamaResponse.ok) {
      throw new Error("Failed to fetch tags from Ollama daemon");
    }

    const data = await ollamaResponse.json();

    // Map out just the clean model names
    const models = data.models.map((m: any) => ({
      name: m.name,
      size: m.size,
      details: m.details,
    }));

    res.json({ success: true, models });
  } catch (error) {
    console.error("Model Discovery Error:", error);
    // Fallback list so the UI never breaks completely if Ollama is asleep
    res.status(500).json({
      success: false,
      error: "Could not discover local models",
      models: [{ name: "llama3.2:3b" }, { name: "qwen2.5:3b" }],
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Promptly Backend humming along at http://localhost:${PORT}`);
});
