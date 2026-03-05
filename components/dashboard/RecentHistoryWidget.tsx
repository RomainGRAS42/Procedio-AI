import React, { useMemo } from 'react';
import InfoTooltip from '../InfoTooltip';
import { Notification } from '../../types';

interface RecentHistoryWidgetProps {
  activities: any[];
  loading: boolean;
  notifications: Notification[];
  onNavigate?: (path: string) => void;
}

const RecentHistoryWidget: React.FC<RecentHistoryWidgetProps> = ({
  activities,
  loading,
  notifications,
  onNavigate
}) => {
  // Combine activities and notifications into a single feed
  const feedItems = useMemo(() => {
    const items = [
      ...notifications.map(n => ({
        id: n.id,
        type: 'notification',
        title: n.title,
        content: n.content,
        date: n.created_at,
        icon: 'fa-bell',
        color: 'text-rose-500',
        bg: 'bg-rose-50',
        link: n.link
      })),
      ...activities.map(a => {
        let icon = 'fa-check';
        let color = 'text-slate-500';
        let bg = 'bg-slate-50';
        let title = 'Activité';

        if (a.title?.includes('CONSULTATION')) {
            // SKIP CONSULTATIONS IN ACTIVITY FEED TO REDUCE NOISE
            return null;
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

    // Sort by date desc
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
  }, [activities, notifications]);

  return (
    <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center text-lg">
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
            Mon Fil d'Activité
            <InfoTooltip text="Vos dernières actions et alertes importantes." />
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