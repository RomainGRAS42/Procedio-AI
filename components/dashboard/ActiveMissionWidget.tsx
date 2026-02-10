import React from 'react';
import { Mission, User } from '../../types';

interface ActiveMissionWidgetProps {
  user: User;
  activeMissions: Mission[];
  onNavigate?: (view: string) => void;
  onStartMission: (id: string) => void;
  onCompleteMission: (mission: Mission) => void;
}

const ActiveMissionWidget: React.FC<ActiveMissionWidgetProps> = ({
  user,
  activeMissions,
  onNavigate,
  onStartMission,
  onCompleteMission
}) => {
  // Priority: 'in_progress' first, then 'assigned'
  const assignedMission = activeMissions.find(m => 
    m.assigned_to === user.id && 
    (m.status === 'in_progress' || m.status === 'assigned')
  );
  
  if (!assignedMission) {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group transition-all duration-500 flex flex-col justify-between h-full min-h-[340px] hover:border-slate-200 hover:shadow-xl hover:shadow-slate-500/5">
        <div className="absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full bg-slate-50/30 group-hover:bg-indigo-50/30 transition-all duration-700"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center text-xl group-hover:text-indigo-400 group-hover:bg-indigo-50 transition-all duration-500">
              <i className="fa-solid fa-mug-hot"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none">
                Mission en cours
              </h3>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-1">
                Quartier calme
              </p>
            </div>
          </div>
          
          <h3 className="text-2xl font-black text-slate-300 tracking-tighter mb-4 leading-tight group-hover:text-slate-400 transition-colors">
            Pas de mission actuellement
          </h3>
          <p className="text-slate-400 text-sm font-medium leading-relaxed opacity-80 mb-6">
            Tout est sous contrôle ! C'est le moment idéal pour parcourir la base de connaissances ou perfectionner tes compétences sur les dernières procédures.
          </p>
        </div>

        <div className="relative z-10 mt-auto flex justify-center">
          <button 
            onClick={() => onNavigate?.('missions')}
            className="px-10 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 hover:-translate-y-1 transition-all shadow-lg active:scale-95 flex items-center gap-3"
          >
             <i className="fa-solid fa-compass text-[12px]"></i>
             Explorer les missions
          </button>
        </div>
      </div>
    );
  }

  const isInProgress = assignedMission.status === 'in_progress';

  const getDeadlineStatus = (deadline?: string, createdAt?: string) => {
    if (!deadline) return { label: "Pas de délai fixe", percent: 0, color: "bg-slate-200" };
    
    const now = new Date();
    const end = new Date(deadline);
    const start = createdAt ? new Date(createdAt) : new Date(now.getTime() - 1000 * 60 * 60 * 24); // Fallback 1 day ago
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const percent = Math.min(Math.max((elapsed / total) * 100, 0), 100);
    
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return { label: "Échu", percent: 100, color: "bg-rose-500" };
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    let label = days > 0 ? `${days}j restants` : `${hours}h restantes`;
    let color = "bg-indigo-600";
    if (percent > 80) color = "bg-rose-500";
    else if (percent > 50) color = "bg-amber-500";
    
    return { label, percent, color };
  };

  const dlStatus = getDeadlineStatus(assignedMission.deadline, assignedMission.created_at);

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group transition-all duration-500 flex flex-col justify-between h-full min-h-[340px] hover:border-slate-200 hover:shadow-xl hover:shadow-slate-500/5">
      {/* Background decoration - Distinctive */}
      <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full transition-all duration-700 ${
        isInProgress ? 'bg-emerald-50/50' : 'bg-slate-50/50 group-hover:bg-slate-100/50'
      }`}></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-4">
             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all duration-500 ${
               isInProgress 
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                : 'bg-slate-50 text-slate-400 group-hover:text-slate-900'
             }`}>
               <i className={`fa-solid ${isInProgress ? 'fa-scroll' : 'fa-thumbtack'}`}></i>
             </div>
             <div>
               <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none">
                    {isInProgress ? 'Mission en cours' : 'Nouvel Ordre'}
                  </h3>
                  {(assignedMission.urgency === 'high' || assignedMission.urgency === 'critical') && (
                    <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                  )}
               </div>
               <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                 {isInProgress ? 'Objectif stratégique' : 'Assigné par le manager'}
               </p>
             </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-[0.2em] rounded-lg border ${
                dlStatus.label === "Échu" 
                  ? "bg-rose-50 border-rose-100 text-rose-500" 
                  : "bg-slate-50 border-slate-100 text-slate-500"
              }`}>
                <i className="fa-regular fa-calendar-clock mr-1.5"></i>
                {dlStatus.label}
              </span>
              <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg border ${
                isInProgress ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}>
                {isInProgress ? 'Actif' : 'Prioritaire'}
              </span>
            </div>
            
            <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px]">
                <i className="fa-solid fa-cube"></i>
              </div>
              <span className="text-slate-800 text-[11px] font-black tracking-tighter">
                {assignedMission.xp_reward} XP
              </span>
            </div>
          </div>
        </div>
        
        <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-3 line-clamp-2 leading-tight">
          {assignedMission.title}
        </h3>
        <p className="text-slate-500 text-sm font-medium line-clamp-3 leading-relaxed opacity-80 mb-6">
          {assignedMission.description}
        </p>

        {/* Deadline Progress Bar - Stricter look */}
        <div className="space-y-2 mt-auto">
           <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
              <span>Progression Temps</span>
              <span className={dlStatus.percent > 80 ? 'text-rose-500' : 'text-slate-600'}>{Math.round(dlStatus.percent)}%</span>
           </div>
           <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
              <div 
                className={`h-full transition-all duration-1000 ${dlStatus.color}`}
                style={{ width: `${dlStatus.percent}%` }}
              ></div>
           </div>
        </div>
      </div>

      <div className="relative z-10 mt-8 flex items-center justify-between">
        <button 
          onClick={() => onNavigate?.('missions')}
          className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors group/link"
        >
          Détails de la mission
          <i className="fa-solid fa-arrow-right group-hover/link:translate-x-1 transition-transform"></i>
        </button>

        {!isInProgress ? (
          <button 
            onClick={() => onStartMission(assignedMission.id)}
            className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 hover:-translate-y-1 transition-all shadow-xl active:scale-95 flex items-center gap-3 group/btn"
          >
             <i className="fa-solid fa-play text-[9px]"></i>
             C'est parti !
          </button>
        ) : (
          <button 
            onClick={() => onCompleteMission(assignedMission)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:from-emerald-600 hover:to-teal-700 hover:-translate-y-1 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-3 group/btn"
          >
             <i className="fa-solid fa-check text-[11px]"></i>
             Mission accomplie
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiveMissionWidget;
