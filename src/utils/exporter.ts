// src/utils/exporter.ts
import { ChatSession } from "./db";

/**
 * Compiles a chat session into a beautifully formatted Markdown Document ledger.
 * Respects pinned and pruned flags with structural visual labels.
 */
export const exportToMarkdown = (session: ChatSession) => {
  const timestamp = new Date(session.updatedAt).toLocaleString();

  let markdown = `# Session Ledger: ${session.title}\n`;
  markdown += `**Model Engine:** \`${session.model}\`  \n`;
  markdown += `**Export Date:** ${timestamp}  \n`;
  markdown += `**Session ID:** \`${session.id}\`  \n\n`;
  markdown += `---\n\n`;

  session.messages.forEach((msg) => {
    const roleLabel =
      msg.role === "user" ? "USER PROMPT" : "ASSISTANT RESPONSE";
    let flags: string[] = [];

    if (msg.isPinned) flags.push("PINNED");
    if (msg.isPruned) flags.push("PRUNED FROM CONTEXT");

    const flagString = flags.length > 0 ? ` *(${flags.join(" | ")})*` : "";

    markdown += `### ${roleLabel}${flagString}\n`;
    markdown += `*Captured: ${new Date(msg.timestamp).toLocaleTimeString()}*\n\n`;

    // Indent code blocks or blockquotes if the message was pruned to visually signal its state
    if (msg.isPruned) {
      markdown += `> ⚠️ *This block was pruned from active context compilation.*\n>\n`;
      markdown +=
        msg.content
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n";
    } else {
      markdown += `${msg.content}\n\n`;
    }

    markdown += `---\n\n`;
  });

  triggerDownload(
    markdown,
    `ledger_${session.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`,
    "text/markdown",
  );
};

/**
 * Transpiles a chat session into a raw JSON Context Blueprint matching standard tuning schemas.
 */
export const exportToJSON = (session: ChatSession) => {
  const blueprint = {
    blueprintVersion: "1.1.0",
    id: session.id,
    title: session.title,
    engineModel: session.model,
    compiledAt: session.updatedAt,
    metrics: {
      totalMessages: session.messages.length,
      pinnedCount: session.messages.filter((m) => m.isPinned).length,
      prunedCount: session.messages.filter((m) => m.isPruned).length,
    },
    // Map data structure cleanly for fine-tuning setups or raw state backups
    messages: session.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      meta: {
        isPinned: msg.isPinned,
        isPruned: msg.isPruned,
      },
    })),
  };

  triggerDownload(
    JSON.stringify(blueprint, null, 2),
    `blueprint_${session.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`,
    "application/json",
  );
};

/**
 * Spawns a transient DOM anchor gate to pass raw data strings safely into client file downloads.
 */
const triggerDownload = (
  content: string,
  fileName: string,
  contentType: string,
) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();

  // Garbage collection cleanup execution
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
