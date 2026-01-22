# Research Canvas with MCP Integration

An AI-powered research assistant that combines data visualization with web search capabilities. Built with [CopilotKit](https://copilotkit.ai), [LangGraph](https://langchain-ai.github.io/langgraph/), and the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

This demo showcases how to integrate custom data sources via MCP with a conversational AI interface for research and exploration.

## ✨ Features

- **AI Research Agent**: Automatically generates relevant search queries and gathers resources
- **Dual Search**: Combines structured data (via MCP) with web search (via Tavily)
- **Interactive Resources**: Preview and explore data visualizations inline
- **Report Generation**: Compile findings into formatted research reports
- **Real-time Collaboration**: Built with CopilotKit for seamless AI-human interaction

## 🚀 Quick Start

### Prerequisites

1. **OpenAI API Key** - Get from [platform.openai.com](https://platform.openai.com)
2. **Tavily API Key** - Get from [tavily.com](https://tavily.com)
3. **Data Source** - Configure your MCP server endpoint (optional)

## 📋 Installation

```bash
# Clone the repository
git clone <your-repo>
cd research-canvas

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your API keys to .env.local
# OPENAI_API_KEY=your-openai-key
# TAVILY_API_KEY=your-tavily-key

# Start the development server
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Agent Backend**: http://localhost:2024

## 🏗️ Project Structure

```
research-canvas/
├── src/                   # Next.js frontend
│   ├── app/              # App router pages
│   ├── components/       # React components
│   └── lib/              # Utilities and types
├── agents/               # LangGraph agent backends
│   ├── typescript/       # TypeScript agent (primary)
│   └── python/          # Python agent (alternative)
├── api/                  # API routes and MCP integration
└── .env.example         # Environment variable template
```

## 🌐 Environment Variables

Create a `.env.local` file based on `.env.example`:

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for LLM | Yes |
| `TAVILY_API_KEY` | Tavily API key for web search | Yes |
| `TAKO_API_TOKEN` | API token for data source | Optional* |
| `TAKO_MCP_URL` | MCP server endpoint URL | Optional* |
| `TAKO_URL` | Base URL for data source | Optional* |

*Optional fields are only needed if you're connecting to a custom MCP data source.

## 💬 Usage

1. **Start a Research Session**: Enter a research question or topic
2. **AI Generates Queries**: The agent automatically creates data-focused search queries
3. **Resource Discovery**: View discovered resources (data visualizations, web articles)
4. **Explore Resources**: Click on resources to preview and analyze
5. **Generate Report**: Compile your findings into a formatted report

## 🏗️ Architecture

```
┌─────────────────┐
│  Next.js App    │
│  (Frontend UI)  │
└────────┬────────┘
         │
         │ CopilotKit
         ▼
┌─────────────────┐
│  LangGraph      │
│  Agent          │
└────────┬────────┘
         │
         ├─→ OpenAI (LLM)
         │
         ├─→ Tavily (Web Search)
         │
         └─→ MCP Server (Optional Data Source)
```

## 🔧 Key Technologies

- **[CopilotKit](https://copilotkit.ai)**: AI copilot framework for React applications
- **[LangGraph](https://langchain-ai.github.io/langgraph/)**: Framework for building stateful agent workflows
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)**: Standard for connecting AI systems to data sources
- **[Next.js](https://nextjs.org)**: React framework for the frontend
- **[Tavily](https://tavily.com)**: Web search API for research

## 🐛 Troubleshooting

### Agent won't start

```bash
# Reinstall dependencies
npm install

# Try running with legacy peer deps
npm install --legacy-peer-deps
```

### API rate limits

If you encounter rate limits:
- Check your OpenAI API quota
- Verify Tavily API subscription level
- Consider adding caching to reduce API calls

### Resources not loading

- Verify all API keys are set in `.env.local`
- Check browser console for errors
- Ensure agent backend is running on port 2024

## 🔐 Security

**Important**: Never commit API keys to version control

1. Always use `.env.local` for sensitive values
2. Add `.env.local` to `.gitignore` (already configured)
3. Rotate API keys regularly
4. Use environment-specific keys for dev/production

## 🚢 Deployment

This project uses a simple two-branch strategy for safe deployments.

### Branch Strategy

- **`main`** - Development branch (CI runs, no auto-deploy)
- **`production`** - Auto-deploys to production (protected branch)

### Quick Deploy

```bash
# Develop and test on main
git push origin main

# Deploy to production when ready
git checkout production
git merge main
git push origin production
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions, including:
- Setting up Vercel and Railway
- Configuring GitHub Actions secrets
- Branch protection rules
- Rollback procedures

## 🤝 Contributing

Contributions are welcome! This project demonstrates how to build AI-powered research tools with CopilotKit and MCP.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🔗 Resources

- [CopilotKit Documentation](https://docs.copilotkit.ai/)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Next.js Documentation](https://nextjs.org/docs)

## 💡 Extending This Project

### Adding Custom MCP Data Sources

This project includes an example MCP integration. To add your own:

1. Implement MCP server for your data source
2. Update environment variables with your MCP endpoint
3. Modify agent tools to call your MCP methods
4. Update UI components to display your data types

### Customizing the Agent

The LangGraph agent is in `agents/typescript/src/`. Key files:
- `agent.ts` - Agent routing logic
- `chat.ts` - Chat and tool definitions
- `search.ts` - Search node implementation

### UI Customization

The Next.js frontend is in `src/`. Key components:
- `components/ResearchCanvas.tsx` - Main research interface
- `components/Resources.tsx` - Resource display and management

## 📄 License

MIT License - See LICENSE file for details

---

**Built as a demonstration of CopilotKit + LangGraph + MCP integration**
