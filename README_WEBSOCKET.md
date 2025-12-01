# Nebula Slither - WebSocket Multiplayer

## Overview

This game now supports both **P2P (PeerJS)** and **WebSocket** multiplayer modes. The WebSocket mode provides much better performance and stability for multiplayer games.

## Performance Improvements

### Why WebSocket is Better Than P2P:
1. **Centralized Authority**: Server handles all game logic, preventing cheating
2. **Better Performance**: No need to synchronize between multiple peers
3. **Lower Latency**: Direct connection to server instead of peer routing
4. **More Reliable**: No dependency on peer connectivity issues
5. **Scalable**: Server can handle many players efficiently

## Quick Start

### 1. Install Dependencies

**Client:**
```bash
npm install
```

**Server:**
```bash
cd server
npm install
```

### 2. Start the Server

```bash
# From the server directory
npm run dev
```

The server will start on `ws://localhost:8080`

### 3. Start the Client

```bash
# From the main directory
npm run dev
```

The client will be available at `http://localhost:5173`

### 4. Play Multiplayer

1. Open the game in your browser
2. **WebSocket mode is enabled by default** (much better performance!)
3. Click "CREATE ROOM" to host a game
4. Share the Room ID with friends
5. Friends join using "JOIN ROOM" with your Room ID
6. Host clicks "START MATCH" when ready

## Architecture

### WebSocket Server Features:
- **Room Management**: Create and join game rooms
- **Real-time Physics**: 60fps server-side game simulation
- **State Synchronization**: Optimized 20fps client updates
- **Automatic Cleanup**: Rooms auto-delete when empty
- **Connection Handling**: Reconnection attempts and error handling

### Client Features:
- **Seamless Integration**: Same UI for both P2P and WebSocket modes
- **Real-time Rendering**: Smooth 60fps client-side rendering
- **Input Optimization**: Efficient input sending to server
- **Visual Indicators**: Connection status and mode indicators

## Development

### Server Scripts:
```bash
npm run server      # Start server in development mode (auto-restart)
npm run server:start # Start server in production mode
```

### Testing:
1. Start the server first
2. Open multiple browser tabs/windows
3. Create room in one tab, join from others
4. Test gameplay with multiple players

### Server Configuration:
- Default port: `8080`
- Game tick rate: `60fps`
- Network broadcast rate: `20fps` (for bandwidth optimization)
- Room cleanup: Automatic when empty

## Troubleshooting

### Common Issues:

**Connection Failed:**
- Make sure the server is running on port 8080
- Check if another service is using the port
- Try refreshing the browser

**Game Lag:**
- WebSocket mode should have minimal lag
- If using P2P mode, switch to WebSocket for better performance
- Check your network connection

**Can't Join Room:**
- Ensure Room ID is correct
- Make sure the host hasn't started the game yet
- Try creating a new room

## File Structure

```
nebula-slither/
├── server/
│   ├── package.json        # Server dependencies
│   └── server.js           # WebSocket game server
├── services/
│   └── websocketService.ts # Client WebSocket service
├── components/
│   ├── GameCanvas.tsx      # Original P2P component
│   └── GameCanvasWebSocket.tsx # New WebSocket component
└── App.tsx                 # Updated app with mode selection
```

## Performance Comparison

| Feature | P2P Mode | WebSocket Mode |
|---------|----------|----------------|
| Latency | High (peer routing) | Low (direct server) |
| Reliability | Medium (peer issues) | High (dedicated server) |
| Cheating Prevention | None | Server authority |
| Scalability | Limited (bandwidth) | High (optimized) |
| Setup Complexity | None | Requires server |

**Recommendation**: Use WebSocket mode for the best gaming experience!