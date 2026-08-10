export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface CacheEntry {
  timestamp: number;
  results: SearchResult[];
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const normalizeQuery = (query: string): string => {
  return query.trim().toLowerCase();
};

/**
 * Service to execute web searches using Electron's Main Process.
 * Bypasses CORS by routing requests through Node.js.
 */
export async function searchWeb(
  query: string,
  maxResults: number = 3,
): Promise<SearchResult[]> {
  const normalized = normalizeQuery(query);
  const now = Date.now();

  // 1. Check cache validity
  const cached = searchCache.get(normalized);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.results.slice(0, maxResults);
  }

  try {
    // 2. Invoke the Electron bridge to fetch HTML from the Main Process
    // The main process handles the request without CORS restrictions
    const rawHtmlText = await window.electronAPI.search(query);

    if (!rawHtmlText) {
      throw new Error("No payload returned from search service.");
    }

    // 3. Parse content structure using the browser's native DOM Parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtmlText, "text/html");

    // DuckDuckGo encapsulates search results inside elements using the '.web-result' CSS class selectors
    const resultNodes = doc.querySelectorAll(".web-result");

    if (resultNodes.length === 0) {
      console.warn(
        "Web search returned 0 result nodes. DDG Page Title:",
        doc.querySelector("title")?.textContent,
      );
    }

    const formattedResults: SearchResult[] = [];

    for (
      let i = 0;
      i < resultNodes.length && formattedResults.length < maxResults;
      i++
    ) {
      const node = resultNodes[i];

      const anchorEl = node.querySelector(
        ".result__a",
      ) as HTMLAnchorElement | null;
      const snippetEl = node.querySelector(
        ".result__snippet",
      ) as HTMLElement | null;

      if (anchorEl) {
        let destinationUrl = anchorEl.getAttribute("href") || "";

        // Strip outbound tracking redirects
        if (destinationUrl.includes("uddg=")) {
          const searchParams = new URLSearchParams(
            destinationUrl.split("?")[1],
          );
          destinationUrl = searchParams.get("uddg") || destinationUrl;
        }

        formattedResults.push({
          title: anchorEl.textContent?.trim() || "Untitled Source",
          snippet:
            snippetEl?.textContent?.trim() ||
            "No summary preview text available.",
          url: destinationUrl.startsWith("//")
            ? `https:${destinationUrl}`
            : destinationUrl,
        });
      }
    }

    // 4. Update the localized query memory cache registry
    searchCache.set(normalized, {
      timestamp: now,
      results: formattedResults,
    });

    return formattedResults;
  } catch (error) {
    console.error(
      "Electron Web Search interface runtime exception encountered:",
      error,
    );
    return [];
  }
}
