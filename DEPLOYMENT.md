# Deployment Guide - Tako MCP Chat

This guide walks you through deploying the Tako MCP Chat demo to Vercel and other platforms.

## Architecture Overview

The app consists of three parts:
1. **Frontend** (React) - Deployed on Vercel
2. **API** (Serverless Functions) - Deployed on Vercel
3. **MCP Server** (Python) - Deployed separately (Railway, Render, Fly.io)

## Step-by-Step Deployment

### Part 1: Deploy MCP Server

The MCP server must be deployed first as the API functions need its URL.

#### Option A: Railway (Recommended)

Railway offers easy Python deployments with good free tier.

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Deploy MCP server
cd mcp_server
railway up

# The deployment URL will be shown (e.g., https://xxx.up.railway.app)
```

**Set Environment Variables in Railway Dashboard:**
1. Go to your project dashboard
2. Click "Variables"
3. Add:
   - `DJANGO_BASE_URL` = `https://tako.com` (or your Tako backend URL)
   - `PUBLIC_BASE_URL` = `https://tako.com`

#### Option B: Render

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your Git repository
4. Configure:
   - **Name**: `tako-mcp-server`
   - **Root Directory**: `mcp_server`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
5. Add environment variables:
   - `DJANGO_BASE_URL` = `https://tako.com`
   - `PUBLIC_BASE_URL` = `https://tako.com`
6. Click "Create Web Service"

#### Option C: Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
cd mcp_server
fly launch --name tako-mcp-server

# Set environment variables
fly secrets set DJANGO_BASE_URL=https://tako.com
fly secrets set PUBLIC_BASE_URL=https://tako.com

# Deploy
fly deploy
```

**Save your MCP Server URL** - you'll need it for Vercel!

### Part 2: Deploy to Vercel

#### Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your Git repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `pip install -r api/requirements.txt && cd frontend && npm install`

5. Add Environment Variables:
   - `TAKO_API_TOKEN` = Your Tako API token
   - `MCP_SERVER_URL` = Your MCP server URL from Part 1

6. Click "Deploy"

#### Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (from project root)
vercel

# Add environment variables
vercel env add TAKO_API_TOKEN production
vercel env add MCP_SERVER_URL production

# Deploy to production
vercel --prod
```

### Part 3: Verify Deployment

1. Visit your Vercel deployment URL
2. Try searching: "Search for Tesla stock"
3. Open a chart from the results
4. Verify the chart loads properly

If something doesn't work, check the troubleshooting section below.

## Environment Variables Reference

### Vercel (Frontend + API)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `TAKO_API_TOKEN` | Yes | Your Tako API token | `abc123...` |
| `MCP_SERVER_URL` | Yes | Deployed MCP server URL | `https://your-app.up.railway.app` |

### MCP Server

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DJANGO_BASE_URL` | Yes | Tako backend URL | `http://localhost:8000` |
| `PUBLIC_BASE_URL` | Yes | Public URL for embeds | `http://localhost:8000` |

## Troubleshooting

### Issue: "Failed to connect to MCP server"

**Cause**: Vercel can't reach your MCP server

**Solutions**:
1. Verify MCP server is deployed and accessible
2. Check `MCP_SERVER_URL` environment variable in Vercel
3. Test MCP server directly: `curl https://your-mcp-server.com/health`
4. Check MCP server logs for errors

### Issue: "500 Internal Server Error" on API calls

**Cause**: Serverless function error

**Solutions**:
1. Check Vercel function logs
2. Verify all dependencies are in `api/requirements.txt`
3. Check Python version compatibility (Vercel uses Python 3.9)
4. Test locally with `vercel dev`

### Issue: Charts display but are blank/white

**Cause**: CORS or embed URL issues

**Solutions**:
1. Check `PUBLIC_BASE_URL` is set correctly in MCP server
2. Verify Tako backend is accessible
3. Check browser console for CORS errors
4. Ensure `DJANGO_BASE_URL` points to actual Tako backend

### Issue: Charts not sized properly

**Cause**: CSS or iframe sizing issues

**Solutions**:
1. Check browser console for errors
2. Verify the chart iframe is loading
3. Try hard refresh (Cmd+Shift+R)
4. Check if `tako::resize` postMessage events are being sent

## Performance Optimization

### Reduce Cold Starts

Vercel serverless functions can have cold starts. To minimize:

1. **Keep functions warm**:
   - Set up a cron job to ping your API every 5 minutes
   - Use Vercel's Edge Functions for lower latency

2. **Optimize function size**:
   - Only import required dependencies
   - Keep `requirements.txt` minimal

### Caching

Add caching to reduce API calls:

```python
# In your serverless function
from functools import lru_cache

@lru_cache(maxsize=128)
def get_chart_data(pub_id):
    # Your logic here
    pass
```

### CDN

Vercel automatically uses CDN for static assets, but you can optimize further:

1. Enable compression in `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, s-maxage=3600"
        }
      ]
    }
  ]
}
```

## Monitoring

### Vercel Analytics

Enable Vercel Analytics in your dashboard for:
- Page views
- API endpoint usage
- Error tracking
- Performance metrics

### Custom Logging

Add logging to serverless functions:

```python
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(request):
    logger.info(f"Request received: {request.path}")
    # Your logic
```

View logs: `vercel logs <deployment-url>`

## Scaling

### Vercel Limits (Hobby Plan)

- **Bandwidth**: 100GB/month
- **Function Execution**: 100 hours/month
- **Function Duration**: 10 seconds max
- **Deployments**: Unlimited

### Upgrade Path

If you exceed limits:
1. Upgrade to Vercel Pro ($20/month)
2. Move heavy operations to dedicated server
3. Implement aggressive caching
4. Use Edge Functions for better limits

## Security Best Practices

1. **Never commit secrets**
   - Use `.env.example` for templates
   - Add `.env` to `.gitignore`

2. **Rotate API tokens**
   - Update `TAKO_API_TOKEN` regularly
   - Use different tokens for dev/prod

3. **CORS Configuration**
   - Restrict origins in production
   - Don't use `*` for `Access-Control-Allow-Origin`

4. **Rate Limiting**
   - Implement rate limiting on API endpoints
   - Use Vercel's built-in protection

5. **Input Validation**
   - Validate all user inputs
   - Sanitize query parameters
   - Check for SQL injection attempts

## Cost Estimates

### Vercel (Hobby Plan - Free)
- Perfect for demos and low-traffic apps
- 100GB bandwidth/month
- 100 hours function execution/month

### Railway (Starter - $5/month)
- 512MB RAM
- Shared CPU
- $5 credit included
- Pay for usage after credit

### Render (Free Tier)
- Apps spin down after 15min inactive
- Slow cold starts
- Good for demos

### Recommended Setup for Production

- **Frontend**: Vercel Pro ($20/month)
- **MCP Server**: Railway Starter ($5/month)
- **Total**: ~$25/month

## Maintenance

### Regular Tasks

1. **Weekly**:
   - Check error logs
   - Monitor usage metrics
   - Review API token usage

2. **Monthly**:
   - Update dependencies
   - Review and optimize slow endpoints
   - Check for security updates

3. **Quarterly**:
   - Rotate API tokens
   - Review and optimize costs
   - Update documentation

### Updating Dependencies

```bash
# Frontend
cd frontend
npm update
npm audit fix

# API
cd api
pip list --outdated
pip install --upgrade package-name

# MCP Server
cd mcp_server
pip list --outdated
pip install --upgrade package-name
```

## Rollback Procedure

If a deployment fails:

```bash
# Via Vercel dashboard
# Go to Deployments → Find working deployment → Promote to Production

# Via CLI
vercel rollback
```

## Support

- **Vercel Issues**: [Vercel Discord](https://vercel.com/discord)
- **Tako Issues**: [Tako Support](https://tako.com/support)
- **MCP Protocol**: [MCP Docs](https://modelcontextprotocol.io/)

---

**Happy Deploying! 🚀**
