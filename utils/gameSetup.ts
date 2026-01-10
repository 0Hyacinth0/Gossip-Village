
import { NPC, GameMode, GameObjective, RelationshipType } from '../types';

export const generateObjective = (mode: GameMode, npcs: NPC[]): GameObjective => {
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

const assignPositions = (npcs: NPC[], gridMap: string[][]): { npcs: NPC[], grid: string[][] } => {
    const newGridMap = JSON.parse(JSON.stringify(gridMap));
    const assignedNPCs = [...npcs];
    
    // Track assigned positions: npcId -> {x, y}
    const assignments: Record<string, {x: number, y: number}> = {};
    // Track occupancy to balance crowd if no specific constraints exist
    const occupiedCount: Record<string, number> = {};

    const registerPosition = (id: string, pos: {x: number, y: number}) => {
        assignments[id] = pos;
        const key = `${pos.x},${pos.y}`;
        occupiedCount[key] = (occupiedCount[key] || 0) + 1;
    };

    // 1. Definition of Zones
    const ZONES: Record<string, {x:number, y:number}[]> = {
        'Market': [{x:0, y:2}, {x:1, y:2}, {x:2, y:2}, {x:3, y:2}], 
        'Official': [{x:2, y:1}, {x:1, y:1}, {x:0, y:0}], 
        'Temple': [{x:0, y:1}, {x:3, y:1}, {x:3, y:0}], 
        'Secluded': [{x:3, y:3}, {x:1, y:3}, {x:2, y:0}, {x:2, y:3}], 
    };

    // 2. Definition of Fixed Role Locations (Based on constants.ts LOCATION_MAP)
    // Map Logic:
    // y=1, x=2: Chief (村长家)
    // y=2, x=0: Smith (打铁铺)
    // y=1, x=3: Herb (百草园)
    // y=2, x=1: Tavern (稻香酒肆)
    // y=0, x=1: Temple (道观) - Though map says y=1 x=0 is Temple, let's align with that.
    // LOCATION_MAP[1][0] is '破旧道观'
    const ROLE_LOCATIONS: Record<string, {x: number, y: number}> = {
        '村长': {x: 2, y: 1},
        '盟主': {x: 2, y: 1},
        '铁匠': {x: 0, y: 2},
        '藏剑': {x: 0, y: 2},
        '医': {x: 3, y: 1},
        '万花': {x: 3, y: 1},
        '药': {x: 3, y: 1},
        '酒': {x: 1, y: 2},
        '栈': {x: 1, y: 2},
        '小二': {x: 1, y: 2},
        '猎': {x: 0, y: 3},
        '道': {x: 0, y: 1},
        '纯阳': {x: 0, y: 1},
    };

    // Helper: Find a slot in a zone, preferring empty ones
    const getBestSlotInZone = (zoneName: string | undefined): {x:number, y:number} => {
        let candidates = zoneName ? ZONES[zoneName] : [];
        if (!candidates || candidates.length === 0) {
             candidates = [];
             for(let y=0; y<4; y++) for(let x=0; x<4; x++) candidates.push({x,y});
        }
        
        // Sort candidates by current occupancy (ascending) + random factor
        candidates.sort((a, b) => {
            const cA = occupiedCount[`${a.x},${a.y}`] || 0;
            const cB = occupiedCount[`${b.x},${b.y}`] || 0;
            return (cA - cB) + (Math.random() * 0.5 - 0.25);
        });

        return candidates[0];
    };

    // Helper: Get a neighbor or same cell
    const getRelativePosition = (center: {x:number, y:number}, type: 'Same' | 'Neighbor'): {x:number, y:number} => {
        if (type === 'Same') return { ...center };
        
        const offsets = [{dx:0, dy:1}, {dx:0, dy:-1}, {dx:1, dy:0}, {dx:-1, dy:0}];
        const valid = offsets
            .map(o => ({x: center.x + o.dx, y: center.y + o.dy}))
            .filter(p => p.x >=0 && p.x < 4 && p.y >= 0 && p.y < 4);
        
        if (valid.length === 0) return { ...center };
        return valid[Math.floor(Math.random() * valid.length)];
    };

    // --- PHASE 1: Assign Fixed Roles ---
    assignedNPCs.forEach(npc => {
        for (const key in ROLE_LOCATIONS) {
            if (npc.role.includes(key)) {
                registerPosition(npc.id, ROLE_LOCATIONS[key]);
                break;
            }
        }
    });

    // --- PHASE 2: Assign Relationships (Iterative to resolve dependencies) ---
    // We run this loop twice to handle chains (A->B->C) or reciprocal lookups
    for (let pass = 0; pass < 2; pass++) {
        assignedNPCs.forEach(npc => {
            if (assignments[npc.id]) return; // Already placed

            if (npc.initialConnectionName) {
                const target = assignedNPCs.find(n => n.name === npc.initialConnectionName);
                if (target && assignments[target.id]) {
                    // Target is placed, place self relative to them
                    const targetPos = assignments[target.id];
                    const type = npc.initialConnectionType;
                    
                    if (type === 'Lover' || type === 'Master' || type === 'Disciple') {
                        // High chance to stay in same cell
                        const mode = Math.random() < 0.8 ? 'Same' : 'Neighbor';
                        registerPosition(npc.id, getRelativePosition(targetPos, mode));
                    } else if (type === 'Family') {
                        // 50/50 Same or Neighbor
                        const mode = Math.random() < 0.5 ? 'Same' : 'Neighbor';
                        registerPosition(npc.id, getRelativePosition(targetPos, mode));
                    } else if (type === 'Enemy') {
                        // Do not force adjacency for enemies, let them spawn by zone normally
                        // so we simply skip here and let Phase 3 handle it
                    } else {
                        // Friends -> Neighbors
                        registerPosition(npc.id, getRelativePosition(targetPos, 'Neighbor'));
                    }
                }
            }
        });
    }

    // --- PHASE 3: Assign Remaining by Zone ---
    assignedNPCs.forEach(npc => {
        if (!assignments[npc.id]) {
            // One last check: if they have a connection that wasn't placed yet, place the target first!
            if (npc.initialConnectionName) {
                const target = assignedNPCs.find(n => n.name === npc.initialConnectionName);
                
                // If target exists and is NOT placed, place target now based on their zone
                if (target && !assignments[target.id]) {
                    const tPos = getBestSlotInZone(target.spawnZone);
                    registerPosition(target.id, tPos);
                }

                // If target is NOW placed (was placed just above or before)
                if (target && assignments[target.id]) {
                     const targetPos = assignments[target.id];
                     const type = npc.initialConnectionType;
                     // Same logic as Phase 2
                     if (['Lover', 'Master', 'Disciple'].includes(type || '')) {
                         registerPosition(npc.id, getRelativePosition(targetPos, 'Same'));
                     } else if (type === 'Family') {
                         registerPosition(npc.id, getRelativePosition(targetPos, Math.random() < 0.5 ? 'Same' : 'Neighbor'));
                     } else if (type === 'Enemy') {
                         registerPosition(npc.id, getBestSlotInZone(npc.spawnZone));
                     } else {
                         registerPosition(npc.id, getRelativePosition(targetPos, 'Neighbor'));
                     }
                } else {
                    // No target found or target invalid
                    registerPosition(npc.id, getBestSlotInZone(npc.spawnZone));
                }
            } else {
                // No connections
                registerPosition(npc.id, getBestSlotInZone(npc.spawnZone));
            }
        }
    });

    // Apply Assignments
    assignedNPCs.forEach(npc => {
        if (assignments[npc.id]) {
            npc.position = assignments[npc.id];
        }
    });

    // Rename Logic (Flavor)
    for (let i = 0; i < assignedNPCs.length; i++) {
        const npc = assignedNPCs[i];
        const {x, y} = npc.position;
        const currentName = newGridMap[y][x];
        const role = npc.role;
        const name = npc.name;

        let newName = currentName;
        if (role.includes('村长') || role.includes('盟主')) newName = '村长家';
        else if (role.includes('铁匠') || role.includes('藏剑')) newName = `${name.substring(0,1)}氏铁铺`;
        else if (role.includes('医') || role.includes('万花')) newName = '百草药庐';
        else if (role.includes('酒') || role.includes('栈')) newName = '稻香酒肆';
        else if (role.includes('丐')) newName = '破庙';
        else if (role.includes('天策') || role.includes('军')) newName = '演武场';
        else if (role.includes('五毒')) newName = '苗疆禁地';
        else if (role.includes('纯阳') || role.includes('道')) newName = '道观';
        
        if (newName !== currentName) {
            newGridMap[y][x] = newName;
        }
    }

    return { npcs: assignedNPCs, grid: newGridMap };
};

export const setupVillage = (rawNPCs: NPC[], locationMap: string[][]): { npcs: NPC[], grid: string[][] } => {
    // 1. Position them
    const { npcs: positionedNPCs, grid: newGridMap } = assignPositions(rawNPCs, locationMap);

    // 2. Build Relationships
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

                // Check if source relationship already exists
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

    return { npcs: positionedNPCs, grid: newGridMap };
};
