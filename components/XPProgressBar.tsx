import React from "react";
import { getMinXPForLevel, getNextLevelXP, getLevelTitle } from "../lib/xpSystem";

interface XPProgressBarProps {
  currentXP: number;
  currentLevel: number;
}

const XPProgressBar: React.FC<XPProgressBarProps> = ({ currentXP, currentLevel }) => {
  const xpForCurrentLevel = getMinXPForLevel(currentLevel);
  // Logic from lib: getNextLevelXP handles the +1 or cap logic
  const xpForNextLevel = getNextLevelXP(currentLevel);

  const xpInCurrentLevel = Math.max(0, currentXP - xpForCurrentLevel);
  const xpNeededForNextLevel = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const progressPercentage = Math.min(
    100,
    Math.max(0, (xpInCurrentLevel / xpNeededForNextLevel) * 100)
  );
  const xpRemaining = Math.max(0, xpForNextLevel - currentXP);

  const currentTitle = getLevelTitle(currentLevel);
  const nextTitle = getLevelTitle(currentLevel + 1);

  return (
    <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xl shadow-indigo-500/5 mb-6 relative overflow-hidden group hover:border-indigo-200 transition-all duration-500 w-full">
      {/* Decorative background - Vibrant & Dynamic */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent blur-[80px] rounded-full -z-10 translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700"></div>

      <div className="flex items-center gap-6">
        <div className="relative group shrink-0">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100 group-hover:scale-105 transition-transform duration-300">
            <span className="text-xl font-black text-indigo-600 font-mono">{currentLevel}</span>
          </div>
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-indigo-100">
            <i className="fa-solid fa-bolt text-[10px] text-amber-400"></i>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">
                  {currentTitle}
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="text-slate-900">{xpInCurrentLevel}</span> / {xpNeededForNextLevel}{" "}
                XP TOTAL DANS LE RANG
              </p>
            </div>
          </div>

          <div className="relative mb-2">
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out relative"
                style={{ width: `${progressPercentage}%` }}>
                <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {Math.round(progressPercentage)}% Progression
            </span>

            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                PROCHAIN GRADE
              </span>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full shadow-sm">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">
                  {nextTitle}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XPProgressBar;
