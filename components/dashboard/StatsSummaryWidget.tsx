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
    <div className={`flex flex-col gap-8 h-full`}>
      {stats.map((stat, idx) => (
        <div
          key={idx}
          onClick={() => isClickable && navigate("/statistics")}
          className={`bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6 transition-all group relative flex-1 ${isClickable ? "hover:shadow-lg hover:shadow-slate-200/50 cursor-pointer" : "cursor-default"}`}>
          {/* Module Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-[1.25rem] ${stat.bg} ${stat.color} flex items-center justify-center text-xl shadow-sm shrink-0`}>
                <i className={`fa-solid ${stat.icon}`}></i>
              </div>
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.15em] leading-none">
                {stat.label}
              </h4>
            </div>
            <InfoTooltip text={stat.tooltipDesc || "Indicateur clé"} align="right" />
          </div>

          {/* Module Body - Centered for Glanceability */}
          <div className="flex-1 flex flex-col items-center justify-center text-center mt-1">
            <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-3">
              {stat.value}
            </p>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">{stat.desc}</p>
          </div>

          <div className="absolute right-6 bottom-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <i className="fa-solid fa-chevron-right text-xs text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"></i>
          </div>

          {/* Decorative bar */}
          <div
            className={`absolute bottom-0 left-10 right-10 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${stat.color.replace("text-", "bg-")}`}></div>
        </div>
      ))}
    </div>
  );
};

export default StatsSummaryWidget;
