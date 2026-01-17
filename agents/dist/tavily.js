"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchTavilyWeb = searchTavilyWeb;
const core_1 = require("@tavily/core");
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
async function searchTavilyWeb(query, maxResults = 3) {
    try {
        // Check for API key before initializing client
        if (!TAVILY_API_KEY) {
            console.warn("Tavily API key not configured - skipping web search");
            return [];
        }
        // Initialize client only when needed
        const tavilyClient = (0, core_1.tavily)({
            apiKey: TAVILY_API_KEY,
        });
        const response = await tavilyClient.search(query, {
            maxResults,
            searchDepth: "advanced",
        });
        return response.results || [];
    }
    catch (error) {
        console.error("Tavily search error:", error);
        return [];
    }
}
//# sourceMappingURL=tavily.js.map