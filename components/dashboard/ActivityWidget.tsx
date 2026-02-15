import React from 'react';
import InfoTooltip from '../InfoTooltip';

interface ActivityItem {
  id: string;
  content: string;
  created_at: string;
  title?: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

interface ActivityWidgetProps {
  activities: ActivityItem[];
  loadingActivities: boolean;
  onRefresh: () => void;
}

const ActivityWidget: React.FC<ActivityWidgetProps> = ({
  activities,
  loadingActivities,
  onRefresh
}) => {
  const getActionIcon = (title: string) => {
    if (title.includes('CONSULTATION')) return 'fa-eye';
    if (title.includes('SUGGESTION')) return 'fa-lightbulb';
    if (title.includes('MISSION')) return 'fa-flag';
    if (title.includes('CLAIM')) return 'fa-trophy';
    return 'fa-check';
  };

  const getActionColor = (title: string) => {
    if (title.includes('CONSULTATION')) return 'bg-blue-50 text-blue-600';
    if (title.includes('SUGGESTION')) return 'bg-amber-50 text-amber-600';
    if (title.includes('MISSION')) return 'bg-emerald-50 text-emerald-600';
    if (title.includes('CLAIM')) return 'bg-purple-50 text-purple-600';
    return 'bg-slate-50 text-slate-600';
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center text-lg">
            <i className="fa-solid fa-heart-pulse"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
            Pouls de l'Équipe
            <InfoTooltip text="Actions des techniciens en temps réel : consultations, missions, suggestions..." />
          </h3>
        </div>
        <button 
          onClick={onRefresh} 
          disabled={loadingActivities}
          className="text-slate-400 hover:text-indigo-600 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 rounded-lg outline-none disabled:opacity-50"
        >
          <i className={`fa-solid fa-rotate-right ${loadingActivities ? 'animate-spin text-indigo-500' : ''}`}></i>
        </button>
      </div>
      <div className="space-y-3 flex-1 overflow-y-auto pr-1 max-h-[600px] scrollbar-thin">
        {activities.map((act) => {
           // Parse content if needed or use as is. Assuming act.user contains profile data.
           const actorName = act.user ? `${act.user.first_name} ${act.user.last_name}` : 'Utilisateur';
           const time = new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
           
           let actionText = act.content;
           // Format specific messages if they follow the standard pattern
           if (act.title?.startsWith('CONSULTATION_')) actionText = `a consulté une procédure`;
           if (act.title?.startsWith('LOG_SUGGESTION_')) actionText = `a fait une suggestion`;
           if (act.title?.startsWith('CLAIM_MASTERY_')) actionText = `a demandé une validation`;
           if (act.title?.startsWith('MISSION_')) actionText = `a avancé sur une mission`;

           return (
            <div key={act.id} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-all group">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getActionColor(act.title || '')}`}>
                <i className={`fa-solid ${getActionIcon(act.title || '')} text-xs`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-black text-slate-800 truncate">{actorName}</p>
                  <span className="text-xs font-black text-slate-500">{time}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5 line-clamp-2">
                  {act.content}
                </p>
              </div>
            </div>
          );
        })}
        {activities.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400 opacity-50">
            <i className="fa-solid fa-ghost text-4xl mb-3"></i>
            <p className="text-xs font-bold uppercase tracking-widest">Le calme plat...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityWidget;
