import React from 'react';
import { GameMode } from '../types';

interface StartScreenProps {
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  onStart: () => void;
  isSimulating: boolean;
  errorMsg: string | null;
}

const StartScreen: React.FC<StartScreenProps> = ({ 
  selectedMode, 
  onSelectMode, 
  onStart, 
  isSimulating, 
  errorMsg 
}) => {
  return (
    <div className="min-h-screen bg-retro-bg text-retro-text flex flex-col items-center justify-center p-4 font-mono">
      <h1 className="text-6xl text-retro-accent mb-4 font-bold tracking-tighter">八卦稻香村</h1>
      <h2 className="text-2xl mb-8 text-stone-500 uppercase tracking-widest">Gossip Village</h2>
      
      {/* Mode Selection */}
      <div className="flex flex-col space-y-2 mb-8 w-64">
           <label className="text-xs text-stone-500">选择游戏模式</label>
           {(['Matchmaker', 'Detective', 'Chaos', 'Sandbox'] as GameMode[]).map(mode => (
               <button 
                  key={mode}
                  onClick={() => onSelectMode(mode)}
                  className={`py-2 border-2 text-sm uppercase ${selectedMode === mode ? 'border-retro-accent text-retro-accent' : 'border-stone-700 text-stone-600'}`}
               >
                  {mode === 'Matchmaker' && '红娘模式'}
                  {mode === 'Detective' && '侦探模式'}
                  {mode === 'Chaos' && '混乱模式'}
                  {mode === 'Sandbox' && '沙盒模式'}
               </button>
           ))}
      </div>

      <div className="max-w-md text-center text-sm space-y-4 mb-8 text-stone-400">
          <p>你是观察者。</p>
          <p>几位身份背景各异的江湖侠士居住在稻香村中。他们有秘密。他们各有目的。他们……</p>
          <p>你的目标是操控他们的现实。</p>
      </div>

      {errorMsg && <div className="text-retro-red mb-4 border border-retro-red p-2">{errorMsg}</div>}

      <button 
          onClick={onStart}
          disabled={isSimulating}
          className="px-8 py-4 bg-retro-panel border-2 border-retro-accent text-retro-accent hover:bg-retro-accent hover:text-retro-bg transition-all font-bold text-lg disabled:opacity-50"
      >
          {isSimulating ? '正在生成世界...' : '进入稻香村'}
      </button>
    </div>
  );
};

export default StartScreen;