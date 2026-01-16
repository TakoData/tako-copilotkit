import { CopilotKit, useCopilotAction } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useState } from "react";

interface ChartResult {
  card_id: string;
  title: string;
  description: string;
  url: string;
  source: string;
}

interface ChartUIFrame {
  html: string;
  pub_id: string;
}

export function TakoMCPChatbot() {
  const [searchResults, setSearchResults] = useState<ChartResult[]>([]);
  const [chartFrames, setChartFrames] = useState<ChartUIFrame[]>([]);

  // Register action for knowledge search
  useCopilotAction({
    name: "searchTakoCharts",
    description:
      "Search Tako's knowledge base for charts and data visualizations. Use this when users ask about data, statistics, trends, or want to see charts.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "Natural language search query for charts and data",
        required: true,
      },
      {
        name: "count",
        type: "number",
        description: "Number of results to return (1-20), defaults to 5",
        required: false,
      },
      {
        name: "search_effort",
        type: "string",
        description:
          'Search depth - "fast" for quick results, "deep" for comprehensive search',
        required: false,
      },
    ],
    handler: async ({ query, count = 5, search_effort = "deep" }: { query: string; count?: number; search_effort?: string }) => {
      const response = await fetch("/api/mcp/knowledge_search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, count, search_effort }),
      });

      const data = await response.json();
      const results = data.results || [];
      setSearchResults(results);

      return `Found ${results.length} charts. The results are now displayed in the UI. Here are the titles:\n${results.map((r: ChartResult, i: number) => `${i + 1}. ${r.title}`).join("\n")}`;
    },
  });

  // Register action for opening chart UI
  useCopilotAction({
    name: "openChartUI",
    description:
      "Open an interactive chart UI in an embedded iframe. Use this to show users a detailed, interactive view of a specific chart.",
    parameters: [
      {
        name: "pub_id",
        type: "string",
        description:
          "The unique identifier (pub_id/card_id) of the chart to open",
        required: true,
      },
      {
        name: "dark_mode",
        type: "boolean",
        description: "Whether to use dark mode theme (default: true)",
        required: false,
      },
    ],
    handler: async ({ pub_id, dark_mode = true }: { pub_id: string; dark_mode?: boolean }) => {
      const response = await fetch("/api/mcp/open_chart_ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pub_id, dark_mode }),
      });

      const data = await response.json();
      if (data.html) {
        setChartFrames((prev) => [...prev, { html: data.html, pub_id }]);
        return `Opened chart UI for ${pub_id}. The interactive chart is now displayed below.`;
      }
      return `Failed to open chart UI for ${pub_id}.`;
    },
  });

  // Register action for getting chart insights
  useCopilotAction({
    name: "getChartInsights",
    description:
      "Get AI-generated insights for a specific chart. Use this when users want deeper analysis of a chart's data.",
    parameters: [
      {
        name: "pub_id",
        type: "string",
        description:
          "The unique identifier (pub_id/card_id) of the chart to analyze",
        required: true,
      },
      {
        name: "effort",
        type: "string",
        description:
          'Reasoning effort level - "low", "medium", or "high" (default: "medium")',
        required: false,
      },
    ],
    handler: async ({ pub_id, effort = "medium" }: { pub_id: string; effort?: string }) => {
      const response = await fetch("/api/mcp/get_card_insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pub_id, effort }),
      });

      const data = await response.json();
      if (data.insights) {
        return `Insights for chart ${pub_id}:\n\n${data.insights}\n\nDescription: ${data.description}`;
      }
      return `Failed to get insights for ${pub_id}.`;
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Tako MCP Chatbot Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Chat with Tako's AI to search for charts, visualize data, and get
            insights.
          </p>
        </header>

        {/* Search Results Display */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Search Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((result) => (
                <div
                  key={result.card_id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {result.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {result.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      Source: {result.source}
                    </span>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart UI Frames Display */}
        {chartFrames.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Interactive Charts
            </h2>
            <div className="space-y-6">
              {chartFrames.map((frame, index) => (
                <div
                  key={`${frame.pub_id}-${index}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Chart: {frame.pub_id}
                    </span>
                    <button
                      onClick={() =>
                        setChartFrames((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      Close
                    </button>
                  </div>
                  <div
                    className="rounded overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: frame.html }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Try asking:
          </h2>
          <ul className="space-y-2 text-blue-800 dark:text-blue-200">
            <li>• "Search for Intel vs Nvidia headcount"</li>
            <li>• "Show me charts about climate change"</li>
            <li>• "Find data on unemployment rates"</li>
            <li>• "Get insights for chart [card_id]"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Main App wrapper with CopilotKit provider
export function TakoMCPChatbotApp() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <TakoMCPChatbot />
      <CopilotPopup
        instructions="You are a helpful assistant that helps users search Tako's knowledge base for charts and data visualizations. When users ask about data, statistics, or trends, use the searchTakoCharts action to find relevant charts. You can also open interactive chart UIs and get insights for specific charts."
        labels={{
          title: "Tako Assistant",
          initial: "Hi! I can help you find and explore charts. What data are you interested in?",
        }}
      />
    </CopilotKit>
  );
}
