import { useState, useRef, useEffect } from "react";

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

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function SimpleTakoChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I can help you search Tako's knowledge base for charts and data. Try asking me to search for something like 'Intel vs Nvidia headcount' or 'climate change data'.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<ChartResult[]>([]);
  const [chartFrames, setChartFrames] = useState<ChartUIFrame[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (role: "user" | "assistant", content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  };

  const handleSearch = async (query: string) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/mcp/knowledge_search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, count: 5, search_effort: "deep" }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];
      setSearchResults(results);

      if (results.length > 0) {
        const titles = results.map((r: ChartResult, i: number) => `${i + 1}. ${r.title}`).join("\n");
        addMessage(
          "assistant",
          `Found ${results.length} charts:\n\n${titles}\n\nThe results are displayed below. You can click on any card to open it, or ask me to "open chart 1" or "open the first chart".`
        );
      } else {
        addMessage("assistant", "I couldn't find any charts matching that query. Try a different search term.");
      }
    } catch (error) {
      console.error("Search error:", error);
      addMessage("assistant", `Sorry, there was an error searching: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChart = async (pub_id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/mcp/open_chart_ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pub_id, dark_mode: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to open chart: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.html) {
        setChartFrames((prev) => [...prev, { html: data.html, pub_id }]);
        addMessage("assistant", `Opened interactive chart for ${pub_id}. You can see it below!`);
      } else {
        addMessage("assistant", `Sorry, couldn't open the chart UI for ${pub_id}.`);
      }
    } catch (error) {
      console.error("Open chart error:", error);
      addMessage("assistant", `Sorry, there was an error opening the chart: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetInsights = async (pub_id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/mcp/get_card_insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pub_id, effort: "medium" }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get insights: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.insights) {
        addMessage("assistant", `Insights for chart ${pub_id}:\n\n${data.insights}\n\n${data.description}`);
      } else if (data.error) {
        addMessage("assistant", `Sorry, couldn't get insights: ${data.error}`);
      }
    } catch (error) {
      console.error("Get insights error:", error);
      addMessage("assistant", `Sorry, there was an error getting insights: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const parseCommand = (text: string) => {
    const lowerText = text.toLowerCase().trim();

    // Search commands
    if (
      lowerText.startsWith("search") ||
      lowerText.includes("find") ||
      lowerText.includes("show me") ||
      lowerText.includes("look for")
    ) {
      const query = text.replace(/^(search|find|show me|look for)\s+(for\s+)?/i, "").trim();
      return { type: "search", query };
    }

    // Open chart commands
    const openMatch = text.match(/open\s+(?:chart\s+)?(?:the\s+)?(?:(\d+)|([a-zA-Z0-9_-]+))/i);
    if (openMatch) {
      const index = openMatch[1];
      const pub_id = openMatch[2];

      if (index && searchResults.length > 0) {
        const idx = parseInt(index) - 1;
        if (idx >= 0 && idx < searchResults.length) {
          return { type: "open", pub_id: searchResults[idx].card_id };
        }
      } else if (pub_id) {
        return { type: "open", pub_id };
      }
    }

    // Insights commands
    const insightsMatch = text.match(/insights?\s+(?:for\s+)?(?:chart\s+)?(?:(\d+)|([a-zA-Z0-9_-]+))/i);
    if (insightsMatch) {
      const index = insightsMatch[1];
      const pub_id = insightsMatch[2];

      if (index && searchResults.length > 0) {
        const idx = parseInt(index) - 1;
        if (idx >= 0 && idx < searchResults.length) {
          return { type: "insights", pub_id: searchResults[idx].card_id };
        }
      } else if (pub_id) {
        return { type: "insights", pub_id };
      }
    }

    // Default to search
    return { type: "search", query: text };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    addMessage("user", userMessage);
    setInput("");

    const command = parseCommand(userMessage);

    switch (command.type) {
      case "search":
        if (command.query) {
          await handleSearch(command.query);
        }
        break;
      case "open":
        if (command.pub_id) {
          await handleOpenChart(command.pub_id);
        }
        break;
      case "insights":
        if (command.pub_id) {
          await handleGetInsights(command.pub_id);
        }
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Tako MCP Chat Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Search charts, explore data, and get AI-powered insights through natural conversation
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Chat Panel */}
          <div className="xl:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col h-[600px]">
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-3">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        />
                        <div
                          className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me to search for charts, open a chart, or get insights..."
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Send
                  </button>
                </div>
              </form>
            </div>

            {/* Instructions */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Try these commands:
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• "Search for Intel vs Nvidia headcount"</li>
                <li>• "Show me climate change data"</li>
                <li>• "Open chart 1" or "Open the first chart"</li>
                <li>• "Get insights for chart 2"</li>
              </ul>
            </div>
          </div>

          {/* Results Panel */}
          <div className="xl:col-span-2 space-y-6">
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  Search Results
                </h2>
                <div className="space-y-3">
                  {searchResults.map((result, idx) => (
                    <div
                      key={result.card_id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => handleOpenChart(result.card_id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          #{idx + 1}
                        </span>
                        <span className="text-xs text-gray-500">{result.source}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 text-sm">
                        {result.title}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {result.description}
                      </p>
                      <button className="mt-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
                        Click to open →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chart Frames */}
            {chartFrames.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  Interactive Charts
                </h2>
                <div className="space-y-4">
                  {chartFrames.map((frame, index) => (
                    <div
                      key={`${frame.pub_id}-${index}`}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {frame.pub_id}
                        </span>
                        <button
                          onClick={() =>
                            setChartFrames((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Close
                        </button>
                      </div>
                      <div
                        className="w-full min-h-[600px]"
                        dangerouslySetInnerHTML={{ __html: frame.html }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
