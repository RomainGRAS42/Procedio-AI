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
  activities: ActivityItem[];
  exams?: any[];
  loading?: boolean;
  onNavigate?: (view: string) => void;
}

const PilotCenterTechWidget: React.FC<PilotCenterTechWidgetProps> = ({
  missions,
  activities,
  exams = [],
  loading,
  onNavigate,
}) => {
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

  return (
    <div className="h-full">
      {/* Missions Section */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-lg shadow-sm">
              <i className="fa-solid fa-rocket"></i>
            </div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
              <span className="uppercase">Mes Missions</span>
              <InfoTooltip text="Tes missions en cours et à venir." />
            </h3>
          </div>
          <button 
            onClick={() => onNavigate && onNavigate('/missions')}
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors bg-transparent border-0 p-0 focus:outline-none"
          >
            Voir tout
          </button>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {/* Pending Exams Section */}
          {exams.length > 0 && exams.map((exam) => {
             // Filter out completed exams or those awaiting review (only show 'approved' which means ready to take)
             if (exam.status !== 'approved') return null;

             return (
            <div
              key={`exam-${exam.id}`}
              onClick={() => onNavigate && onNavigate(`/dashboard?action=mastery&id=${exam.id}`)}
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
          )})}

          {missions.length > 0 ? (
            missions.slice(0, 3).map((mission) => {
              // Status Logic
              let statusLabel = "EN ATTENTE";
              let statusColor = "text-slate-400";
              let progressWidth = "0%";
              let progressColor = "bg-slate-300";

              switch (mission.status) {
                case "assigned":
                  statusLabel = "À LANCER";
                  statusColor = "text-indigo-600 animate-pulse";
                  progressWidth = "5%";
                  progressColor = "bg-indigo-600";
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
                  className="p-4 bg-slate-50 rounded-2xl border border-transparent transition-all cursor-pointer group hover:bg-white hover:border-slate-100 hover:shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                      {mission.title}
                    </span>
                    <div className="text-right">
                      <span className="block text-[10px] font-black text-indigo-600">
                        {mission.xp_reward} XP
                      </span>
                      <span className={`block text-[9px] font-black ${statusColor} uppercase tracking-widest mt-0.5`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                    <div 
                      className={`h-1 rounded-full transition-all duration-500 ${progressColor}`} 
                      style={{ width: progressWidth }}
                    ></div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full min-h-[200px] px-4 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex flex-col items-center justify-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-emerald-500 text-2xl shadow-sm border border-emerald-50 shrink-0">
                <i className="fa-solid fa-check"></i>
              </div>
              <div>
                <p className="text-base font-black text-emerald-900 uppercase tracking-tight">
                  Mission accomplie !
                </p>
                <p className="text-xs font-medium text-emerald-700/80 leading-tight italic mt-2">
                  Tout est à jour. Une pause bien méritée ?
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
