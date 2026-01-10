import React from 'react';

interface GameOverModalProps {
  isOpen: boolean;
  outcome: { result: 'Victory' | 'Defeat'; reason: string } | null;
  onCloseOverlay: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ isOpen, outcome, onCloseOverlay }) => {
  if (!isOpen || !outcome) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
        <div className="max-w-lg p-8 border-4 border-retro-accent bg-retro-panel text-center flex flex-col items-center">
            <h2 className={`text-6xl font-bold mb-4 ${outcome.result === 'Victory' ? 'text-retro-green' : 'text-retro-red'}`}>
                {outcome.result === 'Victory' ? '胜利!' : '失败'}
            </h2>
            <p className="text-retro-text text-xl mb-8">
                {outcome.reason}
            </p>
            <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-retro-accent text-retro-bg font-bold uppercase hover:bg-white w-full mb-4"
            >
                重置世界
            </button>
            <button 
                onClick={onCloseOverlay}
                className="text-stone-500 hover:text-retro-text underline text-sm"
            >
                回顾往事 (查看日志)
            </button>
        </div>
    </div>
  );
};

export default GameOverModal;