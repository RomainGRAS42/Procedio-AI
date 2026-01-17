
import React from 'react';
import { User, Procedure } from '../types';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const stats = [
    { label: 'Procédures', value: '42', icon: 'fa-file-shield', gradient: 'from-blue-500 to-indigo-600' },
    { label: 'Files actives', value: '07', icon: 'fa-bolt-lightning', gradient: 'from-amber-400 to-orange-500' },
    { label: 'Vérifiées', value: '31', icon: 'fa-shield-check', gradient: 'from-emerald-400 to-teal-600' },
    { label: 'Reach', value: '1.2k', icon: 'fa-chart-scatter', gradient: 'from-indigo-500 to-purple-700' },
  ];

  const recentProcedures: Procedure[] = [
    { id: '1', title: 'Audit Sécurité Réseau v2.4', category: 'INFRASTRUCTURE', createdAt: 'Aujourd\'hui, 14:20', views: 89, status: 'validated' },
    { id: '2', title: 'Provisioning Script WS', category: 'AUTOMATION', createdAt: 'Hier', views: 234, status: 'validated' },
    { id: '3', title: 'Guide Intégration SSO', category: 'LOGICIEL', createdAt: 'Il y a 2 jours', views: 156, status: 'validated' },
    { id: '4', title: 'Politique de Mots de Passe', category: 'SÉCURITÉ', createdAt: 'Il y a 3 jours', views: 312, status: 'validated' },
  ];

  return (
    <div className="space-y-12 animate-slide-up">
      <div className="flex flex-col gap-2">
        <span className="text-blue-600 font-black text-xs uppercase tracking-[0.3em]">Support Technique</span>
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Bonjour, {user.firstName} 👋</h2>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, idx) => (
          <div key={idx} className="glass-card p-8 group hover:-translate-y-3 transition-all relative overflow-hidden">
            <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-5 blur-3xl transition-opacity group-hover:opacity-20`}></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-2">
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
              </div>
              <div className={`bg-gradient-to-br ${stat.gradient} p-4 rounded-2xl text-white shadow-2xl shadow-blue-500/20 group-hover:scale-110 transition-transform`}>
                <i className={`fa-solid ${stat.icon} text-xl`}></i>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="w-full">
        <section className="glass-card overflow-hidden w-full">
          <div className="px-10 py-8 border-b border-white/40 flex justify-between items-center bg-white/30 backdrop-blur-md">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Activité Récente</h3>
            <button className="text-blue-600 font-black text-xs uppercase tracking-widest hover:underline">Tout voir</button>
          </div>
          <div className="divide-y divide-white/20">
            {recentProcedures.map((proc) => (
              <div key={proc.id} className="px-10 py-7 flex items-center justify-between hover:bg-white/40 transition-all cursor-pointer group">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <i className="fa-solid fa-file-pdf text-2xl"></i>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-colors">{proc.title}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{proc.createdAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <span className="px-5 py-2.5 rounded-2xl text-[10px] font-black tracking-widest bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                    {proc.category}
                  </span>
                  <div className="text-right min-w-[60px]">
                    <span className="block text-lg font-black text-slate-900 leading-none">{proc.views}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Vues</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
