import React, { useRef, useEffect, useState } from 'react';
import { 
  MAP_SIZE, INITIAL_SNAKE_LENGTH, SEGMENT_DISTANCE, BASE_SPEED, 
  BOOST_SPEED, TURNING_SPEED, FOOD_COUNT, COLORS, NEON_COLORS, BASE_WIDTH 
} from '../constants';
import { Snake, Point, Food, Particle, NetworkMode, PlayerProfile } from '../types';
import { GameWebSocketService } from '../services/websocketService';

interface GameCanvasProps {
  playerName: string;
  onGameOver: (score: number, kills: number) => void;
  networkMode: NetworkMode;
  targetRoomId?: string;
}

export const GameCanvasWebSocket: React.FC<GameCanvasProps> = ({ 
  playerName, 
  onGameOver, 
  networkMode, 
  targetRoomId 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const isBoostingRef = useRef<boolean>(false);
  const wsServiceRef = useRef<GameWebSocketService | null>(null);
  const myPlayerIdRef = useRef<string>('');
  
  // Game State
  const snakesRef = useRef<Map<string, Snake>>(new Map());
  const foodRef = useRef<Food[]>([]);
  const starsRef = useRef<Point[]>([]);
  
  // UI State
  const [isLobby, setIsLobby] = useState(true);
  const [lobbyPlayers, setLobbyPlayers] = useState<PlayerProfile[]>([]);
  const [hostRoomId, setHostRoomId] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  const [currentScore, setCurrentScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<{name: string, score: number}[]>([]);
  const [error, setError] = useState<string>('');

  // Initialize WebSocket and game
  useEffect(() => {
    const init = async () => {
      // Initialize stars
      starsRef.current = [];
      for (let i = 0; i < 1500; i++) {
        starsRef.current.push({
          x: Math.floor(Math.random() * MAP_SIZE * 2) - MAP_SIZE,
          y: Math.floor(Math.random() * MAP_SIZE * 2) - MAP_SIZE
        });
      }

      // Initialize WebSocket
      const wsService = new GameWebSocketService();
      wsServiceRef.current = wsService;

      try {
        await wsService.connect();
        setConnectionStatus('Connected');

        // Set up message handlers
        wsService.onMessage('ROOM_CREATED', (data) => {
          setHostRoomId(data.roomId);
          myPlayerIdRef.current = data.playerId;
          setConnectionStatus('Hosting - Waiting for players...');
        });

        wsService.onMessage('ROOM_JOINED', (data) => {
          setHostRoomId(data.roomId);
          myPlayerIdRef.current = data.playerId;
          setConnectionStatus('In Lobby');
        });

        wsService.onMessage('LOBBY_UPDATE', (data) => {
          setLobbyPlayers(data.players);
        });

        wsService.onMessage('GAME_START', () => {
          setIsLobby(false);
          setConnectionStatus('Game Started');
        });

        wsService.onMessage('STATE', (data) => {
          // Update game state from server
          foodRef.current = data.food;
          setLeaderboard(data.leaderboard);
          
          const receivedSnakes = new Map<string, Snake>();
          data.snakes.forEach((s: Snake) => receivedSnakes.set(s.id, s));
          snakesRef.current = receivedSnakes;
          
          const mySnake = receivedSnakes.get(myPlayerIdRef.current);
          if (mySnake) {
            setCurrentScore(mySnake.score);
          }
        });

        wsService.onMessage('PLAYER_DIED', () => {
          onGameOver(currentScore, 0);
        });

        wsService.onMessage('ERROR', (data) => {
          setError(data.message);
          setConnectionStatus(`Error: ${data.message}`);
        });

        wsService.onMessage('CONNECTION_LOST', () => {
          setConnectionStatus('Connection Lost');
          setError('Lost connection to server');
        });

        // Start appropriate mode
        if (networkMode === 'HOST') {
          wsService.createRoom(playerName, targetRoomId);
        } else if (networkMode === 'CLIENT' && targetRoomId) {
          wsService.joinRoom(targetRoomId, playerName);
        }

      } catch (error) {
        console.error('Failed to connect:', error);
        setConnectionStatus('Connection Failed');
        setError('Failed to connect to game server');
      }
    };

    init();

    // Game loop
    const animate = () => {
      // Send input to server if connected and in game
      if (wsServiceRef.current && !isLobby) {
        const targetAngle = Math.atan2(mouseRef.current.y, mouseRef.current.x);
        wsServiceRef.current.sendInput(targetAngle, isBoostingRef.current);
      }

      if (!isLobby) {
        draw();
      }
      
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartGame = () => {
    if (networkMode === 'HOST' && wsServiceRef.current) {
      wsServiceRef.current.startGame();
    }
  };

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
    
    // Camera Logic
    let camX = canvas.width / 2, camY = canvas.height / 2;
    
    if (mySnake && mySnake.body.length > 0) {
      camX = canvas.width / 2 - mySnake.body[0].x;
      camY = canvas.height / 2 - mySnake.body[0].y;
    } else {
      // Spectator mode - follow leader
      const allSnakes = Array.from(snakesRef.current.values());
      if (allSnakes.length > 0) {
        const leader = allSnakes.reduce((prev, current) => 
          (prev.score > current.score) ? prev : current
        );
        if (leader && leader.body.length > 0) {
          camX = canvas.width / 2 - leader.body[0].x;
          camY = canvas.height / 2 - leader.body[0].y;
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
    const playerX = mySnake ? mySnake.body[0].x : -camX + canvas.width/2;
    const playerY = mySnake ? mySnake.body[0].y : -camY + canvas.height/2;
    
    starsRef.current.forEach(star => {
      const px = star.x;
      const py = star.y;
      if (Math.abs(px - playerX) < canvas.width && Math.abs(py - playerY) < canvas.height) {
        const size = (star.x + star.y) % 3 === 0 ? 2 : 1;
        ctx.fillRect(px, py, size, size);
      }
    });

    // Map borders
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
      ctx.strokeStyle = s.id === myPlayerIdRef.current ? '#ffffff' : s.color;
      
      // Glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      if (s.body.length > 0) {
        ctx.moveTo(s.body[0].x, s.body[0].y);
        for(let i = 1; i < s.body.length; i++) {
          ctx.lineTo(s.body[i].x, s.body[i].y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Inner color
      ctx.lineWidth = s.width - 4;
      ctx.strokeStyle = s.color;
      ctx.stroke();

      // Name
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      if (s.body.length > 0) {
        ctx.fillText(s.name, s.body[0].x, s.body[0].y - 20);
      }
    });

    ctx.restore();
    
    // Spectator indicator
    if (!mySnake && !isLobby) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("SPECTATING", canvas.width / 2, 50);
    }
  };

  if (error) {
    return (
      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-900/50 border border-red-500 p-8 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Connection Error</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded text-white font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLobby) {
    return (
      <div className="absolute inset-0 bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
              WAITING ROOM
            </h2>
            <p className="text-slate-400">
              {networkMode === 'HOST' ? 'You are hosting. Share the Room ID.' : 'Waiting for host to start...'}
            </p>
          </div>

          <div className="flex gap-8 mb-8">
            {/* Room Info */}
            <div className="flex-1 space-y-4">
              <div className="bg-black/30 p-4 rounded-lg border border-slate-700">
                <label className="text-xs text-slate-500 font-bold uppercase block mb-1">Room ID</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-black/50 p-2 rounded text-cyan-400 font-mono text-lg text-center">
                    {hostRoomId || '...'}
                  </code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(hostRoomId)}
                    className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-white font-bold"
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="bg-black/30 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${
                    connectionStatus.includes('Waiting') || connectionStatus.includes('Lobby') 
                      ? 'bg-green-500 animate-pulse' 
                      : connectionStatus.includes('Error')
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}></span>
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
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      p.isHost ? 'bg-purple-600 text-white' : 'bg-cyan-600 text-white'
                    }`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-medium flex-1 truncate">{p.name}</span>
                    {p.isHost && <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded">HOST</span>}
                  </li>
                ))}
                {lobbyPlayers.length === 0 && (
                  <li className="text-slate-600 text-sm italic">Connecting...</li>
                )}
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

      {/* Connection indicator */}
      <div className="absolute bottom-4 left-4 text-white select-none pointer-events-none">
        <div className="bg-slate-800/80 p-2 rounded-lg backdrop-blur border border-slate-600 shadow-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            WebSocket Connected
          </div>
        </div>
      </div>
    </>
  );
};