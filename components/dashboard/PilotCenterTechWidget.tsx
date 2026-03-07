import React from "react";
import { Mission } from "../../types";
import InfoTooltip from "../InfoTooltip";

interface ActivityItem {
  id: string;
  content: string;
  created_at: string;
  title?: string;
}

interface PilotCenterTechWidgetProps {
  missions: Mission[];
  teamMissions?: Mission[]; // Added prop
  activities: ActivityItem[];
  exams?: any[];
  loading?: boolean;
  onNavigate?: (view: string) => void;
  onOpenExam?: (exam: any) => void;
}

const PilotCenterTechWidget: React.FC<PilotCenterTechWidgetProps> = ({
  missions,
  teamMissions = [], // Default empty
  activities,
  exams = [],
  loading,
  onNavigate,
  onOpenExam,
}) => {
  const [activeTab, setActiveTab] = React.useState<'personal' | 'team'>('personal'); // Tab state
  const [missionFilter, setMissionFilter] = React.useState<'active' | 'completed' | 'available'>('active');

  const getActionIcon = (title: string) => {
    if (title.includes("CONSULTATION")) return "fa-eye";
    if (title.includes("SUGGESTION")) return "fa-lightbulb";
    if (title.includes("MISSION")) return "fa-flag";
    if (title.includes("CLAIM")) return "fa-trophy";
    return "fa-check";
  };

  const getActionColor = (title: string) => {
    if (title.includes("CONSULTATION")) return "bg-blue-50 text-blue-600";
    if (title.includes("SUGGESTION")) return "bg-amber-50 text-amber-600";
    if (title.includes("MISSION")) return "bg-emerald-50 text-emerald-600";
    if (title.includes("CLAIM")) return "bg-purple-50 text-purple-600";
    return "bg-slate-50 text-slate-600";
  };

  const visibleExams = exams.filter(e => e.status === 'approved');
  
  // Content depends on tab & filter
  let displayMissions: Mission[] = [];

  if (activeTab === 'personal') {
      if (missionFilter === 'active') {
          displayMissions = missions.filter(m => m.status === 'assigned' || m.status === 'in_progress' || m.status === 'awaiting_validation');
      } else if (missionFilter === 'completed') {
          displayMissions = missions.filter(m => m.status === 'completed' || m.status === 'cancelled');
      }
      // 'available' for personal usually empty unless self-assignable pool, but let's keep logic simple
  } else {
      // Team Tab
      if (missionFilter === 'available') {
          displayMissions = teamMissions.filter(m => m.status === 'open');
      } else if (missionFilter === 'active') {
          // Team missions I'm working on are usually in 'personal' list once assigned. 
          // But maybe we want to see what team is doing? For now let's show user's active team missions or just open ones
          displayMissions = teamMissions.filter(m => m.status === 'in_progress'); 
      }
  }

  // Override: If user clicks "Available", show open team missions regardless of tab? 
  // Better UX: The tabs "Personnelles" vs "Équipe" act as scope.
  // Actually, the user asked for "Available | Active | Completed" like in Missions page.
  // Let's simplify: 
  // 1. "DISPONIBLES" -> Team Missions (Open)
  // 2. "EN COURS" -> Personal Active Missions
  // 3. "TERMINÉES" -> Personal Completed Missions
  
  // So we might not need the "Personnelles / Équipe" toggle anymore if we use the filter pills?
  // User image shows "Personnelles . Equipe" AND the pills.
  // Let's keep both for now, but link them intelligentely.
  
  const activeCount = missions.filter(m => m.status === 'assigned' || m.status === 'in_progress' || m.status === 'awaiting_validation').length;
  const availableCount = teamMissions.filter(m => m.status === 'open').length;
  const completedCount = missions.filter(m => m.status === 'completed' || m.status === 'cancelled').length;

  const getFilteredMissions = () => {
      if (missionFilter === 'available') return teamMissions.filter(m => m.status === 'open');
      if (missionFilter === 'completed') return missions.filter(m => m.status === 'completed' || m.status === 'cancelled');
      // Fix: Ensure we catch ALL active statuses including 'assigned'
      return missions.filter(m => m.status === 'assigned' || m.status === 'in_progress' || m.status === 'awaiting_validation');
  };

  const currentList = getFilteredMissions();
  const hasContent = currentList.length > 0 || (missionFilter === 'active' && visibleExams.length > 0);

  return (
    <div className="h-full">
      {/* Missions Section */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full">
        <div className="flex flex-col gap-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-colors bg-indigo-50 text-indigo-600`}>
                <i className="fa-solid fa-rocket"></i>
                </div>
                <div>
                    <div className="flex items-center gap-3">
                        <h3 className="font-black text-slate-900 text-lg tracking-tight leading-none">
                        MISSIONS
                        </h3>
                        {availableCount > 0 && (
                            <span className="animate-pulse px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-200">
                                Nouvelle mission disponible
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                            {missionFilter === 'available' ? 'Missions Disponibles' : missionFilter === 'completed' ? 'Historique' : 'En cours'}
                        </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={() => onNavigate && onNavigate('/missions')}
                className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-all"
                title="Voir tout"
            >
                <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="bg-slate-50 p-1 rounded-xl flex items-center justify-between">
              <button 
                onClick={() => setMissionFilter('available')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${missionFilter === 'available' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  Disponibles ({availableCount})
              </button>
              <button 
                onClick={() => setMissionFilter('active')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${missionFilter === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  En cours ({activeCount})
              </button>
              <button 
                onClick={() => setMissionFilter('completed')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${missionFilter === 'completed' ? 'bg-white text-slate-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  Terminées ({completedCount})
              </button>
          </div>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {hasContent ? (
             <>
               {/* Show Exams only in Active tab */}
               {missionFilter === 'active' && visibleExams.map((exam) => (
                <div
                  key={`exam-${exam.id}`}
                  onClick={() => {
                      if (onOpenExam) onOpenExam(exam);
                      else if (onNavigate) onNavigate(`/dashboard?action=mastery&id=${exam.id}`);
                  }}
                  className="p-4 bg-white rounded-2xl border-l-4 border-l-rose-500 border-y border-r border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest mb-1">
                        Examen requis
                      </span>
                      <span className="block text-xs font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                        {exam.procedure?.title || "Examen de certification"}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
                      <i className="fa-solid fa-play text-xs pl-0.5"></i>
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-slate-500">
                    Votre demande a été validée. Passez le test pour devenir Référent.
                  </p>
                </div>
              ))}

              {currentList.slice(0, 10).map((mission) => {
                // Status Logic
                let statusLabel = "EN ATTENTE";
                let statusColor = "text-slate-400";
                let progressWidth = "0%";
                let progressColor = "bg-slate-300";
                let borderColor = "border-slate-100";

                if (mission.mission_type === 'challenge') {
                    borderColor = "border-purple-100 bg-purple-50/30";
                } else if (mission.mission_type === 'team') {
                    borderColor = "border-emerald-100 bg-emerald-50/30";
                }

                switch (mission.status) {
                  case "assigned":
                    statusLabel = "À COMMENCER";
                    statusColor = "text-indigo-600 animate-pulse";
                    progressWidth = "5%";
                    progressColor = "bg-indigo-600";
                    break;
                  case "open": // For team missions
                    statusLabel = "DISPONIBLE";
                    statusColor = "text-emerald-600";
                    progressWidth = "0%";
                    progressColor = "bg-emerald-500";
                    break;
                  case "in_progress":
                    statusLabel = "EN COURS";
                    statusColor = "text-blue-500";
                    progressWidth = "50%";
                    progressColor = "bg-blue-500";
                    break;
                  case "awaiting_validation":
                    statusLabel = "EN VALID.";
                    statusColor = "text-amber-500";
                    progressWidth = "90%";
                    progressColor = "bg-amber-500";
                    break;
                  case "completed":
                    statusLabel = "TERMINEE";
                    statusColor = "text-emerald-500";
                    progressWidth = "100%";
                    progressColor = "bg-emerald-500";
                    break;
                  case "cancelled":
                    statusLabel = "ANNULÉE";
                    statusColor = "text-slate-400";
                    progressWidth = "100%";
                    progressColor = "bg-slate-300";
                    break;
                  default:
                    statusLabel = "EN ATTENTE";
                    progressWidth = "0%";
                }

                return (
                  <div
                    key={mission.id}
                    onClick={() => onNavigate && onNavigate(`/missions?id=${mission.id}`)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group hover:bg-white hover:shadow-md ${borderColor}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                          {/* Badges Logic */}
                          {mission.mission_type === 'challenge' ? (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md mb-2">
                                <i className="fa-solid fa-trophy text-[7px]"></i> DÉFI
                            </span>
                          ) : mission.mission_type === 'team' ? (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md mb-2">
                                <i className="fa-solid fa-users text-[7px]"></i> ÉQUIPE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md mb-2">
                                <i className="fa-solid fa-user text-[7px]"></i> SOLO
                            </span>
                          )}
                          
                          <span className="block text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                            {mission.title}
                          </span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="block text-[10px] font-black text-indigo-600">
                          {mission.xp_reward} XP
                        </span>
                        <span className={`block text-[9px] font-black ${statusColor} uppercase tracking-widest mt-0.5`}>
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    {/* Progress Bar only for active missions */}
                    {mission.status !== 'open' && mission.status !== 'completed' && mission.status !== 'cancelled' && (
                        <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden mt-2">
                        <div 
                            className={`h-1 rounded-full transition-all duration-500 ${progressColor}`} 
                            style={{ width: progressWidth }}
                        ></div>
                        </div>
                    )}
                    {/* Description excerpt for open team missions */}
                    {mission.status === 'open' && (
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 font-medium">
                            {mission.description}
                        </p>
                    )}
                  </div>
                );
              })}
             </>
          ) : (
            <div className={`h-full min-h-[200px] px-4 rounded-3xl border flex flex-col items-center justify-center text-center gap-5 bg-slate-50 border-slate-100`}>
              <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center text-2xl shadow-sm border shrink-0 text-slate-300 border-slate-200`}>
                <i className={`fa-solid ${missionFilter === 'completed' ? 'fa-check-double' : 'fa-inbox'}`}></i>
              </div>
              <div>
                <p className={`text-base font-black uppercase tracking-tight text-slate-400`}>
                  {missionFilter === 'available' ? "Aucune mission disponible" : missionFilter === 'completed' ? "Historique vide" : "Rien en cours"}
                </p>
                <p className={`text-xs font-medium leading-tight italic mt-2 text-slate-400`}>
                  {missionFilter === 'available' ? "Revenez plus tard pour de nouvelles missions." : "Tout est calme pour le moment."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PilotCenterTechWidget;
