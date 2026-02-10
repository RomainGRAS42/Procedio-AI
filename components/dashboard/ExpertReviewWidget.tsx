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
      <div className="relative z-10 flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg text-indigo-600">
            <i className="fa-solid fa-microscope"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Revues d'Expert</h3>
            </div>
            <div className="inline-flex mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black uppercase tracking-widest">
              {pendingReviews.length} en attente
            </div>
          </div>
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
  );
};

export default ExpertReviewWidget;
