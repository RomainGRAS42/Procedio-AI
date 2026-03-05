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
}

const RecentHistoryWidget: React.FC<RecentHistoryWidgetProps> = ({
  activities,
  loading,
  notifications,
  onNavigate,
  title = "Mon Fil d'Activité",
  subtitle = "Vos dernières actions et alertes importantes."
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
             return content.includes('terminée') || content.includes('validée') || title.includes('badge');
        }).map(a => ({
            id: a.id,
            type: 'activity',
            title: a.title?.includes('BADGE') ? 'Trophée Débloqué' : 'Mission Accomplie',
            content: a.content,
            date: a.created_at,
            icon: 'fa-trophy',
            color: 'text-amber-500',
            bg: 'bg-amber-50',
            link: null
        }));

        // 2. Filter Notifications (System alerts: Mission Validated, Badge Awarded)
        const successNotifications = notifications.filter(n => {
            const t = n.title?.toLowerCase() || '';
            return t.includes('validée') || t.includes('succès') || t.includes('badge') || t.includes('completed');
        }).map(n => ({
            id: n.id,
            type: 'notification',
            title: n.title,
            content: n.content,
            date: n.created_at,
            icon: 'fa-medal',
            color: 'text-amber-600',
            bg: 'bg-amber-100',
            link: n.link
        }));
        
        // Merge and Sort
        const allSuccess = [...successActivities, ...successNotifications];
        return allSuccess.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    }

    // Default Feed Logic (Activity Feed)
    const items = [
      ...notifications.map(n => {
        let color = 'text-rose-500';
        let bg = 'bg-rose-50';
        let icon = 'fa-bell';

        // Custom colors for specific notifications
        if (n.title.toLowerCase().includes('validée') || n.title.toLowerCase().includes('completed')) {
            color = 'text-emerald-500';
            bg = 'bg-emerald-50';
            icon = 'fa-check-circle';
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
            link: n.link
        };
      }),
      ...activities.map(a => {
        let icon = 'fa-check';
        let color = 'text-slate-500';
        let bg = 'bg-slate-50';
        let title = 'Activité';

        if (a.title?.includes('CONSULTATION')) {
            icon = 'fa-eye';
            color = 'text-blue-500';
            bg = 'bg-blue-50';
            title = 'Consultation';
        } else if (a.title?.includes('MISSION')) {
            icon = 'fa-rocket';
            color = 'text-indigo-500';
            bg = 'bg-indigo-50';
            title = 'Mission';
        } else if (a.title?.includes('CLAIM')) {
            icon = 'fa-hand-holding-hand';
            color = 'text-emerald-500';
            bg = 'bg-emerald-50';
            title = 'Prise en charge';
        }

        return {
            id: a.id,
            type: 'activity',
            title: title,
            content: a.content,
            date: a.created_at,
            icon,
            color,
            bg,
            link: null
        };
      }).filter(Boolean) as any[]
    ];

    // Sort by date desc and limit
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  }, [activities, notifications, title]);

  return (
    <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center text-lg">
            <i className={`fa-solid ${title.includes("Succès") ? "fa-trophy text-amber-400" : "fa-clock-rotate-left"}`}></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
            <span className="uppercase">{title}</span>
            <InfoTooltip text={subtitle} />
          </h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-4">
        {loading ? (
            <div className="space-y-4 animate-pulse">
                {[1,2,3].map(i => (
                    <div key={i} className="h-16 bg-slate-50 rounded-2xl"></div>
                ))}
            </div>
        ) : feedItems.length > 0 ? (
            feedItems.map((item) => (
                <div 
                    key={`${item.type}-${item.id}`}
                    onClick={() => item.link && onNavigate && onNavigate(item.link)}
                    className={`p-3 rounded-2xl border transition-all group flex gap-3 items-start ${item.link ? 'cursor-pointer hover:bg-slate-50 hover:border-slate-200' : 'border-transparent bg-white'}`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                        <i className={`fa-solid ${item.icon} text-xs`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${item.color}`}>
                                {item.title}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div 
                            className="text-xs font-bold text-slate-700 leading-tight mt-0.5 line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: item.content }}
                        />
                    </div>
                </div>
            ))
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