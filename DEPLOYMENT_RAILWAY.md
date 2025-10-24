# 🚂 Deploy GymSage to Railway (FREE)

Railway.app is **better than Render** - no sleep, faster, and easier!

## 🎯 Why Railway?

✅ **$5 free credit/month** (enough for backend + analyzer)  
✅ **No sleep** - stays awake 24/7 (unlike Render)  
✅ **Faster cold starts** than Render  
✅ **Better uptime** and reliability  
✅ **Automatic detection** of Node.js & Python  
✅ **Simple deployment** from GitHub  

---

## 🚀 Quick Deploy (5 Minutes)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Ready for Railway deployment"
git remote add origin https://github.com/YOUR_USERNAME/gymsage.git
git push -u origin main
```

### Step 2: Deploy Backend to Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `gymsage` repository
5. Railway will ask what to deploy:
   - Select **"backend"** directory

6. **Add Environment Variables** (click service → Variables):
   ```
   OPENAI_API_KEY=sk-proj-tll6zxmFr41YXR5NxwXu...
   SUPABASE_URL=https://huvuhuadutudukyplsji.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   JWT_SECRET=AHQWgAlIkwK+jyjNTpFoIeKl8X1xa8Wkxox3WGaUpeaDW6PEEqv8It39zlSmKn...
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://gymsage-XXXXX.vercel.app
   ANALYZER_URL=https://gymsage-analyzer.up.railway.app
   ```

7. **Deploy** - Railway auto-detects Node.js and runs `npm install` + `node server.js`

Your backend will be live at: `https://gymsage-backend.up.railway.app` ✅

### Step 3: Deploy Analyzer to Railway

1. In Railway dashboard, click **"New"** → **"GitHub Repo"**
2. Select your `gymsage` repository again
3. This time select **"analyzer"** directory
4. Railway auto-detects Python!
5. **No environment variables needed** for analyzer
6. **Deploy**

Your analyzer will be live at: `https://gymsage-analyzer.up.railway.app` ✅

### Step 4: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your `gymsage` repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework**: Create React App
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. **Add Environment Variables**:
   ```
   REACT_APP_API_URL=https://gymsage-backend.up.railway.app/api
   REACT_APP_ANALYZER_URL=https://gymsage-analyzer.up.railway.app
   ```

6. **Deploy**

Your frontend will be live at: `https://gymsage-XXXXX.vercel.app` ✅

### Step 5: Update Backend FRONTEND_URL

1. Go back to Railway dashboard
2. Click your **backend service** → **Variables**
3. Update `FRONTEND_URL` to your Vercel URL:
   ```
   FRONTEND_URL=https://gymsage-XXXXX.vercel.app
   ```
4. Service will auto-redeploy

---

## 🎉 Done!

Your app is now deployed and running 24/7 with **NO SLEEP**!

- **App**: `https://gymsage-XXXXX.vercel.app`
- **Backend**: `https://gymsage-backend.up.railway.app`
- **Analyzer**: `https://gymsage-analyzer.up.railway.app`

---

## 💰 Cost Breakdown

| Service | Cost |
|---------|------|
| **Railway** | $0 (within $5 credit) |
| **Vercel** | $0 (free tier) |
| **Supabase** | $0 (free tier) |
| **OpenAI API** | ~$1-5/month |

**Total: ~$1-5/month** (only OpenAI usage)

---

## 📊 Railway Free Tier Details

- **$5 credit/month**
- **500 hours execution** (enough for 2 services 24/7)
- **100GB outbound bandwidth**
- **No sleep** - always on!
- **Automatic HTTPS**
- **Custom domains** (optional)

Your app uses:
- Backend: ~$2/month
- Analyzer: ~$1/month
- **Total: ~$3/month** (within $5 credit) ✅

---

## 🔧 Railway Configuration Files

Railway auto-detects your setup, but you can customize with these files:

### Backend: `backend/railway.json` (Optional)
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Analyzer: `analyzer/railway.json` (Optional)
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health"
  }
}
```

But Railway works **perfectly without these files** - it auto-detects everything!

---

## 🎯 Alternative: Split Deployment

If you want to use multiple free tiers:

**Option A: Railway (Backend) + Fly.io (Analyzer)**
- Backend on Railway ($0 - within credit)
- Analyzer on Fly.io ($0 - free tier)
- Frontend on Vercel ($0 - free tier)

**Option B: Cyclic (Backend) + Railway (Analyzer)**
- Backend on Cyclic ($0 - unlimited Node.js)
- Analyzer on Railway ($0 - within credit)
- Frontend on Vercel ($0 - free tier)

**Option C: All on Railway**
- Everything on Railway ($0 - within $5 credit)
- Simplest option! ✅

---

## 🚦 Monitoring & Logs

**Railway Dashboard:**
- View real-time logs
- Monitor CPU/RAM usage
- Check deployment history
- See bandwidth usage

**Health Checks:**
- Backend: `https://your-backend.up.railway.app/api/health`
- Analyzer: `https://your-analyzer.up.railway.app/health`

---

## 🐛 Troubleshooting

### Backend can't connect to Supabase
- Check `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Verify no extra spaces in environment variables

### Frontend can't reach backend
- Check `REACT_APP_API_URL` includes `/api` at the end
- Verify CORS is configured with your Vercel URL

### Analyzer not responding
- Check logs in Railway dashboard
- Verify Python dependencies installed correctly
- Test health endpoint: `/health`

### Hit Railway $5 limit
- Reduce number of services (deploy analyzer to Fly.io free tier)
- Optimize backend (use compression, reduce logging)
- Upgrade to Railway Hobby plan ($5/month for $5 credit + overages)

---

## 🔥 Pro Tips

### 1. Custom Domains (Optional)
Railway supports custom domains for free:
- `api.yourapp.com` → Backend
- `analyzer.yourapp.com` → Analyzer

### 2. Database Monitoring
Use Supabase dashboard to monitor:
- Database size (500MB free)
- Storage usage (1GB free)
- API requests

### 3. Cost Optimization
- Enable compression in backend (`app.use(compression())`)
- Resize images before upload in frontend
- Use Supabase Edge Functions for simple tasks (free)

### 4. Backup Strategy
- Supabase has automatic backups
- Export your data regularly
- Keep `.env` backed up securely

---

## 🆚 Railway vs Render Comparison

| Feature | Railway | Render |
|---------|---------|--------|
| **Free Credit** | $5/month | $0 |
| **Sleep** | ❌ Never | ✅ After 15 min |
| **Cold Start** | < 1 second | 30-50 seconds |
| **Uptime** | 99.9% | 95% (free tier) |
| **Deployment** | Instant | 3-5 minutes |
| **Logs** | Real-time | Delayed |
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Winner: Railway** 🏆

---

## 📚 Additional Resources

- [Railway Docs](https://docs.railway.app/)
- [Railway Templates](https://railway.app/templates)
- [Railway Discord](https://discord.gg/railway)
- [Railway Pricing](https://railway.app/pricing)

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Railway account created
- [ ] Backend deployed with env vars
- [ ] Analyzer deployed
- [ ] Frontend deployed to Vercel
- [ ] Environment URLs updated
- [ ] Health checks passing
- [ ] Test user registration
- [ ] Test voice recording
- [ ] Test photo upload
- [ ] Test AI coach
- [ ] Share your app! 🎉

---

**Railway makes deployment simple, fast, and FREE!** 🚂✨

