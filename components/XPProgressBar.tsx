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
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-indigo-500/5 mb-6 relative overflow-hidden group hover:border-indigo-200 transition-all duration-500">
      {/* Decorative background - Vibrant & Dynamic */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent blur-[80px] rounded-full -z-10 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -z-10"></div>
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-2xl shadow-indigo-200 border border-slate-800 relative group-hover:scale-105 transition-transform">
            {currentLevel}
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-[10px] flex items-center justify-center border-2 border-white shadow-lg animate-pulse">
              <i className="fa-solid fa-bolt"></i>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-black text-slate-900 text-xl tracking-tight leading-none">
                Niveau {currentLevel}
              </h3>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
              <span className="text-sm font-black text-indigo-600 tracking-tight">{currentTitle}</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="text-slate-900">{xpInCurrentLevel}</span> / {xpNeededForNextLevel} XP TOTAL DANS LE RANG
            </p>
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
            Prochain Grade
          </p>
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <span className="font-black text-slate-800 text-xs uppercase tracking-tight">{nextTitle}</span>
            <i className="fa-solid fa-chevron-right text-[8px] text-slate-300"></i>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-5 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200 shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          >
            {/* Animated shine - More visible */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-full animate-shimmer"></div>
            {/* Glossy top layer */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10"></div>
          </div>
        </div>
        
        {/* XP remaining indicator */}
        <div className="flex items-center justify-between mt-3 px-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
              {Math.round(progressPercentage)}%
            </span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Progression</p>
          </div>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.1em] flex items-center gap-2">
            Plus que <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{xpRemaining} XP</span> pour le rang suivant ! 🚀
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
