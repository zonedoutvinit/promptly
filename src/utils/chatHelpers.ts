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
    .replace(/[\*\-_`#]+/g, "")
    .replace(/\s*\([^)]+\)\s*/g, " ")
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{2000}-\u{32FF}]/gu,
      "",
    )
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();
};

const segmenter = new Intl.Segmenter("en", { granularity: "word" });

export const extractMicroIntentAgnostic = (rawBlock: string): string => {
  // 1. Isolate content
  let topicSegment = rawBlock.includes(":") ? rawBlock.split(":")[0] : rawBlock;
  let cleaned = cleanTextRaw(topicSegment);

  // 2. Tokenize and tag for filtering
  const words = Array.from(segmenter.segment(cleaned))
    .filter((s) => s.isWordLike)
    .map((s) => s.segment);

  // 3. Keep ONLY words that aren't junk, keeping their order
  // This preserves the "integrity" of the phrase
  const cleanTokens = words.filter((w) => {
    const lower = w.toLowerCase();
    const isStopWord = [
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
    ].includes(lower);
    return lower.length > 2 && !fillerBlacklist.includes(lower) && !isStopWord;
  });

  if (cleanTokens.length === 0) return "";

  // 4. Check for Action Marker (Verb) at the start
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
  ];
  let resultTokens = [];

  if (actionMarkers.includes(cleanTokens[0].toLowerCase())) {
    resultTokens = cleanTokens.slice(0, 3); // Action + 2 Nouns
  } else {
    resultTokens = cleanTokens.slice(0, 2); // 2 Nouns (Pure Topic)
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
