import React from 'react';
import { NPC, Relationship } from '../types';
import { STATUS_MAP } from '../constants';

interface VillageMapProps {
  npcs: NPC[];
  onSelectNPC: (npc: NPC) => void;
  selectedNPC: NPC | null;
  gridSize?: number;
  locationNames: string[][];
}

const VillageMap: React.FC<VillageMapProps> = ({ npcs, onSelectNPC, selectedNPC, gridSize = 4, locationNames }) => {
  
  const renderCell = (x: number, y: number) => {
    const npcsInCell = npcs.filter(n => n.position.x === x && n.position.y === y);
    // Use dynamic location map
    const locationName = locationNames[y]?.[x] || '未知区域';
    
    // Check if cell contains any NPC
    const isEmpty = npcsInCell.length === 0;
    const count = npcsInCell.length;

    // Dynamic Layout Logic
    let gridLayout = 'grid-cols-1';
    if (count === 2) gridLayout = 'grid-cols-2';
    else if (count === 3 || count === 4) gridLayout = 'grid-cols-2 grid-rows-2';
    else if (count >= 5) gridLayout = 'grid-cols-3 grid-rows-2';

    const isCrowded = count >= 3;
    const isVeryCrowded = count >= 5;

    return (
      <div 
        key={`${x}-${y}`}
        className={`
            relative w-full h-24 sm:h-32 border-2 z-10 
            bg-retro-bg border-retro-border
            flex flex-col items-center justify-center transition-all p-0.5
        `}
      >
        {/* Location Label (Background) - Positioned at bottom right if crowded to avoid overlap, or kept top left */}
        <div className={`
            absolute text-stone-600 font-bold select-none z-0 pointer-events-none opacity-60
            ${isCrowded ? 'bottom-0.5 right-1 text-[9px] text-right leading-none' : 'top-1 left-1.5 text-[10px]'}
        `}>
            {locationName}
        </div>

        {isEmpty ? (
            <div className="text-stone-800 text-xs select-none">.</div>
        ) : (
            <div className={`w-full h-full grid ${gridLayout} gap-0.5 overflow-hidden z-10`}>
                {npcsInCell.map((npc, idx) => {
                    const isSelected = selectedNPC?.id === npc.id;
                    
                    // Determine relationship border color
                    let relationColor = "border-transparent";
                    if (selectedNPC && selectedNPC.id !== npc.id) {
                        const rel = selectedNPC.relationships.find(r => r.targetId === npc.id);
                        if (rel) {
                            if (rel.type === 'Lover') relationColor = "border-pink-500";
                            else if (rel.type === 'Enemy') relationColor = "border-red-600";
                            else if (rel.type === 'Master' || rel.type === 'Disciple') relationColor = "border-blue-400";
                            else if (rel.affinity > 20) relationColor = "border-retro-green";
                            else if (rel.affinity < -20) relationColor = "border-retro-red";
                        }
                    }

                    // Status visual modifiers
                    const isDead = npc.status === 'Dead';
                    const isJailed = npc.status === 'Jailed';
                    const hasLeft = npc.status === 'Left Village' || npc.status === 'Escaped';
                    const isHeartbroken = npc.status === 'Heartbroken';
                    const isInactive = isDead || isJailed || hasLeft || isHeartbroken;

                    let emoji = '😶';
                    if (isDead) emoji = '💀';
                    else if (isJailed) emoji = '⛓️';
                    else if (hasLeft) emoji = '💨';
                    else if (isHeartbroken) emoji = '💔';
                    else emoji = npc.gender === 'Male' ? '👨🏻' : '👩🏻';

                    // Dynamic styling based on crowding
                    let emojiClass = 'text-3xl mb-0';
                    let nameClass = 'text-xs';
                    let containerPadding = 'px-1';

                    if (count === 2) {
                        emojiClass = 'text-2xl mb-0';
                        nameClass = 'text-[10px]';
                    } else if (isCrowded && !isVeryCrowded) {
                         emojiClass = 'text-lg -mb-0.5';
                         nameClass = 'text-[9px] leading-tight';
                         containerPadding = 'px-0.5';
                    } else if (isVeryCrowded) {
                         emojiClass = 'text-sm -mb-0.5';
                         nameClass = 'text-[8px] leading-tight';
                         containerPadding = 'px-0';
                    }

                    // Layout span for 3rd item in 3-item grid to center it
                    const spanClass = (count === 3 && idx === 2) ? 'col-span-2 w-1/2 mx-auto' : '';

                    return (
                        <div 
                            key={npc.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isInactive) onSelectNPC(npc);
                            }}
                            className={`
                                flex flex-col items-center justify-center rounded
                                border-2 transition-all w-full h-full min-h-0
                                ${spanClass}
                                ${!isInactive ? 'cursor-pointer' : 'cursor-not-allowed pointer-events-none'}
                                ${isSelected ? 'border-retro-accent bg-retro-panel' : `${relationColor} hover:bg-stone-800`}
                                ${hasLeft ? 'border-dashed border-stone-600 bg-black/40 opacity-40 grayscale' : ''}
                                ${isDead || isJailed || isHeartbroken ? 'bg-stone-900 grayscale opacity-80' : ''}
                                ${containerPadding}
                            `}
                        >
                            <div className={`${emojiClass} filter drop-shadow-md`}>
                                {emoji}
                            </div>
                            <div className={`text-center font-bold truncate w-full ${nameClass} ${isInactive ? 'line-through text-stone-500' : 'text-retro-text'}`}>
                                {npc.name}
                            </div>
                            
                            {/* Role (only if single view) */}
                            {!isInactive && count === 1 && (
                                <div className="text-[10px] text-stone-500 truncate">{npc.role}</div>
                            )}

                            {/* Status Label for Inactive - Only show if not crowded, otherwise use icon/color */}
                            {isInactive && !isCrowded && (
                                <div className={`text-[9px] font-bold uppercase mt-0.5 px-1 rounded
                                    ${isDead ? 'text-retro-red bg-retro-red/10' : 
                                      isJailed ? 'text-stone-400 bg-stone-700' : 
                                      isHeartbroken ? 'text-purple-400 bg-purple-900/30' :
                                      'text-stone-500'}
                                `}>
                                    {STATUS_MAP[npc.status] || npc.status}
                                </div>
                            )}

                            {/* Activity Indicator */}
                            {npc.status === 'Normal' && !isInactive && isSelected && (
                                <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-retro-accent animate-pulse"></div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
      </div>
    );
  };

  const grid = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      grid.push(renderCell(x, y));
    }
  }

  // Calculate Lines
  const renderLines = () => {
    if (!selectedNPC) return null;

    const getCenter = (idx: number) => `${idx * 25 + 12.5}%`;

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {selectedNPC.relationships.map((rel, idx) => {
                const target = npcs.find(n => n.id === rel.targetId);
                if (!target) return null;

                const x1 = getCenter(selectedNPC.position.x);
                const y1 = getCenter(selectedNPC.position.y);
                const x2 = getCenter(target.position.x);
                const y2 = getCenter(target.position.y);

                let color = '#5d8a66'; // default positive green
                let dashArray = '0';
                let opacity = Math.min(1, Math.abs(rel.affinity) / 50 + 0.3);
                let width = Math.max(1, Math.abs(rel.affinity) / 20);

                if (rel.type === 'Lover') {
                    color = '#ec4899'; // Pink
                    width = 4;
                    opacity = 0.9;
                } else if (rel.type === 'Enemy') {
                    color = '#dc2626'; // Red
                    width = 3;
                    opacity = 0.9;
                } else if (rel.type === 'Master' || rel.type === 'Disciple') {
                    color = '#60a5fa'; // Blue
                    width = 2;
                    dashArray = '5,5'; // Dashed for master/disciple
                    opacity = 0.8;
                } else if (rel.type === 'Family') {
                    color = '#5d8a66'; // Green
                    width = 3;
                } else if (rel.type === 'Friend') {
                    color = '#fbbf24'; // Yellow
                    width = 2;
                    dashArray = '2,2'; // Dotted for casual friends
                } else {
                    // Fallback based on raw affinity
                    if (rel.affinity < 0) {
                        color = '#c9564c';
                    }
                }

                return (
                    <line 
                        key={idx}
                        x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={color}
                        strokeWidth={width}
                        strokeOpacity={opacity}
                        strokeLinecap="round"
                        strokeDasharray={dashArray}
                    />
                );
            })}
        </svg>
    );
  };

  return (
    <div className="p-4 bg-black/20 rounded-lg border border-retro-border shadow-inner relative">
      <div className="grid grid-cols-4 gap-2 relative">
        {renderLines()}
        {grid}
      </div>
      <div className="mt-2 text-xs text-center text-stone-500 font-mono">
        关系图: 粉色-情缘, 蓝色-师徒, 绿色-亲友, 红色-死敌
      </div>
    </div>
  );
};

export default VillageMap;
