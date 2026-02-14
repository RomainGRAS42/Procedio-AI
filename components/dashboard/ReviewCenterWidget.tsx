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
  onUpdateReferent?: (procedureId: string, userId: string, action: 'assign' | 'revoke') => Promise<void>;
  generatingExamId?: string | null;
  onToggleReadStatus?: (type: 'suggestion' | 'mastery', id: string, status: boolean) => void;
  onMarkAllRead?: () => void;
}

const ReviewCenterWidget: React.FC<ReviewCenterWidgetProps> = ({
  pendingSuggestions,
  masteryClaims,
  onSelectSuggestion,
  onNavigateToStatistics,
  onApproveMastery,
  onViewMasteryDetail,
  onUpdateReferent,
  generatingExamId,
  onToggleReadStatus,
  onMarkAllRead
}) => {

  const handleContextMenu = (e: React.MouseEvent, type: 'suggestion' | 'mastery', item: any) => {
    e.preventDefault();
    if (onToggleReadStatus) {
        // Toggle read status (inverse current)
        onToggleReadStatus(type, item.id, !item.isReadByManager);
    }
  };

  const alertCount = 
    pendingSuggestions.filter(s => !s.isReadByManager).length + 
    masteryClaims.filter(c => !c.isReadByManager).length;

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-tower-control"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
            Centre de Pilotage
            <InfoTooltip text="Centralise la validation des suggestions et des expertises de l'équipe. Clic droit pour marquer comme Lu/Non lu." />
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${alertCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>
            {alertCount} alertes
          </span>
          {alertCount > 0 && onMarkAllRead && (
            <button 
              onClick={(e) => { e.stopPropagation(); onMarkAllRead(); }}
              className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 group"
              title="Tout marquer comme lu"
              aria-label="Tout marquer comme lu"
            >
              <i className="fa-solid fa-check-double text-xs group-hover:scale-110 transition-transform"></i>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[600px] scrollbar-thin">
        {(() => {
          // 1. Unify items
          const allItems = [
            ...masteryClaims.map(c => ({
              ...c,
              dataType: 'mastery',
              date: c.created_at,
              title: c.procedures?.title || "Document inconnu",
              user: c.user_profiles,
              isRead: c.isReadByManager === true
            })),
            ...pendingSuggestions.map(s => ({
              ...s,
              dataType: 'suggestion',
              date: s.createdAt,
              title: s.procedureTitle,
              user: { first_name: s.userName.split(' ')[0], last_name: s.userName.split(' ')[1] || '' }, // Approximation if user obj not full
              isRead: s.isReadByManager === true
            }))
          ];

          // 2. Sort by Date Descending (Newest first)
          const sortedItems = allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          if (sortedItems.length === 0) {
            return (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-300">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                  <i className="fa-solid fa-check-double text-2xl"></i>
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest">Tout est à jour</p>
              </div>
            );
          }

          return sortedItems.map((item) => {
            const isMastery = item.dataType === 'mastery';
            
            if (isMastery) {
              const claim = item;
              const isCompleted = claim.status === 'completed';
              const isApproved = claim.status === 'approved';
              const isPending = claim.status === 'pending';
              const score = claim.score || 0;
              const isSuccess = score >= 70;
              const isRead = claim.isRead;

              return (
                <div 
                  key={`mastery-${claim.id}`}
                  onContextMenu={(e) => handleContextMenu(e, 'mastery', claim)}
                  onClick={() => {
                      if (onToggleReadStatus && !isRead) onToggleReadStatus('mastery', claim.id, true);
                      if (isCompleted) onViewMasteryDetail?.(claim);
                  }}
                  className={`p-3 rounded-2xl border transition-all group/item ${
                    !isRead ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-80'
                  } ${isCompleted ? 'cursor-pointer hover:border-indigo-200' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        !isRead ? 'bg-indigo-600 ring-2 ring-indigo-100 ring-offset-1' : 
                        isPending ? 'bg-orange-400' : 
                        isApproved ? 'bg-indigo-400' : 
                        (isSuccess ? 'bg-emerald-400' : 'bg-rose-400')
                      }`}></div>
                      <span className={`text-[10px] uppercase tracking-widest leading-none ${!isRead ? 'font-black text-indigo-900' : 'font-bold text-slate-400'}`}>
                        {isCompleted ? 'Examen' : 'Expertise'}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300">
                      {new Date(claim.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-[13px] truncate leading-tight group-hover/item:text-indigo-600 transition-colors ${
                          !isRead ? 'font-black text-slate-900' : 'font-medium text-slate-600'
                      }`}>
                        {claim.title}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {claim.user?.first_name} {claim.user?.last_name}
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
                          onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleReadStatus && !isRead) onToggleReadStatus('mastery', claim.id, true);
                              onApproveMastery?.(claim.id);
                          }}
                          className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
                        >
                          VALIDER
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              const sugg = item;
              const isRead = sugg.isRead;
              const isApproved = sugg.status === 'approved';
              const isRejected = sugg.status === 'rejected';
              
              return (
                <div 
                  key={`suggestion-${sugg.id}`}
                  onContextMenu={(e) => handleContextMenu(e, 'suggestion', sugg)}
                  className={`p-3 rounded-2xl border transition-all group/sugg flex items-center justify-between gap-4 ${
                      !isRead ? 'bg-white border-amber-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-80 hover:bg-slate-100'
                  }`}
                >
                  <div 
                      onClick={() => {
                          if (onToggleReadStatus && !isRead) onToggleReadStatus('suggestion', sugg.id, true);
                          onSelectSuggestion(sugg);
                      }}
                      className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${!isRead ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <span className={`text-[9px] uppercase tracking-widest leading-none ${!isRead ? 'font-black text-amber-600' : 'font-bold text-slate-400'}`}>Suggestion</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-300">
                        {new Date(sugg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className={`text-[12px] truncate leading-tight transition-colors ${
                        !isRead ? 'font-black text-slate-900 group-hover/sugg:text-amber-600' : 'font-medium text-slate-600'
                    }`}>
                      {sugg.title}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      {sugg.userName}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {isApproved ? (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center gap-2">
                            <i className="fa-solid fa-check text-[10px]"></i>
                            <span className="text-[9px] font-black uppercase tracking-widest">Validé</span>
                        </div>
                    ) : isRejected ? (
                        <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-2">
                            <i className="fa-solid fa-xmark text-[10px]"></i>
                            <span className="text-[9px] font-black uppercase tracking-widest">Refusé</span>
                        </div>
                    ) : (
                        <>
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  if (onToggleReadStatus && !isRead) onToggleReadStatus('suggestion', sugg.id, true);
                                  onSelectSuggestion(sugg);
                              }}
                              className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                              title="Valider"
                          >
                              <i className="fa-solid fa-check text-xs"></i>
                          </button>
                          <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  if (onToggleReadStatus && !isRead) onToggleReadStatus('suggestion', sugg.id, true);
                                  onSelectSuggestion(sugg);
                              }} 
                              className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-colors"
                              title="Refuser / Voir"
                          >
                              <i className="fa-solid fa-xmark text-xs"></i>
                          </button>
                        </>
                    )}
                  </div>
                </div>
              );
            }
          });
        })()}
      </div>
    </div>
  );
};

export default ReviewCenterWidget;
