import React, { useMemo } from 'react';
import InfoTooltip from '../InfoTooltip';
import { Notification } from '../../types';

interface RecentHistoryWidgetProps {
  activities: any[];
  loading: boolean;
  notifications: Notification[];
  onNavigate?: (path: string) => void;
  title?: string;
  subtitle?: string;
  onMarkAsRead?: (id: string) => void;
  userRole?: string; // Added userRole prop
}

const RecentHistoryWidget: React.FC<RecentHistoryWidgetProps> = ({
  activities,
  loading,
  notifications,
  onNavigate,
  onMarkAsRead,
  title = "Mon Fil d'Activité",
  subtitle = "Vos dernières actions et alertes importantes.",
  userRole
}) => {
  // Combine activities and notifications into a single feed
  const feedItems = useMemo(() => {
    // If it's the Success Journal (based on title), we only want COMPLETED missions and Badges
    const isSuccessJournal = title.includes("Succès");

    if (isSuccessJournal) {
        // 1. Filter Activities (User actions)
        const successActivities = activities.filter(a => {
             const content = a.content?.toLowerCase() || '';
             const title = a.title?.toLowerCase() || '';
             // Capture "terminée", "validée", "badge", but also "referent_granted" or "mastery_completed"
             return content.includes('terminée') || 
                    content.includes('validée') || 
                    content.includes('félicitations') ||
                    title.includes('badge') || 
                    title.includes('mastery_completed');
        }).map(a => {
            const isBadge = a.title?.includes('BADGE');
            // Extract XP value from content if available (e.g. "Vous avez gagné 50 XP")
            const xpMatch = a.content?.match(/(\d+)\s*XP/);
            let xpValue = xpMatch ? xpMatch[1] : null;
            
            // Fallback for activities
            if (!xpValue && (title.includes('validée') || content.includes('validée') || content.includes('terminée'))) {
                 xpValue = '50';
            }
            
            return {
                id: a.id,
                type: 'activity',
                title: isBadge ? 'Trophée Débloqué' : 'Mission Validée !',
                content: a.content, // Keep full content or simplified
                date: a.created_at,
                icon: isBadge ? 'fa-trophy' : 'fa-check-circle',
                color: isBadge ? 'text-amber-500' : 'text-emerald-500',
                bg: isBadge ? 'bg-amber-50' : 'bg-emerald-50',
                link: null,
                xp: xpValue
            };
        });

        // 2. Filter Notifications (System alerts: Mission Validated, Badge Awarded)
        const successNotifications = notifications.filter(n => {
            const t = n.title?.toLowerCase() || '';
            return t.includes('validée') || t.includes('succès') || t.includes('badge') || t.includes('completed') || t.includes('félicitations');
        }).map(n => {
            const isBadge = n.title?.toLowerCase().includes('badge');
            // Extract XP value from content (e.g. "Vous avez gagné <b>50 XP</b>" or "+300 XP")
            const xpMatch = n.content?.match(/(\d+)\s*XP/) || n.title?.match(/(\d+)\s*XP/);
            let xpValue = xpMatch ? xpMatch[1] : null;

            // Fallback: If it's a mission validation and no XP found, assume 50 XP default
            if (!xpValue && (n.title?.toLowerCase().includes('validée') || n.content?.toLowerCase().includes('validée'))) {
                xpValue = '50';
            }

            return {
                id: n.id,
                type: 'notification',
                title: n.title,
                content: n.content,
                date: n.created_at,
                icon: isBadge ? 'fa-medal' : 'fa-check-circle',
                color: isBadge ? 'text-amber-600' : 'text-emerald-500',
                bg: isBadge ? 'bg-amber-100' : 'bg-emerald-50',
                link: n.link,
                xp: xpValue,
                isRead: n.read
            };
        });
        
        // Merge and Sort
        const allSuccess = [...successActivities, ...successNotifications];
        
        // DEDUPLICATION LOGIC
        const uniqueKeys = new Set();
        const dedupedSuccess = allSuccess.filter(item => {
            // Create a unique key based on content similarity and time (down to the minute)
            // Extract mission name to ignore small variations like "Votre mission X" vs "La mission X"
            const contentSimplified = item.content.replace(/^(Votre|La)\s+mission\s+["']?|["']?\s+a été validée\.?|!/gi, "").trim();
            const timeKey = new Date(item.date).toISOString().slice(0, 16); // Up to minute
            const key = `${contentSimplified}|${timeKey}`;
            
            if (uniqueKeys.has(key)) {
                return false;
            }
            uniqueKeys.add(key);
            return true;
        });

        return dedupedSuccess.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    }

    // Default Feed Logic (Activity Feed)
    const items = [
      ...notifications.map(n => {
        let color = 'text-rose-500';
        let bg = 'bg-rose-50';
        let icon = 'fa-bell';
        let xp = null;

        // Custom colors for specific notifications
        if (n.title.toLowerCase().includes('validée') || n.title.toLowerCase().includes('completed') || n.title.toLowerCase().includes('félicitations') || n.title.toLowerCase().includes('bravo')) {
            color = 'text-emerald-500';
            bg = 'bg-emerald-50';
            icon = 'fa-check-circle';
            // Extract XP
            const xpMatch = n.content?.match(/(\d+)\s*XP/);
            if (xpMatch) xp = xpMatch[1];
        } else if (n.title.toLowerCase().includes('refusée') || n.title.toLowerCase().includes('rejected')) {
            color = 'text-rose-500';
            bg = 'bg-rose-50';
            icon = 'fa-circle-xmark';
        } else if (n.title.toLowerCase().includes('attente') || n.title.toLowerCase().includes('pending')) {
            color = 'text-amber-500';
            bg = 'bg-amber-50';
            icon = 'fa-clock';
        }

        return {
            id: n.id,
            type: 'notification',
            title: n.title,
            content: n.content,
            date: n.created_at,
            icon,
            color,
            bg,
            link: n.link,
            xp,
            isRead: n.read
        };
      }),
      ...activities.map(a => {
        // FILTERING LOGIC: Hide Manager-specific activities from Technician
        if (userRole === 'technician' || userRole === 'TECHNICIAN') {
            if (a.title?.includes('CLAIM_MASTERY')) return null; // "Prise en charge" (Manager view of tech action)
            if (a.title?.includes('MISSION_CLAIM')) return null; // "Prise en charge" (Technician claiming a mission - no need to see it in feed as 'Prise en charge')
            // Add other manager-only activity types here if needed
        }

        let icon = 'fa-check';
        let color = 'text-slate-500';
        let bg = 'bg-slate-50';
        let title = 'Activité';
        let link: string | null = null;
        let content = a.content;

        if (a.title?.includes('CONSULTATION')) {
             // ... existing logic ...
            icon = 'fa-eye';
            color = 'text-blue-500';
            bg = 'bg-blue-50';
            title = 'Consultation';
        } else if (a.title?.includes('MISSION_EXPERTISE_LAUNCH')) {
            // ... existing logic ...
            icon = 'fa-bullhorn';
            color = 'text-rose-600';
            bg = 'bg-rose-100';
            title = 'Appel à Expertise';
            const idMatch = a.title.match(/MISSION_EXPERTISE_LAUNCH_(.*)/);
            if (idMatch && idMatch[1]) {
                link = `/missions?id=${idMatch[1]}`;
                // Add button to content
                content += `<br/><span class="inline-block mt-2 px-3 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-rose-700 transition-colors">Accéder à la mission</span>`;
            }
        } else if (a.title?.includes('MISSION')) {
            icon = 'fa-rocket';
            color = 'text-indigo-500';
            bg = 'bg-indigo-50';
            title = 'Mission';
        } else if (a.title?.includes('CLAIM')) {
             // CLAIM is usually "Prise en charge" - Technicians might see their own claims? 
             // Or Manager sees "Tech X claimed mission Y".
             // If userRole is tech, they probably know they claimed it, so maybe hide or rephrase?
             // Leaving as is for now unless specified.
            icon = 'fa-hand-holding-hand';
            color = 'text-emerald-500';
            bg = 'bg-emerald-50';
            title = 'Prise en charge';
        } else if (a.title?.includes('APPLY_REFERENT')) {
            icon = 'fa-graduation-cap';
            color = 'text-orange-500';
            bg = 'bg-orange-50';
            title = 'Candidature Référent';
        } else if (a.title?.includes('MISSION_CHALLENGE_LAUNCH')) {
            icon = 'fa-trophy';
            color = 'text-purple-600';
            bg = 'bg-purple-100';
            title = 'Nouveau Défi';
        } else if (a.title?.includes('MISSION_TEAM_LAUNCH')) {
            icon = 'fa-users-line';
            color = 'text-blue-600';
            bg = 'bg-blue-100';
            title = 'Mission d\'Équipe';
        }

        return {
            id: a.id,
            type: 'activity',
            title: title,
            content: content,
            date: a.created_at,
            icon,
            color,
            bg,
            link,
            isRead: true // Activities are considered read by default
        };
      }).filter(Boolean) as any[]
    ];

    // Sort by date desc and limit
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  }, [activities, notifications, title, userRole]);

  return (
    <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 border border-slate-100 flex items-center justify-center text-lg">
            <i className={`fa-solid ${title.includes("Succès") ? "fa-trophy" : "fa-clock-rotate-left"}`}></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
            <span className="uppercase">{title}</span>
            <InfoTooltip text={subtitle} />
          </h3>
          <div className="flex items-center gap-2">
            {title.includes("Succès") ? (
                 notifications.filter(n => !n.read && (n.title.includes('validée') || n.title.includes('succès') || n.title.includes('badge'))).length > 0 && (
                    <span 
                        className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100 cursor-default select-none"
                        aria-disabled="true"
                        title="Information seulement"
                    >
                        {notifications.filter(n => !n.read && (n.title.includes('validée') || n.title.includes('succès') || n.title.includes('badge'))).length} Non lues
                    </span>
                 )
            ) : (
                notifications.filter(n => !n.read).length > 0 && (
                    <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-rose-100">
                        {notifications.filter(n => !n.read).length} Non lues
                    </span>
                )
            )}
          </div>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4 focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-lg"
        tabIndex={0}
        role="feed"
        aria-label="Liste des activités récentes"
      >
        {loading ? (
            <div className="space-y-4 animate-pulse">
                {[1,2,3].map(i => (
                    <div key={i} className="h-16 bg-slate-50 rounded-2xl"></div>
                ))}
            </div>
        ) : feedItems.length > 0 ? (
            feedItems.map((item) => {
                const badgeConfig = (() => {
                    if (item.type === 'notification') {
                        switch (item.title) {
                            case "Mission validée !":
                            case "Mission validée":
                                return { 
                                    icon: 'fa-check', 
                                    bg: 'bg-emerald-50', 
                                    color: 'text-emerald-600', 
                                    border: 'border-emerald-100',
                                    label: item.title
                                };
                            case "Nouvelle mission":
                            case "Mission d'Équipe 🤝":
                                return { 
                                    icon: 'fa-bell', 
                                    bg: 'bg-rose-50', 
                                    color: 'text-rose-600', 
                                    border: 'border-rose-100',
                                    label: item.title
                                };
                            default:
                                return { 
                                    icon: 'fa-bell', 
                                    bg: 'bg-indigo-50', 
                                    color: 'text-indigo-600', 
                                    border: 'border-indigo-100',
                                    label: item.title
                                };
                        }
                    } else {
                        return {
                            icon: item.icon,
                            bg: item.bg,
                            color: item.color,
                            border: 'border-transparent',
                            label: item.title
                        };
                    }
                })();

                const isUnread = item.type === 'notification' && !item.isRead;
                const isSuccessJournal = title.includes("Succès");
                const clickAction = isSuccessJournal ? (e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Mark as read locally without navigation
                    if (onMarkAsRead && item.type === 'notification') {
                        onMarkAsRead(item.id);
                    }
                } : () => item.link && onNavigate && onNavigate(item.link);

                return (
                <div 
                    key={`${item.type}-${item.id}`}
                    onClick={clickAction}
                    className={`p-4 rounded-2xl border transition-all group flex gap-4 items-start relative overflow-hidden ${
                        isUnread 
                            ? 'bg-white border-indigo-100 shadow-sm cursor-pointer hover:bg-slate-50' 
                            : (item.link && !isSuccessJournal)
                                ? 'cursor-pointer hover:bg-slate-50 border-slate-100 bg-white' 
                                : 'border-transparent bg-slate-50/30 cursor-default'
                    }`}
                    role="article"
                >
                    {/* Unread Indicator */}
                    {isUnread && (
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                    )}

                    {/* ICON / BADGE */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${badgeConfig.bg} ${badgeConfig.border} ${badgeConfig.color}`}>
                        <i className={`fa-solid ${badgeConfig.icon}`}></i>
                    </div>

                    {/* CONTENT */}
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 pr-8">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${badgeConfig.color}`}>
                                {item.type === 'notification' ? item.title : badgeConfig.label}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2">
                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        
                        <p className={`text-xs leading-snug line-clamp-2 pr-8 ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`} 
                           dangerouslySetInnerHTML={{ __html: item.content || '' }}
                        />
                    </div>

                    {/* XP PILL (Dynamic Extraction) */}
                    {(item.xp || (item.content && (item.content.includes('XP') || item.content.includes('Gain de')))) && (
                        <div className="shrink-0 flex flex-col items-end justify-center group-hover:opacity-0 transition-opacity duration-200">
                             <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap shadow-sm border border-amber-200/50 flex items-center gap-1">
                                <i className="fa-solid fa-bolt text-[9px] animate-pulse"></i>
                                {item.xp ? `+ ${item.xp} XP` : (
                                    // Fallback extraction
                                    (() => {
                                        const match = item.content.match(/Gain de (\d+)\s*XP/i) || item.content.match(/(\d+)\s*XP/i);
                                        return match ? `+ ${match[1]} XP` : '+ 50 XP';
                                    })()
                                )}
                             </span>
                        </div>
                    )}
                    
                    {/* HOVER ACTIONS (Mark as Read) - Absolute positioning to overlay XP pill area */}
                    {item.type === 'notification' && !notifications.find(n => n.id === item.id)?.read && onMarkAsRead && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkAsRead(item.id);
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
          })
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 py-8">
                <i className="fa-solid fa-wind text-3xl mb-2"></i>
                <p className="text-xs font-bold uppercase tracking-widest">Rien à signaler</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default RecentHistoryWidget;