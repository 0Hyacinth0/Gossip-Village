import React from 'react';

interface InteractionResultModalProps {
  result: { npcName: string; question: string; reply: string } | null;
  onClose: () => void;
}

const InteractionResultModal: React.FC<InteractionResultModalProps> = ({ result, onClose }) => {
  if (!result) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
         <div className="bg-retro-panel border-2 border-retro-accent max-w-lg w-full p-4 shadow-xl">
            <div className="flex justify-between items-center mb-4 border-b border-stone-700 pb-2">
                <h3 className="text-retro-accent font-bold text-lg">对话记录: {result.npcName}</h3>
                <button onClick={onClose} className="text-stone-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-4 mb-6 text-sm font-mono">
                <div className="bg-black/30 p-3 rounded">
                    <span className="text-stone-400 block text-xs mb-1">你问道:</span>
                    <p className="text-retro-text">"{result.question}"</p>
                </div>
                <div className="bg-retro-accent/10 p-3 rounded border-l-2 border-retro-accent">
                    <span className="text-retro-accent block text-xs mb-1">{result.npcName} 回答:</span>
                    <p className="text-retro-text italic">"{result.reply}"</p>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="w-full bg-retro-accent text-retro-bg py-2 font-bold uppercase hover:bg-white"
            >
                关闭
            </button>
         </div>
    </div>
  );
};

export default InteractionResultModal;