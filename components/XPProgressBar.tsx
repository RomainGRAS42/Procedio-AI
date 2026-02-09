import React from 'react';

interface XPProgressBarProps {
  currentXP: number;
  currentLevel: number;
}

const XPProgressBar: React.FC<XPProgressBarProps> = ({ currentXP, currentLevel }) => {
  // Calculate XP for current level and next level
  const xpForCurrentLevel = (currentLevel - 1) * 100;
  const xpForNextLevel = currentLevel * 100;
  const xpInCurrentLevel = currentXP - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = (xpInCurrentLevel / xpNeededForNextLevel) * 100;
  const xpRemaining = xpForNextLevel - currentXP;

  // Level titles based on XP
  const getLevelTitle = (level: number): string => {
    if (level <= 1) return 'Débutant';
    if (level <= 3) return 'Apprenti';
    if (level <= 5) return 'Pilote';
    if (level <= 8) return 'Expert';
    if (level <= 12) return 'Maître';
    return 'Légende';
  };

  const currentTitle = getLevelTitle(currentLevel);
  const nextTitle = getLevelTitle(currentLevel + 1);

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-indigo-500/5 mb-6 relative overflow-hidden group hover:border-indigo-200 transition-all duration-500">
      {/* Decorative background - Vibrant & Dynamic */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent blur-[80px] rounded-full -z-10 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full -z-10"></div>
      
      {/* Info Tooltip */}
      <div className="absolute top-6 right-8 z-10">
        <div className="relative group/tooltip">
          <button className="w-6 h-6 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-[10px] hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100">
            <i className="fa-solid fa-question"></i>
          </button>
          
          {/* Tooltip Content */}
          <div className="absolute top-full right-0 mt-3 w-72 bg-slate-900/95 backdrop-blur-md text-white rounded-3xl p-6 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all shadow-2xl z-50 border border-white/10">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Comment gagner de l'XP ?</p>
            <ul className="space-y-3 text-[11px] leading-relaxed font-medium">
              <li className="flex items-center justify-between">
                <span className="text-slate-400 uppercase text-[9px] font-bold">Action</span>
                <span className="text-slate-400 uppercase text-[9px] font-bold text-right">Gain</span>
              </li>
              <li className="flex items-center justify-between pt-1 border-t border-white/5">
                <span className="text-slate-200">Lecture procédure</span>
                <span className="text-emerald-400 font-black">+5 XP</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-200">Lecture flash note</span>
                <span className="text-emerald-400 font-black">+5 XP</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-200">Suggestion approuvée</span>
                <span className="text-amber-400 font-black">+50 XP</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-200">Mission accomplie</span>
                <span className="text-purple-400 font-black text-right">Variable</span>
              </li>
            </ul>
            <div className="absolute bottom-full right-6 border-8 border-transparent border-b-slate-900/95"></div>
          </div>
        </div>
      </div>
      
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
