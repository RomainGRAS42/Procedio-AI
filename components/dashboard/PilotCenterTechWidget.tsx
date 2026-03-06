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
  
  // Content depends on tab
  const personalContent = [...visibleExams, ...missions];
  const teamContent = teamMissions;
  
  const hasContent = activeTab === 'personal' ? personalContent.length > 0 : teamContent.length > 0;

  return (
    <div className="h-full">
      {/* Missions Section */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-colors ${activeTab === 'personal' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <i className={`fa-solid ${activeTab === 'personal' ? 'fa-rocket' : 'fa-users'}`}></i>
            </div>
            <div>
                <h3 className="font-black text-slate-900 text-lg tracking-tight leading-none">
                MISSIONS
                </h3>
                <div className="flex gap-2 mt-1">
                    <button 
                        onClick={() => setActiveTab('personal')}
                        className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'personal' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Personnelles
                    </button>
                    <span className="text-slate-300 text-[10px]">•</span>
                    <button 
                        onClick={() => setActiveTab('team')}
                        className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'team' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Équipe {teamMissions.length > 0 && <span className="bg-emerald-100 text-emerald-600 px-1 rounded-md ml-1">{teamMissions.length}</span>}
                    </button>
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

        <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {hasContent ? (
             <>
               {activeTab === 'personal' && visibleExams.map((exam) => (
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

              {(activeTab === 'personal' ? missions : teamMissions).slice(0, 10).map((mission) => {
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
                    statusLabel = "À LANCER";
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
                          {mission.mission_type === 'challenge' && <span className="text-[8px] font-black uppercase tracking-widest text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded mb-1 inline-block">Défi</span>}
                          {mission.mission_type === 'team' && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded mb-1 inline-block">Équipe</span>}
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
                    {/* Progress Bar only for personal missions or active team missions */}
                    {mission.status !== 'open' && (
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
            <div className={`h-full min-h-[200px] px-4 rounded-3xl border flex flex-col items-center justify-center text-center gap-5 ${activeTab === 'personal' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
              <div className={`w-16 h-16 rounded-full bg-white flex items-center justify-center text-2xl shadow-sm border shrink-0 ${activeTab === 'personal' ? 'text-emerald-500 border-emerald-50' : 'text-slate-300 border-slate-200'}`}>
                <i className={`fa-solid ${activeTab === 'personal' ? 'fa-check' : 'fa-users-slash'}`}></i>
              </div>
              <div>
                <p className={`text-base font-black uppercase tracking-tight ${activeTab === 'personal' ? 'text-emerald-900' : 'text-slate-400'}`}>
                  {activeTab === 'personal' ? "Mission accomplie !" : "Aucune mission d'équipe"}
                </p>
                <p className={`text-xs font-medium leading-tight italic mt-2 ${activeTab === 'personal' ? 'text-emerald-700/80' : 'text-slate-400'}`}>
                  {activeTab === 'personal' ? "Tout est à jour. Une pause bien méritée ?" : "Revenez plus tard pour de nouvelles opportunités."}
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
