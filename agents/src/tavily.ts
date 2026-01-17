import { tavily } from "@tavily/core";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function searchTavilyWeb(
  query: string,
  maxResults: number = 3
): Promise<TavilySearchResult[]> {
  try {
    // Check for API key before initializing client
    if (!TAVILY_API_KEY) {
      console.warn("Tavily API key not configured - skipping web search");
      return [];
    }

    // Initialize client only when needed
    const tavilyClient = tavily({
      apiKey: TAVILY_API_KEY,
    });

    const response = await tavilyClient.search(query, {
      maxResults,
      searchDepth: "advanced",
    });

    return response.results || [];
  } catch (error) {
    console.error("Tavily search error:", error);
    return [];
  }
}
