
import React, { useState } from 'react';
import { GameMode } from '../types';
import SupportModal from './SupportModal';
import { APP_CONFIG } from '../config/appConfig';

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
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-retro-bg text-retro-text flex flex-col items-center justify-center p-4 font-mono relative">
      
      {/* Support Button (Top Right) */}
      <button 
        onClick={() => setIsSupportOpen(true)}
        className="absolute top-4 right-4 px-3 py-1 border border-retro-accent text-retro-accent text-xs font-bold hover:bg-retro-accent hover:text-retro-bg transition-colors flex items-center gap-2"
      >
        <span>💖</span> 支持开发者
      </button>

      <h1 className="text-6xl text-retro-accent mb-4 font-bold tracking-tighter">{APP_CONFIG.NAME}</h1>
      <h2 className="text-2xl mb-8 text-stone-500 uppercase tracking-widest">{APP_CONFIG.NAME_EN}</h2>
      
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

      {/* Version Footer */}
      <div className="absolute bottom-4 text-[10px] text-stone-700 font-mono tracking-widest opacity-60">
        {APP_CONFIG.VERSION} "{APP_CONFIG.CODENAME}"
      </div>

      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </div>
  );
};

export default StartScreen;
        