import React from 'react';
import { Procedure } from '../../types';

interface ExpertReviewWidgetProps {
  pendingReviews: Procedure[];
  onSelectProcedure: (procedure: Procedure) => void;
}

const ExpertReviewWidget: React.FC<ExpertReviewWidgetProps> = ({
  pendingReviews,
  onSelectProcedure
}) => {
  return (
    <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl text-indigo-600">
            <i className="fa-solid fa-microscope"></i>
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Revues d'Expert</h3>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-1">{pendingReviews.length} en attente</p>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto max-w-full pb-1 scrollbar-hide">
          {pendingReviews.slice(0, 2).map((proc) => (
            <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="shrink-0 w-48 bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all cursor-pointer group/card">
               <h4 className="font-bold text-slate-800 text-[10px] mb-1 truncate group-hover/card:text-indigo-600 transition-colors">{proc.title}</h4>
               <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{proc.category}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExpertReviewWidget;
