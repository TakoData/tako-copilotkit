/**
 * Search Node
 */

/**
 * The search node is responsible for searching the internet and Tako for information.
 */

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { tavily } from "@tavily/core";
import { AgentState } from "./state";
import { RunnableConfig } from "@langchain/core/runnables";
import {
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { getModel } from "./model";
import {
  copilotkitCustomizeConfig,
  copilotkitEmitState,
} from "@copilotkit/sdk-js/langgraph";
import { initializeTakoMCP, getTakoTool } from "./tako/mcp-client";
import { TakoSearchResult } from "./tako/types";

const ResourceInput = z.object({
  url: z.string().describe("The URL of the resource"),
  title: z.string().describe("The title of the resource"),
  description: z.string().describe("A short description of the resource"),
});

const ExtractResources = tool(() => {}, {
  name: "ExtractResources",
  description: "Extract the 3-5 most relevant resources from a search result.",
  schema: z.object({ resources: z.array(ResourceInput) }),
});

const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

export async function search_node(state: AgentState, config: RunnableConfig) {
  const aiMessage = state["messages"][
    state["messages"].length - 1
  ] as AIMessage;

  let resources = state["resources"] || [];
  let logs = state["logs"] || [];

  // Support both Search tool queries and data_questions
  let queries: string[] = [];
  if (aiMessage.tool_calls && aiMessage.tool_calls[0]?.name === "Search") {
    queries = aiMessage.tool_calls[0]["args"]["queries"];
  } else if (state.data_questions && state.data_questions.length > 0) {
    queries = state.data_questions;
  }

  // Initialize Tako MCP client
  const { tools: takoTools } = await initializeTakoMCP();
  const takoSearchTool = getTakoTool(takoTools, "tako_knowledge_search");
  const takoOpenChartTool = getTakoTool(takoTools, "tako_open_chart_ui");

  for (const query of queries) {
    logs.push({
      message: `Search for ${query}`,
      done: false,
    });
  }
  const { messages, ...restOfState } = state;
  await copilotkitEmitState(config, {
    ...restOfState,
    logs,
    resources,
  });

  const search_results = [];
  const tako_results: any[] = [];

  // Parallel search: Tako + Tavily
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    // Execute Tako and Tavily searches in parallel
    const [tavilyResponse, takoResponse] = await Promise.all([
      tavilyClient.search(query, {}),
      takoSearchTool
        ? takoSearchTool.invoke({
            query,
            count: 5,
            search_effort: "deep",
          })
        : Promise.resolve(null),
    ]);

    search_results.push(tavilyResponse);
    if (takoResponse) {
      tako_results.push(takoResponse);
    }

    logs[i]["done"] = true;
    await copilotkitEmitState(config, {
      ...restOfState,
      logs,
      resources,
    });
  }

  // Process Tako results and get iframes
  const existingUrls = new Set(resources.map((r) => r.url));

  for (const takoResult of tako_results) {
    if (takoResult && takoResult.results) {
      for (const result of takoResult.results) {
        const chartUrl = result.url;

        // Skip if already exists
        if (existingUrls.has(chartUrl)) {
          continue;
        }

        // Get iframe HTML for this chart
        let iframeHtml = "";
        if (takoOpenChartTool && result.card_id) {
          try {
            const iframeResult = await takoOpenChartTool.invoke({
              card_id: result.card_id,
            });
            iframeHtml = iframeResult?.iframe_html || "";
          } catch (error) {
            console.error("Failed to get iframe for chart:", error);
          }
        }

        // Add Tako chart resource
        resources.push({
          url: chartUrl,
          title: result.title || "Tako Chart",
          description: result.description || "",
          content: result.description || "",
          resource_type: "tako_chart",
          card_id: result.card_id,
          iframe_html: iframeHtml,
          source: "Tako",
        });
        existingUrls.add(chartUrl);
      }
    }
  }

  const toolCallId = aiMessage.tool_calls && aiMessage.tool_calls[0]?.id
    ? aiMessage.tool_calls[0].id
    : "search_" + Date.now();

  const searchResultsToolMessageFull = new ToolMessage({
    tool_call_id: toolCallId,
    content: `Performed search: ${JSON.stringify(search_results)}. Found ${tako_results.length} Tako results.`,
    name: "Search",
  });

  const searchResultsToolMessage = new ToolMessage({
    tool_call_id: toolCallId,
    content: `Performed search.`,
    name: "Search",
  });

  const customConfig = copilotkitCustomizeConfig(config, {
    emitIntermediateState: [
      {
        stateKey: "resources",
        tool: "ExtractResources",
        toolArgument: "resources",
      },
    ],
  });

  const model = getModel(state);
  const invokeArgs: Record<string, any> = {};
  if (model.constructor.name === "ChatOpenAI") {
    invokeArgs["parallel_tool_calls"] = false;
  }

  logs = [];

  await copilotkitEmitState(config, {
    ...restOfState,
    resources,
    logs,
  });

  const response = await model.bindTools!([ExtractResources], {
    ...invokeArgs,
    tool_choice: "ExtractResources",
  }).invoke(
    [
      new SystemMessage({
        content: `You need to extract the 3-5 most relevant resources from the following search results.`,
      }),
      ...state["messages"],
      searchResultsToolMessageFull,
    ],
    customConfig
  );

  const aiMessageResponse = response as AIMessage;
  const newResources = aiMessageResponse.tool_calls![0]["args"]["resources"];

  // Add web resources with proper type
  for (const resource of newResources) {
    if (!existingUrls.has(resource.url)) {
      resources.push({
        ...resource,
        resource_type: "web",
        card_id: undefined,
        iframe_html: undefined,
        source: "Tavily Web Search",
      });
      existingUrls.add(resource.url);
    }
  }

  return {
    messages: [
      searchResultsToolMessage,
      aiMessageResponse,
      new ToolMessage({
        tool_call_id: aiMessageResponse.tool_calls![0]["id"]!,
        content: `Resources added.`,
        name: "ExtractResources",
      }),
    ],
    resources,
    logs,
  };
}
