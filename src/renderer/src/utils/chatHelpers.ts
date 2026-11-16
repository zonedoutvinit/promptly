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
  "do you want to",
  "would you like",
  "would you want",
  "let me know if",
  "for example",
  "such as",
  "here is an example",
  "an example of",
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
  "next steps",
  "let's begin",
  "let begin",
  "any specific questions",
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

export const cleanTextRaw = (str: string): string => {
  return str
    .replace(/\s*\([^)]+\)\s*/g, " ") // Remove parentheses and contents
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{2000}-\u{32FF}]/gu,
      "",
    ) // Remove Emojis
    .replace(/[^a-zA-Z0-9\s]/g, " ") // Replaces punctuation (like hyphens) with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
};

const segmenter = new Intl.Segmenter("en", { granularity: "word" });

/**
 * Validates whether a generated suggested prompt sounds natural and structural.
 * Blocks fragments that lack conceptual or action value.
 */
const isValidSuggestion = (suggestion: string): boolean => {
  const lower = suggestion.toLowerCase();
  const words = lower.split(/\s+/);

  // 1. Block isolated structural grammar adjectives/determiners without context
  const bannedSingletons = new Set([
    "another",
    "other",
    "next",
    "previous",
    "more",
    "fewer",
    "less",
    "highly",
    "very",
    "really",
    "mostly",
    "partially",
    "completely",
  ]);
  if (words.some((w) => bannedSingletons.has(w) && words.length === 2)) {
    return false;
  }

  // 2. Block bad semantic combinations or dangling conversational leftover fragments
  const invalidPhrases = [
    "here are",
    "there are",
    "click here",
    "read more",
    "see below",
    "following points",
    "main items",
    "various aspects",
    "different ways",
  ];
  if (invalidPhrases.some((phrase) => lower.includes(phrase))) {
    return false;
  }

  // 3. Simple grammatical sanity check: Avoid choices that are just two particles/prepositions
  const structuralTriggers = new Set([
    "about",
    "above",
    "across",
    "after",
    "against",
    "along",
    "among",
    "around",
    "at",
    "before",
    "behind",
    "below",
    "beneath",
    "beside",
    "between",
    "beyond",
    "but",
    "by",
    "concerning",
    "considering",
    "despite",
    "down",
    "during",
    "except",
    "for",
    "from",
    "in",
    "inside",
    "into",
    "like",
    "near",
    "of",
    "off",
    "on",
    "onto",
    "out",
    "outside",
    "over",
    "past",
    "regarding",
    "since",
    "through",
    "throughout",
    "till",
    "to",
    "toward",
    "under",
    "underneath",
    "until",
    "up",
    "upon",
    "with",
    "within",
    "without",
  ]);

  const structureCount = words.filter((w) => structuralTriggers.has(w)).length;
  if (structureCount >= words.length - 1) {
    return false; // Suggestion is mostly connector words without meat
  }

  return true;
};

export const extractMicroIntentAgnostic = (rawBlock: string): string => {
  // 1. Prioritize explicit formatting (Bold / Quotes) before falling back to colons
  let topicSegment = rawBlock;
  const boldMatch = rawBlock.match(/\*\*([^*]+)\*\*/);
  const quoteMatch = rawBlock.match(/(?:["'])([^"']{3,})(?:["'])/);

  if (boldMatch && boldMatch[1]) {
    topicSegment = boldMatch[1];
  } else if (quoteMatch && quoteMatch[1]) {
    topicSegment = quoteMatch[1];
  } else if (rawBlock.includes(":")) {
    topicSegment = rawBlock.split(":")[0];
  }

  let cleaned = cleanTextRaw(topicSegment);

  // 2. Tokenize and tag for filtering
  const words = Array.from(segmenter.segment(cleaned))
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

  // 3. Filter junk using an expanded dictionary
  const cleanTokens = words.filter((w) => {
    const lower = w.toLowerCase();

    // Expanded stop words to catch pronouns, helper verbs, and question starters
    const isStopWord = new Set([
      "the",
      "and",
      "of",
      "in",
      "to",
      "for",
      "is",
      "your",
      "their",
      "a",
      "an",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "what",
      "who",
      "where",
      "when",
      "why",
      "how",
      "which",
      "do",
      "does",
      "did",
      "have",
      "has",
      "had",
      "let",
      "lets",
      "are",
      "am",
      "was",
      "were",
      "be",
      "been",
      "being",
      "can",
      "could",
      "shall",
      "should",
      "will",
      "would",
      "may",
      "might",
      "must",
      "any",
      "some",
      "this",
      "that",
      "these",
      "those",
      "here",
    ]).has(lower);

    return lower.length > 2 && !fillerBlacklist.includes(lower) && !isStopWord;
  });

  if (cleanTokens.length === 0) return "";

  // 4. Action Marker Check & Slicing
  const actionMarkers = [
    "refactor",
    "analyze",
    "explain",
    "compare",
    "debug",
    "summarize",
    "build",
    "create",
    "optimize",
    "test",
    "explore",
    "identify",
    "assess",
  ];

  let resultTokens = [];
  if (actionMarkers.includes(cleanTokens[0].toLowerCase())) {
    resultTokens = cleanTokens.slice(0, 3); // Action + up to 2 nouns
  } else {
    resultTokens = cleanTokens.slice(0, 3); // Up to 3 Nouns for concepts (e.g. "User Feedback Loop")
  }

  // 5. Final validation
  if (resultTokens.length === 0) return "";

  return resultTokens
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

export const getModelSuggestedPrompts = (
  lastMessage: { role: string; content: string } | null,
): string[] => {
  if (!lastMessage || !lastMessage.content) return [];

  const suggestions: string[] = [];

  const lines = lastMessage.content
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    const hitsBlacklist = fillerBlacklist.some((filler) =>
      lowerLine.includes(filler),
    );
    if (hitsBlacklist) continue;

    const ultraShortIntent = extractMicroIntentAgnostic(line);
    if (!ultraShortIntent) continue;

    // --- FINAL SOUNDNESS CHECKERS ---
    if (!isValidSuggestion(ultraShortIntent)) continue;

    const finalWordCount = ultraShortIntent.split(/\s+/).length;
    if (
      finalWordCount >= 2 &&
      finalWordCount <= 3 &&
      ultraShortIntent.length <= 30
    ) {
      // Prevent redundancy leaks between parent headers and nested choices
      const isRedundantHeader = suggestions.some((existingChip) => {
        const existingSubject = existingChip.split(" ").slice(1).join(" ");
        const currentSubject = ultraShortIntent.split(" ").slice(1).join(" ");
        return (
          currentSubject.length > 3 && existingSubject.includes(currentSubject)
        );
      });

      if (isRedundantHeader) continue;

      if (!suggestions.includes(ultraShortIntent)) {
        suggestions.push(ultraShortIntent);
        if (suggestions.length >= 5) break;
      }
    }
  }

  return suggestions.reverse();
};
