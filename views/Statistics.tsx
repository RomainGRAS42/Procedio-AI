import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Procedure, UserRole } from '../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import InfoTooltip from '../components/InfoTooltip';

interface StatisticsProps {
  user: User;
  onUploadClick?: () => void;
  onSelectProcedure?: (procedure: Procedure) => void;
}

interface ActivityData {
  date: string;
  views: number;
  contributions: number;
}

const Statistics: React.FC<StatisticsProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [healthData, setHealthData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [missedOpportunities, setMissedOpportunities] = useState<{ term: string; count: number; trend: string }[]>([]);
  const [skillMapData, setSkillMapData] = useState<{ subject: string; A: number; fullMark: number; champion?: string }[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [teamLeaderboard, setTeamLeaderboard] = useState<any[]>([]);
  
  // Global KPIs
  const [globalKPIs, setGlobalKPIs] = useState({
    searchSuccess: 0,
    teamIntensity: 0,
    healthPct: 0,
    contributionPulse: 0
  });

  useEffect(() => {
    const fetchAllStats = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchHealthData(),
          fetchMissedOpportunities(),
          fetchSkillMap(),
          fetchActivityTrends(),
          fetchTeamLeaderboard()
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

      const total = procs.length;
      setGlobalKPIs(prev => ({ ...prev, healthPct: total > 0 ? Math.round((fresh / total) * 100) : 0 }));

      setHealthData([
        { name: 'Frais (< 6 mois)', value: fresh, color: '#10b981' }, 
        { name: 'À revoir (6-12 mois)', value: aging, color: '#f59e0b' },
        { name: 'Obsolète (> 1 an)', value: old, color: '#ef4444' },
      ]);
    } catch (err) {
      console.error("Error fetching health data:", err);
    }
  };

  const fetchMissedOpportunities = async () => {
    try {
      const { data: failLogs } = await supabase
        .from('notes')
        .select('title, created_at')
        .ilike('title', 'LOG_SEARCH_FAIL_%');

      const { count: totalSearch } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .ilike('title', 'LOG_SEARCH_%');

      if (!failLogs) return;

      const failCount = failLogs.length;
      const successPct = totalSearch && totalSearch > 0 
        ? Math.round(((totalSearch - failCount) / totalSearch) * 100) 
        : 100;
      
      setGlobalKPIs(prev => ({ ...prev, searchSuccess: successPct }));

      const counts: Record<string, number> = {};
      failLogs.slice(0, 100).forEach(log => {
        const term = log.title.replace('LOG_SEARCH_FAIL_', '').toLowerCase();
        counts[term] = (counts[term] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .map(([term, count]) => ({
          term,
          count,
          trend: 'stable'
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      setMissedOpportunities(sorted);
    } catch (err) {
      console.error("Error fetching missed opportunities:", err);
    }
  };

  const fetchSkillMap = async () => {
    try {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, stats_by_category');

      if (!profiles) return;

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
        A: Math.round(categories[cat].total / categories[cat].count),
        fullMark: 100,
        champion: categories[cat].champion
      }));

      setSkillMapData(mapData);
    } catch (err) {
      console.error("Error fetching skill map:", err);
    }
  };

  const fetchActivityTrends = async () => {
    try {
      // Fetch searches (views) and contributions (procedures created/updated) over last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [ { data: searches }, { data: procs } ] = await Promise.all([
        supabase.from('notes').select('created_at').ilike('title', 'LOG_SEARCH_%').gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('procedures').select('created_at').gte('created_at', thirtyDaysAgo.toISOString())
      ]);

      const days: Record<string, { views: number; contributions: number }> = {};
      
      // Initialize days
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        days[dateStr] = { views: 0, contributions: 0 };
      }

      searches?.forEach(s => {
        const dateStr = new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        if (days[dateStr]) days[dateStr].views++;
      });

      procs?.forEach(p => {
        const dateStr = new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        if (days[dateStr]) days[dateStr].contributions++;
      });

      const chartData = Object.entries(days).map(([date, vals]) => ({
        date,
        ...vals
      })).reverse();

      setActivityData(chartData);

      // Pulse KPI: Average contributions per day
      const avgContrib = procs ? Math.round((procs.length / 30) * 10) / 10 : 0;
      setGlobalKPIs(prev => ({ ...prev, contributionPulse: avgContrib }));

    } catch (err) {
      console.error("Error fetching activity trends:", err);
    }
  };

  const fetchTeamLeaderboard = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, avatar_url, role, level, current_xp')
        .order('current_xp', { ascending: false })
        .limit(5);

      if (data) setTeamLeaderboard(data);

      // Active Users Intensity KPI
      const activeCount = data?.length || 0; 
      setGlobalKPIs(prev => ({ ...prev, teamIntensity: Math.min(100, (activeCount / 10) * 100) }));
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
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
    <div className="p-8 max-w-[1600px] mx-auto space-y-12 animate-fade-in pb-20">
      
      {/* 🚀 HEADER & GLOBAL KPIs */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Intelligence Métier
              <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest font-black">Pro</span>
            </h1>
            <p className="text-slate-500 font-medium text-lg max-w-2xl">
              Analyse prédictive et pilotage stratégique du capital intellectuel de votre équipe.
            </p>
          </div>
        </div>

        {/* TOP KPI ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            label="Succès Recherche" 
            value={`${globalKPIs.searchSuccess}%`} 
            icon="fa-magnifying-glass-chart" 
            color="text-indigo-600"
            bg="bg-indigo-50"
            tooltip="Pourcentage de recherches ayant abouti à un résultat. Un taux bas indique des lacunes documentaires."
          />
          <KPICard 
            label="Fraîcheur Base" 
            value={`${globalKPIs.healthPct}%`} 
            icon="fa-leaf" 
            color="text-emerald-600"
            bg="bg-emerald-50"
            tooltip="Proportion de procédures mises à jour il y a moins de 6 mois."
          />
          <KPICard 
            label="Intensité Team" 
            value={`${globalKPIs.teamIntensity}%`} 
            icon="fa-bolt-lightning" 
            color="text-amber-600"
            bg="bg-amber-50"
            tooltip="Niveau d'activité global de l'équipe (consultations et contributions) par rapport aux objectifs."
          />
          <KPICard 
            label="Pulse Savoir" 
            value={`${globalKPIs.contributionPulse}`} 
            unit="docs/j"
            icon="fa-seedling" 
            color="text-rose-600"
            bg="bg-rose-50"
            tooltip="Vitesse de création/mise à jour de nouvelles connaissances par jour sur les 30 derniers jours."
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-80 bg-slate-50 rounded-[3rem] animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* 📈 SECTION 1: TENDANCES D'ACTIVITÉ (Full Width) */}
          <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-200">
                  <i className="fa-solid fa-chart-line"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    Dynamique Interactive
                    <InfoTooltip text="Évolution croisée entre l'utilisation du savoir (lectures) et la production de nouveau savoir (contributions) sur 30 jours." />
                  </h3>
                  <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Growth vs Consumption</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <span className="text-xs font-black text-slate-500">Lectures</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <span className="text-xs font-black text-slate-500">Créations</span>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorContribs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="#6366f1" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorViews)" 
                    name="Lectures"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="contributions" 
                    stroke="#10b981" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorContribs)" 
                    name="Contributions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 🧩 SECTION 2: ANALYSE DU CONTENU & TEAM (Grid System) */}
          <div className="space-y-12">
            
            {/* 📈 ROW 1: EXPÉRTISE & QUALITÉ (Bento 60/40) */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-12">
              
              {/* SKILL MAP RADAR (60%) */}
              <div className="xl:col-span-3 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    Cartographie d'Expertise
                    <InfoTooltip text="Visualisation radar du niveau moyen de compétence de l'équipe sur vos domaines clés. Identifiez les zones de fragilité." />
                  </h3>
                </div>

                <div className="h-[320px] w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="45%" outerRadius="80%" data={skillMapData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 900 }} />
                      <Radar
                        name="Équipe"
                        dataKey="A"
                        stroke="#6366f1"
                        strokeWidth={4}
                        fill="#6366f1"
                        fillOpacity={0.15}
                      />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8 relative z-10">
                  {skillMapData.slice(0, 4).map((skill, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:border-indigo-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{skill.subject}</span>
                        <span className="text-xs font-black text-indigo-600">{skill.A}%</span>
                      </div>
                      <p className="text-xs font-black text-slate-700 truncate">
                        <i className="fa-solid fa-crown text-amber-400 mr-2"></i>
                        {skill.champion || 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* HEALTH DONUT (40%) */}
              <div className="xl:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    Qualité du Patrimoine
                    <InfoTooltip text="Évaluation de l'obsolescence documentaire. Une base saine doit avoir plus de 70% de documents 'Frais'." />
                  </h3>
                </div>
                
                <div className="flex flex-col items-center gap-8">
                  <div className="w-[240px] h-[240px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={healthData}
                          cx="50%"
                          cy="50%"
                          innerRadius={75}
                          outerRadius={100}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {healthData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <span className="block text-4xl font-black text-slate-900">{globalKPIs.healthPct}%</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Index Santé</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full space-y-3">
                    {healthData.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between hover:scale-[1.02] transition-transform">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base shadow-sm" style={{ backgroundColor: item.color }}>
                            <i className={`fa-solid ${idx === 0 ? 'fa-check' : idx === 1 ? 'fa-clock' : 'fa-triangle-exclamation'}`}></i>
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-xs">{item.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.value} procédures</p>
                          </div>
                        </div>
                        <span className="text-base font-black text-slate-900">{Math.round((item.value / (healthData.reduce((a,b)=>a+b.value,0)||1))*100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 🏆 ROW 2: LEADERS & OPPORTUNITIES (Bento 40/60) */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-12">
              
              {/* TEAM LEADERBOARD (40%) */}
              <div className="xl:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    Top Contributeurs
                    <InfoTooltip text="Classement des collaborateurs les plus actifs sur la plateforme (XP, rédactions, validations)." />
                  </h3>
                </div>

                <div className="space-y-4">
                  {teamLeaderboard.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          {idx === 0 && <i className="fa-solid fa-crown absolute -top-3 -left-1 text-amber-400 text-sm rotate-[-20deg]"></i>}
                          <img src={member.avatar_url} alt="" className="w-14 h-14 rounded-2xl object-cover ring-4 ring-white shadow-md" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-indigo-600 border-2 border-white text-[10px] font-black text-white flex items-center justify-center shadow-lg">
                            {member.level}
                          </div>
                        </div>
                        <div>
                          <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {member.role === UserRole.MANAGER ? 'Manager Expert' : 'Technicien Senior'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-indigo-600">{member.current_xp.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expérience</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MISSED OPPORTUNITIES GRID (60%) */}
              <div className="xl:col-span-3 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    Opportunités de Croissance
                    <InfoTooltip text="Lexique des termes recherchés mais non trouvés. Chaque bloc est une opportunité de croissance pour votre KB." />
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {missedOpportunities.length > 0 ? (
                    missedOpportunities.map((opp, idx) => (
                      <div key={idx} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group cursor-pointer">
                        <div className="flex justify-between items-start mb-4">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm font-black text-xs">
                            #{idx + 1}
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase">Perdu {opp.count}x</span>
                        </div>
                        <p className="font-black text-slate-800 text-lg capitalize mb-4 leading-tight group-hover:text-indigo-600 transition-colors">
                          {opp.term}
                        </p>
                        <button className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest group-hover:gap-3 transition-all">
                          Combler <i className="fa-solid fa-arrow-right"></i>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center text-slate-300">
                      <i className="fa-solid fa-shield-heart text-5xl mb-4"></i>
                      <p className="font-black uppercase tracking-widest text-sm">Tout est couvert !</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for KPI Cards
const KPICard = ({ label, value, unit, icon, color, bg, tooltip }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center text-xl`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <InfoTooltip text={tooltip} />
    </div>
    <div className="space-y-1">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-black text-slate-900">{value}</span>
        {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
      </div>
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</h4>
    </div>
  </div>
);

export default Statistics;

