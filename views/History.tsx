
import React, { useState, useEffect } from 'react';
import { Procedure } from '../types';
import { supabase } from '../lib/supabase';

interface HistoryProps {
  onSelectProcedure: (procedure: Procedure) => void;
}

const History: React.FC<HistoryProps> = ({ onSelectProcedure }) => {
  const [history, setHistory] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Dans une app réelle, on fetcherait une table de logs jointe aux procédures
      // Ici on simule les données basées sur l'utilisateur
      const mockHistory: Procedure[] = [
        { id: '1', title: 'Audit Sécurité Réseau v2.4', category: 'INFRASTRUCTURE', createdAt: '17 Jan 2024', views: 89, status: 'validated' },
        { id: '2', title: 'Provisioning Script WS', category: 'AUTOMATION', createdAt: '16 Jan 2024', views: 234, status: 'validated' },
        { id: '3', title: 'Guide Intégration SSO', category: 'LOGICIEL', createdAt: '15 Jan 2024', views: 156, status: 'validated' },
        { id: '4', title: 'Backup Policy 2024', category: 'CLOUD', createdAt: '14 Jan 2024', views: 42, status: 'validated' },
      ];
      
      setHistory(mockHistory);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-slide-up">
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {/* Header Historique */}
        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-lg shadow-xl shadow-indigo-100">
              <i className="fa-regular fa-clock"></i>
            </div>
            <h3 className="font-black text-slate-900 text-2xl tracking-tight">Dernières procédures consultées</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Affichage : 4 derniers jours</span>
            <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-all">Tout voir</button>
          </div>
        </div>

        {/* Liste History */}
        <div className="divide-y divide-slate-50 flex-1">
          {loading ? (
            <div className="h-full flex items-center justify-center py-40 flex-col gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-400 font-black text-xs uppercase tracking-widest">Reconstitution de votre parcours...</span>
            </div>
          ) : (
            history.map(proc => (
              <div 
                key={proc.id} 
                onClick={() => onSelectProcedure(proc)}
                className="px-10 py-10 flex items-center justify-between hover:bg-slate-50 transition-all group cursor-pointer border-l-4 border-transparent hover:border-indigo-500"
              >
                <div className="flex items-center gap-10">
                   {/* Icône Fichier style capture */}
                   <div className="w-16 h-16 bg-white border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                     <i className="fa-regular fa-file text-2xl"></i>
                   </div>
                   
                   <div className="space-y-2">
                     <h4 className="font-bold text-slate-800 text-2xl group-hover:text-indigo-600 transition-colors leading-none tracking-tight">
                       {proc.title}
                     </h4>
                     <div className="flex items-center gap-4">
                        <span className="text-[11px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-4 py-1.5 rounded-lg transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
                          {proc.category}
                        </span>
                        <div className="h-1.5 w-1.5 bg-slate-200 rounded-full"></div>
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                          {proc.views} VUES
                        </span>
                     </div>
                   </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    Reprendre la lecture
                  </span>
                  <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all"></i>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-8 border-t border-slate-50 text-center">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Procedio conserve vos 50 dernières consultations pour un accès rapide.</p>
        </div>
      </div>
    </div>
  );
};

export default History;
