import React, { useState } from 'react';
import { ActionType, IntelCard, NPC } from '../types';
import { STATUS_MAP } from '../constants';

interface ActionPanelProps {
  actionPoints: number;
  intelInventory: IntelCard[];
  selectedNPC: NPC | null;
  onPerformAction: (type: ActionType, content: string, targetId?: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  isSimulating: boolean;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ 
  actionPoints, 
  intelInventory, 
  selectedNPC, 
  onPerformAction,
  onUndo,
  canUndo,
  isSimulating 
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [mode, setMode] = useState<ActionType>('WHISPER');

  // Map modes to Chinese labels
  const modeLabels: Record<ActionType, string> = {
    'WHISPER': '私信',
    'BROADCAST': '广播',
    'INTERROGATE': '问询',
    'FABRICATE': '伪造',
    'INCEPTION': '托梦'
  };

  const handleExecute = () => {
    let content = "";
    
    if (mode === 'FABRICATE' || mode === 'INCEPTION' || mode === 'INTERROGATE') {
      if (!customInput.trim()) return;
      content = customInput;
    } else {
      const card = intelInventory.find(c => c.id === selectedCardId);
      if (!card) return;
      content = card.content;
    }

    onPerformAction(mode, content, selectedNPC?.id);
    setCustomInput("");
    setSelectedCardId(null);
  };

  const getActionCost = (m: ActionType) => m === 'INTERROGATE' ? 2 : 1;

  // Check if selected NPC is valid for interaction
  const isTargetInactive = selectedNPC && ['Dead', 'Jailed', 'Left Village', 'Escaped', 'Heartbroken'].includes(selectedNPC.status);

  return (
    <div className="flex flex-col h-full bg-retro-panel border-t border-retro-border p-4">
      
      {/* Header: AP Display */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-retro-accent font-mono uppercase tracking-widest">
            情报注入协议
        </h3>
        <div className="flex space-x-1 items-center">
          {canUndo && (
              <button 
                  onClick={onUndo}
                  disabled={isSimulating}
                  className="mr-3 text-[10px] underline text-stone-500 hover:text-retro-red disabled:opacity-50"
              >
                  撤销
              </button>
          )}
          {[...Array(3)].map((_, i) => (
            <div 
              key={i} 
              className={`w-3 h-3 rounded-full border border-retro-accent ${i < actionPoints ? 'bg-retro-accent' : 'bg-transparent'}`} 
            />
          ))}
          <span className="ml-2 text-xs text-retro-text">AP</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4">
        {(['WHISPER', 'BROADCAST', 'INTERROGATE', 'FABRICATE', 'INCEPTION'] as ActionType[]).map(t => (
          <button
            key={t}
            onClick={() => setMode(t)}
            disabled={isSimulating}
            className={`
              flex-1 min-w-[60px] py-2 text-[10px] font-bold border 
              ${mode === t 
                ? 'bg-retro-accent text-retro-bg border-retro-accent' 
                : 'text-stone-500 border-stone-700 hover:text-stone-300'
              }
              transition-colors
            `}
          >
            {modeLabels[t]}
          </button>
        ))}
      </div>

      {/* Context Content */}
      <div className="flex-1 overflow-y-auto mb-4 bg-black/30 p-2 rounded border border-retro-border min-h-[120px]">
        {mode === 'WHISPER' || mode === 'BROADCAST' ? (
          <div className="space-y-2">
            <p className="text-xs text-stone-500 mb-2">选择情报:</p>
            {intelInventory.length === 0 && <p className="text-xs italic text-stone-600">暂无情报。</p>}
            {intelInventory.map(card => (
              <div 
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={`
                  p-2 border cursor-pointer text-xs
                  ${selectedCardId === card.id ? 'border-retro-accent bg-retro-accent/10' : 'border-stone-700 hover:border-stone-500'}
                `}
              >
                <span className="font-bold text-retro-accent">[{card.type}]</span> {card.content}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col">
             <p className="text-xs text-stone-500 mb-2">
                {mode === 'FABRICATE' ? '编写虚假谣言:' : 
                 mode === 'INCEPTION' ? '向目标植入念头:' :
                 '输入你想问的问题 (消耗2AP):'}
             </p>
             <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="flex-1 bg-transparent border border-stone-700 p-2 text-sm text-retro-text resize-none focus:border-retro-accent outline-none"
                placeholder={
                    mode === 'FABRICATE' ? "例如：王村长其实是鬼魂。" : 
                    mode === 'INCEPTION' ? "例如：你突然极度害怕鸡。" :
                    "例如：你昨晚在后山做什么？(试着诈出他的秘密)"
                }
             />
          </div>
        )}
      </div>

      {/* Target Info */}
      <div className="mb-4 text-xs h-6">
        {mode === 'WHISPER' || mode === 'INCEPTION' || mode === 'INTERROGATE' ? (
           selectedNPC ? (
             isTargetInactive ? (
                <span className="text-stone-500">目标不可用: {selectedNPC.name} ({STATUS_MAP[selectedNPC.status] || selectedNPC.status})</span>
             ) : (
                <span className="text-retro-green flex items-center gap-2">
                    目标: {selectedNPC.name}
                    {mode === 'INTERROGATE' && <span className="text-retro-red text-[10px] border border-retro-red px-1">Cost: 2 AP</span>}
                </span>
             )
           ) : (
             <span className="text-retro-red animate-pulse">! 请在地图上选择目标 !</span>
           )
        ) : (
            <span className="text-stone-500">目标: 全体村民</span>
        )}
      </div>

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={
            actionPoints < getActionCost(mode) || 
            isSimulating ||
            ((mode === 'WHISPER' || mode === 'INCEPTION' || mode === 'INTERROGATE') && (!selectedNPC || isTargetInactive)) ||
            ((mode === 'WHISPER' || mode === 'BROADCAST') && !selectedCardId) ||
            ((mode === 'FABRICATE' || mode === 'INCEPTION' || mode === 'INTERROGATE') && !customInput.trim())
        }
        className={`
            w-full py-3 font-bold uppercase tracking-widest text-sm
            border-2 transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            ${actionPoints >= getActionCost(mode) 
                ? 'bg-retro-bg text-retro-accent border-retro-accent hover:bg-retro-accent hover:text-retro-bg' 
                : 'bg-stone-800 text-stone-500 border-stone-600'
            }
        `}
      >
        {isSimulating ? 'AI 处理中...' : `执行 (${getActionCost(mode)} AP)`}
      </button>

    </div>
  );
};

export default ActionPanel;