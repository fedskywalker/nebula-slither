import React, { useEffect, useState } from 'react';
import { generateGameOverCommentary } from '../services/geminiService';

interface GameOverProps {
  score: number;
  kills: number;
  playerName: string;
  onRestart: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({ score, kills, playerName, onRestart }) => {
  const [commentary, setCommentary] = useState<string>('Analyzing battle data...');

  useEffect(() => {
    let mounted = true;
    const fetchCommentary = async () => {
      const text = await generateGameOverCommentary(score, kills, playerName);
      if (mounted) {
        setCommentary(text);
      }
    };
    fetchCommentary();
    return () => { mounted = false; };
  }, [score, kills, playerName]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-95 z-50 animate-fade-in">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-red-500/30 max-w-lg w-full text-center">
        <h2 className="text-5xl font-black text-white mb-2 tracking-tighter">GAME OVER</h2>
        <div className="h-1 w-24 bg-red-500 mx-auto mb-6 rounded-full"></div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-sm uppercase tracking-wider">Mass Collected</p>
            <p className="text-3xl font-bold text-cyan-400">{Math.floor(score)}</p>
          </div>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-sm uppercase tracking-wider">Rivals Defeated</p>
            <p className="text-3xl font-bold text-rose-500">{kills}</p>
          </div>
        </div>

        <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 mb-8 min-h-[5rem] flex items-center justify-center">
          <p className="text-slate-200 italic font-medium">"{commentary}"</p>
        </div>

        <button
          onClick={onRestart}
          className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform transition hover:scale-[1.02]"
        >
          RESPAWN
        </button>
      </div>
    </div>
  );
};