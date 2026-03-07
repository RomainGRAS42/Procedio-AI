import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

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
  const iconRef = useRef<HTMLDivElement>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isVisible && iconRef.current) {
      const updatePosition = () => {
        if (!iconRef.current) return;
        const rect = iconRef.current.getBoundingClientRect();
        
        let left = rect.left + rect.width / 2;
        let transform = 'translate(-50%, -100%)';
        
        if (align === 'left') {
            left = rect.left;
            transform = 'translate(0, -100%)';
        } else if (align === 'right') {
            left = rect.right;
            transform = 'translate(-100%, -100%)';
        }

        // Calculate top to match "bottom-full mb-3" logic (approx 12px gap)
        // transform -100% shifts it up by its own height, so top should be the anchor point
        const top = rect.top - 12;

        setTooltipStyle({
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            transform: transform,
            zIndex: 9999,
            pointerEvents: 'none', // Tooltip is read-only
        });
      };

      updatePosition();
      
      // Update on scroll/resize to keep it attached
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible, align]);

  return (
    <>
      <div
        ref={iconRef}
        className={`relative inline-block group ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}>
        <i className={`fa-solid fa-circle-info transition-colors cursor-help ${iconClassName}`}></i>
      </div>

      {isVisible && createPortal(
        <div
          style={tooltipStyle}
          className="w-[max-content] max-w-[280px] sm:max-w-xs bg-[#121826] text-white text-[13px] p-4 rounded-2xl shadow-xl animate-fade-in"
        >
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
            className={`absolute top-full -mt-1 border-4 border-transparent border-t-[#121826] ${
                align === 'left' ? 'left-4' : align === 'right' ? 'right-4' : 'left-1/2 -translate-x-1/2'
            }`}
          ></div>
        </div>,
        document.body
      )}
    </>
  );
};

export default InfoTooltip;
