import React, { useState, useCallback, useEffect } from 'react';
import { GameState, NPC, LogEntry, ActionType, IntelCard, GameMode, GameObjective } from './types';
import { INITIAL_LOG_ENTRY, MAX_AP_PER_DAY, LOCATION_MAP } from './constants';
import { generateVillage, simulateDay } from './services/geminiService';

import VillageMap from './components/VillageMap';
import ActionPanel from './components/ActionPanel';
import LogFeed from './components/LogFeed';
import NPCDetail from './components/NPCDetail';
import NewspaperModal from './components/NewspaperModal';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>({
    day: 1,
    npcs: [],
    intelInventory: [],
    logs: [INITIAL_LOG_ENTRY],
    isSimulating: false,
    gameMode: 'Sandbox',
    objective: null,
    gameOutcome: null,
    lastNewspaper: null,
    actionPoints: MAX_AP_PER_DAY,
    gridMap: LOCATION_MAP // Initial default map
  });

  const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode>('Matchmaker');
  const [isGameOverOverlayOpen, setIsGameOverOverlayOpen] = useState(false);
  
  // Store actions performed during the day to pass to simulation at night
  const [pendingActions, setPendingActions] = useState<{type: string, content: string, targetId?: string}[]>([]);

  // --- Effects ---
  
  // Automatically open the game over overlay when an outcome is determined
  useEffect(() => {
    if (gameState.gameOutcome) {
        setIsGameOverOverlayOpen(true);
    }
  }, [gameState.gameOutcome]);

  // --- Handlers ---

  const generateObjective = (mode: GameMode, npcs: NPC[]): GameObjective => {
    const shuffled = [...npcs].sort(() => 0.5 - Math.random());
    
    if (mode === 'Matchmaker') {
        // Pick two random people
        const targetA = shuffled[0];
        const targetB = shuffled[1];
        return {
            mode: 'Matchmaker',
            targetIds: [targetA.id, targetB.id],
            description: `红娘任务：撮合 ${targetA.name} 和 ${targetB.name} 结婚。`,
            deadlineDay: 7
        };
    } else if (mode === 'Detective') {
        // Pick one culprit
        const culprit = shuffled[0];
        return {
            mode: 'Detective',
            targetIds: [culprit.id],
            description: `侦探任务：找出村里的罪犯。${culprit.name} 是隐藏的罪犯，但没人知道。通过散布流言炸出真相，并广播正确的指控。`,
            deadlineDay: 7
        };
    } else if (mode === 'Chaos') {
        return {
            mode: 'Chaos',
            targetIds: [],
            description: `混乱任务：在7天内让超过50%的村民死亡、入狱或离村。`,
            deadlineDay: 7
        };
    }

    return {
        mode: 'Sandbox',
        targetIds: [],
        description: '自由沙盒模式。观察或随意干涉。'
    };
  };

  const handleStartGame = async () => {
    setGameState(prev => ({ ...prev, isSimulating: true }));
    setErrorMsg(null);
    try {
        // Initial generation of 6 villagers
        const rawNPCs = await generateVillage(6);
        
        // --- Map & Position Logic ---
        // 1. Create a deep copy of the default location map to modify
        const newGridMap = JSON.parse(JSON.stringify(LOCATION_MAP));
        
        // 2. Create a list of all valid grid coordinates (0,0 to 3,3)
        const availableSlots = [];
        for(let y=0; y<4; y++) for(let x=0; x<4; x++) availableSlots.push({x,y});
        
        // 3. Shuffle slots to randomize where NPCs live
        availableSlots.sort(() => Math.random() - 0.5);

        // 4. Assign positions with Household Logic
        // This ensures family members (like Chief and Son) share the same cell
        const householdLocations: Record<string, {x:number, y:number}> = {};

        const positionedNPCs = rawNPCs.map((npc) => {
            const r = npc.role;
            const n = npc.name;
            const p = npc.publicPersona || '';

            // Determine Household Key based on Role/Name keywords
            // If they match a specific household type, they will try to share the slot
            let householdKey = null;
            if (r.includes('村长') || n.includes('村长') || p.includes('村长之')) householdKey = 'CHIEF';
            else if (r.includes('铁匠') || n.includes('铁匠')) householdKey = 'SMITH';
            else if (r.includes('医') || n.includes('医') || r.includes('药')) householdKey = 'DOCTOR';
            else if (r.includes('杂货') || n.includes('杂货')) householdKey = 'GROCER';
            else if (r.includes('猎') || n.includes('猎')) householdKey = 'HUNTER';

            let pos;

            // Check if this household already has a home
            if (householdKey && householdLocations[householdKey]) {
                pos = householdLocations[householdKey];
                // Do not update map name, assume the head of house set it or it will be set by the first member
            } else {
                // Assign new slot
                pos = availableSlots.pop() || {x: 0, y: 0}; // Fallback to 0,0 if full
                
                if (householdKey) {
                    householdLocations[householdKey] = pos;
                }

                // Determine Location Name based on the Household or Role
                let locName = `${n}家`; // Default

                if (householdKey === 'CHIEF') locName = '村长府邸';
                else if (householdKey === 'SMITH') locName = '铁匠铺';
                else if (householdKey === 'DOCTOR') locName = '回春堂';
                else if (householdKey === 'GROCER') locName = '杂货铺';
                else if (householdKey === 'HUNTER') locName = '猎户小屋';
                else {
                    // Fallback heuristics for individual roles
                    if (r.includes('裁缝')) locName = '裁缝铺';
                    else if (r.includes('屠') || r.includes('肉')) locName = '肉铺';
                    else if (r.includes('酒') || r.includes('栈') || r.includes('厨')) locName = '小酒馆';
                    else if (r.includes('神') || r.includes('仙') || r.includes('道') || r.includes('僧')) locName = '破庙';
                    else if (r.includes('寡妇')) locName = '幽静小院';
                    else if (n.includes('大妈') || n.includes('婶') || n.includes('婆')) locName = `${n}家`;
                }

                // Update the map
                newGridMap[pos.y][pos.x] = locName;
            }

            return {
                ...npc,
                position: pos
            };
        });

        // Generate Objective based on selected mode
        const objective = generateObjective(selectedMode, positionedNPCs);

        // Initial Intel: Everyone's secret is known to God (the player) immediately
        const initialIntel: IntelCard[] = positionedNPCs.map(npc => ({
            id: `intel-${Math.random()}`,
            type: 'Secret',
            content: `${npc.name}的秘密: ${npc.deepSecret}`,
            sourceId: npc.id,
            timestamp: 1
        }));

        setGameState(prev => ({
            ...prev,
            npcs: positionedNPCs,
            intelInventory: initialIntel,
            isSimulating: false,
            gameMode: selectedMode,
            objective: objective,
            gridMap: newGridMap,
            logs: [...prev.logs, {
                day: 1,
                content: `村庄已生成。目标: ${objective.description}`,
                type: 'System'
            }]
        }));
        setHasStarted(true);

    } catch (e) {
        console.error(e);
        setErrorMsg("生成村庄失败。请检查API Key并重试。");
        setGameState(prev => ({ ...prev, isSimulating: false }));
    }
  };

  const handleNPCSelect = (npc: NPC) => {
    setSelectedNPCId(npc.id);
  };

  const handlePerformAction = useCallback((type: ActionType, content: string, targetId?: string) => {
    if (gameState.actionPoints <= 0) return;

    // Map types to Chinese for log display
    const typeCN: Record<ActionType, string> = {
        'WHISPER': '私信',
        'BROADCAST': '广播',
        'FABRICATE': '伪造',
        'INCEPTION': '托梦'
    };

    // Determine target name
    let targetDisplay = '全体村民';
    if (targetId) {
        const target = gameState.npcs.find(n => n.id === targetId);
        targetDisplay = target ? target.name : '未知目标';
    }

    // Log the action immediately for UI feedback
    const actionLog: LogEntry = {
        day: gameState.day,
        content: `玩家对 【${targetDisplay}】 执行了 ${typeCN[type]}: "${content}"。`,
        type: 'System'
    };

    setGameState(prev => ({
        ...prev,
        actionPoints: prev.actionPoints - 1,
        logs: [...prev.logs, actionLog]
    }));

    // Queue action for the nightly simulation
    setPendingActions(prev => [...prev, { type, content, targetId }]);

  }, [gameState.day, gameState.actionPoints, gameState.npcs]);

  const handleEndDay = async () => {
    if (gameState.gameOutcome) {
        // If game is over, this button re-opens the overlay
        setIsGameOverOverlayOpen(true);
        return;
    }

    if (gameState.isSimulating) return;
    setGameState(prev => ({ ...prev, isSimulating: true }));

    try {
        const result = await simulateDay(gameState, pendingActions);

        // Process logs
        const newLogs: LogEntry[] = result.logs.map(l => ({
            day: gameState.day,
            npcName: l.npcName,
            content: `${l.thought} (行为: ${l.action})`,
            type: l.thought ? 'Thought' : 'Action'
        }));

        // Process New Intel (Rumors found during the day)
        const newIntel: IntelCard[] = result.newIntel.map(i => ({
            id: `intel-${Date.now()}-${Math.random()}`,
            type: 'Rumor',
            content: i.content,
            timestamp: gameState.day,
            sourceId: 'simulation'
        }));

        setGameState(prev => {
            // Update NPCs
            const updatedNPCs = prev.npcs.map(npc => {
                // Find status update
                const statusUpdate = result.npcStatusUpdates.find(u => u.npcName === npc.name);
                
                // Find relationship updates where this NPC is the SOURCE
                const relUpdates = result.relationshipUpdates.filter(r => r.sourceName === npc.name);
                
                let newRelationships = [...npc.relationships];

                relUpdates.forEach(update => {
                    // Find target ID by name
                    const target = prev.npcs.find(n => n.name === update.targetName);
                    if (target) {
                        const existingRelIndex = newRelationships.findIndex(r => r.targetId === target.id);
                        if (existingRelIndex >= 0) {
                            newRelationships[existingRelIndex] = {
                                ...newRelationships[existingRelIndex],
                                affinity: Math.max(-100, Math.min(100, newRelationships[existingRelIndex].affinity + update.affinityChange)),
                                trust: Math.max(0, Math.min(100, newRelationships[existingRelIndex].trust + update.trustChange))
                            };
                        } else {
                            newRelationships.push({
                                targetId: target.id,
                                targetName: target.name,
                                affinity: update.affinityChange,
                                trust: 50 + update.trustChange,
                                knownSecrets: []
                            });
                        }
                    }
                });

                const newStatus = (statusUpdate?.status as any) || npc.status;
                
                // Position logic: Prevent disappearance and lock dead/inactive NPCs
                let newPosition = npc.position;
                
                // Definition of inactive states where movement should stop
                const inactiveStates = ['Dead', 'Jailed', 'Left Village', 'Escaped'];
                
                const isInactive = inactiveStates.includes(newStatus);
                const wasInactive = inactiveStates.includes(npc.status);

                if (isInactive || wasInactive) {
                    // Force keep old position if they are inactive or just became inactive
                    // This prevents them from moving or disappearing off grid
                    newPosition = npc.position;
                } else if (statusUpdate?.newPosition) {
                    // Only update position if active and valid coordinates provided
                    const { x, y } = statusUpdate.newPosition;
                    if (x >= 0 && x < 4 && y >= 0 && y < 4) {
                        newPosition = { x, y };
                    }
                }

                return {
                    ...npc,
                    status: newStatus,
                    currentMood: statusUpdate?.mood || npc.currentMood,
                    position: newPosition,
                    relationships: newRelationships
                };
            });

            return {
                ...prev,
                npcs: updatedNPCs,
                logs: [...prev.logs, ...newLogs],
                intelInventory: [...prev.intelInventory, ...newIntel],
                lastNewspaper: result.newspaper,
                gameOutcome: result.gameOutcome || null,
                isSimulating: false,
                day: prev.day, 
                actionPoints: MAX_AP_PER_DAY // Reset AP
            };
        });
        
        // Reset pending actions for the next day
        setPendingActions([]);

    } catch (e) {
        console.error(e);
        setErrorMsg("模拟失败。AI之神正在沉睡。");
        setGameState(prev => ({ ...prev, isSimulating: false }));
    }
  };

  const handleCloseNewspaper = () => {
    setGameState(prev => ({
        ...prev,
        lastNewspaper: null,
        day: prev.day + 1
    }));
  };

  // --- Render ---

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-retro-bg text-retro-text flex flex-col items-center justify-center p-4 font-mono">
        <h1 className="text-6xl text-retro-accent mb-4 font-bold tracking-tighter">八卦村</h1>
        <h2 className="text-2xl mb-8 text-stone-500 uppercase tracking-widest">Gossip Village</h2>
        
        {/* Mode Selection */}
        <div className="flex flex-col space-y-2 mb-8 w-64">
             <label className="text-xs text-stone-500">选择游戏模式</label>
             {(['Matchmaker', 'Detective', 'Chaos', 'Sandbox'] as GameMode[]).map(mode => (
                 <button 
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`py-2 border-2 text-sm uppercase ${selectedMode === mode ? 'border-retro-accent text-retro-accent' : 'border-stone-700 text-stone-600'}`}
                 >
                    {mode === 'Matchmaker' && '💘 红娘模式'}
                    {mode === 'Detective' && '🔍 侦探模式'}
                    {mode === 'Chaos' && '🔥 混乱模式'}
                    {mode === 'Sandbox' && '🧘 沙盒模式'}
                 </button>
             ))}
        </div>

        <div className="max-w-md text-center text-sm space-y-4 mb-8 text-stone-400">
            <p>你是观察者。</p>
            <p>几个村民居住在这里。他们有秘密。他们八卦。他们……</p>
            <p>你的目标是操控他们的现实。</p>
        </div>

        {errorMsg && <div className="text-retro-red mb-4 border border-retro-red p-2">{errorMsg}</div>}

        <button 
            onClick={handleStartGame}
            disabled={gameState.isSimulating}
            className="px-8 py-4 bg-retro-panel border-2 border-retro-accent text-retro-accent hover:bg-retro-accent hover:text-retro-bg transition-all font-bold text-lg disabled:opacity-50"
        >
            {gameState.isSimulating ? '正在生成世界...' : '进入村庄'}
        </button>
      </div>
    );
  }

  const selectedNPC = gameState.npcs.find(n => n.id === selectedNPCId) || null;

  return (
    <div className="h-screen bg-retro-bg text-retro-text font-mono flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <div className="h-12 border-b border-retro-border flex items-center justify-between px-4 bg-retro-panel z-10 shrink-0">
            <div className="flex items-center gap-4">
                <span className="text-retro-accent font-bold">八卦村</span>
                <span className="text-xs text-stone-500">第 {gameState.day} 天</span>
                {gameState.objective && (
                    <span className="text-xs text-retro-text bg-stone-800 px-2 py-1 rounded border border-stone-600 truncate max-w-[200px] md:max-w-md" title={gameState.objective.description}>
                        🎯 {gameState.objective.description}
                    </span>
                )}
            </div>
            <button 
                onClick={handleEndDay}
                disabled={gameState.isSimulating}
                className={`px-4 py-1 text-xs font-bold uppercase transition-all disabled:opacity-50
                    ${gameState.gameOutcome 
                        ? 'bg-retro-text text-retro-bg hover:bg-white animate-pulse' 
                        : 'bg-retro-accent text-retro-bg hover:bg-retro-text'
                    }
                `}
            >
                {gameState.isSimulating 
                    ? '推演中...' 
                    : gameState.gameOutcome 
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
                        npcs={gameState.npcs} 
                        onSelectNPC={handleNPCSelect}
                        selectedNPC={selectedNPC}
                        locationNames={gameState.gridMap}
                    />
                </div>
                <div className="h-1/2 min-h-[320px] shrink-0">
                    <ActionPanel 
                        actionPoints={gameState.actionPoints}
                        intelInventory={gameState.intelInventory}
                        selectedNPC={selectedNPC}
                        onPerformAction={handlePerformAction}
                        isSimulating={gameState.isSimulating || !!gameState.gameOutcome}
                    />
                </div>
            </div>

            {/* Middle: NPC Details */}
            <div className="hidden md:block md:w-1/4 border-r border-retro-border bg-stone-900/30 overflow-y-auto">
               <NPCDetail npc={selectedNPC} />
            </div>

            {/* Right: Log Feed */}
            <div className="hidden lg:block lg:w-1/3 xl:w-1/3 bg-black/20 overflow-hidden">
                <LogFeed logs={gameState.logs} />
            </div>
        </div>
        
        {/* Newspaper Modal Layer */}
        <NewspaperModal 
            news={gameState.lastNewspaper} 
            day={gameState.day} 
            onClose={handleCloseNewspaper} 
        />

        {/* Game Over Overlay */}
        {gameState.gameOutcome && !gameState.lastNewspaper && isGameOverOverlayOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                <div className="max-w-lg p-8 border-4 border-retro-accent bg-retro-panel text-center flex flex-col items-center">
                    <h2 className={`text-6xl font-bold mb-4 ${gameState.gameOutcome.result === 'Victory' ? 'text-retro-green' : 'text-retro-red'}`}>
                        {gameState.gameOutcome.result === 'Victory' ? '胜利!' : '失败'}
                    </h2>
                    <p className="text-retro-text text-xl mb-8">
                        {gameState.gameOutcome.reason}
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-retro-accent text-retro-bg font-bold uppercase hover:bg-white w-full mb-4"
                    >
                        重置世界
                    </button>
                    <button 
                        onClick={() => setIsGameOverOverlayOpen(false)}
                        className="text-stone-500 hover:text-retro-text underline text-sm"
                    >
                        回顾往事 (查看日志)
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;