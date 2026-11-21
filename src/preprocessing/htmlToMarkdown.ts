import {
  buildSuggestedFilename,
  createNormalizedDocument,
  normalizeLineBreaksAndWhitespace,
} from "./normalizeText";
import { NormalizedDocument, PreprocessInput } from "./types";

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "object",
  "embed",
  "nav",
  "footer",
  "aside",
].join(", ");

function escapeMarkdownText(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.nodeValue ?? "";
    // Collapse internal runs of whitespace/newlines inside inline flows
    return raw.replace(/\s+/g, " ");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(inlineNodeToMarkdown).join("");

  switch (tag) {
    case "br":
      return "  \n";
    case "code": {
      const codeText = (el.textContent ?? "").replace(/\r?\n/g, " ").trim();
      if (!codeText) return "";
      const tickRun =
        codeText
          .match(/`+/g)
          ?.reduce((max, run) => Math.max(max, run.length), 0) ?? 0;
      const fence = "`".repeat(tickRun + 1);
      return `${fence}${codeText}${fence}`;
    }
    case "strong":
    case "b": {
      const trimmed = inner.trim();
      return trimmed ? `**${trimmed}**` : "";
    }
    case "em":
    case "i": {
      const trimmed = inner.trim();
      return trimmed ? `*${trimmed}*` : "";
    }
    case "del":
    case "s": {
      const trimmed = inner.trim();
      return trimmed ? `~~${trimmed}~~` : "";
    }
    case "a": {
      const label = inner.trim();
      const href = el.getAttribute("href")?.trim();
      if (!label) return "";
      if (!href || href.startsWith("javascript:") || href.startsWith("#")) {
        return label;
      }
      return `[${label}](${href})`;
    }
    case "img": {
      const alt = (el.getAttribute("alt") ?? "").trim();
      const src = (el.getAttribute("src") ?? "").trim();
      if (!src || src.startsWith("data:")) {
        return alt ? `[Image: ${alt}]` : "";
      }
      return `![${alt || "image"}](${src})`;
    }
    default:
      return inner;
  }
}

function listToMarkdown(listEl: HTMLElement, depth = 0): string {
  const isOrdered = listEl.tagName.toLowerCase() === "ol";
  const indent = "  ".repeat(depth);
  const items = Array.from(listEl.children).filter(
    (child) => child.tagName.toLowerCase() === "li",
  );

  return items
    .map((li, index) => {
      const marker = isOrdered ? `${index + 1}. ` : "- ";
      const parts: string[] = [];

      for (const child of Array.from(li.childNodes)) {
        if (
          child.nodeType === Node.ELEMENT_NODE &&
          ["ul", "ol"].includes((child as HTMLElement).tagName.toLowerCase())
        ) {
          parts.push(listToMarkdown(child as HTMLElement, depth + 1));
        } else {
          parts.push(blockNodeToMarkdown(child, depth + 1));
        }
      }

      const joined = parts
        .join("\n")
        .replace(/\n{2,}/g, "\n")
        .trim();
      const lines = joined.split("\n");
      const firstLine = `${indent}${marker}${lines[0] ?? ""}`;
      const restLines = lines.slice(1).map((line) => `${indent}  ${line}`);
      return [firstLine, ...restLines].join("\n");
    })
    .join("\n");
}

function tableToMarkdown(tableEl: HTMLElement): string {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const matrix = rows
    .map((tr) =>
      Array.from(tr.children)
        .filter((cell) => ["th", "td"].includes(cell.tagName.toLowerCase()))
        .map((cell) =>
          Array.from(cell.childNodes)
            .map(inlineNodeToMarkdown)
            .join("")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\|/g, "\\|"),
        ),
    )
    .filter((row) => row.length > 0);

  if (matrix.length === 0) return "";

  const colCount = Math.max(...matrix.map((r) => r.length));
  const padded = matrix.map((row) =>
    Array.from({ length: colCount }, (_, i) => row[i] ?? ""),
  );

  const header = `| ${padded[0].join(" | ")} |`;
  const separator = `| ${Array.from({ length: colCount }, () => "---").join(" | ")} |`;
  const body = padded
    .slice(1)
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");

  return [header, separator, body].filter(Boolean).join("\n");
}

function blockNodeToMarkdown(node: Node, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.nodeValue ?? "").trim();
    return text ? escapeMarkdownText(text.replace(/\s+/g, " ")) : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Number(tag[1]);
      const headingText = Array.from(el.childNodes)
        .map(inlineNodeToMarkdown)
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      return headingText ? `${"#".repeat(level)} ${headingText}` : "";
    }
    case "p": {
      const para = Array.from(el.childNodes)
        .map(inlineNodeToMarkdown)
        .join("")
        .replace(/[ \t]+/g, " ")
        .trim();
      return para;
    }
    case "pre": {
      const codeEl = el.querySelector("code");
      const langClass = Array.from((codeEl ?? el).classList).find(
        (cls) => cls.startsWith("language-") || cls.startsWith("lang-"),
      );
      const lang = langClass
        ? langClass.replace(/^(language-|lang-)/, "").trim()
        : "";
      const rawCode = (codeEl ?? el).textContent ?? "";
      const cleanedCode = rawCode
        .replace(/\r\n/g, "\n")
        .replace(/^\n+|\n+$/g, "");
      const tickRun =
        cleanedCode
          .match(/`{3,}/g)
          ?.reduce((max, run) => Math.max(max, run.length), 2) ?? 2;
      const fence = "`".repeat(tickRun + 1);
      return `${fence}${lang}\n${cleanedCode}\n${fence}`;
    }
    case "blockquote": {
      const innerBlocks = Array.from(el.childNodes)
        .map((child) => blockNodeToMarkdown(child, listDepth))
        .filter(Boolean)
        .join("\n\n");
      if (!innerBlocks) return "";
      return innerBlocks
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n");
    }
    case "ul":
    case "ol":
      return listToMarkdown(el, listDepth);
    case "table":
      return tableToMarkdown(el);
    case "hr":
      return "---";
    case "div":
    case "section":
    case "article":
    case "main":
    case "header": {
      return Array.from(el.childNodes)
        .map((child) => blockNodeToMarkdown(child, listDepth))
        .filter(Boolean)
        .join("\n\n");
    }
    default: {
      const inline = inlineNodeToMarkdown(el).trim();
      return inline;
    }
  }
}

async function resolveHtmlSource(
  input: PreprocessInput,
  warnings: string[],
): Promise<{ html: string; extractedTitle?: string }> {
  let raw = input.rawText ?? "";

  if (!raw && input.file) {
    raw = await input.file.text();
  }

  const normalizedRaw = normalizeLineBreaksAndWhitespace(raw);
  if (!normalizedRaw) {
    warnings.push("No HTML or text content was found in the input.");
    return { html: "" };
  }

  // If plain text was pasted without HTML tags, wrap paragraphs cleanly
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(normalizedRaw);
  if (!looksLikeHtml) {
    warnings.push(
      "Input contained no HTML tags; normalized as plain Markdown text.",
    );
    return {
      html: `<p>${normalizedRaw.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")}</p>`,
    };
  }

  return { html: normalizedRaw };
}

/**
 * Converts raw or file-backed HTML into a normalized Markdown document
 * for WorkspaceCanvas review and Phase 3 Local RAG indexing.
 */
export async function htmlToMarkdown(
  input: PreprocessInput,
): Promise<NormalizedDocument> {
  const warnings: string[] = [];
  const { html } = await resolveHtmlSource(input, warnings);

  if (!html) {
    return createNormalizedDocument({
      kind: "html",
      trigger: input.trigger,
      content: "",
      suggestedTitle: buildSuggestedFilename(
        input.sourceName,
        "web-clip",
        "md",
      ),
      language: "markdown",
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      warnings,
    });
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const pageTitle =
    doc.querySelector("title")?.textContent?.trim() || undefined;
  const noisyCount = doc.querySelectorAll(NOISE_SELECTORS).length;
  if (noisyCount > 0) {
    warnings.push(`Stripped ${noisyCount} non-content/boilerplate element(s).`);
  }

  doc.querySelectorAll(NOISE_SELECTORS).forEach((el) => el.remove());

  const rootContainer =
    doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body;

  const rawMarkdown = Array.from(rootContainer?.childNodes ?? [])
    .map((child) => blockNodeToMarkdown(child, 0))
    .filter(Boolean)
    .join("\n\n");

  const finalMarkdown =
    pageTitle && !rawMarkdown.startsWith(`# ${pageTitle}`)
      ? `# ${pageTitle}\n\n${rawMarkdown}`
      : rawMarkdown;

  const titleSeed =
    input.sourceName || pageTitle || input.sourceUrl || "web-clip";

  return createNormalizedDocument({
    kind: "html",
    trigger: input.trigger,
    content: finalMarkdown,
    suggestedTitle: buildSuggestedFilename(titleSeed, "web-clip", "md"),
    language: "markdown",
    sourceName: input.sourceName ?? pageTitle,
    sourceUrl: input.sourceUrl,
    warnings,
  });
}
