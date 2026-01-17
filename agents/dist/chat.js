"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat_node = chat_node;
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
const langgraph_1 = require("@copilotkit/sdk-js/langgraph");
const zod_1 = require("zod");
const model = new openai_1.ChatOpenAI({
    model: "gpt-4o",
    temperature: 0.7,
    openAIApiKey: process.env.OPENAI_API_KEY,
});
const WriteResearchQuestionTool = {
    name: "WriteResearchQuestion",
    description: "Write or update the research question. Use this when the user provides a research topic.",
    schema: zod_1.z.object({
        research_question: zod_1.z.string().describe("The research question to investigate"),
    }),
};
const GenerateDataQuestionsTool = {
    name: "GenerateDataQuestions",
    description: "Generate specific data questions to search Tako's knowledge base. These should be focused questions about statistics, trends, or comparisons that can be answered with data visualizations.",
    schema: zod_1.z.object({
        data_questions: zod_1.z.array(zod_1.z.string()).describe("3-5 specific data questions to search for in Tako"),
    }),
};
const WriteReportTool = {
    name: "WriteReport",
    description: "Write the research report with embedded chart iframes. Use the available resources to create a comprehensive report.",
    schema: zod_1.z.object({
        report: zod_1.z.string().describe("The research report in markdown format with embedded iframes"),
    }),
};
async function chat_node(state) {
    const config = (0, langgraph_1.copilotkitEmitState)({
        stateToEmit: {
            WriteResearchQuestion: {
                research_question: true,
            },
            GenerateDataQuestions: {
                data_questions: true,
                logs: true,
            },
            WriteReport: {
                report: true,
            },
        },
    });
    const systemMessage = `You are a research assistant that helps users create data-driven research reports using Tako charts and web resources.

Your workflow:
1. When the user provides a research topic, use WriteResearchQuestion to set it
2. Use GenerateDataQuestions to create 3-5 specific data questions
3. After resources are fetched (both Tako charts and web results), use WriteReport

When writing reports:
- Use markdown formatting
- Embed Tako chart iframes using the iframe_html from tako_chart resources
- Reference web sources with links from tavily_web resources
- Combine visual data (charts) with contextual information (web results)
- Organize information logically
- Include a Resources section categorizing charts and web sources separately

Current state:
- Research question: ${state.research_question || "Not set"}
- Data questions: ${state.data_questions?.length || 0} generated
- Tako Charts: ${state.resources?.filter(r => r.resource_type === 'tako_chart').length || 0}
- Web Resources: ${state.resources?.filter(r => r.resource_type === 'tavily_web').length || 0}
- Report: ${state.report ? "Draft created" : "Not started"}

Be concise and create reports that blend visual data insights with supporting web context.`;
    const tools = [
        WriteResearchQuestionTool,
        GenerateDataQuestionsTool,
        WriteReportTool,
    ];
    const modelWithTools = model.bindTools(tools);
    const response = await modelWithTools.invoke([
        new messages_1.HumanMessage(systemMessage),
        ...(state.messages || []),
    ], config);
    const updates = {
        messages: [response],
    };
    // Handle tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
            const newLogs = [];
            if (toolCall.name === "WriteResearchQuestion") {
                updates.research_question = toolCall.args.research_question;
                newLogs.push(`Research question set: ${toolCall.args.research_question}`);
            }
            else if (toolCall.name === "GenerateDataQuestions") {
                updates.data_questions = toolCall.args.data_questions;
                newLogs.push(`Generated ${toolCall.args.data_questions.length} data questions`);
            }
            else if (toolCall.name === "WriteReport") {
                updates.report = toolCall.args.report;
                newLogs.push("Report draft created");
            }
            if (newLogs.length > 0) {
                updates.logs = newLogs;
                await config.saveState({
                    ...state,
                    ...updates,
                });
            }
        }
    }
    return updates;
}
//# sourceMappingURL=chat.js.map