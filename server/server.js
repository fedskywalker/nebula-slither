import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import http from 'http';

// Game Constants - match client constants
const MAP_SIZE = 4000;
const INITIAL_SNAKE_LENGTH = 8;
const SEGMENT_DISTANCE = 8;
const BASE_SPEED = 3;
const BOOST_SPEED = 5;
const TURNING_SPEED = 0.1;
const FOOD_COUNT = 800;
const BASE_WIDTH = 15;

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

const NEON_COLORS = [
  '#ff0080', '#00ff80', '#8000ff', '#ff8000',
  '#0080ff', '#80ff00', '#ff0040', '#40ff00'
];

// Server state
const rooms = new Map();
const clients = new Map();

// Helper functions
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

const randomPos = () => {
  const padding = 200;
  return {
    x: randomInt(-MAP_SIZE / 2 + padding, MAP_SIZE / 2 - padding),
    y: randomInt(-MAP_SIZE / 2 + padding, MAP_SIZE / 2 - padding)
  };
};

const createSnake = (id, name, startPos = randomPos()) => {
  const body = [];
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    body.push({ x: startPos.x, y: startPos.y + i * SEGMENT_DISTANCE });
  }
  return {
    id,
    name,
    body,
    angle: -Math.PI / 2,
    targetAngle: -Math.PI / 2,
    speed: BASE_SPEED,
    color: COLORS[randomInt(0, COLORS.length - 1)],
    isBot: false,
    score: 0,
    width: BASE_WIDTH,
    turningSpeed: TURNING_SPEED
  };
};

const createFood = (id) => ({
  id,
  ...randomPos(),
  value: randomInt(1, 3),
  color: NEON_COLORS[randomInt(0, NEON_COLORS.length - 1)],
  radius: randomInt(3, 6)
});

// Room management
const createRoom = (roomId, hostClientId) => {
  const room = {
    id: roomId,
    host: hostClientId,
    players: new Map(),
    snakes: new Map(),
    food: [],
    isStarted: false,
    lastUpdate: Date.now()
  };

  // Initialize food
  for (let i = 0; i < FOOD_COUNT; i++) {
    room.food.push(createFood(`food-${i}`));
  }

  rooms.set(roomId, room);
  return room;
};

const addPlayerToRoom = (roomId, clientId, playerName) => {
  const room = rooms.get(roomId);
  if (!room) return null;

  const player = {
    id: clientId,
    name: playerName,
    isHost: clientId === room.host,
    ready: true,
    lastInput: { angle: 0, boosting: false }
  };

  room.players.set(clientId, player);
  return room;
};

const startGame = (roomId) => {
  const room = rooms.get(roomId);
  if (!room || room.isStarted) return;

  room.isStarted = true;
  room.snakes.clear();

  // Create snakes for all players
  room.players.forEach((player) => {
    room.snakes.set(player.id, createSnake(player.id, player.name));
  });

  // Broadcast game start
  broadcastToRoom(roomId, { type: 'GAME_START' });
  console.log(`Game started in room ${roomId} with ${room.players.size} players`);
};

const updatePhysics = (room) => {
  const snakesToRemove = [];
  const allSnakes = Array.from(room.snakes.values());

  room.snakes.forEach((snake, id) => {
    const player = room.players.get(id);
    if (!player) return;

    const input = player.lastInput;
    let targetAngle = input.angle;
    let boosting = input.boosting;

    // Boost mechanics
    if (boosting && snake.body.length > INITIAL_SNAKE_LENGTH / 2) {
      snake.speed = BOOST_SPEED;
      if (Math.random() < 0.2) {
        const dropped = snake.body.pop();
        if (dropped) {
          room.food.push({
            id: `drop-${Math.random()}`,
            x: dropped.x,
            y: dropped.y,
            value: 1,
            color: snake.color,
            radius: 4
          });
        }
      }
    } else {
      snake.speed = BASE_SPEED;
    }

    // Smooth turning
    let diff = targetAngle - snake.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    if (Math.abs(diff) > snake.turningSpeed) {
      snake.angle += Math.sign(diff) * snake.turningSpeed;
    } else {
      snake.angle = targetAngle;
    }

    // Move head
    const head = snake.body[0];
    const newHead = {
      x: head.x + Math.cos(snake.angle) * snake.speed,
      y: head.y + Math.sin(snake.angle) * snake.speed
    };
    
    // Boundary constraints
    newHead.x = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, newHead.x));
    newHead.y = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, newHead.y));

    snake.body.unshift(newHead);
    
    // Body physics (IK constraint)
    for (let i = 1; i < snake.body.length; i++) {
      const prev = snake.body[i-1];
      const curr = snake.body[i];
      const d = dist(prev, curr);
      const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      if (d > SEGMENT_DISTANCE) {
        curr.x = prev.x + Math.cos(angle) * SEGMENT_DISTANCE;
        curr.y = prev.y + Math.sin(angle) * SEGMENT_DISTANCE;
      }
    }

    // Maintain snake length based on score
    const targetLen = INITIAL_SNAKE_LENGTH + Math.floor(snake.score / 10);
    while (snake.body.length > targetLen) {
      snake.body.pop();
    }

    // Collision detection
    if (checkCollisions(snake, allSnakes, room)) {
      snakesToRemove.push(id);
      killSnake(snake, room);
    }
  });

  // Remove dead snakes
  snakesToRemove.forEach(id => {
    room.snakes.delete(id);
    // Notify client of death
    const client = clients.get(id);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify({ type: 'PLAYER_DIED' }));
    }
  });

  // Food consumption
  room.snakes.forEach(snake => {
    for (let i = room.food.length - 1; i >= 0; i--) {
      const food = room.food[i];
      if (dist(snake.body[0], food) < snake.width + food.radius) {
        snake.score += food.value * 10;
        room.food.splice(i, 1);
        const tail = snake.body[snake.body.length - 1];
        snake.body.push({ ...tail });
      }
    }
  });

  // Replenish food
  if (room.food.length < FOOD_COUNT) {
    if (Math.random() < 0.1) {
      room.food.push(createFood(`food-${Math.random()}`));
    }
  }
};

const checkCollisions = (snake, allSnakes, room) => {
  const head = snake.body[0];
  
  // Wall collision
  if (Math.abs(head.x) >= MAP_SIZE/2 || Math.abs(head.y) >= MAP_SIZE/2) {
    return true;
  }

  // Snake collision
  for (const other of allSnakes) {
    const startIdx = (other.id === snake.id) ? 6 : 0;
    for (let i = startIdx; i < other.body.length; i += 2) {
      if (dist(head, other.body[i]) < snake.width/2 + other.width/2 - 4) {
        return true;
      }
    }
  }
  
  return false;
};

const killSnake = (snake, room) => {
  // Convert snake body to food
  for (let i = 0; i < snake.body.length; i += 2) {
    room.food.push({
      id: `remains-${Math.random()}`,
      x: snake.body[i].x + (Math.random() - 0.5) * 10,
      y: snake.body[i].y + (Math.random() - 0.5) * 10,
      value: 2,
      color: '#ffffff',
      radius: 5
    });
  }
};

const broadcastToRoom = (roomId, message) => {
  const room = rooms.get(roomId);
  if (!room) return;

  room.players.forEach((player) => {
    const client = clients.get(player.id);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  });
};

const broadcastGameState = (room) => {
  const snakeList = Array.from(room.snakes.values());
  
  // Optimize bandwidth by rounding positions
  const optimizedSnakes = snakeList.map(s => ({
    ...s,
    body: s.body.map(p => ({x: Math.round(p.x), y: Math.round(p.y)}))
  }));

  const state = {
    type: 'STATE',
    snakes: optimizedSnakes,
    food: room.food,
    leaderboard: snakeList
      .map(s => ({name: s.name, score: s.score}))
      .sort((a,b) => b.score - a.score)
      .slice(0, 5)
  };

  broadcastToRoom(room.id, state);
};

// HTTP server for health checks and WebSocket
const server = http.createServer((req, res) => {
  // CORS headers for web clients
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK - Nebula Slither Server Running');
  } else if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>🎮 Nebula Slither Server</h1>
          <p>WebSocket server is running!</p>
          <p>Connected rooms: ${rooms.size}</p>
          <p>Active players: ${clients.size}</p>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

server.listen(PORT, HOST, () => {
  console.log(`🎮 Nebula Slither Server started on ${HOST}:${PORT}`);
});

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  
  clients.set(clientId, {
    id: clientId,
    ws: ws,
    room: null,
    playerName: 'Unknown'
  });

  console.log(`Client connected: ${clientId}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      const client = clients.get(clientId);
      
      switch (message.type) {
        case 'CREATE_ROOM':
          const roomId = message.roomId || uuidv4().substring(0, 8);
          const room = createRoom(roomId, clientId);
          client.room = roomId;
          client.playerName = message.playerName || 'Host';
          
          addPlayerToRoom(roomId, clientId, client.playerName);
          
          ws.send(JSON.stringify({
            type: 'ROOM_CREATED',
            roomId: roomId,
            playerId: clientId
          }));
          
          // Send initial lobby state
          const players = Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            ready: p.ready
          }));
          
          ws.send(JSON.stringify({
            type: 'LOBBY_UPDATE',
            players: players
          }));
          break;

        case 'JOIN_ROOM':
          const targetRoomId = message.roomId;
          const joinRoom = rooms.get(targetRoomId);
          
          if (!joinRoom) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
            break;
          }
          
          if (joinRoom.isStarted) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Game already in progress' }));
            break;
          }

          client.room = targetRoomId;
          client.playerName = message.playerName || 'Player';
          
          addPlayerToRoom(targetRoomId, clientId, client.playerName);
          
          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            roomId: targetRoomId,
            playerId: clientId
          }));
          
          // Broadcast updated lobby to all players
          const updatedPlayers = Array.from(joinRoom.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            ready: p.ready
          }));
          
          broadcastToRoom(targetRoomId, {
            type: 'LOBBY_UPDATE',
            players: updatedPlayers
          });
          break;

        case 'START_GAME':
          if (client.room) {
            const gameRoom = rooms.get(client.room);
            if (gameRoom && gameRoom.host === clientId) {
              startGame(client.room);
            }
          }
          break;

        case 'INPUT':
          if (client.room) {
            const inputRoom = rooms.get(client.room);
            if (inputRoom && inputRoom.isStarted) {
              const player = inputRoom.players.get(clientId);
              if (player) {
                player.lastInput = {
                  angle: message.angle,
                  boosting: message.isBoosting
                };
              }
            }
          }
          break;
      }
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  });

  ws.on('close', () => {
    const client = clients.get(clientId);
    if (client && client.room) {
      const room = rooms.get(client.room);
      if (room) {
        room.players.delete(clientId);
        room.snakes.delete(clientId);
        
        if (room.players.size === 0) {
          rooms.delete(client.room);
          console.log(`Room ${client.room} deleted - no players left`);
        } else {
          // Broadcast updated lobby
          const remainingPlayers = Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            ready: p.ready
          }));
          
          broadcastToRoom(client.room, {
            type: 'LOBBY_UPDATE',
            players: remainingPlayers
          });
        }
      }
    }
    
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  });
});

// Game loop - 60fps
setInterval(() => {
  rooms.forEach((room) => {
    if (room.isStarted) {
      updatePhysics(room);
      
      // Broadcast state at 20fps for bandwidth optimization
      const now = Date.now();
      if (now - room.lastUpdate > 50) {
        broadcastGameState(room);
        room.lastUpdate = now;
      }
    }
  });
}, 16.67); // ~60fps

console.log('🚀 Game loop started - running at 60fps, broadcasting at 20fps');