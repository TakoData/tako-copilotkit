# Implementation Summary

**Note**: This project previously had both Python and TypeScript agent implementations. The TypeScript agent has been removed to simplify maintenance. Only the Python agent is now supported.

## Architecture Overview

### Components
- Frontend (React/Next.js) - Port 3000
- Python Agent (FastAPI/LangGraph) - Port 2024
- Tako MCP Server - Port 8001 (or remote)

### Agent Implementation
**Python Agent** (`agents/python/`)
- Framework: FastAPI, LangGraph, Python httpx
- MCP Client: Custom implementation with SSE protocol
- File structure:
  - `main.py` - FastAPI entry point
  - `src/agent.py` - LangGraph agent definition
  - `src/lib/chat.py` - Chat node and LLM interactions
  - `src/lib/search.py` - Web search (Tavily) and Tako search
  - `src/lib/tako_mcp.py` - Tako MCP client implementation
  - `src/lib/state.py` - Agent state management
  - `src/lib/model.py` - LLM model configuration

## State Management

**File**: `agents/python/src/lib/state.py`

The agent uses LangGraph's state management with these key fields:
- `messages`: Conversation history
- `research_question`: Extracted research intent
- `resources`: Search results (web + Tako charts)
- `report`: Generated research report
- `logs`: Status messages for UI

## Tako MCP Integration

**File**: `agents/python/src/lib/tako_mcp.py`

Features:
- Direct SSE connection to Tako MCP server (no proxy needed)
- Tools: `knowledge_search`, `explore_knowledge_graph`, `open_chart_ui`
- Handles chart iframe generation for embedding

### Key Functions
- `call_tako_knowledge_search()` - Search Tako's knowledge base
- `call_tako_explore()` - Explore entities/metrics
- `get_tako_chart_iframe()` - Get embeddable chart HTML

## Agent Workflow

### Chat Node (`agents/python/src/lib/chat.py`)
1. Extracts research question with `WriteResearchQuestion` tool
2. Optionally calls Tako explore API for entity/metric context
3. Generates data questions with `GenerateDataQuestions` tool
4. Routes to search node for execution
5. Synthesizes results into research report with `WriteReport` tool
6. Embeds Tako charts using `[TAKO_CHART:title]` markers

### Search Node (`agents/python/src/lib/search.py`)
1. Executes web searches via Tavily (if enabled)
2. Executes Tako searches (fast + deep queries)
3. Fetches chart iframes for Tako results
4. Streams results back to chat node

### Agent Routing (`agents/python/src/agent.py`)
- Entry → Chat Node
- Chat → Search Node (when search needed)
- Search → Chat Node (with results)
- Chat → End (when report complete)

## Environment Variables

**Root `.env`:**
```bash
TAKO_API_TOKEN=your-token
TAKO_MCP_URL=http://localhost:8001
```

**Python Agent (`agents/python/.env`):**
```bash
OPENAI_API_KEY=your-key
TAVILY_API_KEY=your-key
TAKO_API_TOKEN=your-token
TAKO_API_URL=http://localhost:8000
TAKO_MCP_URL=http://localhost:8001
PORT=2024
DISABLE_WEB_SEARCH=false
```

## Running the Application

### Development

```bash
# Install dependencies
npm install
cd agents/python && uv sync && cd ../..

# Start both UI and agent
npm run dev

# Access:
# - UI: http://localhost:3000
# - Agent: http://localhost:2024
```

### Production (Vercel)

Deploy to Vercel and set environment variables:
- `TAKO_API_TOKEN`
- `TAKO_MCP_URL`
- `OPENAI_API_KEY`

## Feature Toggles

See `FEATURE_TOGGLES.md` for configuration options:
- `ENABLE_EXPLORE_API` - Tako knowledge graph exploration
- `ENABLE_DEEP_QUERIES` - Deep/complex Tako queries
- `USE_DIRECT_MCP` - Direct MCP connection (enabled by default)

## Project Structure

```
tako-copilotkit/
├── agents/
│   └── python/              # Python agent (LangGraph + FastAPI)
│       ├── src/
│       │   ├── agent.py
│       │   └── lib/
│       │       ├── chat.py
│       │       ├── search.py
│       │       ├── tako_mcp.py
│       │       ├── state.py
│       │       └── model.py
│       ├── main.py
│       ├── pyproject.toml
│       └── .env
├── src/                     # Next.js frontend
│   ├── app/
│   └── components/
├── public/
├── package.json
├── .env
└── README.md
```

## Notes

- **MCP Protocol**: Direct SSE connection to Tako MCP server
- **No Proxy**: The `backend/mcp_proxy.py` has been removed
- **Chart Embedding**: Charts are embedded using iframe HTML with resize script
- **State Streaming**: Agent streams progress updates to UI via CopilotKit
