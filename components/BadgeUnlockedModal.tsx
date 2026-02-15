import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Badge } from '../types';
import { getMinXPForLevel, getNextLevelXP, getLevelTitle } from '../lib/xpSystem';

interface BadgeUnlockedModalProps {
  badge: Badge;
  onClose: () => void;
  currentXP: number;
  currentLevel: number;
}

const BadgeUnlockedModal: React.FC<BadgeUnlockedModalProps> = ({ badge, onClose, currentXP, currentLevel }) => {
  const [isAnimatingXP, setIsAnimatingXP] = useState(false);
  const [displayXP, setDisplayXP] = useState(currentXP - (badge.xp_reward || 0));

  useEffect(() => {
    // Launch gold confetti for badges!
    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#d97706']
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  const handleCollect = () => {
    if (badge.xp_reward && badge.xp_reward > 0) {
      setIsAnimatingXP(true);
      // Start XP increment animation
      setTimeout(() => {
        setDisplayXP(currentXP);
        // After transition time, close
        setTimeout(() => {
          onClose();
        }, 1500);
      }, 100);
    } else {
      onClose();
    }
  };

  // XP Progress Bar Logic (similar to Dashboard)
  const xpForCurrentLevel = getMinXPForLevel(currentLevel);
  const xpForNextLevel = getNextLevelXP(currentLevel);
  const xpNeededForNextLevel = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  
  const initialXPInLevel = Math.max(0, (currentXP - (badge.xp_reward || 0)) - xpForCurrentLevel);
  const finalXPInLevel = Math.max(0, currentXP - xpForCurrentLevel);
  
  const progressPercentage = (finalXPInLevel / xpNeededForNextLevel) * 100;
  const initialPercentage = (initialXPInLevel / xpNeededForNextLevel) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl border border-white/20 animate-scale-in text-center overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full"></div>

        <div className={`relative z-10 transition-all duration-500 ${isAnimatingXP ? 'opacity-0 scale-95 pointer-events-none translate-y-10' : 'opacity-100 scale-100'}`}>
          <div className="w-28 h-28 bg-amber-50 rounded-full flex items-center justify-center text-5xl shadow-inner mx-auto mb-8 border-4 border-amber-100/50">
             <i className={`fa-solid ${badge.icon || 'fa-award'} text-amber-500`}></i>
          </div>

          <p className="text-amber-600 font-black text-xs uppercase tracking-[0.4em] mb-4">Trophée de Prestige</p>
          
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 leading-tight">
            Exploit Accompli !
          </h2>

          <div className="bg-amber-50/50 rounded-2xl p-6 mb-10 border border-amber-100/30">
            <p className="text-slate-600 text-sm font-medium leading-relaxed italic">
              "Vous recevez le titre de **{badge.name}**. <br/> {badge.description}"
            </p>
          </div>

          {(badge.xp_reward && badge.xp_reward > 0) ? (
            <div className="flex items-center justify-center gap-2 mb-10">
              <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-bounce">
                +{badge.xp_reward} XP Bonus
              </div>
            </div>
          ) : null}

          <button
            onClick={handleCollect}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 hover:-translate-y-1 transition-all shadow-xl active:scale-95"
          >
            Collectionner le badge
          </button>
        </div>

        {/* XP PROGRESS ANIMATION (DUOLINGO STYLE) */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 transition-all duration-700 ${isAnimatingXP ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90 pointer-events-none'}`}>
          <div className="w-20 h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-2xl mb-6">
            {currentLevel}
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Progression</h3>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Niveau {currentLevel} • {getLevelTitle(currentLevel)}</p>

          <div className="w-full">
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${isAnimatingXP ? Math.min(progressPercentage, 100) : Math.min(initialPercentage, 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full animate-shimmer"></div>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                XP: <span className="text-slate-900">{isAnimatingXP ? displayXP : currentXP - (badge.xp_reward || 0)}</span>
              </p>
              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                +{badge.xp_reward} XP
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-in {
          animation: scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
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

export default BadgeUnlockedModal;
