
import React, { useRef, useEffect, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { 
  MAP_SIZE, INITIAL_SNAKE_LENGTH, SEGMENT_DISTANCE, BASE_SPEED, 
  BOOST_SPEED, TURNING_SPEED, FOOD_COUNT, COLORS, NEON_COLORS, BASE_WIDTH 
} from '../constants';
import { Snake, Point, Food, Particle, NetworkMode, ClientInput, WorldState, GameInitPayload, LobbyUpdatePayload, GameStartPayload, PlayerProfile } from '../types';

interface GameCanvasProps {
  playerName: string;
  onGameOver: (score: number, kills: number) => void;
  networkMode: NetworkMode;
  targetRoomId?: string;
}

// Helper: Distance between two points
const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

// Helper: Random int
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper: Random position on map (Safe Zone)
const randomPos = (): Point => {
  const padding = 200; // Keep away from edges to prevent instant death
  return {
    x: randomInt(-MAP_SIZE / 2 + padding, MAP_SIZE / 2 - padding),
    y: randomInt(-MAP_SIZE / 2 + padding, MAP_SIZE / 2 - padding)
  };
};

// Helper: Create a snake
const createSnake = (id: string, name: string, isBot: boolean, startPos: Point = randomPos()): Snake => {
  const body: Point[] = [];
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
    isBot,
    score: 0,
    width: BASE_WIDTH,
    turningSpeed: TURNING_SPEED
  };
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ playerName, onGameOver, networkMode, targetRoomId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs
  const snakesRef = useRef<Map<string, Snake>>(new Map());
  const foodRef = useRef<Food[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Point[]>([]); 
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const isBoostingRef = useRef<boolean>(false);
  const killCountRef = useRef<number>(0);
  
  // Network Refs
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const clientInputsRef = useRef<Map<string, {angle: number, boosting: boolean}>>(new Map());
  const myPlayerIdRef = useRef<string>(networkMode === 'HOST' ? 'host' : 'pending'); 
  
  // Lobby State
  const [isLobby, setIsLobby] = useState(true);
  const isLobbyRef = useRef(true); // Ref to track lobby state inside stable closures
  const [lobbyPlayers, setLobbyPlayers] = useState<PlayerProfile[]>([]);
  const lobbyPlayersRef = useRef<PlayerProfile[]>([]); // Sync ref for logic
  const [hostRoomId, setHostRoomId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('Initializing Network...');

  // HUD State
  const [currentScore, setCurrentScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number}[]>([]);

  // Initialize Game Logic
  useEffect(() => {
    // 1. Setup Stars (Visuals)
    starsRef.current = [];
    for (let i = 0; i < 1500; i++) {
      starsRef.current.push({
        x: randomInt(-MAP_SIZE, MAP_SIZE),
        y: randomInt(-MAP_SIZE, MAP_SIZE)
      });
    }

    // 2. Setup Network
    if (networkMode === 'HOST') {
      const peer = new Peer();
      peerRef.current = peer;

      // Host is always first in lobby
      const hostProfile = { id: 'host', name: playerName, isHost: true, ready: true };
      setLobbyPlayers([hostProfile]);
      lobbyPlayersRef.current = [hostProfile];

      peer.on('open', (id) => {
        setHostRoomId(id);
        setConnectionStatus('Waiting for players...');
      });

      peer.on('connection', (conn) => {
        conn.on('open', () => {
          const playerId = `peer-${conn.peer}`;
          connectionsRef.current.set(playerId, conn);
          
          // Send Init
          const initPayload: GameInitPayload = {
             type: 'INIT',
             playerId: playerId,
             mapSize: MAP_SIZE
          };
          conn.send(initPayload);
        });

        conn.on('data', (data: any) => {
           if (data.type === 'INPUT') {
             const input = data as ClientInput;
             const playerId = `peer-${conn.peer}`;
             
             // If receiving input during lobby, it's a handshake/profile update
             if (input.name) {
                setLobbyPlayers(prev => {
                  const exists = prev.find(p => p.id === playerId);
                  let newList;
                  if (exists) {
                    newList = prev.map(p => p.id === playerId ? { ...p, name: input.name || 'Unknown' } : p);
                  } else {
                    newList = [...prev, { id: playerId, name: input.name || 'Joining...', isHost: false, ready: true }];
                  }
                  lobbyPlayersRef.current = newList; // Sync Ref
                  
                  // Broadcast new lobby state immediately
                  const update: LobbyUpdatePayload = { type: 'LOBBY_UPDATE', players: newList };
                  connectionsRef.current.forEach(c => c.open && c.send(update));
                  
                  return newList;
                });
             }

             // Store input for game loop
             clientInputsRef.current.set(playerId, {
               angle: input.angle,
               boosting: input.isBoosting
             });
           }
        });

        conn.on('close', () => {
           const playerId = `peer-${conn.peer}`;
           connectionsRef.current.delete(playerId);
           snakesRef.current.delete(playerId);
           setLobbyPlayers(prev => {
              const newList = prev.filter(p => p.id !== playerId);
              lobbyPlayersRef.current = newList;
              // Broadcast drop
              const update: LobbyUpdatePayload = { type: 'LOBBY_UPDATE', players: newList };
              connectionsRef.current.forEach(c => c.open && c.send(update));
              return newList;
           });
        });
      });
    } 
    else if (networkMode === 'CLIENT' && targetRoomId) {
      const peer = new Peer();
      peerRef.current = peer;
      
      peer.on('open', () => {
        setConnectionStatus('Connecting to Server...');
        const conn = peer.connect(targetRoomId);
        
        conn.on('open', () => {
          setConnectionStatus('In Lobby');
          connectionsRef.current.set('host', conn);
          
          // Send handshake with name
          const handshake: ClientInput = { type: 'INPUT', angle: 0, isBoosting: false, name: playerName };
          conn.send(handshake);
        });

        conn.on('data', (data: any) => {
          if (data.type === 'INIT') {
            const init = data as GameInitPayload;
            myPlayerIdRef.current = init.playerId;
          } 
          else if (data.type === 'LOBBY_UPDATE') {
             const payload = data as LobbyUpdatePayload;
             setLobbyPlayers(payload.players);
          }
          else if (data.type === 'GAME_START') {
            setIsLobby(false);
            isLobbyRef.current = false;
          }
          else if (data.type === 'STATE') {
             const state = data as WorldState;
             foodRef.current = state.food;
             setLeaderboard(state.leaderboard);
             
             // Sync Snakes with basic interpolation
             const receivedSnakes = new Map<string, Snake>();
             state.snakes.forEach(s => receivedSnakes.set(s.id, s));
             
             // Update local snakes
             snakesRef.current = receivedSnakes;
             
             const mySnake = receivedSnakes.get(myPlayerIdRef.current);
             if (mySnake) setCurrentScore(mySnake.score);
             
             // Death check on client side: If we aren't in lobby, have an ID, but snake is missing in state
             if (myPlayerIdRef.current !== 'pending' && !isLobbyRef.current && !mySnake) {
                // Check if we ever had a snake? For now, instant death.
                // Wait for at least one frame of state before killing to avoid race condition
                if (state.snakes.length > 0) {
                   onGameOver(currentScore, 0); 
                }
             }
          }
        });
        
        conn.on('close', () => {
          setConnectionStatus('Disconnected from Host');
          if (!isLobbyRef.current) onGameOver(currentScore, 0);
        });
        
        conn.on('error', (err) => {
           console.error("Peer Error:", err);
           setConnectionStatus('Connection Failed. Room might be full or closed.');
        });
      });
    }

    // 3. Animation Loop
    let lastTime = 0;
    const animate = (timestamp: number) => {
      // Send Input (Client side)
      if (networkMode === 'CLIENT' && !isLobbyRef.current) {
        const conn = connectionsRef.current.get('host');
        if (conn && conn.open) {
          const targetAngle = Math.atan2(mouseRef.current.y, mouseRef.current.x);
          const input: ClientInput = {
            type: 'INPUT',
            angle: targetAngle,
            isBoosting: isBoostingRef.current
          };
          conn.send(input);
        }
      }

      // Physics (Host side)
      if (networkMode !== 'CLIENT' && !isLobbyRef.current) {
        updatePhysics();
        
        // Broadcast State - Tick rate limited to 20fps for bandwidth optimization
        if (timestamp - lastTime > 50) { 
           broadcastState();
           lastTime = timestamp;
        }
      }

      if (!isLobbyRef.current) {
        draw();
      }
      
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      if (peerRef.current) peerRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps ensures connection survives lobby->game transition

  // --- ACTIONS ---

  const handleStartGame = () => {
    if (networkMode === 'HOST') {
      // Initialize World
      snakesRef.current.clear();
      foodRef.current = [];
      
      // Spawn snakes for all lobby players using REF to ensure latest list
      lobbyPlayersRef.current.forEach(p => {
         snakesRef.current.set(p.id, createSnake(p.id, p.name, false));
      });

      // Spawn Food
      for (let i = 0; i < FOOD_COUNT; i++) {
        foodRef.current.push({
          id: `food-${i}`,
          ...randomPos(),
          value: randomInt(1, 3),
          color: NEON_COLORS[randomInt(0, NEON_COLORS.length - 1)],
          radius: randomInt(3, 6)
        });
      }

      // Notify Clients
      const startMsg: GameStartPayload = { type: 'GAME_START' };
      connectionsRef.current.forEach(c => c.open && c.send(startMsg));
      
      setIsLobby(false);
      isLobbyRef.current = false;
    }
  };

  const broadcastState = () => {
    const snakeList: Snake[] = Array.from(snakesRef.current.values());
    
    // Optimization: Round values to integer to save bandwidth
    const optimizedSnakes = snakeList.map(s => ({
      ...s,
      body: s.body.map(p => ({x: Math.round(p.x), y: Math.round(p.y)}))
    }));

    const state: WorldState = {
      type: 'STATE',
      snakes: optimizedSnakes,
      food: foodRef.current, // Food doesn't move, maybe optimize later
      leaderboard: snakeList.map(s => ({name: s.name, score: s.score})).sort((a,b) => b.score - a.score).slice(0, 5)
    };
    
    connectionsRef.current.forEach(conn => {
      if (conn.open) conn.send(state);
    });
    setLeaderboard(state.leaderboard);
  };

  const updatePhysics = () => {
    const snakesToRemove: string[] = [];
    const allSnakes: Snake[] = Array.from(snakesRef.current.values());

    snakesRef.current.forEach((snake, id) => {
      let targetAngle = snake.angle;
      let boosting = false;

      if (id === 'host') {
        targetAngle = Math.atan2(mouseRef.current.y, mouseRef.current.x);
        boosting = isBoostingRef.current;
      } else if (clientInputsRef.current.has(id)) {
        const input = clientInputsRef.current.get(id)!;
        targetAngle = input.angle;
        boosting = input.boosting;
      }

      if (boosting && snake.body.length > INITIAL_SNAKE_LENGTH / 2) {
        snake.speed = BOOST_SPEED;
        if (Math.random() < 0.2) {
          const dropped = snake.body.pop();
          if (dropped) {
            foodRef.current.push({
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

      // Move Head
      let diff = targetAngle - snake.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      if (Math.abs(diff) > snake.turningSpeed) {
        snake.angle += Math.sign(diff) * snake.turningSpeed;
      } else {
        snake.angle = targetAngle;
      }

      const head = snake.body[0];
      const newHead = {
        x: head.x + Math.cos(snake.angle) * snake.speed,
        y: head.y + Math.sin(snake.angle) * snake.speed
      };
      
      newHead.x = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, newHead.x));
      newHead.y = Math.max(-MAP_SIZE/2, Math.min(MAP_SIZE/2, newHead.y));

      snake.body.unshift(newHead);
      
      // IK Constraint for body
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

      const targetLen = INITIAL_SNAKE_LENGTH + Math.floor(snake.score / 10);
      while (snake.body.length > targetLen) {
        snake.body.pop();
      }

      // Check Death
      if (checkCollisions(snake, allSnakes)) {
         killSnake(snake);
         snakesToRemove.push(id);
         if (id === 'host') onGameOver(Math.floor(snake.score), killCountRef.current);
      }
    });

    snakesToRemove.forEach(id => snakesRef.current.delete(id));

    // Eat Food
    snakesRef.current.forEach(snake => {
      for (let i = foodRef.current.length - 1; i >= 0; i--) {
        const f = foodRef.current[i];
        if (dist(snake.body[0], f) < snake.width + f.radius) {
          snake.score += f.value * 10;
          foodRef.current.splice(i, 1);
          const tail = snake.body[snake.body.length - 1];
          snake.body.push({ ...tail });
        }
      }
    });

    // Replenish Food
    if (foodRef.current.length < FOOD_COUNT) {
      if (Math.random() < 0.1) {
         foodRef.current.push({
           id: `food-${Math.random()}`,
           ...randomPos(),
           value: randomInt(1, 3),
           color: NEON_COLORS[randomInt(0, NEON_COLORS.length - 1)],
           radius: randomInt(3, 6)
         });
      }
    }
    
    const mySnake = snakesRef.current.get('host');
    if (mySnake) setCurrentScore(mySnake.score);
  };

  const checkCollisions = (snake: Snake, allSnakes: Snake[]): boolean => {
    const head = snake.body[0];
    if (Math.abs(head.x) >= MAP_SIZE/2 || Math.abs(head.y) >= MAP_SIZE/2) return true;

    for (const other of allSnakes) {
      const startIdx = (other.id === snake.id) ? 6 : 0;
      for (let i = startIdx; i < other.body.length; i += 2) {
        if (dist(head, other.body[i]) < snake.width/2 + other.width/2 - 4) {
          if (other.id === 'host' && snake.id !== 'host') killCountRef.current += 1;
          return true;
        }
      }
    }
    return false;
  };

  const killSnake = (snake: Snake) => {
    for (let i = 0; i < snake.body.length; i+=2) {
      foodRef.current.push({
        id: `remains-${Math.random()}`,
        x: snake.body[i].x + (Math.random()-0.5)*10,
        y: snake.body[i].y + (Math.random()-0.5)*10,
        value: 2,
        color: '#ffffff',
        radius: 5
      });
    }
    for(let i=0; i<10; i++) {
      particlesRef.current.push({
        x: snake.body[0].x, y: snake.body[0].y,
        vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
        life: 1.0, color: snake.color
      });
    }
  };

  // --- DRAWING ---
  const handleMouseMove = (e: React.MouseEvent) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    mouseRef.current = { x: e.clientX - centerX, y: e.clientY - centerY };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let mySnake = snakesRef.current.get(myPlayerIdRef.current);
    
    // Camera Logic: Follow own snake, OR follow leader (spectate), OR center
    let camX = 0, camY = 0;
    
    if (mySnake && mySnake.body.length > 0) {
       camX = canvas.width / 2 - mySnake.body[0].x;
       camY = canvas.height / 2 - mySnake.body[0].y;
    } else {
       // Spectator Mode: Find the biggest snake
       const allSnakes: Snake[] = Array.from(snakesRef.current.values());
       if (allSnakes.length > 0) {
         const leader = allSnakes.reduce((prev, current) => (prev.score > current.score) ? prev : current);
         if (leader && leader.body.length > 0) {
            camX = canvas.width / 2 - leader.body[0].x;
            camY = canvas.height / 2 - leader.body[0].y;
            // Draw "Spectating" text later
         }
       }
    }

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.translate(camX, camY);

    // Stars
    ctx.fillStyle = '#cbd5e1';
    // Only draw stars visible in viewport to save perf
    const playerX = mySnake ? mySnake.body[0].x : -camX + canvas.width/2;
    const playerY = mySnake ? mySnake.body[0].y : -camY + canvas.height/2;
    
    starsRef.current.forEach(star => {
      // Parallax effect
      const px = star.x;
      const py = star.y;
      if (Math.abs(px - playerX) < canvas.width && Math.abs(py - playerY) < canvas.height) {
        const size = (star.x + star.y) % 3 === 0 ? 2 : 1;
        ctx.fillRect(px, py, size, size);
      }
    });

    // Borders
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 10;
    ctx.strokeRect(-MAP_SIZE/2, -MAP_SIZE/2, MAP_SIZE, MAP_SIZE);

    // Food
    foodRef.current.forEach(f => {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Snakes
    snakesRef.current.forEach(s => {
       ctx.lineCap = 'round';
       ctx.lineJoin = 'round';
       ctx.lineWidth = s.width;
       ctx.strokeStyle = s.id === myPlayerIdRef.current ? '#ffffff' : s.color; // Highlight self
       // Draw Outline
       ctx.shadowBlur = 10;
       ctx.shadowColor = s.color;
       ctx.beginPath();
       if (s.body.length > 0) {
          ctx.moveTo(s.body[0].x, s.body[0].y);
          for(let i=1; i<s.body.length; i++) ctx.lineTo(s.body[i].x, s.body[i].y);
       }
       ctx.stroke();
       ctx.shadowBlur = 0;
       
       // Inner Color
       ctx.lineWidth = s.width - 4;
       ctx.strokeStyle = s.color;
       ctx.stroke();

       // Name
       ctx.fillStyle = 'white';
       ctx.font = 'bold 12px sans-serif';
       ctx.textAlign = 'center';
       ctx.fillText(s.name, s.body[0].x, s.body[0].y - 20);
    });

    ctx.restore();
    
    // Spectator HUD
    if (!mySnake && !isLobby && myPlayerIdRef.current !== 'pending') {
       ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
       ctx.font = 'bold 24px sans-serif';
       ctx.textAlign = 'center';
       ctx.fillText("SPECTATING", canvas.width / 2, 50);
    }
  };

  if (isLobby) {
    return (
      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 max-w-2xl w-full">
           <div className="text-center mb-8">
             <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">WAITING ROOM</h2>
             <p className="text-slate-400">
               {networkMode === 'HOST' ? 'You are the Host. Share the Room ID.' : 'Waiting for Host to start the game...'}
             </p>
           </div>

           <div className="flex gap-8 mb-8">
             {/* Info Panel */}
             <div className="flex-1 space-y-4">
                <div className="bg-black/30 p-4 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Room ID</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-black/50 p-2 rounded text-cyan-400 font-mono text-lg text-center">
                      {hostRoomId || targetRoomId || '...'}
                    </code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(hostRoomId || targetRoomId || '')}
                      className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-white font-bold"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="bg-black/30 p-4 rounded-lg border border-slate-700">
                   <p className="text-sm text-slate-400 mb-1">Status</p>
                   <div className="flex items-center gap-2">
                     <span className={`w-3 h-3 rounded-full ${connectionStatus.includes('Wait') || connectionStatus.includes('In Lobby') ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                     <span className="text-white font-medium">{connectionStatus}</span>
                   </div>
                </div>
             </div>

             {/* Player List */}
             <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700 p-4 min-h-[200px]">
               <h3 className="text-slate-400 text-xs font-bold uppercase mb-3 flex justify-between">
                 <span>Players Connected</span>
                 <span>{lobbyPlayers.length}</span>
               </h3>
               <ul className="space-y-2">
                 {lobbyPlayers.map(p => (
                   <li key={p.id} className="flex items-center gap-3 bg-slate-800 p-2 rounded border border-slate-700">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.isHost ? 'bg-purple-600 text-white' : 'bg-cyan-600 text-white'}`}>
                       {p.name.charAt(0).toUpperCase()}
                     </div>
                     <span className="text-white font-medium flex-1 truncate">{p.name}</span>
                     {p.isHost && <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded">HOST</span>}
                   </li>
                 ))}
                 {lobbyPlayers.length === 0 && <li className="text-slate-600 text-sm italic">Connecting...</li>}
               </ul>
             </div>
           </div>

           {networkMode === 'HOST' && (
             <button 
               onClick={handleStartGame}
               disabled={lobbyPlayers.length < 1}
               className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-xl font-bold py-4 rounded-xl shadow-lg transform transition hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed"
             >
               START MATCH
             </button>
           )}
           
           {networkMode === 'CLIENT' && (
              <div className="text-center py-4 text-slate-500 animate-pulse">
                Host will start the game soon...
              </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={() => isBoostingRef.current = true}
        onMouseUp={() => isBoostingRef.current = false}
        className="block w-full h-full cursor-crosshair touch-none"
      />
      
      {/* Game HUD */}
      <div className="absolute top-4 left-4 text-white select-none pointer-events-none">
        <div className="bg-slate-800/80 p-3 rounded-lg backdrop-blur border border-slate-600 shadow-xl">
           <h3 className="text-xs text-slate-400 font-bold uppercase">Mass</h3>
           <p className="text-2xl font-mono text-cyan-400">{Math.floor(currentScore)}</p>
        </div>
      </div>

      <div className="absolute top-4 right-4 text-white select-none w-48 pointer-events-none">
        <div className="bg-slate-800/80 p-3 rounded-lg backdrop-blur border border-slate-600 shadow-xl">
           <h3 className="text-xs text-slate-400 font-bold uppercase mb-2 border-b border-slate-700 pb-1">Leaderboard</h3>
           <ul>
             {leaderboard.map((entry, idx) => (
               <li key={idx} className="flex justify-between text-sm py-0.5">
                 <span className={entry.name === playerName ? "text-cyan-400 font-bold" : "text-slate-300"}>
                   {idx + 1}. {entry.name.slice(0, 10)}
                 </span>
                 <span className="text-slate-500">{Math.floor(entry.score)}</span>
               </li>
             ))}
           </ul>
        </div>
      </div>
    </>
  );
};
