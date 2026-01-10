
import React from 'react';
import { NPC, RelationshipType } from '../types';
import { STATUS_MAP } from '../constants';

interface NPCDetailProps {
  npc: NPC | null;
}

const RELATIONSHIP_TYPE_MAP: Record<string, string> = {
    'Lover': '情缘',
    'Enemy': '死敌',
    'Master': '师父',
    'Disciple': '徒弟',
    'Family': '亲眷',
    'Friend': '好友',
    'None': '普通'
};

const NPCDetail: React.FC<NPCDetailProps> = ({ npc }) => {
  if (!npc) {
    return (
      <div className="h-full flex items-center justify-center text-stone-600 font-mono text-xs">
        无信号目标
      </div>
    );
  }

  const isDead = npc.status === 'Dead';
  const isHeartbroken = npc.status === 'Heartbroken';
  const isEscaped = npc.status === 'Escaped';
  const isQiDeviated = npc.status === 'QiDeviated';
  const isInjured = npc.status === 'Injured';
  
  const statusCN = STATUS_MAP[npc.status] || npc.status;

  // Stat Bar Helper
  const StatBar = ({ label, value, colorClass, max = 100 }: { label: string, value: number, colorClass: string, max?: number }) => (
    <div className="flex flex-col text-xs mb-2">
      <div className="flex justify-between mb-1">
        <span className="text-stone-400">{label}</span>
        <span className="font-mono text-retro-text">{value}/{max}</span>
      </div>
      <div className="w-full h-2 bg-stone-800 rounded overflow-hidden">
        <div 
            className={`h-full transition-all duration-500 ${colorClass}`} 
            style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <div className="p-4 font-mono text-sm space-y-4">
      <div className="border-b border-retro-border pb-2 mb-2">
        <h2 className="text-xl font-bold text-retro-accent flex items-center justify-between">
            {npc.name}
            <div className="flex gap-1">
                {isDead && <span className="text-retro-red text-[10px] border border-retro-red px-1">已死亡</span>}
                {isQiDeviated && <span className="text-purple-500 text-[10px] border border-purple-500 px-1 animate-pulse">走火入魔</span>}
                {isInjured && <span className="text-orange-500 text-[10px] border border-orange-500 px-1">重伤</span>}
            </div>
        </h2>
        <div className="flex justify-between text-stone-400 text-xs mt-1">
          <span>{npc.role}</span>
          <span>{npc.gender === 'Male' ? '男' : '女'} / {npc.age}岁</span>
        </div>
      </div>
      
      {/* RPG Stats Section */}
      <div className="bg-black/20 p-2 rounded border border-white/5">
        <h3 className="text-retro-text text-xs uppercase font-bold mb-2">基础属性</h3>
        <StatBar label="气血 (HP)" value={npc.hp} colorClass="bg-retro-red" />
        <StatBar label="武力 (MP)" value={npc.mp} colorClass="bg-retro-accent" />
        <StatBar label="入魔 (SAN)" value={npc.san} colorClass="bg-purple-600" />
      </div>

      <div>
        <h3 className="text-retro-text text-xs uppercase font-bold mb-1">公开人设</h3>
        <p className="text-stone-300 bg-stone-900/50 p-2 border-l-2 border-retro-border">{npc.publicPersona}</p>
      </div>

      <div>
        <h3 className="text-retro-accent text-xs uppercase font-bold mb-1">人生目标</h3>
        <p className="text-retro-bg bg-retro-accent/80 p-2 font-bold">{npc.lifeGoal}</p>
      </div>

      <div>
        <h3 className="text-retro-red text-xs uppercase font-bold mb-1 flex items-center">
            <span className="mr-2">深层秘密</span> 
            <span className="text-[10px] bg-retro-red/20 px-1 rounded text-retro-red">仅上帝可见</span>
        </h3>
        <p className="text-stone-300 bg-stone-900/50 p-2 border-l-2 border-retro-red">{npc.deepSecret}</p>
      </div>

      <div>
        <h3 className="text-retro-text text-xs uppercase font-bold mb-1">当前状态</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-stone-800 p-1 px-2 rounded flex justify-between">
                <span className="text-stone-500">心情</span>
                <span>{npc.currentMood}</span>
            </div>
            <div className="bg-stone-800 p-1 px-2 rounded flex justify-between">
                <span className="text-stone-500">状态</span>
                <span className={
                    npc.status === 'Normal' ? 'text-retro-green' : 
                    isQiDeviated ? 'text-purple-500 font-bold' :
                    isDead ? 'text-stone-500' :
                    'text-retro-accent'
                }>{statusCN}</span>
            </div>
        </div>
      </div>

      {/* Relationships Mini View */}
      <div>
         <h3 className="text-retro-text text-xs uppercase font-bold mb-1">人际关系</h3>
         <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {npc.relationships.length === 0 && <span className="text-stone-600 italic text-xs">暂无重要关系。</span>}
            {npc.relationships.map((rel, idx) => {
                const typeCN = RELATIONSHIP_TYPE_MAP[rel.type] || rel.type;
                const isSpecial = rel.type && rel.type !== 'None' && rel.type !== 'Friend';
                
                let badgeClass = "text-stone-500 border-stone-600"; // Default
                if (rel.type === 'Lover') badgeClass = "text-pink-400 border-pink-400";
                if (rel.type === 'Enemy') badgeClass = "text-red-500 border-red-500";
                if (rel.type === 'Master' || rel.type === 'Disciple') badgeClass = "text-blue-400 border-blue-400";
                if (rel.type === 'Family') badgeClass = "text-green-400 border-green-400";

                return (
                    <div key={idx} className="flex justify-between items-center bg-black/20 p-1 px-2 text-xs border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-2">
                             <span>{rel.targetName}</span>
                             {isSpecial && (
                                <span className={`text-[9px] border px-1 rounded ${badgeClass}`}>
                                    {typeCN}
                                </span>
                             )}
                        </div>
                        <div className="flex gap-2">
                            <span className={rel.affinity > 0 ? "text-retro-green" : "text-retro-red"}>
                                {rel.affinity > 0 ? '+' : ''}{rel.affinity}
                            </span>
                        </div>
                    </div>
                );
            })}
         </div>
      </div>
    </div>
  );
};

export default NPCDetail;
