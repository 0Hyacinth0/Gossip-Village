
import { useState, useCallback, useEffect } from 'react';
import { GameState, NPC, LogEntry, ActionType, IntelCard, GameMode, GameObjective, RelationshipType, TimePhase } from '../types';
import { INITIAL_LOG_ENTRY, MAX_AP_PER_DAY, LOCATION_MAP, TIME_PHASE_MAP } from '../constants';
import { generateVillage, simulateDay, interactWithNPC } from '../services/geminiService';

export const useGameEngine = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>({
    day: 1,
    timePhase: 'Morning',
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
    const occupied = new Set<string>();
    
    // Define Zones based on 4x4 Grid and LOCATION_MAP content
    // y0: Entrance, Lake, Tomb, Reeds
    // y1: Temple, Martial, Chief, Herb
    // y2: Smith, Tavern, Stage, Bamboo
    // y3: Hunter, Altar, Tent, Cave
    const ZONES: Record<string, {x:number, y:number}[]> = {
        'Market': [{x:0, y:2}, {x:1, y:2}, {x:2, y:2}, {x:3, y:2}], // Row 2: Commercial area
        'Official': [{x:2, y:1}, {x:1, y:1}, {x:0, y:0}], // Chief's house, Martial field, Entrance
        'Temple': [{x:0, y:1}, {x:3, y:1}, {x:3, y:0}], // Daoist Temple, Herb Garden, Reeds
        'Secluded': [{x:3, y:3}, {x:1, y:3}, {x:2, y:0}, {x:2, y:3}], // Cave, Altar, Tomb, Tent
    };

    const findSlot = (zoneName: string | undefined, occupiedSet: Set<string>): {x:number, y:number} => {
        let candidates = zoneName ? ZONES[zoneName] : [];
        
        // Fallback if zone is undefined or empty: use entire grid
        if (!candidates || candidates.length === 0) {
             candidates = [];
             for(let y=0; y<4; y++) for(let x=0; x<4; x++) candidates.push({x,y});
        }
        
        // Shuffle candidates for randomness
        candidates = candidates.sort(() => Math.random() - 0.5);

        // Priority 1: Find a slot that is NOT occupied yet
        const emptySlot = candidates.find(c => !occupiedSet.has(`${c.x},${c.y}`));
        if (emptySlot) {
            return emptySlot;
        }

        // Priority 2: If all preferred slots occupied, just pick a random one from candidates (allow overlap)
        return candidates[0];
    };

    const positionMap: Record<string, {x:number, y:number}> = {};

    for (let i = 0; i < assignedNPCs.length; i++) {
        const npc = assignedNPCs[i];
        let pos = {x: 0, y: 0};
        
        let connectionTarget = null;
        if (npc.initialConnectionName) {
            // Only try to connect to someone who has ALREADY been placed
            connectionTarget = assignedNPCs.find(n => n.name === npc.initialConnectionName && positionMap[n.id]);
        }

        if (connectionTarget) {
            // Relationship Priority: Spawn near connection
            const targetPos = positionMap[connectionTarget.id];
            const offsets = [{dx:0, dy:0}, {dx:1, dy:0}, {dx:-1, dy:0}, {dx:0, dy:1}, {dx:0, dy:-1}];
            
            // Try to find valid neighbor slot
            const validNeighbors = offsets
                .map(o => ({x: targetPos.x + o.dx, y: targetPos.y + o.dy}))
                .filter(p => p.x >=0 && p.x < 4 && p.y >= 0 && p.y < 4);
            
            // Try to find empty neighbor first
            const emptyNeighbor = validNeighbors.find(p => !occupied.has(`${p.x},${p.y}`));
            
            if (emptyNeighbor) {
                pos = emptyNeighbor;
            } else {
                pos = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
            }
        } else {
            // Zone Priority
            pos = findSlot(npc.spawnZone, occupied);
        }

        positionMap[npc.id] = pos;
        assignedNPCs[i].position = pos;
        occupied.add(`${pos.x},${pos.y}`);

        // Rename Logic based on who lives there
        const {x, y} = pos;
        const currentName = newGridMap[y][x];
        const role = npc.role;
        const name = npc.name;

        let newName = currentName;
        // Only rename if it's a specific residence role
        if (role.includes('村长') || role.includes('盟主')) newName = '村长家';
        else if (role.includes('铁匠') || role.includes('藏剑')) newName = `${name.substring(0,1)}氏铁铺`;
        else if (role.includes('医') || role.includes('万花')) newName = '百草药庐';
        else if (role.includes('酒') || role.includes('栈')) newName = '稻香酒肆';
        else if (role.includes('丐')) newName = '破庙';
        else if (role.includes('天策') || role.includes('军')) newName = '演武场';
        else if (role.includes('五毒')) newName = '苗疆禁地';
        else if (role.includes('纯阳') || role.includes('道')) newName = '道观';
        
        // Update map name if changed
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
        const rawNPCs = await generateVillage(10);
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

                    // Fix: Check if source relationship already exists to prevent duplicates
                    const existingSourceRel = npc.relationships.find(r => r.targetId === target.id);
                    if (!existingSourceRel) {
                        npc.relationships.push({
                            targetId: target.id,
                            targetName: target.name,
                            type: type,
                            affinity: affinity,
                            trust: trust,
                            knownSecrets: []
                        });
                    }
                    
                    const reciprocalTypeMap: Record<string, RelationshipType> = {
                        'Lover': 'Lover', 'Enemy': 'Enemy', 'Family': 'Family',
                        'Master': 'Disciple', 'Disciple': 'Master'
                    };
                    
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
                timePhase: 'Morning',
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
        if (type !== 'BROADCAST' && type !== 'FABRICATE') {
            targetDisplay = targetNPC ? targetNPC.name : '未知目标';
        }
    }

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
                logs: [...prev.logs, { day: prev.day, timePhase: prev.timePhase, content: `你拷问了 ${targetNPC.name}。对方神情变得 ${response.moodChange}。`, type: 'System' }]
            }));
        } catch (e) {
            console.error(e);
            setGameState(prev => ({ ...prev, isSimulating: false }));
        }
        return; 
    }

    const actionLog: LogEntry = {
        day: gameState.day,
        timePhase: gameState.timePhase,
        content: `玩家对 【${targetDisplay}】 施展了 ${typeCN[type]}: "${content}"。`,
        type: 'System'
    };

    setGameState(prev => ({
        ...prev,
        actionPoints: prev.actionPoints - cost,
        logs: [...prev.logs, actionLog]
    }));
    setPendingActions(prev => [...prev, { type, content, targetId }]);
  }, [gameState.day, gameState.timePhase, gameState.actionPoints, gameState.npcs]);

  const undoLastAction = useCallback(() => {
    if (pendingActions.length === 0) return;
    
    const lastAction = pendingActions[pendingActions.length - 1];
    setPendingActions(prev => prev.slice(0, -1));

    setGameState(prev => {
        const typeCN: Record<string, string> = {
            'WHISPER': '传音入密', 'BROADCAST': '江湖传闻', 'FABRICATE': '散布谣言', 'INCEPTION': '心魔植入'
        };
        
        let targetDisplay = '全体侠士';
        if (lastAction.type !== 'BROADCAST' && lastAction.type !== 'FABRICATE' && lastAction.targetId) {
             const t = prev.npcs.find(n => n.id === lastAction.targetId);
             targetDisplay = t ? t.name : '未知目标';
        }
        
        const logContentToMatch = `玩家对 【${targetDisplay}】 施展了 ${typeCN[lastAction.type]}: "${lastAction.content}"。`;
        const logIndex = prev.logs.map(l => l.content).lastIndexOf(logContentToMatch);
        
        let newLogs = prev.logs;
        if (logIndex !== -1) {
             newLogs = prev.logs.filter((_, i) => i !== logIndex);
        }

        return {
            ...prev,
            actionPoints: Math.min(MAX_AP_PER_DAY, prev.actionPoints + 1),
            logs: newLogs
        };
    });
  }, [pendingActions]);

  // Renamed from endDay to advanceTime
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
            timePhase: gameState.timePhase,
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
                const statUpdate = result.statUpdates?.find(s => s.npcName === npc.name);
                
                let newRelationships = [...npc.relationships];
                relUpdates.forEach(update => {
                    const target = prev.npcs.find(n => n.name === update.targetName);
                    if (target) {
                        const existingRelIndex = newRelationships.findIndex(r => r.targetId === target.id);
                        const newTypeVal = (update.newType as RelationshipType) || 'None';
                        
                        if (existingRelIndex >= 0) {
                            const currentRel = newRelationships[existingRelIndex];
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

                // 1. Calculate New Stats
                let newHp = npc.hp;
                let newMp = npc.mp;
                let newSan = npc.san;
                
                if (statUpdate) {
                    newHp = Math.max(0, Math.min(100, npc.hp + statUpdate.hpChange));
                    newMp = Math.max(0, Math.min(100, npc.mp + statUpdate.mpChange));
                    newSan = Math.max(0, Math.min(100, npc.san + statUpdate.sanChange));
                    
                    // --- Added Feature: Log MP Growth ---
                    if (statUpdate.mpChange > 0) {
                        newLogs.push({
                            day: gameState.day,
                            timePhase: gameState.timePhase,
                            npcName: npc.name,
                            content: `${npc.name} 武学精进！武力值提升了 ${statUpdate.mpChange} 点。`,
                            type: 'System'
                        });
                    }
                }

                // 2. Determine Logic-based Status (Strict Override)
                // Default to AI suggestion or keep current
                let computedStatus = (statusUpdate?.status as any) || npc.status;
                const inactiveStates = ['Dead', 'Jailed', 'Left Village', 'Escaped'];
                
                // If previously inactive, keep inactive (Dead stays Dead)
                if (inactiveStates.includes(npc.status)) {
                    computedStatus = npc.status;
                } else {
                    // Force Status based on Stats
                    if (newHp <= 0) {
                        computedStatus = 'Dead';
                        newHp = 0; // Cap at 0
                    } else if (newHp < 20) {
                        // Force Injured if not already Dead
                        computedStatus = 'Injured';
                    } else if (newSan > 80) {
                        computedStatus = 'QiDeviated';
                    } else if (computedStatus === 'Injured' && newHp >= 20) {
                        // Heal back to normal if previously injured and now HP >= 20
                        computedStatus = 'Normal';
                    } else if (computedStatus === 'QiDeviated' && newSan < 80) {
                        // Recover sanity
                        computedStatus = 'Normal';
                    }
                }

                // 3. Movement
                let newPosition = npc.position;
                const isInactive = inactiveStates.includes(computedStatus);
                const wasInactive = inactiveStates.includes(npc.status);

                if (isInactive || wasInactive) {
                    newPosition = npc.position;
                } else if (statusUpdate?.newPosition) {
                    const { x, y } = statusUpdate.newPosition;
                    if (x >= 0 && x < 4 && y >= 0 && y < 4) newPosition = { x, y };
                }

                return {
                    ...npc,
                    status: computedStatus,
                    hp: newHp,
                    mp: newMp,
                    san: newSan,
                    currentMood: statusUpdate?.mood || npc.currentMood,
                    position: newPosition,
                    relationships: newRelationships
                };
            });

            // Calculate Time Advancement
            let nextTimePhase: TimePhase = 'Morning';
            let nextDay = prev.day;
            if (prev.timePhase === 'Morning') nextTimePhase = 'Afternoon';
            else if (prev.timePhase === 'Afternoon') nextTimePhase = 'Evening';
            else if (prev.timePhase === 'Evening') nextTimePhase = 'Night';
            else if (prev.timePhase === 'Night') {
                nextTimePhase = 'Morning';
                nextDay += 1;
            }

            return {
                ...prev,
                npcs: updatedNPCs,
                logs: [...prev.logs, ...newLogs],
                intelInventory: [...prev.intelInventory, ...newIntel],
                lastNewspaper: result.newspaper?.headline ? result.newspaper : null, // Only show if valid
                gameOutcome: result.gameOutcome || null,
                isSimulating: false,
                day: nextDay, 
                timePhase: nextTimePhase,
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
    // Only resets the modal, does not advance day anymore (time advances in endDay)
    setGameState(prev => ({ ...prev, lastNewspaper: null }));
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
