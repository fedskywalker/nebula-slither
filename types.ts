
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export type NetworkMode = 'SINGLE' | 'HOST' | 'CLIENT';

export interface Point {
  x: number;
  y: number;
}

export interface Snake {
  id: string;
  name: string;
  body: Point[];
  angle: number; // in radians
  targetAngle: number;
  speed: number;
  color: string;
  isBot: boolean;
  score: number;
  width: number;
  turningSpeed: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
  radius: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
}

// Network Payloads
export interface ClientInput {
  type: 'INPUT';
  angle: number;
  isBoosting: boolean;
  name?: string; 
}

export interface WorldState {
  type: 'STATE';
  snakes: Snake[]; 
  food: Food[];    
  leaderboard: {name: string, score: number}[];
}

export interface GameInitPayload {
  type: 'INIT';
  playerId: string;
  mapSize: number;
}

export interface LobbyUpdatePayload {
  type: 'LOBBY_UPDATE';
  players: PlayerProfile[];
}

export interface GameStartPayload {
  type: 'GAME_START';
}
