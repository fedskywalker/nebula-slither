#!/bin/bash

echo "🚀 Nebula Slither - Cloud Deployment Script"
echo "==========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Initialize git if needed
if [ ! -d ".git" ]; then
    echo "📁 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Nebula Slither WebSocket game"
fi

echo ""
echo "Choose deployment option:"
echo "1) 🚄 Railway (Fastest - Zero Config)"
echo "2) ⚡ Render (Free tier available)" 
echo "3) 📱 Vercel (Frontend + Railway Backend)"
echo "4) 🔧 Manual setup instructions"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "🚄 Railway Deployment Selected"
        echo ""
        echo "Steps:"
        echo "1. Visit: https://railway.app"
        echo "2. Sign up with GitHub"
        echo "3. Click 'Deploy from GitHub repo'"
        echo "4. Select this repository"
        echo "5. Railway will auto-deploy!"
        echo ""
        echo "Your server will be available at: https://your-app.railway.app"
        echo "WebSocket URL: wss://your-app.railway.app"
        ;;
    2)
        echo "⚡ Render Deployment Selected"
        echo ""
        echo "Steps:"
        echo "1. Push code to GitHub"
        echo "2. Visit: https://render.com"
        echo "3. Connect GitHub and select repo"
        echo "4. Choose 'Web Service'"
        echo "5. Set build command: 'cd server && npm install'"
        echo "6. Set start command: 'node server/server.js'"
        echo ""
        ;;
    3)
        echo "📱 Vercel + Railway Setup"
        echo ""
        echo "Backend (Railway):"
        echo "1. Follow Railway steps above for server"
        echo ""
        echo "Frontend (Vercel):"
        echo "1. Install Vercel CLI: npm install -g vercel"
        echo "2. Run: vercel --prod"
        echo "3. Follow prompts"
        echo ""
        if command -v vercel &> /dev/null; then
            read -p "Deploy frontend now? (y/n): " deploy_frontend
            if [ "$deploy_frontend" = "y" ]; then
                echo "🚀 Deploying frontend..."
                vercel --prod
            fi
        else
            echo "Install Vercel CLI first: npm install -g vercel"
        fi
        ;;
    4)
        echo "🔧 Manual Setup Instructions"
        echo ""
        echo "Server Deployment (Choose one):"
        echo "- Railway: https://railway.app (Recommended)"
        echo "- Render: https://render.com" 
        echo "- DigitalOcean: https://digitalocean.com"
        echo "- AWS/Google Cloud/Azure"
        echo ""
        echo "Frontend Deployment (Choose one):"
        echo "- Vercel: https://vercel.com (Recommended)"
        echo "- Netlify: https://netlify.com"
        echo "- GitHub Pages"
        echo ""
        echo "Environment Variables:"
        echo "- Server: PORT (auto-detected)"
        echo "- Client: VITE_WS_URL (optional, auto-detects)"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "📋 Next Steps After Deployment:"
echo "1. Test server health: visit https://your-domain/health"
echo "2. Update WebSocket URL if needed"
echo "3. Share game URL with friends!"
echo "4. Monitor in browser dev tools for connection status"
echo ""
echo "🎮 Happy gaming!"