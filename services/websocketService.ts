export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ServerMessage extends WebSocketMessage {
  type: 'ROOM_CREATED' | 'ROOM_JOINED' | 'LOBBY_UPDATE' | 'GAME_START' | 'STATE' | 'PLAYER_DIED' | 'ERROR';
}

export interface ClientMessage extends WebSocketMessage {
  type: 'CREATE_ROOM' | 'JOIN_ROOM' | 'START_GAME' | 'INPUT';
}

export class GameWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers = new Map<string, (data: any) => void>();
  private isConnected = false;

  constructor(private serverUrl: string = GameWebSocketService.getDefaultServerUrl()) {}

  private static getDefaultServerUrl(): string {
    // Auto-detect environment
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'ws://localhost:8080';
      } else {
        // Production - assume same domain
        return `${protocol}//${hostname}${window.location.port ? ':' + window.location.port : ''}`;
      }
    }
    return 'ws://localhost:8080';
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to game server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: ServerMessage = JSON.parse(event.data);
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message);
            } else {
              console.log('Unhandled message:', message);
            }
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('Disconnected from game server');
          this.isConnected = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (!this.isConnected) {
            reject(new Error('Failed to connect to game server'));
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(() => {
          // Reconnect failed, will try again if under limit
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
      const handler = this.messageHandlers.get('CONNECTION_LOST');
      if (handler) handler({});
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(message: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  removeMessageHandler(type: string) {
    this.messageHandlers.delete(type);
  }

  createRoom(playerName: string, roomId?: string) {
    this.send({
      type: 'CREATE_ROOM',
      playerName,
      roomId
    });
  }

  joinRoom(roomId: string, playerName: string) {
    this.send({
      type: 'JOIN_ROOM',
      roomId,
      playerName
    });
  }

  startGame() {
    this.send({
      type: 'START_GAME'
    });
  }

  sendInput(angle: number, isBoosting: boolean) {
    this.send({
      type: 'INPUT',
      angle,
      isBoosting
    });
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      default: return 'disconnected';
    }
  }
}