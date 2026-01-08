import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogFeedProps {
  logs: LogEntry[];
}

const LogFeed: React.FC<LogFeedProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-full flex flex-col bg-black/40 border border-retro-border rounded overflow-hidden">
      <div className="bg-retro-panel px-3 py-1 border-b border-retro-border text-xs font-mono text-stone-400">
        系统日志
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs sm:text-sm">
        {logs.length === 0 && <div className="text-stone-600 italic">正在监听信号...</div>}
        
        {logs.map((log, idx) => (
          <div key={idx} className="flex gap-2 animate-in fade-in duration-300">
            <span className="text-stone-600 min-w-[20px]">{`[第${log.day}天]`}</span>
            
            {log.type === 'Thought' && (
               <div className="text-stone-400">
                  <span className="text-retro-accent font-bold">{log.npcName}</span> 想: 
                  <span className="italic text-stone-300"> "{log.content}"</span>
               </div>
            )}
            
            {log.type === 'Action' && (
                <div className="text-retro-text">
                    <span className="text-retro-accent font-bold">{log.npcName || '某人'}</span> 
                    <span> {log.content}</span>
                </div>
            )}

            {log.type === 'System' && (
                <div className="text-retro-green font-bold">
                    &gt; {log.content}
                </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogFeed;