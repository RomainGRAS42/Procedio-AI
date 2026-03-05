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
          {missions.length > 0 ? (
            missions.slice(0, 3).map((mission) => (
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
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                      {mission.status === "awaiting_validation" ? "Valid." : "En cours"}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                  <div className="bg-indigo-500 h-1 rounded-full" style={{ width: '45%' }}></div>
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
    </div>
  );
};

export default PilotCenterTechWidget;
