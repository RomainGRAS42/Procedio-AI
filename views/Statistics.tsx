import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Procedure, UserRole } from '../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import InfoTooltip from '../components/InfoTooltip';
import LoadingState from '../components/LoadingState';
import CustomToast from '../components/CustomToast';
import { cacheStore } from '../lib/CacheStore';

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
  // Initialisation à partir du cache pour un affichage instantané
  const [loading, setLoading] = useState(!cacheStore.has('stats_health'));
  
  const [healthData, setHealthData] = useState(cacheStore.get('stats_health') || []);
  const [missedOpportunities, setMissedOpportunities] = useState(cacheStore.get('stats_missed') || []);
  const [skillMapData, setSkillMapData] = useState(cacheStore.get('stats_skill_map') || []);
  const [activityData, setActivityData] = useState(cacheStore.get('stats_activity') || []);
  const [teamLeaderboard, setTeamLeaderboard] = useState(cacheStore.get('stats_leaderboard') || []);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  const [globalKPIs, setGlobalKPIs] = useState(cacheStore.get('stats_global_kpis') || {
    searchSuccess: 0,
    teamIntensity: 0,
    healthPct: 0,
    contributionPulse: 0,
    redZone: 0
  });

  useEffect(() => {
    const fetchAllStats = async () => {
      // Si on a déjà des données en cache, on ne montre pas le loader global
      // On revalide simplement en arrière-plan (SWR)
      const hasCache = cacheStore.has('stats_health');
      if (!hasCache) setLoading(true);

      try {
        await Promise.all([
          fetchHealthData(),
          fetchMissedOpportunities(),
          fetchSkillMap(),
          fetchActivityTrends(),
          fetchTeamLeaderboard()
        ]);
        
        // Une fois tout fini, on met à jour le cache des KPIs globaux (qui sont mis à jour par petits bouts)
        // Note: Les autres states sont mis à jour dans leurs fonctions fetch respectives
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
        .select('updated_at, created_at, views, Referent');

      if (!procs) return;

      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);

      let fresh = 0;
      let aging = 0;
      let old = 0;
      let redZoneCount = 0;

      procs.forEach((p: any) => {
        const date = new Date(p.updated_at || p.created_at);
        if (date > sixMonthsAgo) fresh++;
        else if (date > oneYearAgo) aging++;
        else old++;

        if (!p.Referent) redZoneCount++;
      });

      const total = procs.length;
      setGlobalKPIs(prev => ({ 
        ...prev, 
        healthPct: total > 0 ? Math.round((fresh / total) * 100) : 0,
        redZone: redZoneCount
      }));

      const health = [
        { name: 'Frais (< 6 mois)', value: fresh, color: '#10b981' }, 
        { name: 'À revoir (6-12 mois)', value: aging, color: '#f59e0b' },
        { name: 'Obsolète (> 1 an)', value: old, color: '#ef4444' },
      ];

      setHealthData(health);
      cacheStore.set('stats_health', health);
      cacheStore.set('stats_global_kpis', { 
        ...globalKPIs, 
        healthPct: total > 0 ? Math.round((fresh / total) * 100) : 0,
        redZone: redZoneCount
      });
    } catch (err) {
      console.error("Error fetching health data:", err);
    }
  };

  const fetchMissedOpportunities = async () => {
    try {
      // 1. Fetch pending opportunities from the new specialized table
      const { data: opportunities } = await supabase
        .from('search_opportunities')
        .select('term, search_count')
        .eq('status', 'pending')
        .order('search_count', { ascending: false })
        .limit(6);

      // 2. Calculate Search Success based on all search logs vs failures
      // Note: We still use the 'notes' table for the global success % calculation 
      // until a dedicated search_logs table is fully deployed.
      const { count: failCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .ilike('title', 'LOG_SEARCH_FAIL_%');

      const { count: totalSearch } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .ilike('title', 'LOG_SEARCH_%');

      const successPct = totalSearch && totalSearch > 0 
        ? Math.round(((totalSearch - (failCount || 0)) / totalSearch) * 100) 
        : 100;
      
      setGlobalKPIs(prev => ({ ...prev, searchSuccess: successPct }));

      if (opportunities) {
        const mapped = opportunities.map(opp => ({
          term: opp.term,
          count: opp.search_count,
          trend: 'stable'
        }));
        setMissedOpportunities(mapped);
        cacheStore.set('stats_missed', mapped);
      }
      
      cacheStore.set('stats_global_kpis', { ...globalKPIs, searchSuccess: successPct });
    } catch (err) {
      console.error("Error fetching missed opportunities:", err);
    }
  };

  const fetchSkillMap = async () => {
    try {
      // 1. Fetch real categories from procedures (to match Procedures.tsx logic)
      const { data: procs } = await supabase
        .from('procedures')
        .select('Type');
      
      const dbCategories = Array.from(new Set(
        procs?.map(p => (p.Type ? String(p.Type).toUpperCase() : 'NON CLASSÉ')) || []
      ));
      
      const defaultCats = ['INFRASTRUCTURE', 'LOGICIEL', 'MATERIEL', 'UTILISATEUR'];
      const synchronizedCategories = Array.from(new Set([...defaultCats, ...dbCategories])).sort();

      // 2. Fetch user profiles for expertise
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, stats_by_category');

      if (!profiles) return;

      const stats: Record<string, { total: number; count: number; max: number; champion: string }> = {};
      
      // Initialize with synchronized categories
      synchronizedCategories.forEach(cat => {
        stats[cat] = { total: 0, count: 0, max: 0, champion: '' };
      });

      profiles.forEach((p: any) => {
        if (p.stats_by_category) {
          Object.entries(p.stats_by_category).forEach(([cat, score]) => {
            const normalizedCat = cat.toUpperCase();
            // Only count if it's in our synchronized categories
            if (stats[normalizedCat]) {
              const s = score as number;
              stats[normalizedCat].total += s;
              stats[normalizedCat].count += 1;
              if (s > stats[normalizedCat].max) {
                stats[normalizedCat].max = s;
                stats[normalizedCat].champion = `${p.first_name} ${p.last_name}`;
              }
            }
          });
        }
      });

      let mapData = synchronizedCategories.map(cat => ({
        subject: cat,
        A: stats[cat].count > 0 ? Math.round(stats[cat].total / stats[cat].count) : 0,
        fullMark: 100,
        champion: stats[cat].champion
      }));

      // Radar chart needs at least 3 points for a proper shape
      if (mapData.length < 3) {
        const fallbacks = ['GENERAL', 'SYSTEME', 'RESEAU'].slice(0, 3 - mapData.length);
        fallbacks.forEach(f => {
          mapData.push({ subject: f, A: 0, fullMark: 100, champion: '' });
        });
      }

      setSkillMapData(mapData);
      cacheStore.set('stats_skill_map', mapData);
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
      cacheStore.set('stats_activity', chartData);

      // Pulse KPI: Average contributions per day
      const avgContrib = procs ? Math.round((procs.length / 30) * 10) / 10 : 0;
      setGlobalKPIs(prev => {
        const next = { ...prev, contributionPulse: avgContrib };
        cacheStore.set('stats_global_kpis', next);
        return next;
      });

    } catch (err) {
      console.error("Error fetching activity trends:", err);
    }
  };

  const fetchTeamLeaderboard = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select(`
          first_name, 
          last_name, 
          avatar_url, 
          role, 
          level, 
          current_xp,
          user_badges (
            badges (
              icon,
              name
            )
          )
        `)
        .order('current_xp', { ascending: false })
        .limit(5);

      if (data) {
        setTeamLeaderboard(data);
        cacheStore.set('stats_leaderboard', data);
      }

      // Active Users Intensity KPI
      const activeCount = data?.length || 0; 
      const intensity = Math.min(100, (activeCount / 10) * 100);
      setGlobalKPIs(prev => {
        const next = { ...prev, teamIntensity: intensity };
        cacheStore.set('stats_global_kpis', next);
        return next;
      });
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    }
  };

  const handleCreateRedZoneMission = async () => {
    if (globalKPIs.redZone === 0) {
      setToast({ message: "Aucune procédure en Zone Rouge ! Excellent travail.", type: "info" });
      return;
    }

    try {
      const { error } = await supabase
        .from('missions')
        .insert([{
          title: "Action Requise : Attribution de Référents",
          description: `Afin de maintenir l'excellence et la jour de notre base de connaissances, ${globalKPIs.redZone} procédures nécessitent l'assignation d'un référent expert. Merci de régulariser la situation.`,
          xp_reward: 100,
          urgency: 'high',
          assigned_to: null, // Open to team
          created_by: user.id,
          status: 'open',
          targetType: 'team'
        }]);

      if (error) throw error;

      setToast({ message: "Mission de fiabilisation lancée avec succès !", type: "success" });
    } catch (err) {
      console.error("Error creating mission:", err);
      setToast({ message: "Impossible de créer la mission.", type: "error" });
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
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
            label="Zone Rouge" 
            value={`${globalKPIs.redZone}`} 
            icon="fa-triangle-exclamation" 
            color="text-rose-600"
            bg="bg-rose-50"
            tooltip="Procédures sans référent assigné. Cliquez pour créer une mission de régularisation immédiate."
            onClick={handleCreateRedZoneMission}
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
            color="text-teal-600"
            bg="bg-teal-50"
            tooltip="Vitesse de création/mise à jour de nouvelles connaissances par jour sur les 30 derniers jours."
            align="right"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message="Synthèse analytique de votre base..." />
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
              <div className="xl:col-span-3 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative group">
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
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-700 truncate">
                          <i className="fa-solid fa-crown text-amber-400 mr-2"></i>
                          {skill.champion || 'N/A'}
                        </p>
                        <InfoTooltip text="Référent ayant le plus haut score d'activité sur ce sujet." align="right" />
                      </div>
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
                          <div className="flex gap-1.5 mt-2">
                             {(member as any).user_badges?.slice(0, 3).map((ub: any, bIdx: number) => (
                               <div key={bIdx} className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center border border-indigo-100/50" title={ub.badges.name}>
                                 <i className={`fa-solid ${ub.badges.icon} text-[8px] text-indigo-500`}></i>
                               </div>
                             ))}
                          </div>
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
      
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999]">
          <CustomToast 
            message={toast.message} 
            type={toast.type} 
            visible={true}
            onClose={() => setToast(null)} 
          />
        </div>
      )}
    </div>
  );
};

// Sub-component for KPI Cards
// Sub-component for KPI Cards
const KPICard = ({ label, value, unit, icon, color, bg, tooltip, align, onClick }: any) => {
  const isInteractive = !!onClick;

  return (
    <div 
      onClick={onClick}
      className={`
        relative p-6 rounded-3xl border transition-all duration-300 group
        ${isInteractive 
          ? 'bg-white border-rose-100 hover:border-rose-400 hover:bg-rose-50/10 cursor-pointer active:scale-95 shadow-md shadow-rose-100/50 hover:shadow-xl hover:shadow-rose-200/50' 
          : 'bg-white border-slate-100 shadow-sm hover:shadow-md'
        }
      `}
    >
      {/* Interactive Badge */}
      {isInteractive && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
           <div className="bg-rose-500 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest flex items-center gap-2 shadow-lg">
             Agir <i className="fa-solid fa-bolt"></i>
           </div>
        </div>
      )}

      {/* Info Tooltip (Absolute for stability) */}
      {!isInteractive && tooltip && (
        <div className="absolute top-3 right-3 z-20">
          <InfoTooltip 
            text={tooltip} 
            align="right"
            className="ml-0"
            iconClassName="text-slate-300 hover:text-indigo-500 text-sm bg-slate-50 hover:bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center transition-all"
          />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center text-xl transition-transform group-hover:scale-110 duration-300`}>
          <i className={`fa-solid ${icon}`}></i>
        </div>
      </div>
      <div className="space-y-1 relative z-10">
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black ${isInteractive ? 'text-rose-600' : 'text-slate-900'}`}>{value}</span>
          {unit && <span className="text-xs font-bold text-slate-400">{unit}</span>}
        </div>
        <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isInteractive ? 'text-rose-400' : 'text-slate-400'}`}>
          {label}
          {isInteractive && <i className="fa-solid fa-chevron-right text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></i>}
        </h4>
      </div>
    </div>
  );
};

export default Statistics;
