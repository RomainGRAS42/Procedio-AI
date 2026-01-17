
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Statistics: React.FC = () => {
  const data = [
    { name: 'Jan', procedures: 8, views: 1240 },
    { name: 'Fév', procedures: 12, views: 1890 },
    { name: 'Mar', procedures: 15, views: 2340 },
    { name: 'Avr', procedures: 10, views: 2847 },
  ];

  const categoryData = [
    { category: 'LOGICIELS', total: 18, validated: 15, pending: 3, views: 1243, rate: '83%' },
    { category: 'INFRASTRUCTURE', total: 12, validated: 10, pending: 2, views: 867, rate: '83%' },
    { category: 'MATÉRIEL', total: 10, validated: 8, pending: 2, views: 534, rate: '80%' },
    { category: 'USERS', total: 5, validated: 4, pending: 1, views: 203, rate: '80%' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total procédures', value: '45', change: '+12%', icon: 'fa-file-lines', color: 'text-blue-600' },
          { label: 'Vues ce mois', value: '2,847', change: '+23%', icon: 'fa-eye', color: 'text-emerald-600' },
          { label: 'Taux de validation', value: '87%', change: '+5%', icon: 'fa-check-double', color: 'text-indigo-600' },
          { label: 'Temps de résolution', value: '4.2h', change: '-18%', icon: 'fa-bolt', color: 'text-amber-600' },
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase">{item.label}</span>
              <i className={`fa-solid ${item.icon} ${item.color}`}></i>
            </div>
            <div className="flex items-baseline gap-2">
              <h4 className="text-2xl font-black text-slate-800">{item.value}</h4>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                item.change.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>{item.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">Évolution mensuelle</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-8">Performances par catégorie</h3>
          <div className="space-y-6">
            {categoryData.map((cat) => (
              <div key={cat.category} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-slate-700">{cat.category}</span>
                  <span className="text-slate-400">{cat.validated} / {cat.total} validées</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-1000" 
                    style={{ width: `${(cat.validated/cat.total)*100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
