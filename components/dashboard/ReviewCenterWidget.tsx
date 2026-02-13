import React from 'react';
import { Suggestion } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface ReviewCenterWidgetProps {
  pendingSuggestions: Suggestion[];
  masteryClaims: any[];
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onNavigateToStatistics?: () => void;
  onApproveMastery?: (requestId: string) => void;
  generatingExamId?: string | null;
}

const ReviewCenterWidget: React.FC<ReviewCenterWidgetProps> = ({
  pendingSuggestions,
  masteryClaims,
  onSelectSuggestion,
  onNavigateToStatistics,
  onApproveMastery,
  generatingExamId
}) => {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-lg">
            <i className="fa-solid fa-list-check"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
            Centre de Révision
            <InfoTooltip text="Validez les suggestions et revendications de votre équipe." />
          </h3>
        </div>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {pendingSuggestions.length} en attente
        </span>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px] scrollbar-hide">
        {masteryClaims.length > 0 && masteryClaims.map((claim) => (
          <div key={claim.id} className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100 flex flex-col gap-3 group/claim">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-graduation-cap text-orange-500"></i>
                <span className="text-[10px] font-black text-orange-700 uppercase tracking-tight">Demande de Maîtrise</span>
              </div>
              <span className="text-[8px] font-bold text-slate-400">Maintenant</span>
            </div>
            
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-800 truncate">
                {claim.procedures?.title || "Document inconnu"}
              </p>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                Par {claim.user_profiles?.first_name} {claim.user_profiles?.last_name}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1">
              {generatingExamId === claim.id ? (
                 <div className="flex-1 overflow-hidden h-8 bg-indigo-50 rounded-xl flex items-center px-3 relative border border-indigo-100">
                   <div className="absolute inset-0 bg-indigo-100/50 animate-pulse w-full h-full"></div>
                   <div className="absolute top-0 left-0 h-full bg-indigo-500/20 w-1/2 animate-[shimmer_1s_infinite]"></div>
                   <span className="relative z-10 text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                     <i className="fa-solid fa-microchip animate-pulse"></i>
                     Génération IA...
                   </span>
                 </div>
              ) : claim.status === 'approved' ? (
                <div className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 border border-emerald-400">
                  <i className="fa-solid fa-check-double scale-125"></i>
                  Quizz généré / Quizz envoyé
                </div>
              ) : (
                <button 
                  onClick={() => onApproveMastery?.(claim.id)}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  GÉNÉRER L'EXAMEN IA
                </button>
              )}
              <button className="w-10 h-8 flex items-center justify-center bg-white border border-slate-100 text-slate-400 rounded-xl hover:text-rose-500 hover:border-rose-100 transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>
        ))}

        {pendingSuggestions.slice(0, 10).map((sugg) => (
          <div key={sugg.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer" onClick={() => onSelectSuggestion(sugg)}>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${sugg.priority === 'high' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{sugg.procedureTitle}</p>
                <p className="text-[10px] font-bold text-slate-500 truncate">{sugg.userName} • {sugg.type}</p>
              </div>
            </div>
            <i className="fa-solid fa-chevron-right text-slate-300 text-[10px]"></i>
          </div>
        ))}
        {pendingSuggestions.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400 opacity-50">
            <i className="fa-solid fa-clipboard-check text-4xl mb-3"></i>
            <p className="text-xs font-bold uppercase tracking-widest">Tout est à jour</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCenterWidget;
