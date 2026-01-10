
import React from 'react';
import { APP_CONFIG } from '../config/appConfig';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const tiers = [
    { amount: 5, label: '请杯茶水', color: 'border-stone-500 text-stone-300' },
    { amount: 10, label: '加个鸡腿', color: 'border-retro-accent text-retro-accent' },
    { amount: 20, label: '服务器续费', color: 'border-retro-red text-retro-red' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-retro-panel border-2 border-retro-accent max-w-3xl w-full p-6 shadow-2xl relative flex flex-col">
        <button 
            onClick={onClose}
            className="absolute top-2 right-2 text-stone-500 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center"
        >
            ✕
        </button>

        <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-retro-accent mb-2">支持开发者</h2>
            <p 
                className="text-stone-400 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: APP_CONFIG.SUPPORT_MESSAGE }}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {tiers.map((tier) => (
                <div key={tier.amount} className={`flex flex-col items-center p-4 border-2 bg-black/20 rounded-lg ${tier.color} transition-transform hover:scale-105`}>
                    <h3 className="text-2xl font-black mb-1 font-serif">¥ {tier.amount}</h3>
                    <span className="text-xs uppercase tracking-widest mb-4 opacity-80 font-bold">{tier.label}</span>
                    
                    {/* Placeholder QR Code */}
                    <div className="w-40 h-40 bg-white p-2 mb-2 rounded-sm shadow-inner">
                        <img 
                            src={`https://placehold.co/150x150/black/white?text=QR+Code+${tier.amount}`} 
                            alt={`QR Code for ${tier.amount}`}
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono">微信 / 支付宝</span>
                </div>
            ))}
        </div>

        <div className="text-center">
            <button 
                onClick={onClose}
                className="px-8 py-2 bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider rounded"
            >
                下次一定
            </button>
        </div>
      </div>
    </div>
  );
};

export default SupportModal;
        