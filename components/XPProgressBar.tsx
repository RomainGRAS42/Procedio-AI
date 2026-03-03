import React from 'react';
import { getMinXPForLevel, getNextLevelXP, getLevelTitle } from '../lib/xpSystem';

interface XPProgressBarProps {
  currentXP: number;
  currentLevel: number;
}

const XPProgressBar: React.FC<XPProgressBarProps> = ({ currentXP, currentLevel }) => {
  
  const xpForCurrentLevel = getMinXPForLevel(currentLevel);
  // Logic from lib: getNextLevelXP handles the +1 or cap logic
  const xpForNextLevel = getNextLevelXP(currentLevel);
  
  const xpInCurrentLevel = Math.max(0, currentXP - xpForCurrentLevel);
  const xpNeededForNextLevel = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const progressPercentage = Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNextLevel) * 100));
  const xpRemaining = Math.max(0, xpForNextLevel - currentXP);

  const currentTitle = getLevelTitle(currentLevel);
  const nextTitle = getLevelTitle(currentLevel + 1);

  return (
    <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xl shadow-indigo-500/5 mb-0 relative overflow-hidden group hover:border-indigo-200 transition-all duration-500 h-full flex flex-col justify-center">
      {/* Decorative background - Vibrant & Dynamic */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent blur-[60px] rounded-full -z-10 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700"></div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xl font-black shadow-xl shadow-indigo-200 border border-slate-800 relative group-hover:scale-105 transition-transform">
            {currentLevel}
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-[9px] flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
              <i className="fa-solid fa-bolt"></i>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-black text-slate-900 text-base tracking-tight leading-none">
                Niveau {currentLevel}
              </h3>
              <span className="text-xs font-black text-indigo-600 tracking-tight">{currentTitle}</span>
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="text-slate-900">{xpInCurrentLevel}</span> / {xpNeededForNextLevel} XP
            </p>
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end hidden sm:flex">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Prochain Grade
          </p>
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
            <span className="font-black text-slate-800 text-[9px] uppercase tracking-tight">{nextTitle}</span>
            <i className="fa-solid fa-chevron-right text-[7px] text-slate-300"></i>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full animate-shimmer"></div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-indigo-700 text-[9px] font-black">
              {Math.round(progressPercentage)}%
            </span>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Progression</p>
          </div>
          <p className="text-[9px] font-black text-slate-900 uppercase tracking-[0.05em] flex items-center gap-1.5">
            Plus que <span className="text-indigo-600">{xpRemaining} XP</span> ! 🚀
          </p>
        </div>
      </div>

      {/* Add shimmer animation to CSS */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default XPProgressBar;
