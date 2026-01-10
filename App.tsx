
import React, { useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { GameMode } from './types';
import { APP_CONFIG } from './config/appConfig';

// Components
import VillageMap from './components/VillageMap';
import ActionPanel from './components/ActionPanel';
import LogFeed from './components/LogFeed';
import NPCDetail from './components/NPCDetail';
import NewspaperModal from './components/NewspaperModal';
import StartScreen from './components/StartScreen';
import InteractionResultModal from './components/InteractionResultModal';
import GameOverModal from './components/GameOverModal';
import TimeDisplay from './components/TimeDisplay';
import SupportModal from './components/SupportModal';

const App: React.FC = () => {
  // Use the custom hook for all logic
  const engine = useGameEngine();
  const [selectedMode, setSelectedMode] = useState<GameMode>('Matchmaker');
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // --- Start Screen ---
  if (!engine.hasStarted) {
    return (
      <StartScreen 
        selectedMode={selectedMode}
        onSelectMode={setSelectedMode}
        onStart={() => engine.startGame(selectedMode)}
        isSimulating={engine.gameState.isSimulating}
        errorMsg={engine.errorMsg}
      />
    );
  }

  const selectedNPC = engine.gameState.npcs.find(n => n.id === engine.selectedNPCId) || null;

  return (
    <div className="h-screen bg-retro-bg text-retro-text font-mono flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <div className="h-14 border-b border-retro-border flex items-center justify-between px-4 bg-retro-panel z-10 shrink-0 shadow-md">
            <div className="flex items-center gap-4 h-full">
                <span className="text-retro-accent font-bold text-lg hidden sm:block tracking-tight">{APP_CONFIG.NAME}</span>
                
                {/* Visual Time Display */}
                <div className="border-l border-r border-stone-700/50 px-2 h-full flex items-center bg-black/10">
                    <TimeDisplay day={engine.gameState.day} phase={engine.gameState.timePhase} />
                </div>

                {engine.gameState.objective && (
                    <span className="text-xs text-stone-400 bg-stone-900/50 px-3 py-1 rounded-full border border-stone-700 truncate max-w-[120px] md:max-w-xs" title={engine.gameState.objective.description}>
                        🎯 {engine.gameState.objective.description}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                {/* Support Button */}
                <button 
                    onClick={() => setIsSupportOpen(true)}
                    className="hidden sm:flex items-center gap-1 text-[10px] text-stone-500 hover:text-retro-accent border border-stone-700 hover:border-retro-accent px-2 py-1.5 rounded transition-all"
                    title="支持开发者"
                >
                    <span>💖</span> 支持开发者
                </button>

                <button 
                    onClick={engine.endDay}
                    disabled={engine.gameState.isSimulating}
                    className={`px-5 py-2 text-xs font-bold uppercase transition-all rounded shadow-lg disabled:opacity-50 disabled:shadow-none
                        ${engine.gameState.gameOutcome 
                            ? 'bg-white text-retro-bg hover:bg-stone-200 animate-pulse border-2 border-retro-text' 
                            : 'bg-retro-accent text-retro-bg border-2 border-retro-accent hover:bg-retro-text hover:border-retro-text'
                        }
                    `}
                >
                    {engine.gameState.isSimulating 
                        ? '推演中...' 
                        : engine.gameState.gameOutcome 
                            ? '🏆 查看结局' 
                            : '推进时辰 >>'
                    }
                </button>
            </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 flex overflow-hidden">
            {/* Left: Map & Action */}
            <div className="w-full md:w-1/2 lg:w-2/5 flex flex-col border-r border-retro-border">
                <div className="flex-1 p-4 overflow-y-auto bg-stone-900/50">
                    <VillageMap 
                        npcs={engine.gameState.npcs} 
                        onSelectNPC={(npc) => engine.setSelectedNPCId(npc.id)}
                        selectedNPC={selectedNPC}
                        locationNames={engine.gameState.gridMap}
                    />
                </div>
                <div className="h-1/2 min-h-[320px] shrink-0">
                    <ActionPanel 
                        actionPoints={engine.gameState.actionPoints}
                        intelInventory={engine.gameState.intelInventory}
                        selectedNPC={selectedNPC}
                        onPerformAction={engine.performAction}
                        onUndo={engine.undoLastAction}
                        canUndo={engine.canUndo}
                        isSimulating={engine.gameState.isSimulating || !!engine.gameState.gameOutcome}
                    />
                </div>
            </div>

            {/* Middle: NPC Details */}
            <div className="hidden md:block md:w-1/4 border-r border-retro-border bg-stone-900/30 overflow-y-auto">
               <NPCDetail npc={selectedNPC} />
            </div>

            {/* Right: Log Feed */}
            <div className="hidden lg:block lg:w-1/3 xl:w-1/3 bg-black/20 overflow-hidden">
                <LogFeed logs={engine.gameState.logs} />
            </div>
        </div>
        
        {/* Modals Layer */}
        <NewspaperModal 
            news={engine.gameState.lastNewspaper} 
            day={engine.gameState.day} 
            onClose={engine.closeNewspaper} 
        />

        <InteractionResultModal 
            result={engine.interactionResult} 
            onClose={() => engine.setInteractionResult(null)} 
        />
        
        <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />

        {/* Only show Game Over if Newspaper is closed */}
        {!engine.gameState.lastNewspaper && (
            <GameOverModal 
                isOpen={engine.isGameOverOverlayOpen}
                outcome={engine.gameState.gameOutcome}
                onCloseOverlay={() => engine.setIsGameOverOverlayOpen(false)}
            />
        )}

        {/* System Version Watermark */}
        <div className="absolute bottom-1 right-2 z-30 pointer-events-none select-none">
            <span className="text-[10px] text-stone-600 font-mono opacity-50 tracking-wider">
                {APP_CONFIG.VERSION} "{APP_CONFIG.CODENAME}"
            </span>
        </div>
    </div>
  );
};

export default App;
        