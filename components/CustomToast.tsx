import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CustomToastProps {
  title?: string;
  message: string;
  type: "success" | "error" | "info";
  visible: boolean;
  onClose: () => void;
}

const CustomToast: React.FC<CustomToastProps> = ({ title, message, type, visible, onClose }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300); // Wait for exit animation
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [visible, onClose]);

  if (!visible && !show) return null;

  return createPortal(
    <div
      className={`fixed top-24 right-4 z-[99999] transition-all duration-300 transform ${
        show ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      <div className={`p-4 rounded-2xl shadow-xl border flex items-center gap-4 max-w-sm backdrop-blur-xl ${
        type === 'error' ? 'bg-rose-50/90 border-rose-200 text-rose-800' :
        type === 'success' ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' :
        'bg-slate-50/90 border-slate-200 text-slate-800'
      }`}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg ${
          type === 'error' ? 'bg-rose-100/50 text-rose-600' :
          type === 'success' ? 'bg-emerald-100/50 text-emerald-600' :
          'bg-indigo-100/50 text-indigo-600'
        }`}>
          <i className={`fa-solid ${
            type === 'error' ? 'fa-triangle-exclamation' :
            type === 'success' ? 'fa-circle-check' :
            'fa-circle-info'
          }`}></i>
        </div>
        <div>
          <h4 className="font-bold text-sm tracking-tight mb-0.5">
            {title || (type === 'error' ? 'Une erreur est survenue' :
             type === 'success' ? 'Succès' :
             'Information')}
          </h4>
          <p className="text-xs font-medium opacity-90 pr-4 leading-relaxed">
            {message}
          </p>
        </div>
        <button 
          onClick={() => setShow(false)}
          className="w-6 h-6 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors ml-auto">
          <i className="fa-solid fa-xmark text-xs opacity-60"></i>
        </button>
      </div>
    </div>,
    document.body
  );
};

export default CustomToast;
