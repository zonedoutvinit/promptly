// src/utils/chatHelpers.ts

export const genericOptions = [
  {
    label: "Deepen Analysis",
    prompt: "Can you elaborate further on this with deeper context?",
  },
  {
    label: "Show Counter-View",
    prompt:
      "What is a strong counter-argument or alternative perspective to what you just said?",
  },
  {
    label: "Summarize Core",
    prompt:
      "Summarize your previous point down into one clear, punchy sentence.",
  },
  {
    label: "Turn to Checklist",
    prompt:
      "Convert your response into a clean, actionable step-by-step checklist.",
  },
];

export const fillerBlacklist = [
  // --- Broad Universal Triggers (Catch-alls) ---
  "do you want to",
  "would you like",
  "would you want",
  "let me know if",

  // --- Conversational Next Steps / Endings ---
  "what's next",
  "whats next",
  "let me know",
  "what sparks your interest",
  "what interests you",
  "what catches your eye",
  "what sounds good",
  "what would you like",
  "where should we start",
  "where would you like to start",
  "where would you like to go",
  "where should we go from here",
  "dive right in",
  "dive in",
  "get us started",
  "get started",
  "feel free to",
  "just let me know",
  "let's dive",
  "lets dive",
  "happy to explore",
  "gladly talk about",
  "do you want to know",
  "do you want to explore",
  "do you want to talk",
  "do you have a favorite",
  "do you have a specifics in mind",
  "want to learn more",
  "want to explore",
  "want to know more",
  "would you be interested",
  "are you interested",
  "are you curious",
  "are you looking for",
  "in the mood for",
  "tell me what",
  "tell me which",
  "tell me how",
  "can you talk about",
  "can we talk about",
  "can we discuss",
  "we could talk about",
  "we could discuss",
  "we could explore",
  "we can dive",
  "we can explore",
  "we can discuss",
  "i can share",
  "i'd love to",
  "id love to",
  "that's a vast topic",
  "thats a vast topic",
  "to give you some",
  "here are some ideas",
  "here are a few",
  "options include",
  "following areas",
  "such as:",
  "for example:",
];

export const isValidPrompt = (str: string): boolean => {
  const lower = str.toLowerCase().trim();

  // 1. Strict Substring Match (The Shield)
  // If the suggestion contains any exact phrase from our blacklist, kill it immediately.
  const isStrictFiller = fillerBlacklist.some((filler) =>
    lower.includes(filler),
  );
  if (isStrictFiller) return false;

  // 2. Structural Length Guard
  if (lower.length < 5) return false;

  // 3. Sentence Structure Guard
  // Real topic paths extracted from lists or colons shouldn't read like an unfinished question starting with auxiliary verbs.
  if (
    lower.startsWith("why do you") ||
    lower.startsWith("how do you") ||
    lower.startsWith("do you need")
  ) {
    return false;
  }

  return true;
};

export const cleanMarkdownText = (str: string): string => {
  return str
    .replace(/[\*\-_]+/g, "") // Strip markdown bold/italics markers
    .replace(/^[^a-zA-Z0-9\s]+/, "") // Safely clean non-alphanumeric prefixes WITHOUT over-stripping spaces
    .replace(/:\s*$/, "") // Strip trailing colons
    .trim();
};

export const getModelSuggestedPrompts = (
  lastMessage: { role: string; content: string } | null,
): string[] => {
  if (!lastMessage || !lastMessage.content) return [];

  const text = lastMessage.content;
  const suggestions: string[] = [];

  const isInvitation =
    text.includes("?") ||
    text.includes(":") ||
    text.toLowerCase().includes("interested in") ||
    text.toLowerCase().includes("mood for") ||
    text.toLowerCase().includes("here are");

  if (isInvitation) {
    const lines = text.split("\n");

    for (const line of lines) {
      let trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 🛑 NEW/ENHANCED STRATEGY 1: Detect structural splits using either Colons OR Question Marks
      // This catches "Explore different cuisines? Tell me..." by splitting on the "?"
      const delimiter = trimmedLine.includes(":")
        ? ":"
        : trimmedLine.includes("?")
          ? "?"
          : null;

      if (delimiter) {
        const parts = trimmedLine.split(delimiter);
        const rawHeader = parts[0].trim();
        const cleanHeader = cleanMarkdownText(rawHeader);

        if (
          cleanHeader.length >= 2 &&
          cleanHeader.length < 60 &&
          isValidPrompt(cleanHeader)
        ) {
          // Re-attach the question mark cleanly so it presents beautifully as a path choice
          const finalPrompt = cleanHeader.endsWith("?")
            ? cleanHeader
            : `${cleanHeader}?`;

          if (!suggestions.includes(finalPrompt)) {
            suggestions.push(finalPrompt);
            continue; // Successfully extracted, skip fallback strategies for this line
          }
        }
      }

      // 2. Fallback Strategy: Handle raw list items or bullet lines without clear delimiters
      if (/^[\s\-\*•\d\.\)]+/.test(trimmedLine)) {
        const cleanLine = cleanMarkdownText(trimmedLine);
        if (
          isValidPrompt(cleanLine) &&
          cleanLine.length > 4 &&
          cleanLine.length < 75
        ) {
          const formattedPrompt = cleanLine.endsWith("?")
            ? cleanLine
            : `${cleanLine}?`;

          if (!suggestions.includes(formattedPrompt)) {
            suggestions.push(formattedPrompt);
          }
        }
      }
    }
  }

  // 3. Quote Fallback Pass
  if (suggestions.length === 0) {
    const quoteRegex = /"([^"\n]{6,65})"/g;
    let quoteMatch;
    while ((quoteMatch = quoteRegex.exec(text)) !== null) {
      const cleanQuote = cleanMarkdownText(quoteMatch[1]);
      if (isValidPrompt(cleanQuote)) {
        const formattedQuote = cleanQuote.endsWith("?")
          ? cleanQuote
          : `${cleanQuote}?`;

        if (!suggestions.includes(formattedQuote)) {
          suggestions.push(formattedQuote);
        }
      }
    }
  }

  return suggestions.slice(0, 5);
};
