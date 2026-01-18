
import React, { useState } from 'react';
import { User, UserRole, Procedure } from '../types';

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewHistory: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onQuickNote, onSelectProcedure, onViewHistory }) => {
  const [isRead, setIsRead] = useState(false);
  const [managerAnnouncement, setManagerAnnouncement] = useState({
    author: "RO",
    fullName: "ROMS",
    content: "Bonjour l'équipe ! La maintenance de ce soir à 22h est cruciale pour la stabilité du réseau. Vérifiez bien vos checklist avant de clore votre service. Vous faites du super boulot ! 🚀",
  });

  const [newTeamMsg, setNewTeamMsg] = useState('');
  const [showManagerTools, setShowManagerTools] = useState(false);

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

  const handleUpdateTeamMsg = () => {
    if (newTeamMsg.trim()) {
      setManagerAnnouncement({ ...managerAnnouncement, content: newTeamMsg });
      setNewTeamMsg('');
      setIsRead(false); // Réinitialiser le statut de lecture pour l'équipe
      setShowManagerTools(false); // Ferme automatiquement le bloc (PJ n°2)
    }
  };

  return (
    <div className="space-y-10 animate-slide-up pb-12">
      
      {/* 1. BIENVENUE */}
      <section className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl shadow-indigo-500/5 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="space-y-2 text-center md:text-left">
          <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            Hello, <span className="text-indigo-600">{user.firstName}</span>
          </h2>
          <p className="text-slate-400 font-medium text-lg">Prêt à simplifier le support IT aujourd'hui ?</p>
        </div>
        
        {user.role === UserRole.MANAGER && (
          <button 
            onClick={() => setShowManagerTools(!showManagerTools)}
            className={`px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-xl ${
              showManagerTools 
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-indigo-100/20' 
                : 'bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-700'
            }`}
          >
            <i className={`fa-solid ${showManagerTools ? 'fa-xmark' : 'fa-bolt-lightning text-lg'}`}></i>
            {showManagerTools ? 'Fermer Command Center' : 'Open Command Center'}
          </button>
        )}
      </section>

      {/* 2. DASHBOARD TOOLS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* MESSAGE DU MANAGER */}
        <section className={`relative border border-slate-100 rounded-[3rem] p-10 flex flex-col justify-between items-start gap-10 transition-all duration-500 ${
          isRead ? 'bg-slate-50 opacity-60' : 'bg-white shadow-xl shadow-indigo-500/5'
        }`}>
          <div className="flex items-center gap-6 w-full">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl border border-indigo-100">
              {managerAnnouncement.author}
            </div>
            <div className="flex-1">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annonce Équipe</h4>
               <p className={`text-xl font-semibold leading-relaxed tracking-tight text-slate-700`}>
                 "{managerAnnouncement.content}"
               </p>
            </div>
          </div>
          <div className="w-full flex justify-between items-center">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Posté à l'instant</span>
            {user.role === UserRole.TECHNICIAN && !isRead && (
              <button onClick={() => setIsRead(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                Lu et compris
              </button>
            )}
          </div>
        </section>

        {/* COMMAND CENTER OU INFRA */}
        {user.role === UserRole.MANAGER && showManagerTools ? (
          <section className="bg-indigo-950 rounded-[3rem] p-10 text-white shadow-2xl space-y-8 animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-6">
               <h3 className="font-black text-xs uppercase tracking-[0.2em] text-indigo-300">Command Center</h3>
               <i className="fa-solid fa-tower-broadcast text-indigo-400 animate-pulse"></i>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Update Global</label>
                <textarea 
                  value={newTeamMsg}
                  onChange={(e) => setNewTeamMsg(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:bg-white/10 outline-none transition-all resize-none h-24"
                  placeholder="Écrire le message..."
                />
              </div>
              <button onClick={handleUpdateTeamMsg} className="w-full bg-indigo-600 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-900/50 transition-all">
                Diffuser le message
              </button>
            </div>
          </section>
        ) : (
          <section className="bg-white border border-slate-100 rounded-[3rem] p-10 flex flex-col justify-between shadow-xl shadow-indigo-500/5 animate-slide-up">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">Santé de l'infrastructure</h3>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Normal</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {['Réseau Core', 'Datacenter', 'VPN Access', 'Identity'].map((s) => (
                <div key={s} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm group hover:bg-white hover:border-indigo-100 transition-all">
                  <span className="text-[10px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">{s}</span>
                  <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 3. STATS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <article key={idx} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8 hover:shadow-md transition-all group">
            <div className={`w-20 h-20 rounded-3xl ${stat.bg} ${stat.color} flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">{stat.label}</h3>
            </div>
          </article>
        ))}
      </section>

      {/* 4. RECENTS */}
      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <h3 className="font-black text-slate-900 text-xl tracking-tight">Activité Récente</h3>
          <button onClick={onViewHistory} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">Tout voir</button>
        </div>
        <div className="divide-y divide-slate-50">
           {recentProcedures.map(proc => (
             <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="p-10 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all group">
                <div className="flex items-center gap-8">
                   <div className="w-16 h-16 bg-white border border-slate-100 text-slate-300 rounded-2xl flex items-center justify-center group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                     <i className="fa-regular fa-file-lines text-2xl"></i>
                   </div>
                   <div>
                     <h4 className="font-bold text-slate-800 text-xl group-hover:text-indigo-600 transition-colors leading-tight mb-2">{proc.title}</h4>
                     <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-3 py-1 rounded-lg">{proc.category}</span>
                   </div>
                </div>
                <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all"></i>
             </div>
           ))}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
