import React from "react";
import { useNavigate } from "react-router-dom";
import InfoTooltip from "../InfoTooltip";

interface StatItem {
  label: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
  desc: string;
  tooltipTitle: string;
  tooltipDesc: string;
}

interface StatsSummaryWidgetProps {
  stats: StatItem[];
  isClickable?: boolean;
}

const StatsSummaryWidget: React.FC<StatsSummaryWidgetProps> = ({ stats, isClickable = true }) => {
  const navigate = useNavigate();

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-1 gap-4 h-full`}>
      {stats.map((stat, idx) => (
        <div
          key={idx}
          onClick={() => isClickable && navigate("/statistics")}
          className={`bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between gap-4 transition-all group relative ${isClickable ? "hover:shadow-lg hover:shadow-slate-200/50 cursor-pointer" : "cursor-default"}`}>
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`w-11 h-11 rounded-[1rem] ${stat.bg} ${stat.color} flex items-center justify-center text-lg shadow-inner shrink-0`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
              {stat.value}
            </p>
          </div>
          <div className="flex flex-col items-end text-right min-w-0">
            <div className="flex items-center gap-1 justify-end">
              <p className="text-[11px] font-bold text-slate-600 leading-tight truncate">
                {stat.desc}
              </p>
              <InfoTooltip text={stat.tooltipDesc || "Indicateur clé"} align="right" />
            </div>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
              {stat.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsSummaryWidget;
