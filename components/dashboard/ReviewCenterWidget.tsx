import React, { useState, useMemo } from 'react';
import { Suggestion, Notification, Mission } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface ReviewCenterWidgetProps {
  pendingSuggestions: Suggestion[];
  masteryClaims: any[];
  notifications?: Notification[];
  activeMissions?: Mission[];
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onNavigateToStatistics?: () => void;
  onApproveMastery?: (requestId: string) => void;
  onViewMasteryDetail?: (claim: any) => void;
  onUpdateReferent?: (procedureId: string, userId: string, action: 'assign' | 'revoke') => Promise<void>;
  generatingExamId?: string | null;
  onToggleReadStatus?: (type: 'suggestion' | 'mastery' | 'notification', id: string, status: boolean) => void;
  onMarkAllRead?: () => void;
  onNavigateToMission?: (missionId: string) => void;
}

const ReviewCenterWidget: React.FC<ReviewCenterWidgetProps> = ({
  pendingSuggestions,
  masteryClaims,
  notifications = [],
  activeMissions = [],
  onSelectSuggestion,
  onNavigateToStatistics,
  onApproveMastery,
  onViewMasteryDetail,
  onUpdateReferent,
  generatingExamId,
  onToggleReadStatus,
  onMarkAllRead,
  onNavigateToMission
}) => {
  const [selectedType, setSelectedType] = useState<string>('all'); // 'all' | 'suggestion' | 'mastery' | 'notification'
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const handleContextMenu = (e: React.MouseEvent, type: 'suggestion' | 'mastery' | 'notification', item: any) => {
    e.preventDefault();
    if (onToggleReadStatus) {
        // Toggle read status (inverse current)
        const currentRead = type === 'notification' ? item.read : item.isReadByManager;
        onToggleReadStatus(type, item.id, !currentRead);
    }
  };

  const alertCount = 
    pendingSuggestions.filter(s => !s.isReadByManager).length + 
    masteryClaims.filter(c => !c.isReadByManager).length +
    notifications.filter(n => {
      if (n.read) return false;
      // Filter out notifications for inactive missions
      const missionId = n.link && n.link.includes('id=') ? n.link.split('id=')[1] : null;
      if (missionId) {
        return activeMissions.some(m => m.id === missionId);
      }
      return true;
    }).length;

  // 1. Unify items
  const allItems = useMemo(() => [
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
      user: { first_name: (s.userName || "Inconnu").split(' ')[0], last_name: (s.userName || "").split(' ')[1] || '' }, // Approximation if user obj not full
      isRead: s.isReadByManager === true
    })),
    ...notifications.map(n => {
      let missionId = n.link && n.link.includes('id=') ? n.link.split('id=')[1] : null;

      // Fallback: Try to find mission ID from title if link is missing ID (Fix for legacy notifications)
      if (!missionId && n.type === 'mission' && n.content && activeMissions.length > 0) {
          // Match patterns: 'mission : "Title"' or 'mission : Title'
          const match = n.content.match(/mission : "?([^"]+?)"?$/) || n.content.match(/mission : "(.+?)"/);
          if (match && match[1]) {
              const missionTitle = match[1];
              const foundMission = activeMissions.find(m => m.title.trim() === missionTitle.trim());
              if (foundMission) {
                  missionId = foundMission.id;
              }
          }
      }

      const isMissionActive = missionId ? activeMissions.some(m => m.id === missionId) : false;
      
      return {
        ...n,
        dataType: 'notification',
        date: n.created_at || new Date().toISOString(),
        title: n.title,
        user: { first_name: 'Système', last_name: '' }, // Notifications are system-generated or we don't have sender info joined yet
        isRead: n.read === true,
        content: n.content,
        missionId,
        isMissionActive
      };
    })
  ], [masteryClaims, pendingSuggestions, notifications, activeMissions]);

  // Extract unique users
  const uniqueUsers = useMemo(() => {
    const users = new Map();
    allItems.forEach(item => {
      if (item.user) {
        const fullName = `${item.user.first_name} ${item.user.last_name}`;
        if (!users.has(fullName)) users.set(fullName, fullName);
      }
    });
    return Array.from(users.values()).sort();
  }, [allItems]);

  // Filter and Group
  const groupedItems = useMemo(() => {
    let filtered = allItems;

    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.dataType === selectedType);
    }

    if (selectedUser !== 'all') {
      filtered = filtered.filter(item => {
        const name = item.user ? `${item.user.first_name} ${item.user.last_name}` : 'Inconnu';
        return name === selectedUser;
      });
    }

    // Sort by Priority (Unread first) then Date Descending
    filtered.sort((a, b) => {
      // 1. Prioritize Unread items
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1; // Unread (false) comes first
      }
      // 2. Sort by Date
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Group by Date
    const groups: { [key: string]: typeof allItems } = {};
    filtered.forEach(item => {
      const date = new Date(item.date);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      if (date.toDateString() === today.toDateString()) {
        dateLabel = "Aujourd'hui";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateLabel = "Hier";
      }

      // Capitalize first letter
      dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(item);
    });

    return groups;
  }, [allItems, selectedType, selectedUser]);

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative min-h-[500px]">
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center text-lg">
              <i className="fa-solid fa-list-check"></i>
            </div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
              Centre de Pilotage
              <InfoTooltip text="Centralise la validation des suggestions et des expertises de l'équipe. Clic droit pour marquer comme Lu/Non lu." />
            </h3>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-[11px] font-bold uppercase tracking-widest ${alertCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>
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

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl py-2 pl-3 pr-8 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer min-h-[44px]"
            >
              <option value="all">Tout voir</option>
              <option value="suggestion">Suggestions</option>
              <option value="mastery">Expertises</option>
              <option value="notification">Alertes</option>
            </select>
            <i className="fa-solid fa-filter absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
          </div>

          <div className="relative group">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl py-2 pl-3 pr-8 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer min-h-[44px]"
            >
              <option value="all">Tous les membres</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
            <i className="fa-solid fa-user absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
          </div>
        </div>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto pr-2 max-h-[600px] scrollbar-thin">
        {Object.entries(groupedItems).length > 0 ? (
          Object.entries(groupedItems).map(([dateLabel, groupItems]) => (
            <div key={dateLabel} className="space-y-3">
              <h3 className="sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10 text-xs font-black text-slate-700 uppercase tracking-widest border-b border-slate-100 flex items-center gap-2">
                <i className="fa-regular fa-calendar text-slate-400"></i>
                {dateLabel}
              </h3>
              <div className="space-y-2 pl-2">
                {groupItems.map((item) => {
                  const isMastery = item.dataType === 'mastery';
                  
                  if (isMastery) {
                    const claim = item;
                    const isCompleted = claim.status === 'completed';
                    const isApproved = claim.status === 'approved';
                    const isPending = claim.status === 'pending';
                    const isReviewPending = isCompleted && claim.score !== undefined; // User finished quiz, awaiting manager
                    const score = claim.score || 0;
                    const isSuccess = score >= 70;
                    const isRead = claim.isRead;

                    return (
                      <div 
                        key={`mastery-${claim.id}`}
                        onContextMenu={(e) => handleContextMenu(e, 'mastery', claim)}
                        onClick={() => {
                            if (onToggleReadStatus && !isRead) onToggleReadStatus('mastery', claim.id, true);
                            if (isCompleted || isReviewPending) onViewMasteryDetail?.(claim);
                        }}
                        className={`p-3 rounded-2xl border transition-all group/item ${
                          !isRead ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-80'
                        } ${isCompleted || isReviewPending ? 'cursor-pointer hover:border-indigo-200' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              !isRead ? 'bg-indigo-600 ring-2 ring-indigo-100 ring-offset-1' : 
                              isPending ? 'bg-orange-400' : 
                              isApproved ? 'bg-indigo-400' : 
                              (isSuccess ? 'bg-emerald-400' : 'bg-rose-400')
                            }`}></div>
                            <span className={`text-[11px] uppercase tracking-widest leading-none ${!isRead ? 'font-black text-indigo-900' : 'font-bold text-slate-500'}`}>
                              {isReviewPending ? 'Résultat Examen' : isCompleted ? 'Examen Terminé' : 'Expertise'}
                            </span>
                          </div>
                          <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
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
                              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                {claim.user?.first_name} {claim.user?.last_name}
                              </p>
                            </div>

                            <div className="shrink-0">
                              {isReviewPending ? (
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      if (onToggleReadStatus && !isRead) onToggleReadStatus('mastery', claim.id, true);
                                      onViewMasteryDetail?.(claim);
                                  }}
                                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95 flex items-center gap-2"
                                >
                                  <i className="fa-solid fa-eye"></i>
                                  CORRIGER
                                </button>
                              ) : isCompleted ? (
                                <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                                  isSuccess ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'
                                }`}>
                                  <span className="text-[11px] font-black">{score}%</span>
                                  <i className={`fa-solid ${isSuccess ? 'fa-check' : 'fa-xmark'} text-xs`}></i>
                                </div>
                              ) : generatingExamId === claim.id ? (
                                <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center gap-2">
                                   <i className="fa-solid fa-circle-notch animate-spin text-xs"></i>
                                 <span className="text-[10px] font-black uppercase tracking-widest">IA...</span>
                                </div>
                              ) : isApproved ? (
                                <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center gap-2">
                                  <i className="fa-solid fa-paper-plane text-[10px]"></i>
                                  <span className="text-[10px] font-black uppercase tracking-widest">Envoyé</span>
                                </div>
                              ) : (
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      if (onToggleReadStatus && !isRead) onToggleReadStatus('mastery', claim.id, true);
                                      onApproveMastery?.(claim.id);
                                  }}
                                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
                                >
                                  VALIDER
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else if (item.dataType === 'notification') {
                      const notif = item as any; // Cast to access custom props
                      const isRead = notif.isRead;
                      const isActive = notif.isMissionActive;
                      
                      return (
                        <div 
                          key={`notification-${notif.id}`}
                          onContextMenu={(e) => handleContextMenu(e, 'notification', notif)}
                          onClick={() => {
                              // Don't auto-mark as read on click, just navigate
                              if (notif.missionId && onNavigateToMission) onNavigateToMission(notif.missionId);
                          }}
                          className={`p-3 rounded-2xl border transition-all group/notif cursor-pointer ${
                              !isRead && isActive ? 'bg-white border-blue-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-80 hover:bg-slate-100'
                          }`}
                        >
                           <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${!isRead && isActive ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                <span className={`text-[11px] uppercase tracking-widest leading-none ${!isRead && isActive ? 'font-black text-rose-600' : 'font-bold text-slate-500'}`}>
                                  {isActive ? 'Alerte Mission' : 'Mission Terminée'}
                                </span>
                                {!isRead && isActive && (
                                  <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-sm animate-bounce">
                                    EN ATTENTE
                                  </span>
                                )}
                                {!isActive && (
                                  <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                                    TERMINÉE
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <h4 className={`text-[12px] truncate leading-tight transition-colors ${
                                !isRead && isActive ? 'font-black text-slate-900 group-hover/notif:text-blue-600' : 'font-medium text-slate-600'
                            }`}>
                              {notif.content}
                            </h4>
                            {notif.title && (
                               <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                 {notif.title}
                               </p>
                            )}
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
                              <span className={`text-[11px] uppercase tracking-widest leading-none ${!isRead ? 'font-black text-amber-600' : 'font-bold text-slate-500'}`}>Suggestion</span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                              {new Date(sugg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <h4 className={`text-[12px] truncate leading-tight transition-colors ${
                              !isRead ? 'font-black text-slate-900 group-hover/sugg:text-amber-600' : 'font-medium text-slate-600'
                          }`}>
                            {sugg.title}
                          </h4>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {sugg.userName}
                          </p>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          {isApproved ? (
                              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center gap-2">
                                  <i className="fa-solid fa-check text-[10px]"></i>
                                  <span className="text-[10px] font-black uppercase tracking-widest">Validé</span>
                              </div>
                          ) : isRejected ? (
                              <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-2">
                                  <i className="fa-solid fa-xmark text-[10px]"></i>
                                  <span className="text-[10px] font-black uppercase tracking-widest">Refusé</span>
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
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-300">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <i className="fa-solid fa-check-double text-2xl"></i>
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest">Tout est à jour</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCenterWidget;
