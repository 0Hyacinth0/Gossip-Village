import React from 'react';
import { DailyNews } from '../types';

interface NewspaperModalProps {
  news: DailyNews | null;
  day: number;
  onClose: () => void;
}

const NewspaperModal: React.FC<NewspaperModalProps> = ({ news, day, onClose }) => {
  if (!news) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#e8e4d9] text-[#1a1815] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded shadow-2xl relative border-4 border-[#2b2724]">
        
        {/* Header */}
        <div className="border-b-4 border-black p-4 text-center">
            <h1 className="text-4xl font-serif font-black uppercase tracking-tighter">村口日报</h1>
            <div className="flex justify-between text-xs font-bold border-t-2 border-black mt-2 pt-1">
                <span>第 {day} 期</span>
                <span>价格: 免费</span>
                <span>天气: 混乱</span>
            </div>
        </div>

        {/* Content */}
        <div className="p-6">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-serif font-bold leading-tight mb-4 italic">
                    "{news.headline}"
                </h2>
                <div className="w-16 h-1 bg-black mx-auto"></div>
            </div>

            <div className="space-y-4 font-serif text-sm sm:text-base text-justify">
                {news.articles.map((article, idx) => (
                    <p key={idx} className="indent-8 leading-relaxed tracking-wide">
                        {article}
                    </p>
                ))}
            </div>
        </div>

        {/* Footer / Action */}
        <div className="p-4 border-t-2 border-black bg-[#d6cfc7] flex justify-center">
            <button 
                onClick={onClose}
                className="bg-[#1a1815] text-[#e8e4d9] px-8 py-2 font-bold uppercase hover:bg-[#c9564c] transition-colors"
            >
                开启新的一天
            </button>
        </div>
      </div>
    </div>
  );
};

export default NewspaperModal;