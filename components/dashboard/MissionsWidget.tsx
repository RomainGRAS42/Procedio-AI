import React from 'react';
import { Mission, UserRole } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface MissionsWidgetProps {
  activeMissions: Mission[];
  userRole: UserRole;
  viewMode: 'personal' | 'team';
  onNavigate?: (view: string) => void;
  loading?: boolean;
}

const MissionsWidget: React.FC<MissionsWidgetProps> = ({
  activeMissions,
  userRole,
  viewMode,
  onNavigate,
  loading
}) => {
  const isTeamView = userRole === UserRole.MANAGER && viewMode === 'team';

  if (isTeamView) {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative min-h-[300px]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100 shrink-0">
              <i className="fa-solid fa-map-location-dot"></i>
            </div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center min-w-0">
              <span className="truncate">Missions d'Équipe</span>
              <InfoTooltip text="Suivi global des missions : statut, attribution et progression." className="shrink-0 ml-2" />
            </h3>
          </div>
          <button 
            onClick={() => onNavigate?.('missions')}
            className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all flex items-center shrink-0 whitespace-nowrap group/action"
          >
            Voir tout
            <i className="fa-solid fa-chevron-right ml-2 text-[8px] group-hover:translate-x-0.5 transition-transform"></i>
          </button>
        </div>

        <div className="space-y-2 flex-1 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Analyse en cours...</span>
            </div>
          ) : activeMissions.length > 0 ? (
            activeMissions
              .slice(0, 5)
              .map((mission) => {
                 const assigneeName = mission.assignee ? `${mission.assignee.first_name} ${mission.assignee.last_name}` : 'Non assigné';
                 const statusLabel = {
                   'open': 'À prendre',
                   'assigned': 'Assignée',
                   'in_progress': 'En cours',
                   'awaiting_validation': 'En attente',
                   'completed': 'Terminée'
                 }[mission.status] || mission.status;
                 
                 const statuscolor = {
                   'open': 'bg-slate-100 text-slate-500',
                   'assigned': 'bg-blue-100 text-blue-600',
                   'in_progress': 'bg-indigo-100 text-indigo-600',
                   'awaiting_validation': 'bg-amber-100 text-amber-600',
                   'completed': 'bg-emerald-100 text-emerald-600'
                 }[mission.status] || 'bg-slate-100 text-slate-500';

                 return (
                  <div key={mission.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all group cursor-pointer" onClick={() => onNavigate?.('missions')}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                         <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${statuscolor}`}>
                           {statusLabel}
                         </span>
                         <span className="text-[9px] font-bold text-slate-400">
                           {assigneeName}
                         </span>
                      </div>
                      <span className="text-[8px] font-bold text-indigo-400 flex items-center gap-1">
                        <i className="fa-solid fa-star text-[7px]"></i> {mission.xp_reward} XP
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-xs leading-tight mb-0.5 line-clamp-1 group-hover:text-indigo-600 transition-colors">{mission.title}</h4>
                    <p className="text-[9px] text-slate-400 line-clamp-1">{mission.description}</p>
                  </div>
                );
              })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center opacity-50">
              <i className="fa-solid fa-flag-checkered text-3xl text-slate-300 mb-2"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aucune mission en cours</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col h-full min-h-[320px] hover:border-indigo-100 transition-all">
      <div className="flex items-center justify-between mb-6 gap-4 flex-nowrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-black text-slate-900 text-base tracking-tight uppercase truncate">Missions Disponibles</h3>
            <InfoTooltip text="Missions recommandées basées sur votre profil." className="shrink-0" />
          </div>
        </div>
        <button 
          onClick={() => onNavigate?.('missions')} 
          className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all flex items-center shrink-0 whitespace-nowrap group/action"
        >
          <span>Voir tout</span>
          <i className="fa-solid fa-chevron-right ml-2 text-[8px] group-hover:translate-x-0.5 transition-transform"></i>
        </button>
      </div>
      
      <div className="space-y-3 flex-1 overflow-y-auto scrollbar-hide">
        {activeMissions.slice(0, 4).map((mission) => (
          <div key={mission.id} onClick={() => onNavigate?.('missions')} className="p-4 bg-slate-50 border border-transparent hover:border-indigo-100 hover:bg-white rounded-2xl transition-all cursor-pointer group/m">
            <div className="flex justify-between items-start mb-2">
              <span className={`text-[7px] font-black uppercase tracking-widest ${mission.urgency === 'critical' ? 'text-rose-500' : 'text-indigo-500'}`}>{mission.urgency}</span>
              <span className="text-[9px] font-black text-indigo-600">{mission.xp_reward} XP</span>
            </div>
            <p className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover/m:text-indigo-600 transition-colors">{mission.title}</p>
          </div>
        ))}
        {activeMissions.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center py-6 text-slate-300">
            <i className="fa-solid fa-mug-hot text-2xl mb-2"></i>
            <p className="text-[8px] font-black uppercase tracking-widest">Aucune mission</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionsWidget;
