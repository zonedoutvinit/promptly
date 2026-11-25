// src/utils/streamSanitizers.ts
import {
  DiffLine,
  LiveCanvasDraft,
  StreamSanitizeResult,
} from "@renderer/types";

export function normalizeAndCleanCitations(input: string): string {
  return (
    input
      // Normalize <cite: 1> to[cite: 1] before angle-bracket scrubbing
      .replace(/<\s*cite\s*:\s*(\d+(?:\s*,\s*\d+)*)\s*>/gi, "")
      // Drop lines where a model echoes "Source[cite: 1]: ..." verbatim
      .replace(/^(?:Source\s*)?\[\s*cite\s*:\s*\d+\s*\]:?\s+.*$/gim, "")
      .trim()
  );
}

export function scrubArtifactMarkup(input: string): string {
  return input
    .replace(/<\/?(?:artifact(?:_[a-zA-Z0-9_-]*)?)[^>]*>/gi, "")
    .replace(/<\/?(?:[a-zA-Z_][a-zA-Z0-9_-]*)?$/g, "");
}

export function unwrapArtifactFences(input: string): string {
  return input
    .replace(
      /```(?:xml|html|markdown|text)?\s*(<(?:artifact_create|artifact_patch)[\s\S]*?)```/gi,
      "$1",
    )
    .replace(/<artifact_content[^>]*>([\s\S]*?)<\/artifact_content>/gi, "$1");
}

export function unwrapProseMarkdownFence(input: string): string {
  const trimmed = input.trim();
  const match =
    /^```(?:markdown|md|text|txt|plain)?\s*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  if (!match) return input;

  const inner = match[1];
  if (/```/.test(inner)) return input;
  return inner.trim();
}

export function stripStreamingCodeFences(input: string): string {
  return input
    .replace(
      /```(?!markdown\b|md\b|text\b|txt\b|plain\b)([a-zA-Z0-9_-]*)\n[\s\S]*?```/g,
      "",
    )
    .trim();
}

export function sanitizeChatStreamText(
  raw: string,
  workspaceEnabled = false,
): StreamSanitizeResult {
  if (!raw) {
    return { text: "", activeArtifactAction: null, liveDraft: null };
  }

  let working = unwrapArtifactFences(normalizeAndCleanCitations(raw));
  let activeArtifactAction: string | null = null;
  let liveDraft: LiveCanvasDraft | null = null;

  // 1. Unclosed <artifact_create ...>
  const openCreateMatch =
    /<artifact_create(?:\s+title="([^"]*)")?(?:\s+language="([^"]*)")?[^>]*>(?![\s\S]*<\/artifact_create>)([\s\S]*)$/i.exec(
      working,
    );

  if (openCreateMatch) {
    const fileTitle = openCreateMatch[1]?.trim() || "artifact";
    const lang = openCreateMatch[2]?.trim() || "text";
    const draftContent = scrubArtifactMarkup(
      stripHallucinatedArtifactTags(openCreateMatch[3] || ""),
    ).replace(/^\n/, "");

    activeArtifactAction = `Drafting ${fileTitle} in Canvas...`;
    liveDraft = {
      mode: "create",
      title: fileTitle,
      language: lang,
      content: draftContent,
    };
    working = working.slice(0, openCreateMatch.index);
  }

  // 2. Unclosed <artifact_patch>
  if (!liveDraft) {
    const openPatchMatch =
      /<artifact_patch>(?![\s\S]*<\/artifact_patch>)([\s\S]*)$/i.exec(working);

    if (openPatchMatch) {
      const replaceMatch = /<replace>([\s\S]*?)(?:<\/replace>|$)/i.exec(
        openPatchMatch[1] || "",
      );
      activeArtifactAction = "Applying patch to Canvas...";
      liveDraft = {
        mode: "patch",
        content: replaceMatch
          ? scrubArtifactMarkup(
              stripHallucinatedArtifactTags(replaceMatch[1]),
            ).replace(/^\n/, "")
          : "",
      };
      working = working.slice(0, openPatchMatch.index);
    }
  }

  // 3. Fallback for small models: only treat a trailing unpaired code fence as liveDraft
  if (!liveDraft && workspaceEnabled) {
    let pos = 0;
    let openFenceStart: number | null = null;
    let openFenceLang = "text";
    let openFenceBodyStart = 0;

    while (pos < working.length) {
      const fenceIdx = working.indexOf("```", pos);
      if (fenceIdx === -1) break;

      if (openFenceStart === null) {
        const afterTicks = working.slice(fenceIdx + 3);
        const newlineOffset = afterTicks.indexOf("\n");
        if (newlineOffset === -1) {
          openFenceStart = fenceIdx;
          openFenceLang = afterTicks.trim() || "text";
          openFenceBodyStart = working.length;
          break;
        }
        openFenceStart = fenceIdx;
        openFenceLang = afterTicks.slice(0, newlineOffset).trim() || "text";
        openFenceBodyStart = fenceIdx + 3 + newlineOffset + 1;
        pos = openFenceBodyStart;
      } else {
        openFenceStart = null;
        pos = fenceIdx + 3;
      }
    }

    if (openFenceStart !== null) {
      const normalizedLang = openFenceLang.toLowerCase();
      const isCodeLikeFence =
        normalizedLang.length > 0 &&
        !["markdown", "md", "text", "txt", "plain"].includes(normalizedLang);

      const codeBody = scrubArtifactMarkup(
        working.slice(openFenceBodyStart),
      ).replace(/^\n/, "");

      if (isCodeLikeFence) {
        activeArtifactAction = "Streaming code to Canvas...";
        liveDraft = {
          mode: "fence",
          language: openFenceLang,
          content: codeBody,
        };
        working = working.slice(0, openFenceStart);
      }
    }
  }

  working = scrubArtifactMarkup(
    working
      .replace(/<artifact_create[\s\S]*?<\/artifact_create>/gi, "")
      .replace(/<artifact_patch>[\s\S]*?<\/artifact_patch>/gi, ""),
  ).trim();

  return { text: working, activeArtifactAction, liveDraft };
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (
      i < oldLines.length &&
      j < newLines.length &&
      oldLines[i] === newLines[j]
    ) {
      result.push({ type: "unchanged", text: oldLines[i] });
      i++;
      j++;
    } else {
      let foundMatch = false;
      for (let lookahead = 1; lookahead <= 5; lookahead++) {
        if (
          i + lookahead < oldLines.length &&
          oldLines[i + lookahead] === newLines[j]
        ) {
          for (let k = 0; k < lookahead; k++) {
            result.push({ type: "removed", text: oldLines[i + k] });
          }
          i += lookahead;
          foundMatch = true;
          break;
        }
        if (
          j + lookahead < newLines.length &&
          oldLines[i] === newLines[j + lookahead]
        ) {
          for (let k = 0; k < lookahead; k++) {
            result.push({ type: "added", text: newLines[j + k] });
          }
          j += lookahead;
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        if (i < oldLines.length) {
          result.push({ type: "removed", text: oldLines[i] });
          i++;
        }
        if (j < newLines.length) {
          result.push({ type: "added", text: newLines[j] });
          j++;
        }
      }
    }
  }
  return result;
}

export const stripHallucinatedArtifactTags = (input: string): string => {
  return input
    .replace(/<\/?(?:artifact|artifact_content)[^>]*>/gi, "")
    .replace(/^```(?:xml|html|markdown|text|python)?\s*$/gim, "")
    .replace(/^```\s*$/gim, "");
};
