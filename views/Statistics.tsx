import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Procedure, UserRole } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';
import InfoTooltip from '../components/InfoTooltip';

interface StatisticsProps {
  user: User;
  onUploadClick?: () => void;
  onSelectProcedure?: (procedure: Procedure) => void;
}

const Statistics: React.FC<StatisticsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [healthData, setHealthData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [missedOpportunities, setMissedOpportunities] = useState<{ term: string; count: number; trend: string }[]>([]);
  const [skillMapData, setSkillMapData] = useState<{ subject: string; A: number; fullMark: number; champion?: string }[]>([]);

  useEffect(() => {
    const fetchAllStats = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchHealthData(),
          fetchMissedOpportunities(),
          fetchSkillMap()
        ]);
      } catch (error) {
        console.error("Error fetching statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user.role === UserRole.MANAGER) {
      fetchAllStats();
    }
  }, [user]);

  const fetchHealthData = async () => {
    try {
      const { data: procs } = await supabase
        .from('procedures')
        .select('updated_at, created_at, views');

      if (!procs) return;

      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);

      let fresh = 0;
      let aging = 0;
      let old = 0;

      procs.forEach(p => {
        const date = new Date(p.updated_at || p.created_at);
        if (date > sixMonthsAgo) fresh++;
        else if (date > oneYearAgo) aging++;
        else old++;
      });

      setHealthData([
        { name: 'Frais (< 6 mois)', value: fresh, color: '#10b981' }, // Emerald-500
        { name: 'À revoir (6-12 mois)', value: aging, color: '#f59e0b' }, // Amber-500
        { name: 'Obsolète (> 1 an)', value: old, color: '#ef4444' }, // Rose-500
      ]);
    } catch (err) {
      console.error("Error fetching health data:", err);
    }
  };

  const fetchMissedOpportunities = async () => {
    try {
      const { data } = await supabase
        .from('notes')
        .select('title, created_at')
        .ilike('title', 'LOG_SEARCH_FAIL_%')
        .order('created_at', { ascending: false });

      if (!data) return;

      // Group by search term (extract from title LOG_SEARCH_FAIL_term)
      const counts: Record<string, number> = {};
      data.forEach(log => {
        const term = log.title.replace('LOG_SEARCH_FAIL_', '').toLowerCase();
        counts[term] = (counts[term] || 0) + 1;
      });

      // Convert to array and sort
      const sorted = Object.entries(counts)
        .map(([term, count]) => ({
          term,
          count,
          trend: 'stable' // Simplified trend logic for now
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5

      setMissedOpportunities(sorted);
    } catch (err) {
      console.error("Error fetching missed opportunities:", err);
    }
  };

  const fetchSkillMap = async () => {
    try {
      // Fetch all user profiles to aggregate stats
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, stats_by_category');

      if (!profiles) return;

      // Aggregate scores by category
      const categories: Record<string, { total: number; count: number; max: number; champion: string }> = {};

      profiles.forEach((p: any) => {
        if (p.stats_by_category) {
          Object.entries(p.stats_by_category).forEach(([cat, score]) => {
            const s = score as number;
            if (!categories[cat]) categories[cat] = { total: 0, count: 0, max: 0, champion: '' };
            
            categories[cat].total += s;
            categories[cat].count += 1;
            
            if (s > categories[cat].max) {
              categories[cat].max = s;
              categories[cat].champion = `${p.first_name} ${p.last_name}`;
            }
          });
        }
      });

      const mapData = Object.keys(categories).map(cat => ({
        subject: cat,
        A: Math.round(categories[cat].total / categories[cat].count), // Average
        fullMark: 100, // Normalized base
        champion: categories[cat].champion
      }));

      setSkillMapData(mapData);

    } catch (err) {
      console.error("Error fetching skill map:", err);
    }
  };

  if (user.role !== UserRole.MANAGER) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <i className="fa-solid fa-lock text-4xl mb-4"></i>
        <p>Accès réservé aux managers.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Centre d'Analyse
          </h1>
          <p className="text-slate-500 font-medium">
            Pilotage de la connaissance et de la performance d'équipe.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-slate-50 rounded-[2.5rem] animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          
          {/* 1. SANTÉ DE LA BASE (Pie Chart) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <i className="fa-solid fa-heart-pulse text-rose-500"></i>
                Santé du Patrimoine
              </h3>
              <InfoTooltip text="Répartition des procédures par fraîcheur (date de mise à jour)." />
            </div>
            
            <div className="flex-1 min-h-[250px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Center Label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className="block text-2xl font-black text-slate-800">
                    {healthData.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Docs</span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {healthData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. OPPORTUNITÉS MANQUÉES (List) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                Opportunités
              </h3>
              <InfoTooltip text="Termes recherchés sans résultat. Créez du contenu pour combler ces manques." />
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
              {missedOpportunities.length > 0 ? (
                missedOpportunities.map((opp, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-200 transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                      <div>
                        <p className="font-black text-slate-800 text-sm capitalize mb-1">{opp.term}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {opp.count} recherches échouées
                        </p>
                      </div>
                      <button className="w-8 h-8 rounded-xl bg-white text-indigo-600 shadow-sm flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all transform hover:scale-110 active:scale-95" title="Créer une procédure">
                        <i className="fa-solid fa-plus"></i>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-300">
                  <i className="fa-solid fa-check-circle text-4xl mb-3"></i>
                  <p className="text-xs font-bold uppercase tracking-widest text-center">Aucun manque détecté</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. SKILL MAP & CHAMPIONS (Radar + List) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col lg:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <i className="fa-solid fa-compass-drafting text-indigo-500"></i>
                Cartographie Compétences
              </h3>
              <InfoTooltip text="Niveau moyen de l'équipe par catégorie et experts identifiés." />
            </div>

            <div className="flex-1 flex flex-col gap-6">
              {/* Radar Chart */}
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillMapData}>
                    <PolarGrid stroke="#f1f5f9" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                    <Radar
                      name="Équipe"
                      dataKey="A"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fill="#6366f1"
                      fillOpacity={0.2}
                    />
                    <RechartsTooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Champions List */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Experts par Domaine</h4>
                {skillMapData.slice(0, 4).map((skill, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                        {skill.subject.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{skill.subject}</p>
                        <p className="text-[10px] font-medium text-slate-400">Moyenne: {skill.A}%</p>
                      </div>
                    </div>
                    {skill.champion && (
                      <div className="text-right">
                         <div className="flex items-center gap-1.5 justify-end">
                            <i className="fa-solid fa-crown text-amber-400 text-xs"></i>
                            <span className="text-xs font-black text-slate-800">{skill.champion}</span>
                         </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Statistics;
