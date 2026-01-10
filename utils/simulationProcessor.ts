
import { NPC, LogEntry, TimePhase, RelationshipType, IntelCard } from '../types';
import { SimulationResponse } from '../services/geminiService';
import { MAX_AP_PER_DAY } from '../constants';

interface ProcessResult {
    updatedNPCs: NPC[];
    newLogs: LogEntry[];
    newIntel: IntelCard[];
    nextDay: number;
    nextTimePhase: TimePhase;
    nextAP: number;
}

export const processSimulationResults = (
    currentNPCs: NPC[],
    currentIntel: IntelCard[], // Added parameter for deduplication
    result: SimulationResponse,
    currentDay: number,
    currentTimePhase: TimePhase
): ProcessResult => {
    
    // Initialize logs with AI provided logs
    const newLogs: LogEntry[] = result.logs.map(l => ({
        day: currentDay,
        timePhase: currentTimePhase,
        npcName: l.npcName,
        content: `${l.thought} (行动: ${l.action})`,
        type: l.thought ? 'Thought' : 'Action'
    }));

    // Process Intel with Deduplication
    const existingContentSet = new Set(currentIntel.map(i => i.content));
    const newIntel: IntelCard[] = [];
    const seenInBatch = new Set<string>();

    for (const item of result.newIntel) {
        // Filter out duplicates that exist in history or appeared earlier in this batch
        if (!existingContentSet.has(item.content) && !seenInBatch.has(item.content)) {
            newIntel.push({
                id: `intel-${Date.now()}-${Math.random()}`,
                type: 'Rumor',
                content: item.content,
                timestamp: currentDay,
                sourceId: 'simulation'
            });
            seenInBatch.add(item.content);
        }
    }

    // Process NPCs
    const updatedNPCs = currentNPCs.map(npc => {
        const statusUpdate = result.npcStatusUpdates.find(u => u.npcName === npc.name);
        const relUpdates = result.relationshipUpdates.filter(r => r.sourceName === npc.name);
        const statUpdate = result.statUpdates?.find(s => s.npcName === npc.name);
        
        let newRelationships = [...npc.relationships];
        relUpdates.forEach(update => {
            const target = currentNPCs.find(n => n.name === update.targetName);
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
            
            // Log MP Growth
            if (statUpdate.mpChange > 0) {
                newLogs.push({
                    day: currentDay,
                    timePhase: currentTimePhase,
                    npcName: npc.name,
                    content: `${npc.name} 武学精进！武力值提升了 ${statUpdate.mpChange} 点。`,
                    type: 'System'
                });
            }
        }

        // 2. Determine Logic-based Status (Strict Override)
        let computedStatus = (statusUpdate?.status as any) || npc.status;
        const inactiveStates = ['Dead', 'Jailed', 'Left Village', 'Escaped'];
        
        if (inactiveStates.includes(npc.status)) {
            computedStatus = npc.status;
        } else {
            if (newHp <= 0) {
                computedStatus = 'Dead';
                newHp = 0;
            } else if (newHp < 20) {
                computedStatus = 'Injured';
            } else if (newSan >= 90) { // Threshold raised from 80 to 90
                computedStatus = 'QiDeviated';
            } else if (computedStatus === 'Injured' && newHp >= 20) {
                computedStatus = 'Normal';
            } else if (computedStatus === 'QiDeviated' && newSan < 80) { // Recover buffer
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
    let nextDay = currentDay;
    if (currentTimePhase === 'Morning') nextTimePhase = 'Afternoon';
    else if (currentTimePhase === 'Afternoon') nextTimePhase = 'Evening';
    else if (currentTimePhase === 'Evening') nextTimePhase = 'Night';
    else if (currentTimePhase === 'Night') {
        nextTimePhase = 'Morning';
        nextDay += 1;
    }

    return {
        updatedNPCs,
        newLogs,
        newIntel,
        nextDay,
        nextTimePhase,
        nextAP: MAX_AP_PER_DAY
    };
};
