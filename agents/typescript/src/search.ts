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
  let webQueries: string[] = [];
  if (aiMessage.tool_calls && aiMessage.tool_calls[0]?.name === "Search") {
    webQueries = aiMessage.tool_calls[0]["args"]["queries"];
  }

  const dataQuestions = state.data_questions || [];

  // Separate fast and deep questions for staged execution
  const fastQuestions = dataQuestions.filter(q => q.search_effort === "fast");
  const deepQuestions = dataQuestions.filter(q => q.search_effort === "deep");

  // Initialize Tako MCP client
  const { tools: takoTools } = await initializeTakoMCP();
  const takoSearchTool = getTakoTool(takoTools, "tako_knowledge_search");
  const takoOpenChartTool = getTakoTool(takoTools, "tako_open_chart_ui");

  // Add logs for web searches
  for (const query of webQueries) {
    logs.push({
      message: `Web search for ${query}`,
      done: false,
    });
  }

  // Add logs for fast Tako searches
  for (const q of fastQuestions) {
    logs.push({
      message: `Tako fast search: ${q.question}`,
      done: false,
    });
  }

  // Add logs for deep Tako searches
  for (const q of deepQuestions) {
    logs.push({
      message: `Tako deep search: ${q.question}`,
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

  // STAGE 1: Run web searches and fast Tako searches in parallel
  const fastSearchPromises = [];

  // Add Tavily web searches
  for (const query of webQueries) {
    fastSearchPromises.push(
      tavilyClient.search(query, {}).then(result => ({ type: 'web', result }))
    );
  }

  // Add fast Tako searches
  for (const q of fastQuestions) {
    if (takoSearchTool) {
      fastSearchPromises.push(
        takoSearchTool.invoke({
          query: q.question,
          count: 5,
          search_effort: "fast",
        }).then(result => ({ type: 'tako', result, question: q }))
      );
    }
  }

  const fastResults = await Promise.all(fastSearchPromises);

  // Process fast results
  let logIndex = 0;
  for (const item of fastResults) {
    if (item.type === 'web') {
      search_results.push(item.result);
      logs[logIndex]["done"] = true;
      logIndex++;
    } else if (item.type === 'tako' && item.result) {
      tako_results.push(item.result);
      logs[logIndex]["done"] = true;
      logIndex++;
    }
    await copilotkitEmitState(config, {
      ...restOfState,
      logs,
      resources,
    });
  }

  // Process fast Tako results (add to resources immediately)
  const existingUrls = new Set(resources.map((r) => r.url));

  for (const takoResult of tako_results) {
    if (takoResult && takoResult.results) {
      for (const result of takoResult.results) {
        const chartUrl = result.url;
        if (existingUrls.has(chartUrl)) continue;

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

  // STAGE 2: Deep searches - streaming (one at a time)
  for (let i = 0; i < deepQuestions.length; i++) {
    const q = deepQuestions[i];
    const deepLogIndex = webQueries.length + fastQuestions.length + i;

    try {
      if (takoSearchTool) {
        const takoResponse = await takoSearchTool.invoke({
          query: q.question,
          count: 5,
          search_effort: "deep",
        });

        if (takoResponse && takoResponse.results) {
          // Process deep search results and add to resources immediately (streaming)
          for (const result of takoResponse.results) {
            const chartUrl = result.url;
            if (existingUrls.has(chartUrl)) continue;

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

            // STREAM: Add resource immediately
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

          tako_results.push(takoResponse);
        }
      }

      logs[deepLogIndex]["done"] = true;
      await copilotkitEmitState(config, {
        ...restOfState,
        logs,
        resources,
      });
    } catch (error) {
      console.error(`Deep search failed for "${q.question}":`, error);
      logs[deepLogIndex]["done"] = true;
      await copilotkitEmitState(config, {
        ...restOfState,
        logs,
        resources,
      });
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
