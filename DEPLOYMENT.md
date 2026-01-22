# Deployment Guide

This guide explains how to deploy the Research Canvas application to production.

## Branch Strategy

We use a simple two-branch deployment strategy:

- **`main`** - Development branch
  - Runs CI checks on every push
  - Does not auto-deploy
  - Used for active development and testing

- **`production`** - Production branch
  - **Auto-deploys to production Vercel + Railway**
  - Only merge here when ready for production release
  - Protected branch (requires PR reviews)

## Deployment Workflow

### 1. Development
```bash
# Work on feature branches
git checkout -b feature/my-feature
# ... make changes ...
git push origin feature/my-feature
# Create PR to main
```

### 2. Test on Main
```bash
# Merge PR to main
# Test thoroughly on main branch
# CI runs automatically
```

### 3. Deploy to Production
```bash
# When ready for production, create PR from main to production
git checkout production
git merge main
git push origin production
# Auto-deploys to production!
```

## Required Secrets

Configure these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### Vercel Deployment
- `VERCEL_TOKEN` - Your Vercel API token
  - Get from: https://vercel.com/account/tokens
  - Scopes: Read and Write

### Railway Deployment (for Python Agent)
- `RAILWAY_TOKEN` - Your Railway API token
  - Get from: https://railway.app/account/tokens
  - Project access required

### Environment Variables

Set these in your Vercel project settings:
- `OPENAI_API_KEY` - OpenAI API key
- `TAVILY_API_KEY` - Tavily API key for web search
- `TAKO_API_TOKEN` - (Optional) Data source API token
- `TAKO_MCP_URL` - (Optional) MCP server URL
- `TAKO_URL` - (Optional) Data source base URL

Set these in your Railway project settings:
- `OPENAI_API_KEY` - OpenAI API key
- `TAVILY_API_KEY` - Tavily API key
- `TAKO_API_TOKEN` - (Optional) Data source API token
- `TAKO_MCP_URL` - (Optional) MCP server URL
- `PORT` - Set to `2024`

## Manual Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### Deploy to Railway

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login
railway login

# Link to project
railway link

# Deploy
cd agents/python
railway up
```

## Branch Protection Rules

Recommended settings for the `production` branch:

1. **Require pull request reviews** - At least 1 approval
2. **Require status checks** - Must pass CI before merge
3. **Require branches to be up to date** - Ensure latest code
4. **Include administrators** - Apply rules to everyone
5. **Restrict who can push** - Only maintainers

To configure:
1. Go to repository Settings → Branches
2. Add branch protection rule for `production`
3. Enable the above settings

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing in CI
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Changes tested locally and on main branch
- [ ] Breaking changes documented
- [ ] Database migrations applied (if any)
- [ ] Third-party services configured

## Rollback Procedure

If something goes wrong in production:

### Vercel Rollback
```bash
# Via dashboard
# 1. Go to Deployments
# 2. Find previous working deployment
# 3. Click "Promote to Production"

# Via CLI
vercel rollback
```

### Railway Rollback
```bash
# Via dashboard
# 1. Go to Deployments
# 2. Select previous deployment
# 3. Click "Redeploy"
```

### Git Rollback
```bash
# Revert to previous commit
git revert HEAD
git push origin production
# This triggers new deployment with reverted code
```

## Monitoring

### Vercel
- **Analytics**: https://vercel.com/dashboard/analytics
- **Logs**: `vercel logs <deployment-url>`
- **Real-time**: Vercel Dashboard → Deployments → Logs

### Railway
- **Logs**: Railway Dashboard → Service → Logs
- **Metrics**: Railway Dashboard → Service → Metrics
- **Alerts**: Configure in Railway Dashboard

## Continuous Improvement

### Performance Monitoring
- Monitor Core Web Vitals in Vercel Analytics
- Track API response times
- Monitor error rates

### Security Updates
- Review and update dependencies monthly
- Run `npm audit` and fix vulnerabilities
- Keep Python dependencies up to date

### Cost Optimization
- Monitor Vercel bandwidth usage
- Review Railway resource usage
- Optimize API calls and caching

## Troubleshooting

### Deployment Fails

**Problem**: Vercel deployment fails with build error

**Solution**:
```bash
# Test build locally first
npm run build

# Check build logs in Vercel dashboard
# Verify environment variables are set
```

**Problem**: Railway deployment fails

**Solution**:
```bash
# Check Railway logs
railway logs

# Verify Python dependencies
cd agents/python
pip install -r requirements.txt

# Test locally
python main.py
```

### Environment Variables Not Working

**Problem**: App can't access environment variables

**Solution**:
- Verify variables are set in deployment platform
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new variables
- For Vercel: Use `NEXT_PUBLIC_` prefix for client-side vars

## Support

- **Vercel Issues**: [Vercel Discord](https://vercel.com/discord)
- **Railway Issues**: [Railway Discord](https://discord.gg/railway)
- **GitHub Actions**: [Actions Documentation](https://docs.github.com/en/actions)

---

**Last Updated**: 2026-01-22
