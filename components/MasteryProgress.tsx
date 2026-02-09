import React from 'react';

interface MasteryData {
  subject: string;
  A: number;
  fullMark: number;
}

interface MasteryProgressProps {
  data: MasteryData[];
}

const MasteryProgress: React.FC<MasteryProgressProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
          <i className="fa-solid fa-chart-line text-xl"></i>
        </div>
        <p className="text-slate-500 font-bold text-sm">Exploration en cours...</p>
        <p className="text-slate-400 text-[10px] mt-1">Consultez des procédures pour développer votre expertise.</p>
      </div>
    );
  }

  // Categories icons mapping
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('infra') || cat.includes('system')) return 'fa-server';
    if (cat.includes('dev') || cat.includes('code')) return 'fa-code';
    if (cat.includes('secu')) return 'fa-shield-halved';
    if (cat.includes('reseau') || cat.includes('network')) return 'fa-network-wired';
    if (cat.includes('support')) return 'fa-headset';
    if (cat.includes('data')) return 'fa-database';
    return 'fa-layer-group';
  };

  return (
    <div className="space-y-6">
      {data.map((item, idx) => {
        const percentage = Math.min(Math.round((item.A / item.fullMark) * 100), 100);
        const icon = getCategoryIcon(item.subject);
        
        return (
          <div key={idx} className="group cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 border border-slate-100">
                  <i className={`fa-solid ${icon}`}></i>
                </div>
                <div>
                  <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1">
                    {item.subject}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded-md">
                      Niveau {Math.floor(item.A / 10) + 1}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-slate-900 tracking-tighter">
                  {percentage}%
                </span>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Maîtrise</p>
              </div>
            </div>
            
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden relative p-0.5 border border-slate-200/50">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ width: `${percentage}%` }}
              >
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
