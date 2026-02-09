import React from 'react';
import { Suggestion } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface ReviewCenterWidgetProps {
  pendingSuggestions: Suggestion[];
  masteryClaims: any[];
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onNavigateToStatistics?: () => void;
}

const ReviewCenterWidget: React.FC<ReviewCenterWidgetProps> = ({
  pendingSuggestions,
  masteryClaims,
  onSelectSuggestion,
  onNavigateToStatistics
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
        {masteryClaims.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-center justify-between animate-pulse cursor-pointer hover:bg-amber-100 transition-colors"
               onClick={onNavigateToStatistics}
          >
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-medal text-amber-500"></i>
              <span className="text-xs font-black text-amber-700 uppercase tracking-tight">{masteryClaims.length} Revendication(s)</span>
            </div>
            <i className="fa-solid fa-arrow-right text-amber-500 text-xs"></i>
          </div>
        )}

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
