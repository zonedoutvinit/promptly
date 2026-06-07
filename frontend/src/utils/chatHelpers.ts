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

  // --- Questions & Invitations ---
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

  // --- Meta Context Setups ---
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

export const cleanMarkdownText = (str: string): string => {
  return str
    .replace(/[\*\-_]+/g, "")
    .replace(/^[\s\-\*•\d\.\)]+/, "")
    .replace(/:\s*$/, "")
    .trim();
};

export const isValidPrompt = (str: string): boolean => {
  const lower = str.toLowerCase().trim();

  // 1. Check strict substring match from blacklist first (Fast path)
  const isStrictFiller = fillerBlacklist.some((filler) =>
    lower.includes(filler),
  );
  if (isStrictFiller) return false;

  // 2. Length-based cleanups
  if (lower.length < 8) return false;

  // 3. 🧠 Fuzzy Match Overlap Scoring Engine (No external dependencies)
  const candidateWords = lower
    .replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (candidateWords.length === 0) return false;

  // Create a set of all individual filler words from your blacklist
  const uniqueFillerWords = new Set<string>();
  fillerBlacklist.forEach((phrase) => {
    phrase.split(/\s+/).forEach((word) => {
      if (word.length > 1) uniqueFillerWords.add(word);
    });
  });

  // Count how many words in the candidate string exist in our filler dictionary
  let fillerWordCount = 0;
  candidateWords.forEach((word) => {
    if (uniqueFillerWords.has(word)) {
      fillerWordCount++;
    }
  });

  // Calculate score (percentage of filler words making up the string)
  const overlapScore = fillerWordCount / candidateWords.length;

  // If collectively more than 40% of the string consists of filler words, block it!
  if (overlapScore >= 0.4) {
    return false;
  }

  return true;
};

export const getModelSuggestedPrompts = (
  lastMessage: { role: string; content: string } | null,
): string[] => {
  if (!lastMessage || !lastMessage.content) return [];

  const text = lastMessage.content;
  const suggestions: string[] = [];

  // Identify if the assistant is setting up alternative branch choices
  const isInvitation =
    text.includes("?") ||
    text.includes(":") ||
    text.toLowerCase().includes("interested in") ||
    text.toLowerCase().includes("mood for");

  if (isInvitation) {
    const lines = text.split("\n");

    for (const line of lines) {
      let trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 1. Detect standard colon-separated options (e.g., "**Food history:** text" or "Types of dishes:")
      if (trimmedLine.includes(":")) {
        // Find the first colon split
        const parts = trimmedLine.split(":");
        const rawHeader = parts[0].trim();

        // Clean out markdown bold/bullet indicators safely
        const cleanHeader = cleanMarkdownText(rawHeader);

        // Validate the extracted header criteria
        if (
          cleanHeader.length >= 4 &&
          cleanHeader.length < 50 &&
          /^[A-Z]/.test(cleanHeader) && // Must start with an uppercase topic letter
          isValidPrompt(cleanHeader)
        ) {
          // Format as a crisp, clickable query path
          const finalPrompt = cleanHeader.endsWith("?")
            ? cleanHeader
            : `${cleanHeader}?`;

          if (!suggestions.includes(finalPrompt)) {
            suggestions.push(finalPrompt);
            continue; // Move to the next line successfully
          }
        }
      }

      // 2. Fallback Strategy: Handle raw explicit list items or bullet lines that don't have colons
      if (/^[\s\-\*•\d\.\)]+/.test(trimmedLine)) {
        const cleanLine = cleanMarkdownText(trimmedLine);
        if (
          isValidPrompt(cleanLine) &&
          cleanLine.length > 8 &&
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

  // 3. Last Resort Fallback: Parse explicit double-quoted options if structural extraction yielded nothing
  if (suggestions.length === 0) {
    const quoteRegex = /"([^"\n]{12,65})"/g;
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
