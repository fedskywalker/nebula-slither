# 🚄 Railway Deployment - FASTEST OPTION

Railway is the quickest way to deploy your game with zero config needed.

## Step 1: Prepare for Deployment

First, let's create the necessary deployment files:

### Create railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server/server.js",
    "healthcheckPath": "/health"
  }
}
```

### Update server.js for production
Add this health check endpoint to your server.js:

```javascript
// Add this to your WebSocket server
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Update WebSocket server to use the HTTP server
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Nebula Slither Server started on port ${PORT}`);
});
```

## Step 2: Deploy to Railway

1. **Sign up at [railway.app](https://railway.app)** (free tier gives you $5/month)

2. **Connect your GitHub** (create a repo first):
   ```bash
   cd /Users/roger/Downloads/nebula-slither
   git init
   git add .
   git commit -m "Initial WebSocket server"
   # Push to GitHub
   ```

3. **Deploy with one click**:
   - Click "Deploy from GitHub repo"
   - Select your repo
   - Railway auto-detects Node.js and deploys!

4. **Get your WebSocket URL**:
   - Railway gives you: `wss://your-app.railway.app`

## Step 3: Update Client

Update the WebSocket URL in your client:

```typescript
// In websocketService.ts
export class GameWebSocketService {
  constructor(private serverUrl: string = 'wss://your-app.railway.app') {}
  // ... rest of code
}
```

## Step 4: Deploy Client

**Option A: Vercel (Recommended)**
```bash
npm install -g vercel
vercel --prod
```

**Option B: Netlify**
```bash
npm run build
# Upload dist/ folder to netlify.com
```

## Total Time: ~10 minutes
## Cost: FREE (Railway $5 credit, Vercel free tier)

Your friends can play at: `https://your-game.vercel.app`