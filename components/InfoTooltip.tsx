import React, { useState } from "react";

interface InfoTooltipProps {
  text: string;
  isHtml?: boolean; // New prop to enable HTML rendering
  align?: "left" | "center" | "right";
  className?: string; // Container style
  iconClassName?: string; // Icon style override
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  isHtml = false, // Default to false for safety/backward compat
  align = "center",
  className = "ml-2",
  iconClassName = "text-slate-300 hover:text-indigo-500 text-[0.8rem]",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const getAlignClasses = () => {
    switch (align) {
      case "left":
        return "left-0";
      case "right":
        return "right-0";
      default:
        return "left-1/2 -translate-x-1/2";
    }
  };

  const getArrowClasses = () => {
    switch (align) {
      case "left":
        return "left-4";
      case "right":
        return "right-4";
      default:
        return "left-1/2 -translate-x-1/2";
    }
  };

  return (
    <div
      className={`relative inline-block group ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}>
      <i className={`fa-solid fa-circle-info transition-colors cursor-help ${iconClassName}`}></i>

      {isVisible && (
        <div
          className={`absolute bottom-full mb-3 w-[max-content] max-w-[280px] sm:max-w-xs bg-[#121826] text-white text-[13px] p-4 rounded-2xl shadow-xl z-50 animate-fade-in pointer-events-none ${getAlignClasses()}`}>
          {isHtml ? (
            <div
              className="font-medium leading-relaxed text-center antialiased whitespace-normal break-words"
              dangerouslySetInnerHTML={{ __html: text }}
            />
          ) : (
            <p className="font-medium leading-relaxed text-center antialiased whitespace-normal break-words">
              {text}
            </p>
          )}
          <div
            className={`absolute top-full -mt-1 border-4 border-transparent border-t-[#121826] ${getArrowClasses()}`}></div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
