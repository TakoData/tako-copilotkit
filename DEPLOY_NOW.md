# Deploy to Vercel - Quick Guide

## Fastest Method: Vercel CLI (2 minutes)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
# Opens browser to login/signup
```

### Step 3: Deploy
```bash
cd /Users/robertabbott/Desktop/tako-copilotkit
vercel
```

**What happens:**
- Vercel detects Vite project automatically
- Asks a few setup questions (just press Enter for defaults)
- Deploys to a preview URL
- Takes ~1-2 minutes

### Step 4: Set Environment Variables
```bash
# Set Tako API token
vercel env add TAKO_API_TOKEN

# When prompted:
# - Environment: Production, Preview, Development (select all 3)
# - Value: paste your API token

# Set MCP server URL
vercel env add MCP_SERVER_URL

# When prompted:
# - Environment: Production, Preview, Development (select all 3)
# - Value: https://mcp.tako.com (or your MCP server URL)
```

### Step 5: Deploy to Production
```bash
vercel --prod
```

**Done!** Your app is live at the URL shown.

---

## Alternative: GitHub + Vercel Dashboard

If you prefer using the dashboard:

### Step 1: Push to GitHub
```bash
cd /Users/robertabbott/Desktop/tako-copilotkit

# Initialize and commit
git add .
git commit -m "Initial commit: Tako MCP Chat"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/tako-mcp-chat.git
git push -u origin main
```

### Step 2: Import to Vercel
1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your `tako-mcp-chat` repo
4. Framework Preset: **Vite** (auto-detected)
5. Root Directory: `./` (leave as is)
6. Click **"Deploy"** (yes, even without env vars!)

### Step 3: Add Environment Variables
After first deployment:
1. Go to your project settings
2. Click "Environment Variables"
3. Add:
   - `TAKO_API_TOKEN` = your API token
   - `MCP_SERVER_URL` = https://mcp.tako.com (or your server)
4. Click "Redeploy" to apply

---

## Environment Variables You Need

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `TAKO_API_TOKEN` | Your API token | https://tako.com/account |
| `MCP_SERVER_URL` | MCP server URL | Contact Tako or use public server |

---

## Testing Your Deployment

Once deployed:

1. **Visit your Vercel URL** (shown after deployment)
2. **Try searching**: "Search for Tesla stock"
3. **Click a result** to open the chart
4. **Verify chart loads** properly

---

## Troubleshooting

### "Failed to connect to MCP server"
- Check `MCP_SERVER_URL` is correct
- Verify MCP server is running: `curl https://mcp.tako.com/health`

### "500 Internal Server Error"
- Check Vercel function logs (click on deployment → Functions tab)
- Verify both environment variables are set

### Charts don't load
- Check browser console for errors
- Verify CORS is configured on MCP server
- Try hard refresh: Cmd+Shift+R

---

## Quick Commands Reference

```bash
# Deploy preview
vercel

# Deploy production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Open project in browser
vercel open
```

---

**Ready to deploy? Run:** `vercel`
