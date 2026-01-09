import React, { useState } from 'react';
import { useGameEngine } from './hooks/useGameEngine';
import { GameMode } from './types';

// Components
import VillageMap from './components/VillageMap';
import ActionPanel from './components/ActionPanel';
import LogFeed from './components/LogFeed';
import NPCDetail from './components/NPCDetail';
import NewspaperModal from './components/NewspaperModal';
import StartScreen from './components/StartScreen';
import InteractionResultModal from './components/InteractionResultModal';
import GameOverModal from './components/GameOverModal';

const App: React.FC = () => {
  // Use the custom hook for all logic
  const engine = useGameEngine();
  const [selectedMode, setSelectedMode] = useState<GameMode>('Matchmaker');

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
        <div className="h-12 border-b border-retro-border flex items-center justify-between px-4 bg-retro-panel z-10 shrink-0">
            <div className="flex items-center gap-4">
                <span className="text-retro-accent font-bold">八卦稻香村</span>
                <span className="text-xs text-stone-500">第 {engine.gameState.day} 天</span>
                {engine.gameState.objective && (
                    <span className="text-xs text-retro-text bg-stone-800 px-2 py-1 rounded border border-stone-600 truncate max-w-[200px] md:max-w-md" title={engine.gameState.objective.description}>
                        🎯 {engine.gameState.objective.description}
                    </span>
                )}
            </div>
            <button 
                onClick={engine.endDay}
                disabled={engine.gameState.isSimulating}
                className={`px-4 py-1 text-xs font-bold uppercase transition-all disabled:opacity-50
                    ${engine.gameState.gameOutcome 
                        ? 'bg-retro-text text-retro-bg hover:bg-white animate-pulse' 
                        : 'bg-retro-accent text-retro-bg hover:bg-retro-text'
                    }
                `}
            >
                {engine.gameState.isSimulating 
                    ? '推演中...' 
                    : engine.gameState.gameOutcome 
                        ? '🏆 查看结局' 
                        : '结束今天 >>'
                }
            </button>
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

        {/* Only show Game Over if Newspaper is closed */}
        {!engine.gameState.lastNewspaper && (
            <GameOverModal 
                isOpen={engine.isGameOverOverlayOpen}
                outcome={engine.gameState.gameOutcome}
                onCloseOverlay={() => engine.setIsGameOverOverlayOpen(false)}
            />
        )}
    </div>
  );
};

export default App;