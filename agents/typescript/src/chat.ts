/**
 * Chat Node
 */

import { RunnableConfig } from "@langchain/core/runnables";
import { AgentState, Resource } from "./state";
import { getModel } from "./model";
import { getResource } from "./download";
import {
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { copilotkitCustomizeConfig } from "@copilotkit/sdk-js/langgraph";
import { initializeTakoMCP, callTakoExplore, formatExploreResults } from "./tako/mcp-client";

// Feature toggles
const ENABLE_EXPLORE_API = false;
const ENABLE_DEEP_QUERIES = false;

const Search = tool(() => {}, {
  name: "Search",
  description:
    "A list of one or more search queries to find good resources to support the research.",
  schema: z.object({ queries: z.array(z.string()) }),
});

const WriteReport = tool(() => {}, {
  name: "WriteReport",
  description: "Write the research report.",
  schema: z.object({ report: z.string() }),
});

const WriteResearchQuestion = tool(() => {}, {
  name: "WriteResearchQuestion",
  description: "Write the research question.",
  schema: z.object({ research_question: z.string() }),
});

const DeleteResources = tool(() => {}, {
  name: "DeleteResources",
  description: "Delete the URLs from the resources.",
  schema: z.object({ urls: z.array(z.string()) }),
});

const GenerateDataQuestions = tool(() => {}, {
  name: "GenerateDataQuestions",
  description: `Generate 3-6 data-focused questions to search Tako's knowledge base.

Create a diverse set of questions with different complexity levels:
- 2-3 basic questions (search_effort='fast') for straightforward data lookups
- 1-2 complex questions (search_effort='deep') for in-depth analysis
- 0-1 prediction market questions (search_effort='deep') about forecasts, probabilities, or future outcomes

Example:
[
  {"question": "China GDP 2020-2024", "search_effort": "fast", "query_type": "basic"},
  {"question": "What factors drove China's economic growth post-pandemic?", "search_effort": "deep", "query_type": "complex"},
  {"question": "What are prediction market odds for China GDP growth in 2025?", "search_effort": "deep", "query_type": "prediction_market"}
]`,
  schema: z.object({
    questions: z.array(
      z.object({
        question: z.string(),
        search_effort: z.enum(['fast', 'deep']),
        query_type: z.enum(['basic', 'complex', 'prediction_market']),
      })
    ),
  }),
});

export async function chat_node(state: AgentState, config: RunnableConfig) {
  const customConfig = copilotkitCustomizeConfig(config, {
    emitIntermediateState: [
      {
        stateKey: "report",
        tool: "WriteReport",
        toolArgument: "report",
      },
      {
        stateKey: "research_question",
        tool: "WriteResearchQuestion",
        toolArgument: "research_question",
      },
      {
        stateKey: "data_questions",
        tool: "GenerateDataQuestions",
        toolArgument: "questions",
      },
    ],
    emitToolCalls: "DeleteResources",
  });

  state["resources"] = state.resources || [];
  const researchQuestion = state.research_question || "";
  const report = state.report || "";

  const resources: Resource[] = [];
  const takoChartsMap: Record<string, string> = {};
  const availableTakoCharts: string[] = [];

  for (const resource of state["resources"]) {
    // Tako charts already have descriptions, don't fetch content
    if (resource.resource_type === "tako_chart") {
      const title = resource.title || "";
      const iframeHtml = resource.iframe_html || "";
      const description = resource.description || "";

      // Add to resources with description as content
      resources.push({
        ...resource,
        content: description
      });

      // Build Tako charts map for post-processing
      if (title && iframeHtml) {
        takoChartsMap[title] = iframeHtml;
        availableTakoCharts.push(`  - **${title}**\n    Description: ${description}`);
      }
    } else {
      // Web resources: fetch content
      const content = getResource(resource.url);
      if (content === "ERROR") {
        continue;
      }
      resource.content = content;
      resources.push(resource);
    }
  }

  const availableTakoChartsStr = availableTakoCharts.length > 0
    ? availableTakoCharts.join("\n")
    : "  (No Tako charts available yet)";

  // Load Tako MCP tools
  const { tools: takoTools } = await initializeTakoMCP();
  const allTools = [
    Search,
    WriteReport,
    WriteResearchQuestion,
    DeleteResources,
    GenerateDataQuestions,
    ...takoTools,
  ];

  const model = getModel(state);
  const invokeArgs: Record<string, unknown> = {};
  if (model.constructor.name === "ChatOpenAI") {
    invokeArgs["parallel_tool_calls"] = false;
  }

  // Build dynamic prompt based on feature toggles
  const dataQuestionsInstructions = ENABLE_DEEP_QUERIES
    ? `2. THEN: Use GenerateDataQuestions to create 3-6 data-focused questions with varied complexity:
           - 2-3 BASIC questions (fast search) for straightforward data: "Country X GDP 2020-2024"
           - 1-2 COMPLEX questions (deep search) for analytical insights: "What factors drove X's growth?"
           - 0-1 PREDICTION MARKET question (deep search) if relevant: "What are odds for X in 2025?"
           - Use the entities, metrics, cohorts, and time periods listed in the knowledge base context above when available
           - Prefer exact entity/metric names from the knowledge base context for better search results`
    : `2. THEN: Use GenerateDataQuestions to create 2-4 BASIC data-focused questions (fast search only):
           - Focus on straightforward data lookups: "Country X GDP 2020-2024"
           - Use the entities, metrics, cohorts, and time periods listed in the knowledge base context above when available
           - Prefer exact entity/metric names from the knowledge base context for better search results
           - Note: Deep/complex queries are currently disabled`;

  const response = await model.bindTools!(
    allTools,
    invokeArgs
  ).invoke(
    [
      new SystemMessage(
        `You are a research assistant. You help the user with writing a research report.
        Do not recite the resources, instead use them to answer the user's question.

        ${state.explore_context || ""}

        RESEARCH WORKFLOW:
        1. FIRST: When you receive a user's query, use WriteResearchQuestion to extract/formulate the core research question
        ${dataQuestionsInstructions}
        3. These questions will search Tako for relevant charts and visualizations
        4. Use the Search tool for web resources
        5. Combine insights from both Tako charts and web resources in your report

        IMPORTANT ABOUT RESEARCH QUESTION:
        - Always start by using WriteResearchQuestion to capture the user's research intent
        - This creates a clear, focused question from their natural language query
        - If a research question is already provided, YOU MUST NOT ASK FOR IT AGAIN

        CRITICAL - EMBEDDING TAKO CHARTS IN REPORT:
        When writing your report, you can embed Tako chart visualizations using markers.

        SYNTAX: [TAKO_CHART:exact_title_of_chart]

        AVAILABLE TAKO CHARTS:
${availableTakoChartsStr}

        EXAMPLE:
        ## Economic Growth Analysis

        China's economy has shown significant growth over the past decade...

        [TAKO_CHART:China GDP Growth 2000-2020]

        The data visualization above shows the dramatic increase in GDP...

        RULES FOR EMBEDDING CHARTS:
        - Use [TAKO_CHART:exact_title] syntax to embed charts
        - The title must EXACTLY match one of the available charts listed above
        - **IMPORTANT**: Only embed charts that genuinely enrich the specific section of your report
        - Evaluate the chart description to ensure it provides relevant data for the point you're making
        - Position markers where you want the interactive chart to appear
        - Add explanatory text before and after the chart marker to provide context
        - Quality over quantity: Embed 1-3 highly relevant charts rather than all available charts
        - Skip charts that are tangentially related or don't add meaningful insights
        - The chart will be automatically rendered as an interactive visualization

        You should use the search tool to get resources before answering the user's question.
        Use the content and descriptions from both Tako charts and web resources to inform your report.
        If you finished writing the report, ask the user proactively for next steps, changes etc, make it engaging.
        To write the report, you should use the WriteReport tool. Never EVER respond with the report, only use the tool.

        This is the research question:
        ${researchQuestion}

        This is the research report:
        ${report}

        Here are the resources that you have available:
        ${JSON.stringify(resources)}
        `
      ),
      ...state.messages,
    ],
    customConfig
  );

  const aiMessage = response as AIMessage;

  if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
    if (aiMessage.tool_calls[0].name === "WriteReport") {
      let report = aiMessage.tool_calls[0].args.report;

      // Post-process: Replace Tako chart markers with actual iframe HTML
      report = report.replace(/\[TAKO_CHART:([^\]]+)\]/g, (match: string, chartTitle: string) => {
        const title = chartTitle.trim();
        if (takoChartsMap[title]) {
          const iframeHtml = takoChartsMap[title];
          // Remove script tags - resize listener is handled in React component
          const iframeOnly = iframeHtml.replace(/<script.*?<\/script>/gs, '');
          return `\n\n${iframeOnly}\n\n`;
        } else {
          // Chart not found, leave marker but add warning
          return `\n\n[Chart not found: ${title}]\n\n`;
        }
      });

      return {
        report,
        resources: state.resources, // Preserve resources
        messages: [
          aiMessage,
          new ToolMessage({
            tool_call_id: aiMessage.tool_calls![0]["id"]!,
            content: "Report written.",
            name: "WriteReport",
          }),
        ],
      };
    } else if (aiMessage.tool_calls[0].name === "WriteResearchQuestion") {
      const researchQuestion = aiMessage.tool_calls[0].args.research_question;

      // Call explore API to get knowledge graph context (if enabled)
      let exploreContext = '';
      if (ENABLE_EXPLORE_API) {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 EXPLORE API CALL');
        console.log(`Research Question: ${researchQuestion}`);
        const exploreResults = await callTakoExplore(researchQuestion);
        exploreContext = formatExploreResults(exploreResults);

        // Log explore results
        if (exploreResults.total_matches > 0) {
          console.log('\n📊 EXPLORE RESULTS:');
          if (exploreResults.entities?.length) {
            console.log(`  Entities (${exploreResults.entities.length}):`);
            exploreResults.entities.slice(0, 5).forEach((e: any) => {
              console.log(`    - ${e.name || 'N/A'}`);
            });
          }
          if (exploreResults.metrics?.length) {
            console.log(`  Metrics (${exploreResults.metrics.length}):`);
            exploreResults.metrics.slice(0, 5).forEach((m: any) => {
              console.log(`    - ${m.name || 'N/A'}`);
            });
          }
          if (exploreResults.cohorts?.length) {
            console.log(`  Cohorts (${exploreResults.cohorts.length}):`);
            exploreResults.cohorts.slice(0, 3).forEach((c: any) => {
              console.log(`    - ${c.name || 'N/A'}`);
            });
          }
          if (exploreResults.time_periods?.length) {
            console.log(`  Time Periods (${exploreResults.time_periods.length}):`);
            exploreResults.time_periods.slice(0, 3).forEach((t: string) => {
              console.log(`    - ${t}`);
            });
          }
        } else {
          console.log('  ⚠️  No explore results found');
        }
        console.log('='.repeat(80) + '\n');
      } else {
        console.log('⏭️  Explore API disabled (ENABLE_EXPLORE_API=false)');
      }

      return {
        research_question: researchQuestion,
        explore_context: exploreContext,
        messages: [
          aiMessage,
          new ToolMessage({
            tool_call_id: aiMessage.tool_calls![0]["id"]!,
            content: "Research question written.",
            name: "WriteResearchQuestion",
          }),
        ],
      };
    } else if (aiMessage.tool_calls[0].name === "GenerateDataQuestions") {
      const dataQuestions = aiMessage.tool_calls[0].args.questions;

      // Log generated data questions
      console.log('\n' + '='.repeat(80));
      console.log(`❓ GENERATED DATA QUESTIONS (${dataQuestions.length} total)`);
      dataQuestions.forEach((q: any, i: number) => {
        const effort = q.search_effort || 'unknown';
        const queryType = q.query_type || 'unknown';
        const question = q.question || 'N/A';
        console.log(`  ${i + 1}. [${effort.toUpperCase()}] [${queryType}] ${question}`);
      });
      console.log('='.repeat(80) + '\n');

      return {
        data_questions: dataQuestions,
        messages: [
          aiMessage,
          new ToolMessage({
            tool_call_id: aiMessage.tool_calls![0]["id"]!,
            content: `Generated ${dataQuestions.length} data questions for search.`,
            name: "GenerateDataQuestions",
          }),
        ],
      };
    }
  }

  return {
    messages: response,
  };
}
