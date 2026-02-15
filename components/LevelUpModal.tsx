import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface LevelUpModalProps {
  level: number;
  title: string;
  onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ level, title, onClose }) => {
  useEffect(() => {
    // Launch confetti!
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-fade-in" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl border border-white/20 animate-scale-in text-center overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500"></div>
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full"></div>

        <div className="relative z-10">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-4xl text-white font-black shadow-xl shadow-indigo-200 mx-auto mb-8 animate-bounce-subtle">
            {level}
          </div>

          <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.4em] mb-4">Nouvelle Certification Pro</p>
          
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 leading-tight">
            Promotion !
          </h2>
          <h3 className="text-xl font-bold text-slate-500 mb-8">
            Vous avez atteint le grade de <br/>
            <span className="text-indigo-600 font-black tracking-tight">{title}</span>
          </h3>

          <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed max-w-[280px] mx-auto">
            Votre statut au sein de l'entreprise a évolué. Continuez à valider vos compétences !
          </p>

          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 hover:-translate-y-1 transition-all shadow-xl active:scale-95"
          >
            Continuer la progression
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
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LevelUpModal;
