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
    <div className={`flex flex-col gap-6 h-full`}>
      {stats.map((stat, idx) => (
        <div 
          key={idx} 
          onClick={() => isClickable && navigate('/statistics')}
          className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4 transition-all group relative ${isClickable ? 'hover:shadow-lg hover:shadow-slate-200/50 cursor-pointer' : 'cursor-default'}`}
        >
          {/* Module Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center text-lg shadow-sm shrink-0`}>
                <i className={`fa-solid ${stat.icon}`}></i>
              </div>
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">
                {stat.label}
              </h4>
            </div>
            <InfoTooltip 
              text={stat.tooltipDesc || "Indicateur clé"} 
              align="right"
            />
          </div>

          {/* Module Body */}
          <div className="flex items-end justify-between gap-4 mt-2">
            <div className="min-w-0">
              <p className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-1">
                {stat.value}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide truncate">
                {stat.desc}
              </p>
            </div>
            <div className="shrink-0 pb-1">
              <i className="fa-solid fa-chevron-right text-[10px] text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"></i>
            </div>
          </div>

          {/* Decorative bar */}
          <div className={`absolute bottom-0 left-8 right-8 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${stat.color.replace('text-', 'bg-')}`}></div>
        </div>
      ))}
    </div>
  );
};

export default StatsSummaryWidget;
