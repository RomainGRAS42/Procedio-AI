
import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';

const Statistics: React.FC = () => {
  // Données simulées pour l'évolution de la base de connaissance
  const evolutionData = [
    { name: 'Jan', consultations: 850, updates: 5 },
    { name: 'Fév', consultations: 1100, updates: 12 },
    { name: 'Mar', consultations: 980, updates: 8 },
    { name: 'Avr', consultations: 1450, updates: 15 },
    { name: 'Mai', consultations: 1200, updates: 10 },
    { name: 'Juin', consultations: 1900, updates: 22 },
  ];

  // Données des techniciens les plus actifs (Engagement)
  const topTechs = [
    { name: 'Sarah K.', suggestions: 14, views: 156, score: 92 },
    { name: 'Julien V.', suggestions: 8, views: 243, score: 88 },
    { name: 'Marc D.', suggestions: 5, views: 89, score: 75 },
    { name: 'Thomas B.', suggestions: 12, views: 112, score: 95 },
  ];

  // Liste des modifications récentes demandées
  const pendingRequests = [
    { id: 1, tech: 'Sarah K.', proc: 'Backup Policy v4', date: 'Il y a 2h', type: 'Correction', priority: 'High' },
    { id: 2, tech: 'Julien V.', proc: 'Config VPN Cisco', date: 'Il y a 5h', type: 'Mise à jour', priority: 'Medium' },
    { id: 3, tech: 'Marc D.', proc: 'SSO Azure AD', date: 'Hier', type: 'Ajout étape', priority: 'Low' },
  ];

  return (
    <div className="space-y-8 animate-slide-up pb-10">
      
      {/* 1. INDICATEURS CLÉS (KPIs) - Style Sombre Contrasté */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Procédures Actives', value: '142', detail: '+12 ce mois', icon: 'fa-file-shield', color: 'text-indigo-400', bg: 'bg-slate-900' },
          { label: 'Temps Moyen Lecture', value: '3m 45s', detail: '-12% vs mai', icon: 'fa-stopwatch', color: 'text-emerald-400', bg: 'bg-slate-900' },
          { label: 'Modifs Approuvées', value: '89%', detail: 'Taux de succès', icon: 'fa-square-check', color: 'text-blue-400', bg: 'bg-slate-900' },
          { label: 'Techniciens Actifs', value: '24', detail: 'Sur 26 total', icon: 'fa-users-gear', color: 'text-rose-400', bg: 'bg-slate-900' },
        ].map((kpi, idx) => (
          <div key={idx} className={`${kpi.bg} p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 relative overflow-hidden group hover:-translate-y-1 transition-all`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center ${kpi.color}`}>
                <i className={`fa-solid ${kpi.icon} text-xl`}></i>
              </div>
              <div>
                <h4 className="text-3xl font-black text-white tracking-tighter">{kpi.value}</h4>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{kpi.label}</p>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 ${kpi.color}`}>
                    {kpi.detail}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* 2. GRAPHIQUE D'ÉVOLUTION (Engagement vs Updates) */}
        <div className="xl:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight">Analyse de l'Engagement</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Volume de consultations vs Mises à jour</p>
            </div>
            <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none">
              <option>6 derniers mois</option>
              <option>Cette année</option>
            </select>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData}>
                <defs>
                  <linearGradient id="colorConsult" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '15px'}}
                  itemStyle={{fontWeight: 800, fontSize: '12px'}}
                />
                <Area type="monotone" dataKey="consultations" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorConsult)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. TOP TECHNICIENS (Classement Gamification) */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
          <h3 className="font-black text-slate-900 text-xl tracking-tight mb-8">Contributeurs Clés</h3>
          <div className="space-y-6 flex-1">
            {topTechs.map((tech, i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                  {tech.name.split(' ')[0][0]}{tech.name.split(' ')[1][0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{tech.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{tech.suggestions} suggestions</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-indigo-600 text-sm">{tech.score}%</p>
                  <p className="text-[9px] text-slate-300 font-bold uppercase">Impact</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">
            Voir tout l'annuaire
          </button>
        </div>
      </div>

      {/* 4. MODIFICATIONS DEMANDÉES (Tableau de bord de validation) */}
      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white text-sm shadow-lg shadow-rose-100">
              <i className="fa-solid fa-code-pull-request"></i>
            </div>
            <h3 className="font-black text-slate-900 text-xl tracking-tight">Modifications en attente</h3>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-white px-4 py-2 rounded-xl border border-slate-100">
            {pendingRequests.length} Requêtes Prioritaires
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Technicien</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Procédure Ciblée</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Priorité</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pendingRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                        {req.tech.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-700 text-sm">{req.tech}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <p className="font-bold text-slate-800 text-sm">{req.proc}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">{req.date}</p>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg uppercase tracking-widest">
                      {req.type}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${
                         req.priority === 'High' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 
                         req.priority === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                       }`}></div>
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{req.priority}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <button className="px-5 py-2.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 active:scale-95">
                      Examiner
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-8 bg-slate-50/30 text-center">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
             Interface de Gouvernance Procedio • Mode Manager Activé
           </p>
        </div>
      </section>
    </div>
  );
};

export default Statistics;
