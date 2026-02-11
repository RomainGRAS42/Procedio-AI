import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

interface KPIDetailsModalProps {
  title: string;
  type: 'urgent' | 'redZone';
  items: Array<{
    id?: string;
    label: string;
    sublabel?: string;
    count?: number;
    value?: any;
  }>;
  onClose: () => void;
}

const KPIDetailsModal: React.FC<KPIDetailsModalProps> = ({ title, type, items, onClose }) => {
  const navigate = useNavigate();

  const handleCreateMission = (item: any) => {
    let missionTitle = "";
    let missionDesc = "";

    if (type === 'urgent') {
      missionTitle = `Combler manque : ${item.label}`;
      missionDesc = `Le terme "${item.label}" a été recherché ${item.count} fois sans succès. Il est urgent de créer une procédure ou une flash note pour couvrir ce sujet.`;
    } else if (type === 'redZone') {
      // item.label is procedure title
      missionTitle = `Assigner Référent : ${item.label}`;
      missionDesc = `La procédure "${item.label}" n'a pas de référent expert assigné. Veuillez identifier un expert et mettre à jour la fiche.`;
    }

    navigate('/missions', { 
      state: { 
        createMission: true, 
        initialData: {
          title: missionTitle,
          description: missionDesc,
          urgency: 'high',
          xp_reward: 100
        }
      } 
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-2xl shadow-2xl animate-scale-up max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
           <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                type === 'urgent' ? 'bg-rose-50 text-rose-600' : 'bg-orange-50 text-orange-600'
              }`}>
                 <i className={`fa-solid ${type === 'urgent' ? 'fa-triangle-exclamation' : 'fa-link-slash'}`}></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h3>
           </div>
           <button onClick={onClose} className="text-slate-300 hover:text-rose-500 transition-colors">
              <i className="fa-solid fa-xmark text-2xl"></i>
           </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-2 scrollbar-hide flex-1">
          {items.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <i className="fa-solid fa-check-circle text-4xl mb-4 text-emerald-300"></i>
              <p>Aucun élément à traiter.</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-100">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 leading-tight">{item.label}</h4>
                    {item.sublabel && <p className="text-xs text-slate-500 mt-1">{item.sublabel}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => handleCreateMission(item)}
                  className="px-4 py-2 bg-white text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i> Mission
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default KPIDetailsModal;
