"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const runtime_1 = require("@copilotkit/runtime");
const agent_1 = require("./agent");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const runtime = new runtime_1.CopilotRuntime({
    // @ts-expect-error - LangGraphAgent constructor signature may have changed
    agents: new runtime_1.LangGraphAgent({
        name: "tako_research_agent",
        description: "Research assistant that creates data-driven reports using Tako charts and web sources",
        graph: agent_1.graph,
    }),
});
app.use("/copilotkit", (req, res) => {
    const handler = (0, runtime_1.copilotRuntimeNodeHttpEndpoint)({
        endpoint: "/copilotkit",
        runtime,
    });
    return handler(req, res);
});
const PORT = process.env.PORT || 8002;
app.listen(PORT, () => {
    console.log(`\n✅ Agent server running on http://localhost:${PORT}`);
    console.log(`🔍 Info: http://localhost:${PORT}/copilotkit/info\n`);
});
//# sourceMappingURL=server.js.map