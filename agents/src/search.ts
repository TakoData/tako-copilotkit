import { TakoResearchState } from "./state";
import { copilotkitEmitState } from "@copilotkit/sdk-js/langchain";

const TAKO_API_BASE = process.env.TAKO_API_BASE || "http://localhost:3000/api/mcp";
const TAKO_API_TOKEN = process.env.TAKO_API_TOKEN || "";

interface SearchResult {
  card_id: string;
  title: string;
  description: string;
  source: string;
  url: string;
}

export async function searchTakoCharts(
  query: string,
  count: number = 5
): Promise<SearchResult[]> {
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
  } catch (error) {
    console.error("Error searching Tako charts:", error);
    return [];
  }
}

export async function getChartIframe(
  pub_id: string,
  dark_mode: boolean = false
): Promise<string> {
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
  } catch (error) {
    console.error("Error getting chart iframe:", error);
    return "";
  }
}

export async function search_node(state: TakoResearchState) {
  const config = copilotkitEmitState({});

  const newLogs: string[] = [];
  const newResources = [...(state.resources || [])];

  // Search for each data question
  for (const question of state.data_questions || []) {
    newLogs.push(`Searching Tako for: "${question}"`);

    const results = await searchTakoCharts(question, 3);
    newLogs.push(`Found ${results.length} charts for "${question}"`);

    // Get iframe HTML for each result
    for (const result of results) {
      // Check if we already have this resource
      if (newResources.some(r => r.card_id === result.card_id)) {
        continue;
      }

      newLogs.push(`Fetching chart: ${result.title}`);
      const iframe_html = await getChartIframe(result.card_id);

      newResources.push({
        ...result,
        iframe_html,
      });
    }
  }

  // Emit intermediate state
  await config.saveState({
    ...state,
    logs: newLogs,
    resources: newResources,
  });

  return {
    logs: newLogs,
    resources: newResources,
  };
}
