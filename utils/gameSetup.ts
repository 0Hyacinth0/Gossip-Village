
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
    const occupied = new Set<string>();
    
    const ZONES: Record<string, {x:number, y:number}[]> = {
        'Market': [{x:0, y:2}, {x:1, y:2}, {x:2, y:2}, {x:3, y:2}], 
        'Official': [{x:2, y:1}, {x:1, y:1}, {x:0, y:0}], 
        'Temple': [{x:0, y:1}, {x:3, y:1}, {x:3, y:0}], 
        'Secluded': [{x:3, y:3}, {x:1, y:3}, {x:2, y:0}, {x:2, y:3}], 
    };

    const findSlot = (zoneName: string | undefined, occupiedSet: Set<string>): {x:number, y:number} => {
        let candidates = zoneName ? ZONES[zoneName] : [];
        if (!candidates || candidates.length === 0) {
             candidates = [];
             for(let y=0; y<4; y++) for(let x=0; x<4; x++) candidates.push({x,y});
        }
        candidates = candidates.sort(() => Math.random() - 0.5);

        const emptySlot = candidates.find(c => !occupiedSet.has(`${c.x},${c.y}`));
        if (emptySlot) return emptySlot;

        return candidates[0];
    };

    const positionMap: Record<string, {x:number, y:number}> = {};

    for (let i = 0; i < assignedNPCs.length; i++) {
        const npc = assignedNPCs[i];
        let pos = {x: 0, y: 0};
        
        let connectionTarget = null;
        if (npc.initialConnectionName) {
            connectionTarget = assignedNPCs.find(n => n.name === npc.initialConnectionName && positionMap[n.id]);
        }

        if (connectionTarget) {
            const targetPos = positionMap[connectionTarget.id];
            const offsets = [{dx:0, dy:0}, {dx:1, dy:0}, {dx:-1, dy:0}, {dx:0, dy:1}, {dx:0, dy:-1}];
            
            const validNeighbors = offsets
                .map(o => ({x: targetPos.x + o.dx, y: targetPos.y + o.dy}))
                .filter(p => p.x >=0 && p.x < 4 && p.y >= 0 && p.y < 4);
            
            const emptyNeighbor = validNeighbors.find(p => !occupied.has(`${p.x},${p.y}`));
            if (emptyNeighbor) pos = emptyNeighbor;
            else pos = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
        } else {
            pos = findSlot(npc.spawnZone, occupied);
        }

        positionMap[npc.id] = pos;
        assignedNPCs[i].position = pos;
        occupied.add(`${pos.x},${pos.y}`);

        const {x, y} = pos;
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

    // 2. Build Relationships (Moved from component logic to here)
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
