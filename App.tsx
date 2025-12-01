
import React, { useState, useCallback, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { MainMenu } from './components/MainMenu';
import { GameOver } from './components/GameOver';
import { GameState, NetworkMode } from './types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [playerName, setPlayerName] = useState<string>('Player 1');
  const [finalScore, setFinalScore] = useState<number>(0);
  const [killCount, setKillCount] = useState<number>(0);
  
  // Multiplayer State
  const [networkMode, setNetworkMode] = useState<NetworkMode>('SINGLE');
  const [roomId, setRoomId] = useState<string>(''); // For joining
  
  useEffect(() => {
    // Check URL for room code only on load
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomId(room);
      // Don't auto-start, just let MainMenu handle the pre-fill
    }
  }, []);

  const startGame = useCallback((name: string, mode: NetworkMode = 'SINGLE', targetRoom?: string) => {
    setPlayerName(name);
    setNetworkMode(mode);
    if (targetRoom) {
      setRoomId(targetRoom);
    }
    setGameState(GameState.PLAYING);
  }, []);

  const endGame = useCallback((score: number, kills: number) => {
    setFinalScore(score);
    setKillCount(kills);
    setGameState(GameState.GAME_OVER);
  }, []);

  const resetGame = useCallback(() => {
    setGameState(GameState.MENU);
    setNetworkMode('SINGLE');
    setRoomId('');
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 text-white font-sans selection:bg-cyan-500 selection:text-black">
      {gameState === GameState.MENU && (
        <MainMenu 
          onStart={startGame} 
          initialRoomId={roomId}
        />
      )}

      {gameState === GameState.PLAYING && (
        <GameCanvas 
          playerName={playerName} 
          onGameOver={endGame} 
          networkMode={networkMode}
          targetRoomId={roomId}
        />
      )}

      {gameState === GameState.GAME_OVER && (
        <GameOver 
          score={finalScore} 
          kills={killCount} 
          playerName={playerName}
          onRestart={resetGame} 
        />
      )}
    </div>
  );
}
