# Tako MCP Chat - Vercel Deployment

A conversational interface for searching and exploring Tako charts using the Model Context Protocol (MCP). This demo showcases Tako's MCP UI integration with a clean, deployable architecture.

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/tako-mcp-chat)

### Prerequisites

1. **Tako API Token** - Get from [tako.com](https://tako.com)
2. **MCP Server URL** - Deploy the MCP server separately (see below)

### One-Click Deployment

1. Click the "Deploy with Vercel" button above
2. Set environment variables:
   - `TAKO_API_TOKEN` - Your Tako API token
   - `MCP_SERVER_URL` - Your deployed MCP server URL
3. Deploy!

## 📋 Manual Deployment

### Step 1: Get MCP Server URL

You need an MCP server URL. Options:

1. **Use Tako's public MCP server** (if available)
   - Contact Tako for the public MCP server URL
   - Or use: `https://mcp.tako.com` (example)

2. **Deploy your own MCP server**
   - Get the Tako MCP server code separately
   - Deploy to Railway, Render, or Fly.io
   - See Tako's MCP server repository for deployment instructions

### Step 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Clone and setup
git clone <your-repo>
cd tako-mcp-chat

# Deploy
vercel

# Set environment variables
vercel env add TAKO_API_TOKEN
vercel env add MCP_SERVER_URL

# Deploy to production
vercel --prod
```

## 🏗️ Project Structure

```
tako-mcp-chat/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── SimpleTakoChat.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── api/                   # Vercel serverless functions
│   ├── mcp_client.py      # Shared MCP client
│   ├── knowledge_search.py
│   ├── open_chart_ui.py
│   ├── get_card_insights.py
│   └── requirements.txt
├── backend/               # Local development backend (optional)
│   └── mcp_proxy.py       # For local testing only
├── vercel.json            # Vercel configuration
└── README.md              # This file
```

**Note**: This demo connects to a remote Tako MCP server. You'll need to set `MCP_SERVER_URL` to point to Tako's public MCP server or your own deployed instance.

## 🔧 Local Development

### Prerequisites

- Node.js 18+
- Python 3.9+
- Tako API token

### Setup

```bash
# Clone the repository
git clone <your-repo>
cd tako-mcp-chat

# Install frontend dependencies
cd frontend
npm install

# Install API dependencies
cd ../api
pip install -r requirements.txt

# Install MCP server dependencies
cd ../mcp_server
pip install -r requirements.txt
```

### Running Locally

**Option A: Connect to Remote MCP Server (Recommended)**
```bash
# Set environment variables
export TAKO_API_TOKEN="your-api-token"
export MCP_SERVER_URL="https://mcp.tako.com"  # or your deployed MCP server

# Run Vercel dev server
vercel dev
# Runs on http://localhost:3000
```

**Option B: Use Local Backend Proxy (for testing)**
```bash
# Terminal 1 - Run local proxy
cd backend
TAKO_API_TOKEN="your-api-token" \
MCP_SERVER_URL="https://mcp.tako.com" \
python mcp_proxy.py

# Terminal 2 - Run frontend
cd frontend
npm run dev
# Runs on http://localhost:3000
```

## 🌐 Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `TAKO_API_TOKEN` | Your Tako API token | `abc123...` |
| `MCP_SERVER_URL` | URL of deployed MCP server | `https://mcp.example.com` |

### For Production

The MCP server should be configured separately (contact Tako or deploy your own instance).

## 💬 Usage

Once deployed, the chat interface supports these commands:

### Search
```
Search for Intel vs Nvidia
Find climate change data
Show me unemployment rates
```

### Open Charts
```
Open chart 1
Open the first chart
```

### Get Insights
```
Get insights for chart 1
```

## 🏗️ Architecture

```
┌─────────────────┐
│  Vercel Frontend│
│   (React + Vite)│
└────────┬────────┘
         │
         │ /api/mcp/* requests
         ▼
┌─────────────────┐
│Vercel Serverless│
│   Functions     │
│  (Python API)   │
└────────┬────────┘
         │
         │ HTTP requests
         ▼
┌─────────────────┐
│   MCP Server    │
│  (Separate host)│
└────────┬────────┘
         │
         │ REST API
         ▼
┌─────────────────┐
│  Tako Backend   │
└─────────────────┘
```

## 📝 API Endpoints

The Vercel serverless functions provide these endpoints:

- `POST /api/mcp/knowledge_search` - Search Tako charts
- `POST /api/mcp/open_chart_ui` - Get chart UI HTML
- `POST /api/mcp/get_card_insights` - Get AI insights

## 🐛 Troubleshooting

### Frontend shows "500 Internal Server Error"

**Issue**: Serverless function can't connect to MCP server

**Solution**:
- Verify `MCP_SERVER_URL` is set correctly
- Check MCP server is running and accessible
- Check MCP server logs

### Charts don't load properly

**Issue**: MCP server `PUBLIC_BASE_URL` misconfigured

**Solution**:
- Set `PUBLIC_BASE_URL` in MCP server environment
- Should be publicly accessible URL (e.g., `https://tako.com`)

### "Failed to connect to MCP server"

**Issue**: MCP server not responding

**Solution**:
- Check MCP server is deployed and running
- Verify URL in `MCP_SERVER_URL` environment variable
- Check firewall/CORS settings

## 🔐 Security

### For Production:

1. **Environment Variables**: Never commit tokens to git
2. **CORS**: Configure allowed origins in MCP server
3. **Rate Limiting**: Add rate limiting to API endpoints
4. **API Token**: Rotate Tako API token regularly
5. **HTTPS**: Always use HTTPS in production

## 📦 Deployment Checklist

- [ ] Deploy MCP server to Railway/Render/Fly.io
- [ ] Get MCP server public URL
- [ ] Get Tako API token
- [ ] Set Vercel environment variables
- [ ] Deploy to Vercel
- [ ] Test search functionality
- [ ] Test chart loading
- [ ] Verify insights work

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

See Tako's main repository for license information.

## 🔗 Links

- [Tako Website](https://tako.com)
- [Tako API Docs](https://tako.com/docs)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Vercel Documentation](https://vercel.com/docs)

## 💡 Tips

### Optimizing Costs

- Use "fast" search_effort for quicker, cheaper searches
- Cache MCP responses where appropriate
- Set reasonable timeout values

### Improving Performance

- Deploy MCP server geographically close to Tako backend
- Use CDN for static assets
- Minimize serverless function cold starts

### Customization

- Edit `SimpleTakoChat.tsx` for UI changes
- Modify command parsing for different interactions
- Add new serverless functions for additional MCP tools

---

**Built with ❤️ to demonstrate Tako's MCP capabilities**
