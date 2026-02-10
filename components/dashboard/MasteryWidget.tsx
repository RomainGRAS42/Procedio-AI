import React from 'react';
import MasteryProgress from '../MasteryProgress';
import InfoTooltip from '../InfoTooltip';

interface MasteryWidgetProps {
  personalStats: {
    level: number;
    xp: number;
    mastery: any[];
  };
}

const MasteryWidget: React.FC<MasteryWidgetProps> = ({ personalStats }) => {
  return (
    <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col h-full hover:border-indigo-100 transition-all">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Maitrise Experte</h3>
        </div>
        <InfoTooltip text="Votre niveau de maîtrise par catégorie métier." align="right" />
      </div>
      
      <div className="flex-1">
        <MasteryProgress data={personalStats.mastery} />
      </div>

      <div className="mt-8 pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">XP Restant</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-indigo-600">{(personalStats.level * 100) - personalStats.xp}</span>
            <span className="text-[10px] font-bold text-slate-300 uppercase">Points</span>
          </div>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cible Suivante</span>
          <span className="text-xs font-black text-slate-700 uppercase">Rang {personalStats.level + 1}</span>
        </div>
      </div>
    </div>
  );
};

export default MasteryWidget;
