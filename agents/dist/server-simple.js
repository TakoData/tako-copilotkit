"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Simplified server for testing without CopilotKit runtime
 * This directly invokes the LangGraph agent
 */
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const agent_1 = require("./agent");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
// Agent info endpoint (for CopilotKit compatibility)
app.get("/copilotkit/info", (req, res) => {
    res.json({
        agents: [
            {
                name: "tako_research_agent",
                description: "Research assistant that creates data-driven reports using Tako charts and web sources"
            }
        ]
    });
});
// Main agent endpoint
app.post("/copilotkit", async (req, res) => {
    try {
        console.log("Received request:", JSON.stringify(req.body, null, 2).substring(0, 500));
        const result = await agent_1.graph.invoke(req.body);
        console.log("Sending response:", JSON.stringify(result, null, 2).substring(0, 500));
        res.json(result);
    }
    catch (error) {
        console.error("Agent error:", error);
        if (error.message?.includes('exceeded your current quota') ||
            error.message?.includes('429') ||
            error.status === 429) {
            return res.status(429).json({
                error: 'OpenAI API quota exceeded',
                details: String(error)
            });
        }
        if (error.message?.includes('Incorrect API key') ||
            error.message?.includes('401') ||
            error.status === 401) {
            return res.status(401).json({
                error: 'Invalid OpenAI API key',
                details: String(error)
            });
        }
        res.status(500).json({
            error: 'Internal server error',
            details: String(error)
        });
    }
});
const PORT = process.env.PORT || 8002;
app.listen(PORT, () => {
    console.log(`\n✅ Agent server running on http://localhost:${PORT}`);
    console.log(`📊 Mode: Direct LangGraph invocation`);
    console.log(`🔍 Health: http://localhost:${PORT}/health`);
    console.log(`ℹ️  Info: http://localhost:${PORT}/copilotkit/info\n`);
});
//# sourceMappingURL=server-simple.js.map