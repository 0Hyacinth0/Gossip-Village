import { useState, useCallback, useEffect } from 'react';
import { GameState, NPC, LogEntry, ActionType, IntelCard, GameMode, GameObjective, RelationshipType } from '../types';
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
            description: `红娘任务：撮合 ${targetA.name} 和 ${targetB.name} 结为神仙眷侣 (关系: Lover)。`,
            deadlineDay: 7
        };
    } else if (mode === 'Detective') {
        const culprit = shuffled[0];
        return {
            mode: 'Detective',
            targetIds: [culprit.id],
            description: `侦探任务：找出恶人谷卧底。${culprit.name} 是潜伏者。通过散布流言炸出真相，并广播正确的指控。`,
            deadlineDay: 7
        };
    } else if (mode === 'Chaos') {
        return {
            mode: 'Chaos',
            targetIds: [],
            description: `混乱任务：在7天内让超过50%的侠客重伤不治、关入大牢或退出江湖。`,
            deadlineDay: 7
        };
    }
    return {
        mode: 'Sandbox',
        targetIds: [],
        description: '自由沙盒模式。观察江湖百态。'
    };
  };

  // --- Smart Placement Algorithm ---
  const assignPositions = (npcs: NPC[], gridMap: string[][]): { npcs: NPC[], grid: string[][] } => {
    const newGridMap = JSON.parse(JSON.stringify(gridMap));
    const assignedNPCs = [...npcs];
    
    // Define Zones based on 4x4 Grid
    // y, x coordinates
    const ZONES: Record<string, {x:number, y:number}[]> = {
        'Market': [{x:2, y:2}, {x:1, y:2}, {x:0, y:2}, {x:3, y:1}, {x:2, y:1}], // Center-ish / Smithy / Inn
        'Temple': [{x:0, y:1}, {x:3, y:1}, {x:2, y:0}], // Daoist Temple / Garden
        'Official': [{x:1, y:1}, {x:2, y:1}, {x:0, y:0}], // Chief / Training
        'Secluded': [{x:3, y:3}, {x:1, y:3}, {x:0, y:3}, {x:3, y:0}], // Cave / Hut / Reeds
    };

    // Helper: Find first available slot in preferred zone, or random
    const findSlot = (zoneName: string | undefined, occupied: Set<string>): {x:number, y:number} => {
        let candidates = zoneName ? ZONES[zoneName] : [];
        if (!candidates || candidates.length === 0) {
            // Fallback to random if zone undefined
             candidates = [];
             for(let y=0; y<4; y++) for(let x=0; x<4; x++) candidates.push({x,y});
        }

        // Try to find a slot that isn't crowded (let's say max 2 per cell initially)
        // But for simplicity, we just pick from candidates.
        // If we want adjacency, we handle it in the main loop.
        
        // Shuffle candidates for variety
        candidates = candidates.sort(() => Math.random() - 0.5);
        return candidates[0];
    };

    const positionMap: Record<string, {x:number, y:number}> = {};

    // 1. Group by Connection (Lover/Family/Master/Enemy should be near)
    // We iterate and place. If NPC has a connection that is ALREADY placed, we try to place adjacent.
    // If not placed, we place normally and wait for the other to place near us (or force it).
    
    // Sort so that people with connections are processed? 
    // Actually, simple pass: 
    // If A has connection B:
    //   If B has pos -> place A near B.
    //   If B has no pos -> place A in Zone, store A's pos. When B comes, B checks A.
    
    for (let i = 0; i < assignedNPCs.length; i++) {
        const npc = assignedNPCs[i];
        let pos = {x: 0, y: 0};
        
        // Check connection
        let connectionTarget = null;
        if (npc.initialConnectionName) {
            connectionTarget = assignedNPCs.find(n => n.name === npc.initialConnectionName && positionMap[n.id]);
        }

        if (connectionTarget) {
            const targetPos = positionMap[connectionTarget.id];
            // Place in same cell or adjacent
            const offsets = [{dx:0, dy:0}, {dx:1, dy:0}, {dx:-1, dy:0}, {dx:0, dy:1}, {dx:0, dy:-1}];
            // Filter valid grid
            const validNeighbors = offsets.map(o => ({x: targetPos.x + o.dx, y: targetPos.y + o.dy}))
                                          .filter(p => p.x >=0 && p.x < 4 && p.y >= 0 && p.y < 4);
            // Pick one
            pos = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
        } else {
            // Place in Zone
            pos = findSlot(npc.spawnZone, new Set());
        }

        positionMap[npc.id] = pos;
        assignedNPCs[i].position = pos;

        // --- Rename Location Logic (Flavor) ---
        // Dynamically rename the cell based on who lives there now
        const {x, y} = pos;
        const currentName = newGridMap[y][x];
        const role = npc.role;
        const name = npc.name;

        // Only rename generic locations or overwrite based on priority
        let newName = currentName;
        
        // Priority: Chief > Sect Specific > Merchant > Common
        if (role.includes('村长') || role.includes('盟主')) newName = '村长家';
        else if (role.includes('铁匠') || role.includes('藏剑')) newName = `${name.substring(0,1)}氏铁铺`;
        else if (role.includes('医') || role.includes('万花')) newName = '百草药庐';
        else if (role.includes('酒') || role.includes('栈')) newName = '稻香酒肆';
        else if (role.includes('丐')) newName = '破庙';
        else if (role.includes('天策') || role.includes('军')) newName = '演武场';
        else if (role.includes('五毒')) newName = '苗疆禁地';
        else if (role.includes('纯阳') || role.includes('道')) newName = '道观';
        
        // Update map only if it hasn't been claimed by a higher priority role?
        // Simple override for now to reflect the latest interesting resident
        if (newName !== currentName) {
            newGridMap[y][x] = newName;
        }
    }

    return { npcs: assignedNPCs, grid: newGridMap };
  };

  // --- Actions ---

  const startGame = async (selectedMode: GameMode) => {
    setGameState(prev => ({ ...prev, isSimulating: true }));
    setErrorMsg(null);
    try {
        // Generate 10 Villagers
        const rawNPCs = await generateVillage(10);
        
        // Apply Smart Placement Algorithm
        const { npcs: positionedNPCs, grid: newGridMap } = assignPositions(rawNPCs, LOCATION_MAP);

        // Build Initial Relationships
        positionedNPCs.forEach(npc => {
            if (npc.initialConnectionName && npc.initialConnectionType) {
                const target = positionedNPCs.find(t => t.name === npc.initialConnectionName);
                if (target) {
                    const type = npc.initialConnectionType as RelationshipType;
                    let affinity = 0;
                    let trust = 50;

                    if (type === 'Lover') { affinity = 80; trust = 90; }
                    else if (type === 'Enemy') { affinity = -80; trust = 0; }
                    else if (type === 'Master') { affinity = 50; trust = 80; }
                    else if (type === 'Disciple') { affinity = 50; trust = 60; }
                    else if (type === 'Family') { affinity = 60; trust = 80; }

                    npc.relationships.push({
                        targetId: target.id,
                        targetName: target.name,
                        type: type,
                        affinity: affinity,
                        trust: trust,
                        knownSecrets: []
                    });
                    
                    // Add reciprocal if missing
                    const reciprocalTypeMap: Record<string, RelationshipType> = {
                        'Lover': 'Lover', 'Enemy': 'Enemy', 'Family': 'Family',
                        'Master': 'Disciple', 'Disciple': 'Master'
                    };
                    
                    // We assume the loop will hit the other person eventually or we rely on Gemini to generate pairs.
                    // But to be safe, let's inject the reciprocal right now if not exists
                    const existingRel = target.relationships.find(r => r.targetId === npc.id);
                    if (!existingRel) {
                        target.relationships.push({
                            targetId: npc.id,
                            targetName: npc.name,
                            type: reciprocalTypeMap[type] || 'Friend',
                            affinity: affinity,
                            trust: trust,
                            knownSecrets: []
                        });
                    }
                }
            }
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
                content: `稻香村风云际会。目标: ${objective.description}`,
                type: 'System'
            }]
        }));
        setHasStarted(true);
    } catch (e) {
        console.error(e);
        setErrorMsg("江湖路远，服务器暂未响应。请重试。");
        setGameState(prev => ({ ...prev, isSimulating: false }));
    }
  };

  const performAction = useCallback(async (type: ActionType, content: string, targetId?: string) => {
    const cost = type === 'INTERROGATE' ? 2 : 1;
    if (gameState.actionPoints < cost) return;

    const typeCN: Record<ActionType, string> = {
        'WHISPER': '传音入密', 'BROADCAST': '江湖传闻', 'FABRICATE': '散布谣言', 'INCEPTION': '心魔植入', 'INTERROGATE': '拷问信息'
    };

    let targetDisplay = '全体侠士';
    let targetNPC = null;
    if (targetId) {
        targetNPC = gameState.npcs.find(n => n.id === targetId);
        // If it's NOT broadcast AND NOT fabricate, we show the specific name. 
        if (type !== 'BROADCAST' && type !== 'FABRICATE') {
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
                logs: [...prev.logs, { day: prev.day, content: `你拷问了 ${targetNPC.name}。对方神情变得 ${response.moodChange}。`, type: 'System' }]
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
        content: `玩家对 【${targetDisplay}】 施展了 ${typeCN[type]}: "${content}"。`,
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
            'WHISPER': '传音入密', 'BROADCAST': '江湖传闻', 'FABRICATE': '散布谣言', 'INCEPTION': '心魔植入'
        };
        
        // Reconstruct the exact log string to find and remove it
        let targetDisplay = '全体侠士';
        if (lastAction.type !== 'BROADCAST' && lastAction.type !== 'FABRICATE' && lastAction.targetId) {
             const t = prev.npcs.find(n => n.id === lastAction.targetId);
             targetDisplay = t ? t.name : '未知目标';
        }
        
        const logContentToMatch = `玩家对 【${targetDisplay}】 施展了 ${typeCN[lastAction.type]}: "${lastAction.content}"。`;
        
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
            content: `${l.thought} (行动: ${l.action})`,
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
                        
                        // Parse new type or use 'None' if undefined
                        const newTypeVal = (update.newType as RelationshipType) || 'None';
                        
                        if (existingRelIndex >= 0) {
                            const currentRel = newRelationships[existingRelIndex];
                            // Only update type if the AI explicitly sent a new type (not None), or maintain old one
                            const resolvedType = newTypeVal !== 'None' ? newTypeVal : currentRel.type;

                            newRelationships[existingRelIndex] = {
                                ...currentRel,
                                affinity: Math.max(-100, Math.min(100, currentRel.affinity + update.affinityChange)),
                                trust: Math.max(0, Math.min(100, currentRel.trust + update.trustChange)),
                                type: resolvedType
                            };
                        } else {
                            newRelationships.push({
                                targetId: target.id,
                                targetName: target.name,
                                affinity: update.affinityChange,
                                trust: 50 + update.trustChange,
                                knownSecrets: [],
                                type: newTypeVal
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
        setErrorMsg("服务器打坐中，请稍后再试。");
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
