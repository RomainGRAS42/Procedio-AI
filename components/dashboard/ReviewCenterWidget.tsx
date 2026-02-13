import React from 'react';
import { Suggestion } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface ReviewCenterWidgetProps {
  pendingSuggestions: Suggestion[];
  masteryClaims: any[];
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onNavigateToStatistics?: () => void;
  onApproveMastery?: (requestId: string) => void;
  onViewMasteryDetail?: (claim: any) => void;
  generatingExamId?: string | null;
}

const ReviewCenterWidget: React.FC<ReviewCenterWidgetProps> = ({
  pendingSuggestions,
  masteryClaims,
  onSelectSuggestion,
  onNavigateToStatistics,
  onApproveMastery,
  onViewMasteryDetail,
  generatingExamId
}) => {
  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-tower-control"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
            Centre de Pilotage
            <InfoTooltip text="Prenez des décisions sur les suggestions et validez l'expertise métier." />
          </h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {pendingSuggestions.length + masteryClaims.filter(c => c.status === 'pending').length} alertes
          </span>
        </div>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto max-h-[350px] scrollbar-hide pr-1">
        {masteryClaims.length > 0 && masteryClaims.map((claim) => {
          const isCompleted = claim.status === 'completed';
          const isApproved = claim.status === 'approved';
          const isPending = claim.status === 'pending';
          const score = claim.score || 0;
          const isSuccess = score >= 70;

          return (
            <div 
              key={claim.id} 
              onClick={() => isCompleted && onViewMasteryDetail?.(claim)}
              className={`p-3 rounded-2xl border border-slate-50 hover:border-slate-200 transition-all group/item ${
                isCompleted ? 'cursor-pointer hover:bg-slate-50/50' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isPending ? 'bg-orange-400 animate-pulse' : 
                    isApproved ? 'bg-indigo-400' : 
                    (isSuccess ? 'bg-emerald-400' : 'bg-rose-400')
                  }`}></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    {isCompleted ? 'Examen' : 'Expertise'}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-slate-300">
                  {new Date(claim.updated_at || claim.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="text-[13px] font-black text-slate-800 truncate leading-tight group-hover/item:text-indigo-600 transition-colors">
                    {claim.procedures?.title || "Document inconnu"}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {claim.user_profiles?.first_name} {claim.user_profiles?.last_name}
                  </p>
                </div>

                <div className="shrink-0">
                  {isCompleted ? (
                    <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                      isSuccess ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                    }`}>
                      <span className="text-[11px] font-black">{score}%</span>
                      <i className={`fa-solid ${isSuccess ? 'fa-check' : 'fa-xmark'} text-[10px]`}></i>
                    </div>
                  ) : generatingExamId === claim.id ? (
                    <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center gap-2">
                       <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i>
                       <span className="text-[9px] font-black uppercase tracking-widest">IA...</span>
                    </div>
                  ) : isApproved ? (
                    <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center gap-2">
                      <i className="fa-solid fa-paper-plane text-[10px]"></i>
                      <span className="text-[9px] font-black uppercase tracking-widest">Envoyé</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => onApproveMastery?.(claim.id)}
                      className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
                    >
                      VALIDER
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {pendingSuggestions.length > 0 && (
          <div className="pt-4 mt-2 border-t border-slate-50">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 block px-1">Suggestions</span>
            {pendingSuggestions.slice(0, 5).map((sugg) => (
              <div 
                key={sugg.id} 
                onClick={() => onSelectSuggestion(sugg)}
                className="p-3 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all cursor-pointer group/sugg flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-[12px] font-black text-slate-700 truncate leading-tight group-hover/sugg:text-indigo-600">
                    {sugg.procedureTitle}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {sugg.userName} • {sugg.type}
                  </p>
                </div>
                <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                  sugg.priority === 'high' ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}>
                  {sugg.priority}
                </div>
              </div>
            ))}
          </div>
        )}

        {pendingSuggestions.length === 0 && masteryClaims.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-300">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <i className="fa-solid fa-check-double text-2xl"></i>
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest">Tour de contrôle vide</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCenterWidget;
