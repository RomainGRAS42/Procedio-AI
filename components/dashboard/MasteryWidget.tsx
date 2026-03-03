import React from "react";
import MasteryProgress from "../MasteryProgress";
import InfoTooltip from "../InfoTooltip";

interface MasteryWidgetProps {
  personalStats: {
    level: number;
    xp: number;
    mastery: any[];
  };
}

import { calculateLevelFromXP, getLevelTitle, getMinXPForLevel } from "../../lib/xpSystem";

interface MasteryWidgetProps {
  personalStats: {
    level: number;
    xp: number;
    mastery: any[];
  };
}

const MasteryWidget: React.FC<MasteryWidgetProps> = ({ personalStats }) => {
  const currentLevel = personalStats.level;
  const nextLevel = currentLevel + 1;
  const nextLevelTitle = getLevelTitle(nextLevel);

  const xpForNextLevel =
    personalStats.level >= 10 ? getMinXPForLevel(10) * 1.5 : getMinXPForLevel(nextLevel);

  const xpRemaining = Math.max(0, xpForNextLevel - personalStats.xp);

  return (
    <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col h-full hover:border-indigo-100 transition-all">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">
                Maitrise Experte
              </h3>
              <InfoTooltip text="Calculé via tes lectures de procédures et suggestions validées (courbe exponentielle)." />
            </div>
            <div className="inline-flex mt-1 px-2 py-0.5 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100/50">
              Progression par paliers
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Slot d'action vide ou pour bouton futur */}
        </div>
      </div>

      <div className="flex-1">
        <MasteryProgress data={personalStats.mastery} />
      </div>

      <div className="mt-8 pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Étape suivante
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-indigo-600 font-mono tracking-tighter">
              +{xpRemaining.toLocaleString()}
            </span>
            <span className="text-xs font-black text-slate-400 uppercase">XP pour le grade</span>
          </div>
        </div>
        <div className="flex flex-col text-right items-end">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Rappel Objectif Global
            </span>
            <InfoTooltip
              text={`Atteindre le Grade ${nextLevel} (${nextLevelTitle}) débloque de nouveaux privilèges et badges d'expertise sur toute la plateforme.`}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                PROCHAIN GRADE
              </span>
              <span className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">
                {nextLevelTitle}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasteryWidget;
