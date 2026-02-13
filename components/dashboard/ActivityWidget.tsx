import React from 'react';
import InfoTooltip from '../InfoTooltip';

interface ActivityItem {
  id: string;
  content: string;
  created_at: string;
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
  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center text-lg">
            <i className="fa-solid fa-heart-pulse"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
            Pouls de l'Équipe
            <InfoTooltip text="Vibrez au rythme de vos collaborateurs : lectures, badges et notes de terrain." />
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
      <div className="space-y-2 flex-1 overflow-y-auto pr-1 max-h-[400px] scrollbar-thin">
        {activities.map((act) => (
          <div key={act.id} className="flex gap-3 items-start p-3 bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-md rounded-2xl transition-all group">
            <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0 group-hover:scale-125 transition-transform shadow-sm shadow-indigo-200"></div>
            <div>
              <p className="text-xs font-bold text-slate-700 leading-tight">{act.content}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 group-hover:text-indigo-400 transition-colors">
                {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
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
