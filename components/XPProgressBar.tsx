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
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-6 border border-indigo-100 shadow-sm mb-6 relative overflow-hidden group">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-200/20 to-transparent rounded-full blur-3xl -z-10"></div>
      
      {/* Info Tooltip */}
      <div className="absolute top-4 right-4 z-10">
        <div className="relative group/tooltip">
          <button className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] hover:bg-indigo-200 transition-all">
            <i className="fa-solid fa-question"></i>
          </button>
          
          {/* Tooltip Content */}
          <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 text-white rounded-2xl p-4 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all shadow-2xl z-50">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Comment gagner de l'XP ?</p>
            <ul className="space-y-2 text-[11px] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">+5 XP</span>
                <span className="text-slate-300">Lire une procédure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">+5 XP</span>
                <span className="text-slate-300">Lire une flash note</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">+50 XP</span>
                <span className="text-slate-300">Suggestion approuvée</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">Variable</span>
                <span className="text-slate-300">Compléter une mission (selon difficulté)</span>
              </li>
            </ul>
            <div className="absolute bottom-full right-6 border-8 border-transparent border-b-slate-900"></div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-lg font-black shadow-lg shadow-indigo-200">
            {currentLevel}
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base tracking-tight leading-none mb-1">
              Niveau {currentLevel} - {currentTitle}
            </h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              {xpInCurrentLevel}/{xpNeededForNextLevel} XP
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">
            Prochain niveau
          </p>
          <p className="font-black text-slate-700 text-sm">
            {nextTitle}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-3 bg-slate-200/50 rounded-full overflow-hidden backdrop-blur-sm">
          <div 
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>
        
        {/* XP remaining indicator */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {Math.round(progressPercentage)}% complété
          </p>
          <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">
            Plus que {xpRemaining} XP ! 🚀
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
