import React from 'react';
import { Mission } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface ActivityItem {
  id: string;
  content: string;
  created_at: string;
  title?: string;
}

interface PilotCenterTechWidgetProps {
  missions: Mission[];
  activities: ActivityItem[];
  loading?: boolean;
  onNavigate?: (view: string) => void;
}

const PilotCenterTechWidget: React.FC<PilotCenterTechWidgetProps> = ({
  missions,
  activities,
  loading,
  onNavigate
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
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full min-h-[500px]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-tower-control"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
            Centre de Pilotage
            <InfoTooltip text="Tes missions en cours et ton activité récente." />
          </h3>
        </div>
      </div>

      <div className="space-y-8 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {/* Activity Section */}
        <div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
             <i className="fa-solid fa-clock-rotate-left text-rose-500"></i> Mon Activité
          </p>
          <div className="space-y-3">
            {activities.length > 0 ? (
              activities.slice(0, 5).map((act) => (
                <div key={act.id} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-all group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getActionColor(act.title || '')}`}>
                    <i className={`fa-solid ${getActionIcon(act.title || '')} text-xs`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-xs font-medium text-slate-800 leading-tight line-clamp-2">
                        {act.content}
                     </p>
                     <span className="text-xs font-black text-slate-500">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center opacity-40">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rien à signaler</p>
              </div>
            )}
          </div>
        </div>

        {/* Missions Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-rocket text-indigo-500"></i> Mes Missions
            </p>
            {missions.length > 5 && (
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                Voir tout
              </span>
            )}
          </div>
          
          <div className="space-y-3">
            {missions.length > 0 ? (
              missions.slice(0, 3).map((mission) => (
                <div 
                  key={mission.id} 
                  className="p-4 bg-slate-50 rounded-2xl border border-transparent transition-all cursor-default group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">{mission.title}</span>
                    <span className="text-xs font-black text-indigo-600 shrink-0 ml-4">{mission.xp_reward} XP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full bg-indigo-500 ${mission.status === 'awaiting_validation' ? 'w-full' : 'w-1/2'}`}></div>
                    </div>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest shrink-0">
                      {mission.status === 'awaiting_validation' ? 'Valid.' : 'En cours'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 animate-fade-in flex flex-col items-center justify-center gap-4 group">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-indigo-400 text-2xl shadow-sm border border-slate-100 group-hover:scale-110 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all duration-500">
                  <i className="fa-solid fa-mug-hot"></i>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Mission accomplie !</p>
                  <p className="text-xs font-medium text-slate-600 max-w-[280px] leading-relaxed italic">
                    Tout est à jour pour le moment. Profite-en pour explorer de nouvelles fiches ou prendre une pause bien méritée.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PilotCenterTechWidget;
