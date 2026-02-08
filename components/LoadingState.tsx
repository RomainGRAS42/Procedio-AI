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
      <div className="relative mb-8">
        {/* Outer Glow Ring */}
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-2xl animate-pulse"></div>
        
        {/* Main Spinner Container */}
        <div className="relative w-24 h-24">
          {/* Animated Gradient Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
          
          {/* Central Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fa-solid fa-sparkles text-indigo-600 text-3xl animate-bounce"></i>
          </div>
        </div>
      </div>
      
      {/* Loading Text */}
      <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2 uppercase">
        {message}
      </h3>
      <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] animate-pulse">
        Optimisation par Zorya AI
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
