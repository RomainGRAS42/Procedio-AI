import React, { useState } from 'react';

interface InfoTooltipProps {
  text: string;
  align?: 'left' | 'center' | 'right';
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, align = 'center' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const getAlignClasses = () => {
    switch (align) {
      case 'left': return 'left-0 translate-x-0';
      case 'right': return 'right-0 translate-x-0';
      default: return 'left-1/2 -translate-x-1/2';
    }
  };

  const getArrowClasses = () => {
    switch (align) {
      case 'left': return 'left-4 translate-x-0';
      case 'right': return 'right-4 translate-x-0';
      default: return 'left-1/2 -translate-x-1/2';
    }
  };

  return (
    <div 
      className="relative inline-block ml-2 group"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <i className="fa-solid fa-circle-info text-slate-300 hover:text-indigo-500 transition-colors cursor-help text-[0.8rem]"></i>
      
      {isVisible && (
        <div className={`absolute bottom-full mb-3 w-64 bg-slate-800 text-white text-xs p-4 rounded-xl shadow-2xl z-50 animate-fade-in pointer-events-none ${getAlignClasses()}`}>
          <p className="font-semibold leading-relaxed tracking-wide text-center antialiased">{text}</p>
          <div className={`absolute top-full -mt-1 border-4 border-transparent border-t-slate-800 ${getArrowClasses()}`}></div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
