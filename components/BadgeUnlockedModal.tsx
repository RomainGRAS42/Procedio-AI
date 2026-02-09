import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Badge } from '../types';

interface BadgeUnlockedModalProps {
  badge: Badge;
  onClose: () => void;
}

const BadgeUnlockedModal: React.FC<BadgeUnlockedModalProps> = ({ badge, onClose }) => {
  useEffect(() => {
    // Launch gold confetti for badges!
    const duration = 2 * 1000;
    const animationEnd = Date.now() + duration;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      confetti({
        particleCount: 40,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#d97706'] // Gold colors
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-fade-in" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl border border-white/20 animate-scale-in text-center overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full"></div>

        <div className="relative z-10">
          <div className="w-28 h-28 bg-amber-50 rounded-full flex items-center justify-center text-5xl shadow-inner mx-auto mb-8 border-4 border-amber-100/50">
             <i className={`fa-solid ${badge.icon || 'fa-award'} text-amber-500`}></i>
          </div>

          <p className="text-amber-600 font-black text-xs uppercase tracking-[0.4em] mb-4">Nouveau Badge Débloqué !</p>
          
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 leading-tight">
            {badge.name}
          </h2>

          <div className="bg-amber-50/50 rounded-2xl p-6 mb-10 border border-amber-100/30">
            <p className="text-slate-600 text-sm font-medium leading-relaxed italic">
              "{badge.description}"
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-10">
            <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
              +{badge.xp_reward || 0} XP Bonus
            </div>
            {badge.category && (
              <div className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                {badge.category}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 hover:-translate-y-1 transition-all shadow-xl active:scale-95"
          >
            Collectionner le badge
          </button>
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
      `}</style>
    </div>
  );
};

export default BadgeUnlockedModal;
