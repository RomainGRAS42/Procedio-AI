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
  loading?: boolean;
  onNavigate?: (view: string) => void;
}

const PilotCenterTechWidget: React.FC<PilotCenterTechWidgetProps> = ({
  missions,
  activities,
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Missions Section */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
              <i className="fa-solid fa-rocket"></i>
            </div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
              Mes Missions
              <InfoTooltip text="Tes missions en cours et à venir." />
            </h3>
          </div>
          {missions.length > 3 && (
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest cursor-pointer hover:text-indigo-700 transition-colors">
              Voir tout
            </span>
          )}
        </div>

        {/* --- MOVED: Message du Manager (Above Missions List) --- */}
        <div className="mb-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-4">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
            RM
          </div>
          <div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">
              Message du Manager
            </p>
            <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
              "Salut l'équipe France, objectif 100% de conformité cette semaine ! On compte sur vous."
            </p>
          </div>
        </div>
        {/* ----------------------------------------------------- */}

        <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin flex flex-col justify-center">
          {missions.length > 0 ? (
            missions.slice(0, 3).map((mission) => (
              <div
                key={mission.id}
                className="p-4 bg-slate-50 rounded-2xl border border-transparent transition-all cursor-default group hover:bg-white hover:border-slate-100 hover:shadow-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {mission.title}
                  </span>
                  <span className="text-[10px] font-black text-indigo-600 shrink-0 ml-4">
                    {mission.xp_reward} XP
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-indigo-500 ${mission.status === "awaiting_validation" ? "w-full" : "w-1/2"}`}></div>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0">
                    {mission.status === "awaiting_validation" ? "Valid." : "En cours"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 px-4 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex flex-col items-center justify-center text-center gap-5">
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

      {/* Activity Section */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center text-lg shadow-lg shadow-violet-100">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
              Historique Récent
              <InfoTooltip text="Tes dernières actions pour reprendre rapidement ton travail." />
            </h3>
          </div>
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          {activities.length > 0 ? (
            activities.slice(0, 8).map((act) => (
              <div
                key={act.id}
                className="flex gap-4 items-center p-2.5 hover:bg-slate-50 rounded-2xl transition-all group border border-transparent hover:border-slate-100">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${getActionColor(act.title || "")} shadow-sm`}>
                  <i className={`fa-solid ${getActionIcon(act.title || "")} text-xs`}></i>
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                  <p className="text-xs font-medium text-slate-700 leading-tight truncate">
                    {act.content}
                  </p>
                  <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">
                    {new Date(act.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <i className="fa-solid fa-ghost text-slate-200 text-3xl mb-3"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Rien à signaler
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PilotCenterTechWidget;
