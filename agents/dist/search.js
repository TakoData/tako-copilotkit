"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchTakoCharts = searchTakoCharts;
exports.getChartIframe = getChartIframe;
exports.search_node = search_node;
const langchain_1 = require("@copilotkit/sdk-js/langchain");
const tavily_1 = require("./tavily");
const TAKO_API_BASE = process.env.TAKO_API_BASE || "http://localhost:3000/api/mcp";
const TAKO_API_TOKEN = process.env.TAKO_API_TOKEN || "";
async function searchTakoCharts(query, count = 5) {
    try {
        const response = await fetch(`${TAKO_API_BASE}/knowledge_search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                query,
                count,
                search_effort: "deep",
            }),
        });
        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.results || [];
    }
    catch (error) {
        console.error("Error searching Tako charts:", error);
        return [];
    }
}
async function getChartIframe(pub_id, dark_mode = false) {
    try {
        const response = await fetch(`${TAKO_API_BASE}/open_chart_ui`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                pub_id,
                dark_mode,
                width: "100%",
                height: "500px",
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to get chart iframe: ${response.statusText}`);
        }
        const data = await response.json();
        return data.html || "";
    }
    catch (error) {
        console.error("Error getting chart iframe:", error);
        return "";
    }
}
async function search_node(state) {
    const config = (0, langchain_1.copilotkitEmitState)({});
    const newLogs = [];
    const newResources = [...(state.resources || [])];
    // Search for each data question
    for (const question of state.data_questions || []) {
        newLogs.push(`Searching Tako and Web for: "${question}"`);
        // Run searches in parallel
        const [takoResults, tavilyResults] = await Promise.all([
            searchTakoCharts(question, 3),
            (0, tavily_1.searchTavilyWeb)(question, 3)
        ]);
        newLogs.push(`Found ${takoResults.length} charts, ${tavilyResults.length} web results`);
        // Process Tako charts
        for (const result of takoResults) {
            // Check if we already have this resource by URL
            if (newResources.some(r => r.url === result.url)) {
                continue;
            }
            newLogs.push(`Fetching chart: ${result.title}`);
            const iframe_html = await getChartIframe(result.card_id);
            newResources.push({
                ...result,
                iframe_html,
                resource_type: 'tako_chart',
            });
        }
        // Process Tavily web results
        for (const result of tavilyResults) {
            // Check if we already have this resource by URL
            if (newResources.some(r => r.url === result.url)) {
                continue;
            }
            newLogs.push(`Adding web result: ${result.title}`);
            newResources.push({
                title: result.title,
                description: result.content.substring(0, 300) + '...',
                source: 'Tavily Web Search',
                url: result.url,
                content: result.content,
                resource_type: 'tavily_web',
            });
        }
        // Emit intermediate state after each question
        await config.saveState({
            ...state,
            logs: newLogs,
            resources: newResources,
        });
    }
    return {
        logs: newLogs,
        resources: newResources,
    };
}
//# sourceMappingURL=search.js.map