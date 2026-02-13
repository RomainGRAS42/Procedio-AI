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
        <div key={idx} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between gap-4 hover:shadow-lg hover:shadow-slate-200/50 transition-all group relative">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-[1.2rem] ${stat.bg} ${stat.color} flex items-center justify-center text-xl shadow-inner shrink-0`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
          </div>
          <div className="flex flex-col items-end text-right min-w-0">
             <div className="flex items-center gap-1.5 justify-end">
               <p className="text-sm font-bold text-slate-600 truncate max-w-[140px]">{stat.desc}</p>
               <InfoTooltip text={stat.tooltipDesc || "Indicateur clé"} />
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsSummaryWidget;
