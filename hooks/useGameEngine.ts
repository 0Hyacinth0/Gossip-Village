
import { useState, useCallback, useEffect } from 'react';
import { GameState, NPC, LogEntry, ActionType, IntelCard, GameMode, GameObjective, TimePhase } from '../types';
import { INITIAL_LOG_ENTRY, MAX_AP_PER_DAY, LOCATION_MAP } from '../constants';
import { generateVillage, simulateDay, interactWithNPC } from '../services/geminiService';
import { generateObjective, setupVillage } from '../utils/gameSetup';
import { processSimulationResults } from '../utils/simulationProcessor';

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
  const [interactionResult, setInteractionResult] = useState<{npcName: string, question: string, reply: string} | null>(null);
  const [pendingActions, setPendingActions] = useState<{type: string, content: string, targetId?: string}[]>([]);

  // --- Effects ---
  useEffect(() => {
    if (gameState.gameOutcome) {
        setIsGameOverOverlayOpen(true);
    }
  }, [gameState.gameOutcome]);

  // --- Actions ---

  const startGame = async (selectedMode: GameMode) => {
    setGameState(prev => ({ ...prev, isSimulating: true }));
    setErrorMsg(null);
    try {
        const rawNPCs = await generateVillage(10);
        
        // Use utility to setup placement and relationships
        const { npcs: positionedNPCs, grid: newGridMap } = setupVillage(rawNPCs, LOCATION_MAP);
        
        // Use utility to generate objective
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

  const endDay = async () => {
    if (gameState.gameOutcome) {
        setIsGameOverOverlayOpen(true);
        return;
    }
    if (gameState.isSimulating) return;
    setGameState(prev => ({ ...prev, isSimulating: true }));

    try {
        const result = await simulateDay(gameState, pendingActions);
        
        setGameState(prev => {
            // Process logic via utility
            const processed = processSimulationResults(
                prev.npcs,
                prev.intelInventory, // PASS CURRENT INTEL
                result, 
                prev.day, 
                prev.timePhase
            );

            return {
                ...prev,
                npcs: processed.updatedNPCs,
                logs: [...prev.logs, ...processed.newLogs],
                intelInventory: [...prev.intelInventory, ...processed.newIntel],
                lastNewspaper: result.newspaper?.headline ? result.newspaper : null,
                gameOutcome: result.gameOutcome || null,
                isSimulating: false,
                day: processed.nextDay, 
                timePhase: processed.nextTimePhase,
                actionPoints: processed.nextAP
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
