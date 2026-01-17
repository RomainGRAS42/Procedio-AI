
import React, { useState } from 'react';
import { User, Procedure } from '../types';

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewHistory: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onQuickNote, onSelectProcedure, onViewHistory }) => {
  const [isRead, setIsRead] = useState(false);

  const [managerAnnouncement] = useState({
    author: "RO",
    fullName: "ROMS",
    content: "Bonjour l'équipe ! La maintenance de ce soir à 22h est cruciale pour la stabilité du réseau. Vérifiez bien vos checklist avant de clore votre service. Vous faites du super boulot ! 🚀",
  });

  const stats = [
    { label: 'Consultations', value: '42', icon: 'fa-book-open', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Suggestions', value: '7', icon: 'fa-check-circle', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Mes Notes', value: '12', icon: 'fa-note-sticky', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  ];

  const recentProcedures: Procedure[] = [
    { id: '1', title: 'Audit Sécurité Réseau v2.4', category: 'INFRASTRUCTURE', createdAt: 'Aujourd\'hui', views: 89, status: 'validated' },
    { id: '2', title: 'Provisioning Script WS', category: 'AUTOMATION', createdAt: 'Hier', views: 234, status: 'validated' },
    { id: '3', title: 'Guide Intégration SSO', category: 'LOGICIEL', createdAt: 'Hier', views: 156, status: 'validated' },
  ];

  const handleMarkAsRead = () => {
    setIsRead(true);
  };

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      
      {/* 1. BIENVENUE ÉPURÉE (Sans badge session active) */}
      <section className="bg-white/70 backdrop-blur-xl border border-white p-10 rounded-[3rem] shadow-xl shadow-indigo-500/5">
        <div className="space-y-2">
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            Ravi de vous voir, <span className="text-indigo-600">{user.firstName}</span>
          </h2>
          <p className="text-slate-500 font-semibold text-lg">Prêt à optimiser le support IT aujourd'hui ?</p>
        </div>
      </section>

      {/* 2. DISPOSITION HORIZONTALE (Manager + Infra sur la même ligne) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
        
        {/* MESSAGE DU MANAGER */}
        <section className={`relative border-2 rounded-[3rem] p-8 md:p-10 flex flex-col justify-between items-start gap-8 transition-all duration-500 ${
          isRead ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-indigo-100 shadow-2xl shadow-indigo-500/5'
        }`}>
          <div className={`absolute left-0 top-10 bottom-10 w-1.5 rounded-r-full transition-colors ${isRead ? 'bg-slate-300' : 'bg-indigo-500'}`}></div>
          <div className="flex items-center gap-6 w-full">
            <div className="flex flex-col items-center gap-3 shrink-0">
              <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">
                {managerAnnouncement.author}
              </div>
              <p className="font-black text-slate-900 text-[9px] uppercase tracking-[0.2em]">{managerAnnouncement.fullName}</p>
            </div>
            <div className="flex-1">
               <p className={`text-lg md:text-xl font-semibold leading-relaxed tracking-tight italic transition-colors ${isRead ? 'text-slate-400' : 'text-slate-800'}`}>
                 "{managerAnnouncement.content}"
               </p>
            </div>
          </div>
          <div className="w-full flex justify-start pl-20 mt-auto">
            {!isRead ? (
               <button onClick={handleMarkAsRead} className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                 Confirmer la lecture
               </button>
             ) : (
               <span className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                 <i className="fa-solid fa-circle-check text-base"></i> Message consulté
               </span>
             )}
          </div>
        </section>

        {/* SANTÉ INFRASTRUCTURE */}
        <section className="bg-indigo-950 rounded-[3rem] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between">
           <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] -mr-24 -mt-24"></div>
           <div className="relative z-10 space-y-6">
             <div className="flex items-center justify-between">
               <h3 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-300">État de l'Infrastructure</h3>
               <div className="flex items-center gap-3 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                 <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em]">Opérationnel</span>
               </div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Réseau Core", status: "OK", color: "emerald" },
                  { label: "Datacenter", status: "OK", color: "emerald" },
                  { label: "VPN Access", status: "Latence", color: "amber" },
                  { label: "Identity", status: "OK", color: "emerald" }
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">{s.label}</span>
                    <div className={`w-2 h-2 rounded-full ${s.color === 'emerald' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]'}`}></div>
                  </div>
                ))}
             </div>
           </div>
           <div className="relative z-10 pt-6 mt-4 flex justify-between items-center border-t border-white/5">
             <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Dernière vérification: il y a 2m</span>
             <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1 h-3 bg-emerald-500/30 rounded-full"></div>)}
             </div>
           </div>
        </section>
      </div>

      {/* 3. BARRE DE STATISTIQUES */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <article key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8 transition-all hover:translate-x-1 hover:shadow-md">
            <div className={`w-20 h-20 rounded-3xl ${stat.bg} ${stat.color} flex items-center justify-center text-3xl shadow-sm`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">{stat.label}</h3>
            </div>
          </article>
        ))}
      </section>

      {/* 4. HISTORIQUE - APERÇU */}
      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-sm shadow-lg shadow-indigo-100">
              <i className="fa-regular fa-clock"></i>
            </div>
            <h3 className="font-black text-slate-900 text-xl tracking-tight">Dernières procédures consultées</h3>
          </div>
          <button 
            onClick={onViewHistory}
            className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-5 py-2.5 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
          >
            Tout voir
          </button>
        </div>
        <div className="divide-y divide-slate-50">
           {recentProcedures.map(proc => (
             <div 
               key={proc.id} 
               onClick={() => onSelectProcedure(proc)}
               className="px-10 py-8 flex items-center justify-between hover:bg-indigo-50/40 transition-all group cursor-pointer border-l-4 border-transparent hover:border-indigo-500"
             >
                <div className="flex items-center gap-8">
                   <div className="w-16 h-16 bg-white border border-slate-100 text-slate-400 rounded-[1.25rem] flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                     <i className="fa-regular fa-file-lines text-2xl"></i>
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-800 text-xl group-hover:text-indigo-600 transition-colors leading-tight mb-2">{proc.title}</h4>
                     <div className="flex items-center gap-4">
                        <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-3 py-1 rounded-lg transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">{proc.category}</span>
                        <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{proc.views} vues</span>
                     </div>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                  <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all"></i>
                </div>
             </div>
           ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
