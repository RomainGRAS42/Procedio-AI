import React from 'react';

interface LoadingStateProps {
  message?: string;
  overlay?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = "Analyse des données en cours...", 
  overlay = false 
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-in">
      <div className="relative mb-12">
        {/* Faint Radial Glow */}
        <div className="absolute inset-0 -m-8 rounded-full bg-indigo-500/10 blur-3xl animate-pulse"></div>
        
        {/* Spinner Ring */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-[6px] border-slate-100"></div>
          <div className="absolute inset-0 rounded-full border-[6px] border-[#6366f1] border-t-transparent animate-spin"></div>
        </div>
      </div>
      
      {/* Text 1: Bold, Dark */}
      <h3 className="text-2xl font-bold text-[#1B1B1F] tracking-wide mb-3 uppercase">
        {message}
      </h3>
      
      {/* Text 2: Thin, Light Gray with Blue Tint, Spaced */}
      <p className="text-[#9AA7C6] font-light text-sm uppercase tracking-[0.25em]">
        Intelligence Procedio
      </p>
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md rounded-[3rem]">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full py-20 flex items-center justify-center">
      {content}
    </div>
  );
};

export default LoadingState;
