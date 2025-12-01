#!/bin/bash

echo "🎮 Starting Nebula Slither WebSocket Server & Client..."

# Kill any existing processes on the ports
echo "📡 Cleaning up existing processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Wait a moment for cleanup
sleep 2

# Start server in background
echo "🚀 Starting WebSocket server on port 8080..."
cd server
npm install
npm run dev &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to initialize..."
sleep 3

# Go back to main directory and start client
cd ..
echo "🌐 Starting client on port 5173..."
npm install
npm run dev &
CLIENT_PID=$!

echo ""
echo "✅ Game started successfully!"
echo "📊 Server running on: ws://localhost:8080"
echo "🎯 Client running on: http://localhost:5173"
echo ""
echo "To stop the game, press Ctrl+C"
echo ""

# Wait for user to stop
wait $CLIENT_PID $SERVER_PID