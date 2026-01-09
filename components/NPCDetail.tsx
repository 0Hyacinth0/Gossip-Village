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
  
  // Use map or fallback to original string
  const statusCN = STATUS_MAP[npc.status] || npc.status;

  return (
    <div className="p-4 font-mono text-sm space-y-4">
      <div className="border-b border-retro-border pb-2 mb-2">
        <h2 className="text-xl font-bold text-retro-accent flex items-center justify-between">
            {npc.name}
            {isDead && <span className="text-retro-red text-xs border border-retro-red px-1">已死亡</span>}
            {isHeartbroken && <span className="text-purple-400 text-xs border border-purple-400 px-1">心碎</span>}
            {isEscaped && <span className="text-orange-400 text-xs border border-orange-400 px-1">已逃亡</span>}
        </h2>
        <div className="flex justify-between text-stone-400 text-xs mt-1">
          <span>{npc.role}</span>
          <span>年龄: {npc.age}</span>
        </div>
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
                    npc.status === 'Heartbroken' ? 'text-purple-400' :
                    npc.status === 'Escaped' ? 'text-orange-400' :
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
