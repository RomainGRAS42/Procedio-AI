import React from 'react';

interface BadgesWidgetProps {
  earnedBadges: any[];
  onNavigate?: (view: string) => void;
}

const BadgesWidget: React.FC<BadgesWidgetProps> = ({
  earnedBadges,
  onNavigate
}) => {
  return (
    <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 hover:border-orange-100 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg border border-orange-100">
            <i className="fa-solid fa-trophy"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Mes Badges</h3>
          <div className="relative group/xp-info">
            <button className="w-5 h-5 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-[8px] hover:bg-orange-50 hover:text-orange-600 transition-all border border-slate-100">
              <i className="fa-solid fa-question"></i>
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-900 text-white rounded-2xl p-4 opacity-0 invisible group-hover/xp-info:opacity-100 group-hover/xp-info:visible transition-all z-[60] shadow-2xl border border-white/10 pointer-events-none">
              <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-3 text-center">Comment gagner de l'XP ?</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] pb-1 border-b border-white/5 opacity-50 font-black">
                  <span>ACTION</span>
                  <span>GAIN</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Lecture procédure</span>
                  <span className="text-emerald-400">+5 XP</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Lecture flash note</span>
                  <span className="text-emerald-400">+5 XP</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold">
                  <span>Suggestion approuvée</span>
                  <span className="text-amber-400">+50 XP</span>
                </div>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-slate-900"></div>
            </div>
          </div>
        </div>
        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
          {earnedBadges.length} Obtenus
        </span>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Collection active</p>
          <div className="flex flex-wrap gap-3">
            {earnedBadges.length > 0 ? (
              earnedBadges.map((ub) => (
                <div key={ub.id} className="group relative">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center gap-1 hover:border-orange-200 hover:bg-white transition-all cursor-help transform hover:-translate-y-1">
                    <i className={`fa-solid ${ub.badges.icon} text-lg text-orange-600`}></i>
                    <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter truncate w-10 text-center">
                      {ub.badges.name}
                    </span>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-3 bg-slate-900 text-white rounded-xl text-[10px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                     <p className="font-black text-orange-400 uppercase tracking-widest mb-1">{ub.badges.name}</p>
                     <p className="text-slate-300 leading-relaxed">{ub.badges.description}</p>
                     <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="w-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aucun badge débloqué</p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Prochain Défi</p>
           <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group/challenge hover:bg-white hover:border-amber-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center text-sm group-hover/challenge:bg-amber-50 group-hover/challenge:text-amber-500 transition-colors">
                  <i className="fa-solid fa-book-bookmark"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase leading-none mb-1">Lecteur Assidu</p>
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-amber-400 w-3/4 animate-pulse"></div>
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">75%</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BadgesWidget;
