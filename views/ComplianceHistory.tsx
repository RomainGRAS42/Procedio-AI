
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface ComplianceHistoryProps {
  user: User;
  onBack: () => void;
}

const ComplianceHistory: React.FC<ComplianceHistoryProps> = ({ user, onBack }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplianceHistory();
  }, []);

  const fetchComplianceHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .or('title.ilike.LOG_READ_%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setActivities(data);
    } catch (e) {
      console.error("Erreur chargement suivi émargements:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-lg shadow-xl shadow-indigo-100">
              <i className="fa-solid fa-user-check"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-2xl tracking-tight">Suivi des Émargements</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registre complet des confirmations de lecture</p>
            </div>
          </div>
          <button 
            onClick={onBack}
            className="text-[10px] font-black text-slate-900 uppercase tracking-widest bg-white border border-slate-200 px-6 py-3 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-3 shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-arrow-left"></i>
            PRÉCÉDENT
          </button>
        </div>

        <div className="divide-y divide-slate-50 flex-1">
          {loading ? (
            <div className="h-full flex items-center justify-center py-40 flex-col gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-400 font-black text-xs uppercase tracking-widest">Génération du registre de conformité...</span>
            </div>
          ) : activities.length > 0 ? (
            activities.map(act => (
              <div 
                key={act.id} 
                className="px-10 py-8 flex items-center justify-between hover:bg-slate-50 transition-all group border-l-4 border-transparent hover:border-emerald-500"
              >
                <div className="flex items-center gap-8">
                   <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                     <i className="fa-solid fa-check-double text-xl"></i>
                   </div>
                   
                   <div className="space-y-1">
                     <p className="font-bold text-slate-700 text-lg leading-tight">
                       {act.content}
                     </p>
                     <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-3 py-1 rounded-lg">
                          CONFIRMÉ
                        </span>
                        <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                          {formatDate(act.created_at || act.updated_at)}
                        </span>
                     </div>
                   </div>
                </div>
                
                <div className="flex items-center gap-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-all">
                  <span className="text-[10px] font-black uppercase tracking-widest">Entrée certifiée</span>
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center text-slate-300 flex flex-col items-center gap-4">
               <i className="fa-solid fa-clipboard-list text-4xl opacity-20"></i>
               <p className="text-[10px] font-black uppercase tracking-widest">Aucun émargement enregistré</p>
            </div>
          )}
        </div>
        
        <div className="p-8 border-t border-slate-50 bg-slate-50/10">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] text-center">Ce registre constitue une preuve d'information pour la conformité opérationnelle.</p>
        </div>
      </div>
    </div>
  );
};

export default ComplianceHistory;
