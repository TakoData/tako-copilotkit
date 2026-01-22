# Research Canvas - Quick Start Guide

## 🎯 Overview

An AI-powered research assistant that combines multiple data sources with web search. Built with CopilotKit, LangGraph, and the Model Context Protocol.

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd research-canvas

# Install dependencies
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```bash
OPENAI_API_KEY=sk-your-openai-key-here
TAVILY_API_KEY=tvly-your-tavily-key-here

# Optional: If connecting to a custom MCP data source
# TAKO_API_TOKEN=your-data-source-token
# TAKO_MCP_URL=http://localhost:8001
# TAKO_URL=http://localhost:8000
```

### 3. Start the Application

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:3000
- **Agent Backend**: http://localhost:2024

### 4. Try It Out

1. Open http://localhost:3000
2. Enter a research question (e.g., "Compare electric vehicles vs gas cars")
3. Watch the AI agent:
   - Generate focused search queries
   - Search multiple sources
   - Collect relevant resources
4. Explore resources and generate a report

## 📁 Project Structure

```
tako-copilotkit/
├── src/                          # Next.js frontend
│   ├── app/                      # App router pages
│   ├── components/               # React components
│   │   ├── Resources.tsx         # ✨ Enhanced with Tako chart badges
│   │   └── ResearchCanvas.tsx    # ✨ Added chart preview modal
│   └── lib/
│       └── types.ts              # ✨ Extended with Tako fields
│
├── agents/typescript/            # LangGraph agent
│   ├── src/
│   │   ├── agent.ts              # ✨ Updated routing
│   │   ├── chat.ts               # ✨ Added GenerateDataQuestions + Tako MCP tools
│   │   ├── search.ts             # ✨ Parallel Tako + Tavily search
│   │   ├── state.ts              # ✨ Extended with Tako fields
│   │   └── tako/
│   │       ├── mcp-client.ts     # ✨ MCP client configuration
│   │       └── types.ts          # ✨ Tako-specific types
│   └── package.json              # ✨ Added @langchain/mcp-adapters
│
├── api/                          # Tako MCP server (Vercel functions)
├── backend/                      # Tako MCP server (local dev)
└── .env.local                    # ✨ Environment configuration

✨ = New or modified files
```

## 🎨 Key Features

### 1. AI-Powered Research
- Agent automatically generates focused search queries
- Intelligent routing between different data sources
- Contextual understanding of research goals

### 2. Multi-Source Search
- Web search via Tavily API
- Optional custom data sources via MCP
- Parallel search for faster results

### 3. Interactive Resources
- Preview and explore discovered resources
- Edit and annotate findings
- Organize resources by relevance

### 4. Research Workflow
```
Research Question
    ↓
AI Generates Search Queries
    ↓
Parallel Multi-Source Search
    ↓
Resource Discovery & Organization
    ↓
Report Generation
```

## 🔧 Agent Tools

The LangGraph agent has access to these tools:

### Core Tools
- `GenerateDataQuestions` - Create focused search queries
- `Search` - Execute web search via Tavily
- `WriteReport` - Generate formatted research reports
- `WriteResearchQuestion` - Set or update research topic
- `DeleteResources` - Remove unwanted resources

### Optional MCP Tools
If you configure a custom MCP data source, additional tools become available based on your MCP server implementation.

## 🐛 Troubleshooting

### Agent Won't Start
```bash
# Reinstall dependencies with legacy peer deps
npm install --legacy-peer-deps

# Try running again
npm run dev
```

### API Key Errors
- Verify API keys are correctly set in `.env.local`
- Check that keys don't have extra spaces or quotes
- Ensure `.env.local` is in the project root directory

### Port Already in Use
```bash
# If port 3000 or 2024 is already in use
# Kill the process or change the port in package.json
lsof -ti:3000 | xargs kill -9
lsof -ti:2024 | xargs kill -9
```

### Missing Dependencies
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## 📝 Example Research Questions

Try these to test the research assistant:
- "Compare renewable energy adoption across countries"
- "Analyze the impact of remote work on productivity"
- "What are the latest trends in artificial intelligence?"
- "Electric vehicle market growth and forecasts"
- "Cybersecurity threats in 2024"
- "Impact of climate change on agriculture"

## 🎓 How It Works

### Architecture Overview
```
User Query (via CopilotKit)
    ↓
LangGraph Agent
    ↓
Generate Search Queries (AI)
    ↓
Execute Searches in Parallel
    ├─→ Web Search (Tavily)
    └─→ Custom Data Sources (MCP, optional)
    ↓
Collect & Organize Resources
    ↓
Display in UI
    ↓
Generate Report (on demand)
```

### Agent Flow
1. **User Input**: User enters research question via CopilotKit UI
2. **Query Generation**: Agent generates focused search queries
3. **Parallel Search**: Searches multiple sources simultaneously
4. **Resource Collection**: Gathers and deduplicates results
5. **State Management**: Updates application state with resources
6. **UI Rendering**: Frontend displays resources in organized view
7. **Report Generation**: User can compile findings into formatted report

## 📚 Documentation & Resources

- **CopilotKit**: https://docs.copilotkit.ai/
- **LangGraph**: https://langchain-ai.github.io/langgraph/
- **Model Context Protocol**: https://modelcontextprotocol.io/
- **Next.js**: https://nextjs.org/docs
- **Tavily API**: https://tavily.com/docs

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Application starts without errors
- ✅ Research question is accepted
- ✅ AI generates relevant search queries
- ✅ Resources appear in the UI
- ✅ You can preview and explore resources
- ✅ Reports can be generated

## 🚀 Next Steps

### 1. Customize the Agent
- Modify tool definitions in `agents/typescript/src/chat.ts`
- Add custom search logic in `agents/typescript/src/search.ts`
- Adjust routing in `agents/typescript/src/agent.ts`

### 2. Add Custom Data Sources
- Implement an MCP server for your data
- Configure MCP endpoint in environment variables
- Update agent to use MCP tools

### 3. Enhance the UI
- Customize components in `src/components/`
- Add new resource types
- Improve report formatting

## 💡 Tips

- Use specific, focused research questions for better results
- The agent works best with factual, research-oriented queries
- Delete irrelevant resources before generating reports
- Experiment with different agent prompts and tools

---

**Happy researching! 🎯📚**
