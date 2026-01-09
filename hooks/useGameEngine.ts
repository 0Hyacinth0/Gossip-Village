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

  // --- Actions ---

  const startGame = async (selectedMode: GameMode) => {
    setGameState(prev => ({ ...prev, isSimulating: true }));
    setErrorMsg(null);
    try {
        // Generate 10 Villagers for more complexity
        const rawNPCs = await generateVillage(10);
        
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

            // Wuxia/JX3 Sect Mapping Logic
            if (r.includes('村长') || n.includes('村长') || r.includes('盟主')) householdKey = 'CHIEF';
            else if (r.includes('藏剑') || r.includes('铁匠') || r.includes('铸')) householdKey = 'HIDDEN_SWORD';
            else if (r.includes('万花') || r.includes('医') || r.includes('药') || r.includes('琴')) householdKey = 'WAN_HUA';
            else if (r.includes('杂货') || r.includes('商') || r.includes('镖')) householdKey = 'MERCHANT';
            else if (r.includes('天策') || r.includes('军') || r.includes('将') || r.includes('猎')) householdKey = 'TIAN_CE';
            else if (r.includes('纯阳') || r.includes('道') || r.includes('剑客')) householdKey = 'CHUN_YANG';
            else if (r.includes('少林') || r.includes('和尚') || r.includes('僧')) householdKey = 'SHAOLIN';
            else if (r.includes('书生') || r.includes('秀才') || r.includes('长歌')) householdKey = 'SCHOLAR';
            else if (r.includes('丐') || r.includes('乞') || r.includes('流浪')) householdKey = 'BEGGAR';
            else if (r.includes('七秀') || r.includes('舞') || r.includes('女侠')) householdKey = 'QI_XIU';
            else if (r.includes('唐门') || r.includes('刺客') || r.includes('暗器')) householdKey = 'TANG_SECT';
            else if (r.includes('五毒') || r.includes('蛊') || r.includes('巫')) householdKey = 'FIVE_VENOMS';
            else if (r.includes('明教') || r.includes('波斯') || r.includes('火')) householdKey = 'MING_JIAO';
            else if (r.includes('恶人') || r.includes('匪') || r.includes('盗')) householdKey = 'VILLAIN';
            else if (r.includes('酒') || r.includes('厨') || r.includes('小二')) householdKey = 'INN';
            
            let pos;
            if (householdKey && householdLocations[householdKey]) {
                // Join existing household
                pos = householdLocations[householdKey];
            } else {
                // Find a new slot
                pos = availableSlots.pop() || {x: 0, y: 0};
                if (householdKey) householdLocations[householdKey] = pos;

                // Update Map Name Logic with Wuxia flavors BUT scaled down to village size
                let locName = `${n}居`; // Default generic
                
                // Specific Location Mappings (Village Scale)
                if (householdKey === 'CHIEF') locName = '村长家';
                else if (householdKey === 'HIDDEN_SWORD') locName = '叶家铁铺';
                else if (householdKey === 'WAN_HUA') locName = '村口医庐';
                else if (householdKey === 'MERCHANT') locName = '杂货摊';
                else if (householdKey === 'TIAN_CE') locName = '校场';
                else if (householdKey === 'CHUN_YANG') locName = '小道观';
                else if (householdKey === 'SHAOLIN') locName = '知客寮';
                else if (householdKey === 'SCHOLAR') locName = '私塾';
                else if (householdKey === 'BEGGAR') locName = '破庙一角';
                else if (householdKey === 'QI_XIU') locName = '水榭';
                else if (householdKey === 'TANG_SECT') locName = '竹林小屋';
                else if (householdKey === 'FIVE_VENOMS') locName = '苗疆木屋';
                else if (householdKey === 'MING_JIAO') locName = '异域营帐';
                else if (householdKey === 'VILLAIN') locName = '黑店';
                else if (householdKey === 'INN') locName = '稻香酒肆';
                
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
