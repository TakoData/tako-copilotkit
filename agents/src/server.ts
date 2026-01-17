import "dotenv/config";
import { CopilotRuntime } from "@copilotkit/runtime";
import express from "express";
import cors from "cors";
import { graph } from "./agent";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize the runtime with our LangGraph agent
const runtime = new CopilotRuntime();

// For local development: use the compiled graph directly
// For production: use LangGraphPlatformClient to connect to deployed agent

const USE_LOCAL_AGENT = process.env.USE_LOCAL_AGENT === "true";

if (USE_LOCAL_AGENT) {
  // Local development - run the agent directly
  app.post("/copilotkit", async (req, res) => {
    try {
      const result = await graph.invoke(req.body);
      res.json(result);
    } catch (error) {
      console.error("Agent error:", error);
      res.status(500).json({ error: String(error) });
    }
  });
} else {
  // Production - connect to deployed LangGraph agent
  const client = new LangGraphPlatformClient({
    apiUrl: process.env.LANGGRAPH_API_URL,
    apiKey: process.env.LANGGRAPH_API_KEY,
  });

  const agent = new LangGraphAgent({
    client,
    graphId: "tako_research_agent",
  });

  app.post("/copilotkit", async (req, res) => {
    const handler = runtime.streamHttpServerResponse(req, res, {
      agents: [agent],
    });
    await handler();
  });
}

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Agent server running on http://localhost:${PORT}`);
  console.log(`Mode: ${USE_LOCAL_AGENT ? "Local" : "Production"}`);
});
