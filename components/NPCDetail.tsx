
import React, { useState } from 'react';
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
  const [showBackstory, setShowBackstory] = useState(false);

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

  // Calculate Battle Power
  const battlePower = Math.floor(npc.mp * 1.5 + npc.hp * 0.5);

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
    <div className="p-4 font-mono text-sm space-y-4 relative h-full flex flex-col">
      <div className="border-b border-retro-border pb-2 mb-2">
        <h2 className="text-xl font-bold text-retro-accent flex items-center justify-between">
            {npc.name}
            <div className="flex gap-1">
                {isDead && <span className="text-retro-red text-[10px] border border-retro-red px-1">已死亡</span>}
                {isQiDeviated && <span className="text-purple-500 text-[10px] border border-purple-500 px-1 animate-pulse">走火入魔</span>}
                {isInjured && <span className="text-orange-500 text-[10px] border border-orange-500 px-1 animate-pulse">重伤</span>}
            </div>
        </h2>
        <div className="flex justify-between text-stone-400 text-xs mt-1">
          <span>{npc.role}</span>
          <span>{npc.gender === 'Male' ? '男' : '女'} / {npc.age}岁</span>
        </div>
      </div>
      
      {/* RPG Stats Section */}
      <div className="bg-black/20 p-2 rounded border border-white/5 relative overflow-hidden">
        {/* Battle Power Display */}
        <div className="absolute right-2 top-2 text-right opacity-20 pointer-events-none">
            <div className="text-4xl font-black">⚔️</div>
        </div>
        <div className="flex justify-between items-end mb-2 border-b border-white/10 pb-2">
            <span className="text-retro-text text-xs uppercase font-bold">综合战力</span>
            <span className="text-xl font-black text-amber-500 font-serif tracking-widest">{battlePower}</span>
        </div>

        <StatBar label="气血 (HP)" value={npc.hp} colorClass={isInjured ? "bg-red-800 animate-pulse" : "bg-retro-red"} />
        <StatBar label="武力 (MP)" value={npc.mp} colorClass="bg-retro-accent" />
        <StatBar label="入魔 (SAN)" value={npc.san} colorClass={isQiDeviated ? "bg-purple-500 animate-pulse" : "bg-purple-600"} />
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

      {/* Backstory Button */}
      <button 
        onClick={() => setShowBackstory(true)}
        className="w-full py-2 bg-stone-800 border border-stone-600 text-stone-300 hover:text-retro-accent hover:border-retro-accent transition-colors flex items-center justify-center gap-2"
      >
        <span>📜</span> 查看生平往事
      </button>

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
                    isInjured ? 'text-red-500 font-bold' :
                    'text-retro-accent'
                }>{statusCN}</span>
            </div>
        </div>
      </div>

      {/* Relationships Mini View */}
      <div className="flex-1 overflow-hidden flex flex-col">
         <h3 className="text-retro-text text-xs uppercase font-bold mb-1">人际关系</h3>
         <div className="space-y-1 overflow-y-auto pr-1 flex-1">
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

      {/* Backstory Modal/Overlay */}
      {showBackstory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#e8e4d9] text-[#1a1815] w-full max-w-md max-h-[80vh] overflow-y-auto rounded-sm border-4 border-[#2b2724] shadow-2xl relative flex flex-col">
                <button 
                    onClick={() => setShowBackstory(false)}
                    className="absolute top-2 right-2 text-2xl font-bold leading-none hover:text-retro-red w-8 h-8 flex items-center justify-center"
                >
                    &times;
                </button>
                
                <div className="p-6 pb-2 border-b border-[#1a1815]/20">
                    <h3 className="text-2xl font-serif font-black mb-1">{npc.name}</h3>
                    <div className="text-xs text-[#5d5750] font-bold uppercase tracking-widest">生平往事 · 绝密卷宗</div>
                </div>
                
                <div className="p-6 font-serif text-base leading-relaxed text-justify whitespace-pre-wrap">
                    {npc.backstory || "暂无记录。"}
                </div>

                <div className="p-4 bg-[#d6cfc7] border-t border-[#1a1815]/20 text-center">
                    <span className="text-xs font-bold text-[#5d5750]">稻香村情报网 · 绝密</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default NPCDetail;
