import { useState, useCallback, useEffect } from 'react';
import { GameState, NPC, LogEntry, ActionType, IntelCard, GameMode, GameObjective } from '../types';
import { INITIAL_LOG_ENTRY, MAX_AP_PER_DAY, LOCATION_MAP } from '../constants';
import { generateVillage, simulateDay, interactWithNPC } from '../services/geminiService';

export const useGameEngine = () => {
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
    gridMap: LOCATION_MAP
  });

  const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGameOverOverlayOpen, setIsGameOverOverlayOpen] = useState(false);
  
  // Interaction State
  const [interactionResult, setInteractionResult] = useState<{npcName: string, question: string, reply: string} | null>(null);
  
  // Store actions performed during the day
  const [pendingActions, setPendingActions] = useState<{type: string, content: string, targetId?: string}[]>([]);

  // --- Effects ---
  useEffect(() => {
    if (gameState.gameOutcome) {
        setIsGameOverOverlayOpen(true);
    }
  }, [gameState.gameOutcome]);

  // --- Helpers ---
  const generateObjective = (mode: GameMode, npcs: NPC[]): GameObjective => {
    const shuffled = [...npcs].sort(() => 0.5 - Math.random());
    
    if (mode === 'Matchmaker') {
        const targetA = shuffled[0];
        const targetB = shuffled[1];
        return {
            mode: 'Matchmaker',
            targetIds: [targetA.id, targetB.id],
            description: `红娘任务：撮合 ${targetA.name} 和 ${targetB.name} 结婚。`,
            deadlineDay: 7
        };
    } else if (mode === 'Detective') {
        const culprit = shuffled[0];
        return {
            mode: 'Detective',
            targetIds: [culprit.id],
            description: `侦探任务：找出村里的罪犯。${culprit.name} 是隐藏的罪犯。通过散布流言炸出真相，并广播正确的指控。`,
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

  // --- Actions ---

  const startGame = async (selectedMode: GameMode) => {
    setGameState(prev => ({ ...prev, isSimulating: true }));
    setErrorMsg(null);
    try {
        const rawNPCs = await generateVillage(6);
        
        // Map & Position Logic
        const newGridMap = JSON.parse(JSON.stringify(LOCATION_MAP));
        const availableSlots = [];
        for(let y=0; y<4; y++) for(let x=0; x<4; x++) availableSlots.push({x,y});
        availableSlots.sort(() => Math.random() - 0.5);

        const householdLocations: Record<string, {x:number, y:number}> = {};

        const positionedNPCs = rawNPCs.map((npc) => {
            const r = npc.role;
            const n = npc.name;
            const p = npc.publicPersona || '';
            let householdKey = null;
            if (r.includes('村长') || n.includes('村长') || p.includes('村长之')) householdKey = 'CHIEF';
            else if (r.includes('铁匠') || n.includes('铁匠')) householdKey = 'SMITH';
            else if (r.includes('医') || n.includes('医') || r.includes('药')) householdKey = 'DOCTOR';
            else if (r.includes('杂货') || n.includes('杂货')) householdKey = 'GROCER';
            else if (r.includes('猎') || n.includes('猎')) householdKey = 'HUNTER';

            let pos;
            if (householdKey && householdLocations[householdKey]) {
                pos = householdLocations[householdKey];
            } else {
                pos = availableSlots.pop() || {x: 0, y: 0};
                if (householdKey) householdLocations[householdKey] = pos;

                // Update Map Name Logic
                let locName = `${n}家`;
                if (householdKey === 'CHIEF') locName = '村长府邸';
                else if (householdKey === 'SMITH') locName = '铁匠铺';
                else if (householdKey === 'DOCTOR') locName = '回春堂';
                else if (householdKey === 'GROCER') locName = '杂货铺';
                else if (householdKey === 'HUNTER') locName = '猎户小屋';
                newGridMap[pos.y][pos.x] = locName;
            }
            return { ...npc, position: pos };
        });

        const objective = generateObjective(selectedMode, positionedNPCs);
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

  const performAction = useCallback(async (type: ActionType, content: string, targetId?: string) => {
    const cost = type === 'INTERROGATE' ? 2 : 1;
    if (gameState.actionPoints < cost) return;

    const typeCN: Record<ActionType, string> = {
        'WHISPER': '私信', 'BROADCAST': '广播', 'FABRICATE': '伪造', 'INCEPTION': '托梦', 'INTERROGATE': '问询'
    };

    let targetDisplay = '全体村民';
    let targetNPC = null;
    if (targetId) {
        targetNPC = gameState.npcs.find(n => n.id === targetId);
        // If it's NOT broadcast, we show the specific name. If it IS broadcast, it remains '全体村民'.
        if (type !== 'BROADCAST') {
            targetDisplay = targetNPC ? targetNPC.name : '未知目标';
        }
    }

    // Interrogation Logic
    if (type === 'INTERROGATE' && targetNPC) {
        setGameState(prev => ({ ...prev, isSimulating: true }));
        try {
            const response = await interactWithNPC(targetNPC, content);
            setInteractionResult({ npcName: targetNPC.name, question: content, reply: response.reply });

            let newIntel: IntelCard[] = [];
            if (response.revealedInfo) {
                newIntel = [{
                    id: `intel-confession-${Date.now()}`,
                    type: 'Confession',
                    content: `[口供] ${targetNPC.name}: ${response.revealedInfo}`,
                    sourceId: targetNPC.id,
                    timestamp: gameState.day
                }];
            }

            setGameState(prev => ({
                ...prev,
                isSimulating: false,
                actionPoints: prev.actionPoints - cost,
                intelInventory: [...prev.intelInventory, ...newIntel],
                npcs: prev.npcs.map(n => n.id === targetNPC?.id ? { ...n, currentMood: response.moodChange } : n),
                logs: [...prev.logs, { day: prev.day, content: `你问询了 ${targetNPC.name}。对方变得 ${response.moodChange}。`, type: 'System' }]
            }));
        } catch (e) {
            console.error(e);
            setGameState(prev => ({ ...prev, isSimulating: false }));
        }
        return; 
    }

    // Standard Actions
    const actionLog: LogEntry = {
        day: gameState.day,
        content: `玩家对 【${targetDisplay}】 执行了 ${typeCN[type]}: "${content}"。`,
        type: 'System'
    };

    setGameState(prev => ({
        ...prev,
        actionPoints: prev.actionPoints - cost,
        logs: [...prev.logs, actionLog]
    }));
    setPendingActions(prev => [...prev, { type, content, targetId }]);
  }, [gameState.day, gameState.actionPoints, gameState.npcs]);

  const undoLastAction = useCallback(() => {
    if (pendingActions.length === 0) return;
    
    // Get the last action to reconstruct its log message
    const lastAction = pendingActions[pendingActions.length - 1];
    
    // Remove from pending queue
    setPendingActions(prev => prev.slice(0, -1));

    setGameState(prev => {
        const typeCN: Record<string, string> = {
            'WHISPER': '私信', 'BROADCAST': '广播', 'FABRICATE': '伪造', 'INCEPTION': '托梦'
        };
        
        // Reconstruct the exact log string to find and remove it
        let targetDisplay = '全体村民';
        if (lastAction.type !== 'BROADCAST' && lastAction.targetId) {
             const t = prev.npcs.find(n => n.id === lastAction.targetId);
             targetDisplay = t ? t.name : '未知目标';
        }
        
        const logContentToMatch = `玩家对 【${targetDisplay}】 执行了 ${typeCN[lastAction.type]}: "${lastAction.content}"。`;
        
        // Find the index of the *last* matching log entry (to avoid removing earlier identical actions if any)
        const logIndex = prev.logs.map(l => l.content).lastIndexOf(logContentToMatch);
        
        let newLogs = prev.logs;
        if (logIndex !== -1) {
             newLogs = prev.logs.filter((_, i) => i !== logIndex);
        }

        // Refund 1 AP (All pending actions cost 1)
        return {
            ...prev,
            actionPoints: Math.min(MAX_AP_PER_DAY, prev.actionPoints + 1),
            logs: newLogs
        };
    });
  }, [pendingActions]);

  const endDay = async () => {
    if (gameState.gameOutcome) {
        setIsGameOverOverlayOpen(true);
        return;
    }
    if (gameState.isSimulating) return;
    setGameState(prev => ({ ...prev, isSimulating: true }));

    try {
        const result = await simulateDay(gameState, pendingActions);
        
        const newLogs: LogEntry[] = result.logs.map(l => ({
            day: gameState.day,
            npcName: l.npcName,
            content: `${l.thought} (行为: ${l.action})`,
            type: l.thought ? 'Thought' : 'Action'
        }));

        const newIntel: IntelCard[] = result.newIntel.map(i => ({
            id: `intel-${Date.now()}-${Math.random()}`,
            type: 'Rumor',
            content: i.content,
            timestamp: gameState.day,
            sourceId: 'simulation'
        }));

        setGameState(prev => {
            const updatedNPCs = prev.npcs.map(npc => {
                const statusUpdate = result.npcStatusUpdates.find(u => u.npcName === npc.name);
                const relUpdates = result.relationshipUpdates.filter(r => r.sourceName === npc.name);
                
                let newRelationships = [...npc.relationships];
                relUpdates.forEach(update => {
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
                let newPosition = npc.position;
                const inactiveStates = ['Dead', 'Jailed', 'Left Village', 'Escaped'];
                const isInactive = inactiveStates.includes(newStatus);
                const wasInactive = inactiveStates.includes(npc.status);

                if (isInactive || wasInactive) {
                    newPosition = npc.position;
                } else if (statusUpdate?.newPosition) {
                    const { x, y } = statusUpdate.newPosition;
                    if (x >= 0 && x < 4 && y >= 0 && y < 4) newPosition = { x, y };
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
                actionPoints: MAX_AP_PER_DAY
            };
        });
        setPendingActions([]);
    } catch (e) {
        console.error(e);
        setErrorMsg("模拟失败。AI之神正在沉睡。");
        setGameState(prev => ({ ...prev, isSimulating: false }));
    }
  };

  const closeNewspaper = () => {
    setGameState(prev => ({ ...prev, lastNewspaper: null, day: prev.day + 1 }));
  };

  return {
    gameState,
    hasStarted,
    selectedNPCId,
    setSelectedNPCId,
    errorMsg,
    startGame,
    performAction,
    undoLastAction,
    canUndo: pendingActions.length > 0,
    endDay,
    closeNewspaper,
    interactionResult,
    setInteractionResult,
    isGameOverOverlayOpen,
    setIsGameOverOverlayOpen
  };
};
