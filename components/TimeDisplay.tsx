
import React from 'react';
import { TimePhase } from '../types';

interface TimeDisplayProps {
  day: number;
  phase: TimePhase;
}

const PHASES: TimePhase[] = ['Morning', 'Afternoon', 'Evening', 'Night'];

const PHASE_CONFIG: Record<TimePhase, { label: string; icon: string; color: string; sub: string }> = {
  'Morning': { 
    label: '辰时', 
    sub: '清晨',
    icon: '🌅', 
    color: 'text-amber-200 border-amber-500/50 bg-amber-900/20' 
  },
  'Afternoon': { 
    label: '未时', 
    sub: '午后',
    icon: '☀️', 
    color: 'text-orange-300 border-orange-500/50 bg-orange-900/20' 
  },
  'Evening': { 
    label: '酉时', 
    sub: '黄昏',
    icon: '🌇', 
    color: 'text-purple-300 border-purple-500/50 bg-purple-900/20' 
  },
  'Night': { 
    label: '子时', 
    sub: '深夜',
    icon: '🌙', 
    color: 'text-blue-300 border-blue-500/50 bg-blue-900/20' 
  }
};

const TimeDisplay: React.FC<TimeDisplayProps> = ({ day, phase }) => {
  const config = PHASE_CONFIG[phase];
  const currentIndex = PHASES.indexOf(phase);

  return (
    <div className="flex items-center h-full px-2 gap-3 select-none">
      
      {/* Day Counter */}
      <div className="flex flex-col items-center justify-center leading-none px-2 border-r border-stone-700/50">
        <span className="text-[10px] text-stone-500 uppercase font-bold tracking-widest">Day</span>
        <span className="text-xl font-serif font-black text-retro-text">{day}</span>
      </div>

      {/* Visual Time Track */}
      <div className={`flex items-center gap-3 px-3 py-1 rounded border ${config.color} transition-colors duration-500`}>
        
        {/* Icon & Label */}
        <div className="flex flex-col items-center min-w-[36px]">
            <span className="text-lg leading-none mb-0.5 filter drop-shadow-md">{config.icon}</span>
            <span className="text-[10px] font-bold opacity-80">{config.label}</span>
        </div>

        {/* Progress Bar / Track */}
        <div className="flex gap-1 items-center">
            {PHASES.map((p, idx) => {
                const isActive = p === phase;
                const isPast = PHASES.indexOf(p) < currentIndex;
                
                let bgClass = 'bg-stone-800 border-stone-700';
                if (isActive) {
                    if (p === 'Morning') bgClass = 'bg-amber-500 border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
                    else if (p === 'Afternoon') bgClass = 'bg-orange-500 border-orange-300 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
                    else if (p === 'Evening') bgClass = 'bg-purple-500 border-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.5)]';
                    else if (p === 'Night') bgClass = 'bg-blue-600 border-blue-300 shadow-[0_0_8px_rgba(37,99,235,0.5)]';
                } else if (isPast) {
                    bgClass = 'bg-stone-600 border-stone-500';
                }

                return (
                    <div key={p} className="flex flex-col gap-1 items-center">
                         <div 
                            className={`w-3 h-6 rounded-sm border transition-all duration-300 ${bgClass}`}
                            title={PHASE_CONFIG[p].sub}
                         />
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default TimeDisplay;
