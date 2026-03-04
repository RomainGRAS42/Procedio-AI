import React from "react";
import { getLevelTitle } from "../lib/xpSystem";

interface MasteryData {
  subject: string;
  A: number;
  fullMark: number;
  certifications?: number;
}

interface MasteryProgressProps {
  data: MasteryData[];
}

const MASTERY_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000];

const getMasteryLevelInfo = (count: number) => {
  let level = 1;
  let min = 0;
  let max = MASTERY_THRESHOLDS[0];

  for (let i = 0; i < MASTERY_THRESHOLDS.length; i++) {
    if (count >= MASTERY_THRESHOLDS[i]) {
      level = i + 2; // Level starts at 1, so passing first threshold means Level 2
      min = MASTERY_THRESHOLDS[i];
      max = MASTERY_THRESHOLDS[i + 1] || (MASTERY_THRESHOLDS[i] * 2); // Fallback for last level
    } else {
      break;
    }
  }
  
  return { level, min, max };
};

const MasteryProgress: React.FC<MasteryProgressProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
          <i className="fa-solid fa-chart-line text-xl"></i>
        </div>
        <p className="text-slate-500 font-bold text-sm">Exploration en cours...</p>
        <p className="text-slate-500 text-xs mt-1">
          Consultez des procédures pour développer votre expertise.
        </p>
      </div>
    );
  }

  // Categories icons mapping
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes("infra") || cat.includes("system")) return "fa-server";
    if (cat.includes("dev") || cat.includes("code")) return "fa-code";
    if (cat.includes("secu")) return "fa-shield-halved";
    if (cat.includes("reseau") || cat.includes("network")) return "fa-network-wired";
    if (cat.includes("support")) return "fa-headset";
    if (cat.includes("data")) return "fa-database";
    return "fa-layer-group";
  };

  return (
    <div className="space-y-6">
      {data.map((item, idx) => {
        const { level, min, max } = getMasteryLevelInfo(item.A);
        
        // Calculer la progression RELATIVE au niveau actuel
        // Ex: 34 lectures. Niveau (25->50). Progression = (34-25) / (50-25)
        const currentProgress = item.A - min;
        const levelRange = max - min;
        const percentage = Math.min(Math.round((currentProgress / levelRange) * 100), 100);
        
        const icon = getCategoryIcon(item.subject);
        const remaining = max - item.A;

        return (
          <div key={idx} className="group cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 border border-slate-100 relative overflow-hidden">
                  <i className={`fa-solid ${icon} relative z-10`}></i>
                  {/* Niveau Badge sur l'icone */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-100 text-indigo-700 text-[8px] font-black flex items-center justify-center rounded-md border border-white z-20">
                    {level}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-none">
                      {item.subject}
                    </h4>
                    {item.certifications && item.certifications > 0 && (
                       <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-bold uppercase tracking-wide border border-emerald-100 flex items-center gap-1">
                         <i className="fa-solid fa-certificate"></i> {item.certifications}
                       </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                       Niveau {level} • Total {item.A}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-end justify-end gap-1">
                  <span className="text-sm font-black text-indigo-600 tracking-tighter">
                    {currentProgress}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 mb-0.5">
                    / {levelRange}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {remaining > 0 ? (
                    <>Plus que <span className="text-slate-600 font-black">{remaining}</span> lectures</>
                  ) : (
                    <span className="text-emerald-500 font-black">Niveau Validé !</span>
                  )}
                </p>
              </div>
            </div>

            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden relative p-0.5 border border-slate-200/50">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ width: `${percentage}%` }}>
                {/* Subtle animated shine */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full animate-progress-shine"></div>
              </div>
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes progress-shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress-shine {
          animation: progress-shine 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default MasteryProgress;
