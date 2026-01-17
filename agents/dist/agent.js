"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("./state");
const chat_1 = require("./chat");
const search_1 = require("./search");
// Route function to determine next step
function shouldSearch(state) {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];
    // Check if the last message has tool calls for GenerateDataQuestions
    if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
        const hasGenerateQuestions = lastMessage.tool_calls.some((tc) => tc.name === "GenerateDataQuestions");
        if (hasGenerateQuestions && state.data_questions && state.data_questions.length > 0) {
            return "search";
        }
    }
    return "end";
}
// Create the graph
const workflow = new langgraph_1.StateGraph(state_1.TakoResearchStateAnnotation)
    .addNode("chat", chat_1.chat_node)
    .addNode("search", search_1.search_node)
    .addEdge("__start__", "chat")
    .addConditionalEdges("chat", shouldSearch, {
    search: "search",
    end: "__end__",
})
    .addEdge("search", "chat");
// Compile the graph without checkpointer for now
// TODO: Add proper thread_id handling for state persistence
exports.graph = workflow.compile();
//# sourceMappingURL=agent.js.map