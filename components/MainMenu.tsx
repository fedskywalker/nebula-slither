
import React, { useState } from 'react';
import { generateSnakeName } from '../services/geminiService';
import { NetworkMode } from '../types';

interface MainMenuProps {
  onStart: (name: string, mode: NetworkMode, roomId?: string) => void;
  initialRoomId?: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onStart, initialRoomId = '' }) => {
  const [name, setName] = useState('CosmicWorm');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [manualRoomId, setManualRoomId] = useState('');

  const handleGenerateName = async () => {
    setIsLoading(true);
    const newName = await generateSnakeName();
    setName(newName);
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (initialRoomId) {
      // Auto-join from URL
      onStart(name, 'CLIENT', initialRoomId);
    } else {
      // Manual selection
      if (activeTab === 'create') {
        onStart(name, 'HOST');
      } else {
        if (manualRoomId.trim()) {
          onStart(name, 'CLIENT', manualRoomId.trim());
        }
      }
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-95 z-50">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 max-w-md w-full relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-75"></div>

        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 text-center mb-8">
          NEBULA SLITHER
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-slate-400 text-sm font-medium mb-2">
              Operator Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={15}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                placeholder="Enter name..."
              />
              <button
                type="button"
                onClick={handleGenerateName}
                disabled={isLoading}
                className="bg-slate-700 hover:bg-slate-600 text-cyan-400 p-3 rounded-lg border border-slate-600 transition disabled:opacity-50"
                title="Generate AI Name"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    <path d="M5 4a1 1 0 00-1 1v1h1V5a1 1 0 00-1-1zm0 10h1v1a1 1 0 00-1 1 1 1 0 00-1-1v-1zM15 4a1 1 0 00-1 1v1h1V5a1 1 0 00-1-1zm0 10h1v1a1 1 0 00-1 1 1 1 0 00-1-1v-1z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {!initialRoomId && (
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-2 text-sm font-bold rounded transition ${activeTab === 'create' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                CREATE ROOM
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`flex-1 py-2 text-sm font-bold rounded transition ${activeTab === 'join' ? 'bg-cyan-900/50 text-cyan-400 shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                JOIN ROOM
              </button>
            </div>
          )}

          {initialRoomId ? (
             <div className="bg-cyan-900/30 border border-cyan-800 p-3 rounded text-center animate-pulse">
              <p className="text-cyan-400 text-sm font-bold">Joining Private Room...</p>
            </div>
          ) : activeTab === 'join' ? (
             <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">
                  Room ID
                </label>
                <input
                  type="text"
                  value={manualRoomId}
                  onChange={(e) => setManualRoomId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition font-mono"
                  placeholder="Paste ID here (e.g. 1234-abcd)"
                />
             </div>
          ) : (
            <div className="text-center text-slate-400 text-sm py-2">
              You will be the Host. Share your Room ID or Link with friends after starting.
            </div>
          )}

          <button
            type="submit"
            disabled={activeTab === 'join' && !manualRoomId && !initialRoomId}
            className={`w-full font-bold py-3 px-4 rounded-lg shadow-lg transform transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              activeTab === 'create' && !initialRoomId
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white'
            }`}
          >
            {initialRoomId || activeTab === 'join' ? 'ENTER GAME' : 'START SERVER'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
          <p className="text-slate-500 text-xs">
            Controls: Mouse to steer. Hold click to boost.
          </p>
        </div>
      </div>
    </div>
  );
};
