import React from 'react';

interface BadgesWidgetProps {
  earnedBadges: any[];
  onNavigate?: (view: string) => void;
}

const BadgesWidget: React.FC<BadgesWidgetProps> = ({
  earnedBadges,
  onNavigate
}) => {
  // Helper to determine badge tier styling
  const getBadgeStyle = (criteriaValue: number) => {
    if (criteriaValue >= 2000) return { 
      bg: "bg-amber-50", 
      border: "border-amber-200", 
      icon: "text-amber-600", 
      shadow: "shadow-amber-500/10",
      ring: "ring-amber-100"
    }; // Gold
    if (criteriaValue >= 500) return { 
      bg: "bg-slate-50", 
      border: "border-slate-200", 
      icon: "text-slate-600", 
      shadow: "shadow-slate-500/10",
      ring: "ring-slate-100"
    }; // Silver
    return { 
      bg: "bg-orange-50", 
      border: "border-orange-100", 
      icon: "text-orange-600", 
      shadow: "shadow-orange-500/10",
      ring: "ring-orange-100"
    }; // Bronze/Standard
  };

  return (
    <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 hover:border-orange-100 transition-all h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg border border-orange-100">
            <i className="fa-solid fa-trophy"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Mes Trophées</h3>
              <div className="relative group/xp-info">
                <button className="text-slate-300 hover:text-orange-500 transition-colors cursor-help ml-1">
                  <i className="fa-solid fa-circle-info text-[0.8rem]"></i>
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-white text-slate-900 rounded-[2rem] p-6 opacity-0 invisible group-hover/xp-info:opacity-100 group-hover/xp-info:visible transition-all z-[60] shadow-2xl border border-slate-100 pointer-events-none text-left ring-1 ring-slate-900/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-trophy"></i>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">Comment obtenir des trophées</h4>
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                    Chaque action te rapporte de l'XP. Cumule l'XP pour débloquer automatiquement tes badges de spécialité.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <span className="text-[11px] font-bold text-slate-700">Lecture procédure</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Badge Novice</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                        <span className="text-[11px] font-bold text-slate-700">Missions terminées</span>
                      </div>
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">Badge Expert</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                        <span className="text-[11px] font-bold text-slate-700">Suggestions validées</span>
                      </div>
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase">Badge Innovateur</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-start gap-2">
                      <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                      <p className="text-[10px] text-slate-400 leading-tight italic">
                        L'XP est créditée instantanément. Tes trophées s'affichent dès le palier atteint.
                      </p>
                    </div>
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-white filter drop-shadow-[0_-1px_1px_rgba(0,0,0,0.05)]"></div>
                </div>
              </div>
            </div>
            <div className="inline-flex mt-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest">
              {earnedBadges.length} Obtenus
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Collection active</p>
          <div className="flex flex-wrap gap-3">
            {earnedBadges.length > 0 ? (
              earnedBadges.map((ub) => {
                const style = getBadgeStyle(ub.badges.criteria_value || 0);
                return (
                  <div key={ub.id} className="group relative">
                    <div className={`w-14 h-14 rounded-2xl ${style.bg} border ${style.border} flex flex-col items-center justify-center gap-1 hover:bg-white hover:scale-110 transition-all cursor-help transform shadow-sm ${style.shadow}`}>
                      <i className={`fa-solid ${ub.badges.icon} text-lg ${style.icon}`}></i>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate w-10 text-center leading-none">
                        {ub.badges.name}
                      </span>
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-3 bg-slate-900 text-white rounded-xl text-[10px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                       <p className={`font-black uppercase tracking-widest mb-1 ${style.icon.replace('text-', 'text-')}`}>{ub.badges.name}</p>
                       <p className="text-slate-300 leading-relaxed">{ub.badges.description}</p>
                       <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Votre parcours trophées</p>
                <p className="text-[11px] text-slate-400 mb-3">Complétez des actions pour débloquer vos premiers badges !</p>
                <div className="flex justify-center gap-2 mt-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex flex-col items-center justify-center gap-0.5 opacity-50">
                    <i className="fa-solid fa-book text-xs"></i>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Novice</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex flex-col items-center justify-center gap-0.5 opacity-50">
                    <i className="fa-solid fa-check-circle text-xs"></i>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Engagé</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex flex-col items-center justify-center gap-0.5 opacity-50">
                    <i className="fa-solid fa-trophy text-xs"></i>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Expert</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
           <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Prochain Défi</p>
           <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group/challenge hover:bg-white hover:border-amber-200 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center text-sm group-hover/challenge:bg-amber-50 group-hover/challenge:text-amber-500 transition-colors">
                  <i className="fa-solid fa-book-bookmark"></i>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-700 uppercase leading-none mb-1">Lecteur Assidu</p>
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-amber-400 w-3/4 animate-pulse"></div>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">75%</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BadgesWidget;
