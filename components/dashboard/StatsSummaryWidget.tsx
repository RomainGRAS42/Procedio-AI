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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group relative">
          <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center text-xl`}>
            <i className={`fa-solid ${stat.icon}`}></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
              <InfoTooltip text={stat.tooltipDesc || "Indicateur clé"} />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsSummaryWidget;
