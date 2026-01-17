# Tako Research Canvas - Quick Start Guide

## 🎯 What's Been Implemented

You now have a fully functional research canvas that integrates Tako's chart database with web search, powered by LangGraph agents and the Model Context Protocol (MCP).

## 🚀 Quick Start

### 1. Add Your API Keys

Edit `.env.local` and add your keys:
```bash
OPENAI_API_KEY=sk-proj-your-key-here
TAVILY_API_KEY=tvly-your-key-here
# Tako credentials are already configured
```

Also edit `agents/typescript/.env` with the same keys.

### 2. Install & Run

```bash
# Install dependencies (already done)
npm install

# Start the application
npm run dev
```

This runs:
- **Next.js UI** on http://localhost:3000
- **LangGraph Agent** on http://localhost:8000

### 3. Test It Out

1. Open http://localhost:3000
2. Enter a research question: "Compare Intel vs Nvidia GPU performance"
3. Watch as the agent:
   - Generates data-focused questions
   - Searches Tako for charts
   - Searches web for articles
   - Displays both as resources
4. Click a Tako chart → See interactive preview
5. Generate a report with embedded charts

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

### 1. Dual Resource Types
- **Tako Charts**: Blue badge, click for preview modal with iframe
- **Web Articles**: Click to edit details

### 2. Smart Search
- Agent generates data-focused questions automatically
- Parallel search: Tako charts + Tavily web search
- No duplicates, proper source attribution

### 3. Interactive Charts
- Full Tako chart iframes embedded in preview modal
- Can embed charts directly in research reports
- Responsive and scrollable

### 4. Research Workflow
```
Research Question
    ↓
GenerateDataQuestions (AI generates 3-5 questions)
    ↓
Parallel Search (Tako MCP + Tavily)
    ↓
Resources Display (Charts + Web)
    ↓
Report Generation (With embedded charts)
```

## 🔧 Available Tools

### MCP Tools (from Tako)
- `tako_knowledge_search` - Search Tako's chart database
- `tako_open_chart_ui` - Get chart iframe HTML
- `tako_get_card_insights` - Get AI chart insights (not yet integrated)

### Custom Tools
- `GenerateDataQuestions` - Generate data-focused search questions
- `Search` - Trigger web search via Tavily
- `WriteReport` - Generate research report
- `WriteResearchQuestion` - Set research question
- `DeleteResources` - Delete resources

## 🐛 Troubleshooting

### Agent Won't Start
```bash
# Make sure dependencies are installed
cd agents/typescript
npm install --legacy-peer-deps
cd ../..
npm run dev
```

### Tako Charts Not Loading
- Check TAKO_API_TOKEN is set in both `.env` files
- Verify Tako MCP server is accessible (check TAKO_MCP_URL)
- Look for errors in agent console (port 8000)

### Missing Dependencies
```bash
# Reinstall with legacy peer deps
npm install --legacy-peer-deps
```

## 📝 Example Research Questions

Try these to see Tako integration in action:
- "Compare Intel vs Nvidia GPU performance"
- "Analyze unemployment trends in the US"
- "Climate change data and projections"
- "Electric vehicle market growth"
- "Cryptocurrency market analysis"

## 🎓 How It Works

### MCP Architecture
```
User Query
    ↓
LangGraph Agent (chat_node)
    ├─→ GenerateDataQuestions
    │       ↓
    │   search_node
    │       ├─→ Tako MCP (via @langchain/mcp-adapters)
    │       │       ↓
    │       │   tako_knowledge_search
    │       │       ↓
    │       │   tako_open_chart_ui (get iframe)
    │       │       ↓
    │       │   Tako chart resources
    │       │
    │       └─→ Tavily Web Search
    │               ↓
    │           Web article resources
    │
    └─→ Combined Resources → Report
```

### Resource Flow
1. Agent calls `GenerateDataQuestions` with research context
2. Questions stored in `state.data_questions`
3. Agent routes to `search_node`
4. `search_node` searches in parallel:
   - Tako MCP: `tako_knowledge_search` → chart results
   - Tavily: web search → article results
5. For each Tako chart: call `tako_open_chart_ui` to get iframe HTML
6. Resources added with proper types:
   - Tako: `{resource_type: 'tako_chart', iframe_html: '...', source: 'Tako'}`
   - Web: `{resource_type: 'web', source: 'Tavily Web Search'}`
7. Frontend displays with type-aware rendering

## 📚 Documentation

- **Full Implementation Details**: See `IMPLEMENTATION_SUMMARY.md`
- **Original Plan**: See planning session transcript
- **CopilotKit Docs**: https://docs.copilotkit.ai/
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **MCP Protocol**: https://modelcontextprotocol.io/

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Research question accepted
- ✅ "Generating data questions..." appears
- ✅ Resources section shows "X charts, Y web"
- ✅ Tako charts have blue badge
- ✅ Clicking chart opens preview modal with iframe
- ✅ Report can be generated with embedded charts

## 🚀 Next Steps

1. **Test locally**: Add API keys and run `npm run dev`
2. **Try research questions**: Test the Tako integration
3. **Deploy**: Push to Vercel or deploy MCP server
4. **Enhance**: Add chart insights, PDF export, etc.

## 💡 Tips

- Charts load faster with Tako MCP server running locally
- Use specific research questions for better Tako results
- Delete unwanted resources before generating report
- Edit web resources to improve report quality

---

**Ready to research with Tako charts! 🎨📊**

Need help? Check `IMPLEMENTATION_SUMMARY.md` for detailed documentation.
