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
    notifications.filter(n => !n.read && (n.type === 'mission_status' || n.type === 'info')).length;

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
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full overflow-hidden">
      <div className="flex flex-col gap-6 mb-6 shrink-0">
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

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-3 pb-4">
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
                  const isUnread = !item.isRead;
                  
                  // Common visual elements based on type
                  let icon = 'fa-circle';
                  let iconBg = 'bg-slate-100';
                  let iconColor = 'text-slate-500';
                  let typeLabel = 'Info';
                  let userAction = null;

                  if (isMastery) {
                    const claim = item;
                    const isCompleted = claim.status === 'completed';
                    const isApproved = claim.status === 'approved';
                    const isReviewPending = isCompleted && claim.score !== undefined;
                    const score = claim.score || 0;
                    const isSuccess = score >= 70;

                    typeLabel = isReviewPending ? 'Résultat Examen' : isCompleted ? 'Examen Terminé' : 'Expertise';
                    icon = 'fa-graduation-cap';
                    iconBg = isUnread ? 'bg-indigo-100' : 'bg-slate-100';
                    iconColor = isUnread ? 'text-indigo-600' : 'text-slate-400';

                    userAction = (
                        <div className="shrink-0 flex items-center gap-2">
                            {isReviewPending ? (
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      if (onToggleReadStatus && isUnread) onToggleReadStatus('mastery', claim.id, true);
                                      onViewMasteryDetail?.(claim);
                                  }}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors"
                                >
                                  Corriger
                                </button>
                            ) : isCompleted ? (
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {score}%
                                </span>
                            ) : generatingExamId === claim.id ? (
                                <span className="text-[10px] font-bold text-indigo-500 animate-pulse">IA...</span>
                            ) : !isApproved && (
                                <button 
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      if (onToggleReadStatus && isUnread) onToggleReadStatus('mastery', claim.id, true);
                                      onApproveMastery?.(claim.id);
                                  }}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors"
                                >
                                  Valider
                                </button>
                            )}
                        </div>
                    );
                  } else if (item.dataType === 'suggestion') {
                    const sugg = item;
                    const isApproved = sugg.status === 'approved';
                    const isRejected = sugg.status === 'rejected';
                    
                    typeLabel = 'Suggestion';
                    icon = 'fa-lightbulb';
                    iconBg = isUnread ? 'bg-amber-100' : 'bg-slate-100';
                    iconColor = isUnread ? 'text-amber-600' : 'text-slate-400';

                    userAction = (
                        <div className="shrink-0 flex items-center gap-2">
                            {isApproved ? (
                                <span className="text-[10px] font-bold text-emerald-500"><i className="fa-solid fa-check"></i> Validé</span>
                            ) : isRejected ? (
                                <span className="text-[10px] font-bold text-rose-500"><i className="fa-solid fa-xmark"></i> Refusé</span>
                            ) : (
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onToggleReadStatus && isUnread) onToggleReadStatus('suggestion', sugg.id, true);
                                            onSelectSuggestion(sugg);
                                        }}
                                        className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors"
                                        title="Valider"
                                    >
                                        <i className="fa-solid fa-check text-[10px]"></i>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                  } else if (item.dataType === 'notification') {
                     const notif = item as any;
                     typeLabel = notif.isMissionActive ? 'Alerte Mission' : 'Notification';
                     icon = 'fa-bell';
                     iconBg = isUnread ? 'bg-rose-100' : 'bg-slate-100';
                     iconColor = isUnread ? 'text-rose-600' : 'text-slate-400';
                  }

                  return (
                    <div 
                      key={`${item.dataType}-${item.id}`}
                      onContextMenu={(e) => handleContextMenu(e, item.dataType as any, item)}
                      onClick={() => {
                          if (item.dataType === 'mastery') {
                              if (onToggleReadStatus && isUnread) onToggleReadStatus('mastery', item.id, true);
                              onViewMasteryDetail?.(item);
                          } else if (item.dataType === 'suggestion') {
                              if (onToggleReadStatus && isUnread) onToggleReadStatus('suggestion', item.id, true);
                              onSelectSuggestion(item);
                          } else if (item.dataType === 'notification') {
                              if (item.missionId && onNavigateToMission) onNavigateToMission(item.missionId);
                          }
                      }}
                      className={`relative p-4 rounded-2xl border transition-all group cursor-pointer flex items-start gap-4 ${
                        isUnread 
                          ? 'bg-white border-indigo-100 shadow-sm' 
                          : 'bg-slate-50/40 border-transparent hover:bg-slate-50'
                      }`}
                    >
                      {/* Red Dot for Unread */}
                      {isUnread && (
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 animate-pulse z-10"></div>
                      )}

                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
                        <i className={`fa-solid ${icon}`}></i>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 pr-6">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${isUnread ? 'text-slate-900' : 'text-slate-500'}`}>
                                {typeLabel}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        
                        <h4 className={`text-sm truncate leading-tight mb-1 ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                            {item.title}
                        </h4>
                        
                        {item.user && (
                             <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <i className="fa-regular fa-user text-[10px]"></i>
                                {item.user.first_name} {item.user.last_name}
                             </p>
                        )}
                        
                        {/* Action Buttons Container (Visible mostly for Mastery/Suggestion) */}
                        {userAction && (
                            <div className="mt-3 flex justify-end">
                                {userAction}
                            </div>
                        )}
                      </div>

                      {/* Hover "Mark as Read" Button */}
                      {isUnread && onToggleReadStatus && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleReadStatus(item.dataType as any, item.id, true);
                                }}
                                className="w-8 h-8 rounded-full bg-white shadow-md border border-slate-100 text-slate-400 hover:text-emerald-600 hover:border-emerald-100 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                                title="Marquer comme lu"
                            >
                                <i className="fa-solid fa-check"></i>
                            </button>
                        </div>
                      )}
                    </div>
                  );
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
