import React from 'react';
import { Procedure, UserRole } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface RecentProceduresWidgetProps {
  recentProcedures: Procedure[];
  userRole: UserRole;
  viewMode: 'personal' | 'team';
  onSelectProcedure: (procedure: Procedure) => void;
  onShowHistory: () => void;
  formatDate: (date: string) => string;
}

const RecentProceduresWidget: React.FC<RecentProceduresWidgetProps> = ({
  recentProcedures,
  userRole,
  viewMode,
  onSelectProcedure,
  onShowHistory,
  formatDate
}) => {
  const isTeamView = userRole === UserRole.MANAGER && viewMode === 'team';

  return (
    <div className={`${isTeamView ? 'lg:col-span-3' : 'lg:col-span-3'} bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col`}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg shadow-lg">
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">
              {isTeamView ? "Dernière Procédure en Ligne" : "Dernière Procédure"}
            </h3>
            <InfoTooltip text="Dernières procédures publiées dans la base." />
          </div>
        </div>
        <button 
          onClick={onShowHistory} 
          className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all flex items-center group/action"
        >
          Historique
          <i className="fa-solid fa-chevron-right ml-2 text-[8px] group-hover:translate-x-0.5 transition-transform"></i>
        </button>
      </div>
      {recentProcedures.slice(0, 1).map((proc) => (
        <div key={proc.id} onClick={() => window.open(proc.fileUrl || '#', '_blank')} className="flex items-center justify-between p-6 bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-100 rounded-3xl cursor-pointer group transition-all shadow-sm hover:shadow-md">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white border border-slate-100 text-rose-500 shadow-md rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <i className="fa-solid fa-file-pdf text-2xl"></i>
            </div>
            <div>
              <h4 className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors leading-tight mb-2">{proc.title}</h4>
              <div className="flex gap-4">
                <span className="px-3 py-1 bg-white rounded-lg border border-slate-100 text-[10px] text-slate-500 font-black tracking-widest uppercase shadow-sm">{proc.category}</span>
                <span className="px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-100 text-[10px] text-indigo-500 font-black tracking-widest uppercase flex items-center gap-2">
                  <i className="fa-solid fa-clock text-[9px]"></i>
                  {formatDate(proc.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vues</span>
               <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-100 shadow-sm">
                 <i className="fa-solid fa-eye text-indigo-400 text-xs"></i>
                 <span className="text-xs font-black text-slate-700">{proc.views}</span>
               </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
               <i className="fa-solid fa-arrow-up-right-from-square"></i>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentProceduresWidget;
