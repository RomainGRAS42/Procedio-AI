import React from 'react';
import InfoTooltip from '../InfoTooltip';

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
}

const StatsSummaryWidget: React.FC<StatsSummaryWidgetProps> = ({ stats }) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(stats.length, 4)} gap-6`}>
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-lg hover:shadow-slate-200/50 transition-all group relative">
          <div className={`w-16 h-16 rounded-[1.5rem] ${stat.bg} ${stat.color} flex items-center justify-center text-2xl shadow-inner`}>
            <i className={`fa-solid ${stat.icon}`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
              <InfoTooltip text={stat.tooltipDesc || "Indicateur clé"} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 truncate">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsSummaryWidget;
