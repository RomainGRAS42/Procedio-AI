import React from 'react';
import { Procedure, UserRole } from '../../types';

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
        <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">
          {isTeamView ? "Dernière Procédure en Ligne" : "Dernière Procédure"}
        </h3>
        <button onClick={onShowHistory} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
          Historique
        </button>
      </div>
      {recentProcedures.slice(0, 1).map((proc) => (
        <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl cursor-pointer group transition-all border border-transparent hover:border-indigo-100">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${isTeamView ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-slate-100 text-indigo-600 shadow-sm'} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <i className="fa-solid fa-file-pdf text-xl"></i>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors leading-tight mb-1">{proc.title}</h4>
              <div className="flex gap-3">
                <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase">{proc.category}</span>
                <span className="text-[8px] text-indigo-400 font-black tracking-widest uppercase flex items-center gap-1">
                  <i className="fa-solid fa-clock text-[7px]"></i>
                  {formatDate(proc.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isTeamView && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex -space-x-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-white"></div>
                  ))}
                </div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{proc.views} vus</span>
              </div>
            )}
            <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"></i>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentProceduresWidget;
