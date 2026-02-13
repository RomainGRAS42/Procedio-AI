import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Procedure, UserRole } from '../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import KPIDetailsModal from '../components/KPIDetailsModal';
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
    redZone: 0,
    urgentCount: 0,
    totalViews: 0
  });

  // Modal State
  const [modalConfig, setModalConfig] = useState<{ title: string; type: 'urgent' | 'redZone'; items: any[] } | null>(null);
  const [redZoneList, setRedZoneList] = useState<any[]>([]);
  const [urgentList, setUrgentList] = useState<any[]>([]);

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
        .select('uuid, title, updated_at, created_at, views');

      if (!procs) return;

      const { data: referents } = await supabase.from('procedure_referents').select('procedure_id');
      const referentSet = new Set(referents?.map(r => r.procedure_id) || []);

      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);

      let fresh = 0;
      let aging = 0;
      let old = 0;
      let redZoneCount = 0;
      let totalViews = 0;
      const redZoneItems: any[] = [];

      procs.forEach((p: any) => {
        const date = new Date(p.updated_at || p.created_at);
        if (date > sixMonthsAgo) fresh++;
        else if (date > oneYearAgo) aging++;
        else old++;

        if (!referentSet.has(p.uuid)) {
          redZoneCount++;
          redZoneItems.push({
            id: p.uuid,
            label: p.title || "Procédure sans titre",
            sublabel: "Aucun référent assigné"
          });
        }
        totalViews += (p.views || 0);
      });

      setRedZoneList(redZoneItems);

      const total = procs.length;
      setGlobalKPIs(prev => ({ 
        ...prev, 
        healthPct: total > 0 ? Math.round((fresh / total) * 100) : 0,
        redZone: redZoneCount,
        totalViews: totalViews
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
        redZone: redZoneCount,
        totalViews: totalViews
      });
    } catch (err) {
      console.error("Error fetching health data:", err);
    }
  };

  const fetchMissedOpportunities = async () => {
    try {
      // 1. Fetch pending opportunities count for URGENT KPI
      const { count: urgentCount, data: opportunities } = await supabase
        .from('search_opportunities')
        .select('term, search_count', { count: 'exact' })
        .eq('status', 'pending')
        .order('search_count', { ascending: false })
        .limit(20); // Limit to top 20 for the list

      // 2. Calculate Search Success based on all search logs vs failures
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
      
      setGlobalKPIs(prev => ({ ...prev, searchSuccess: successPct, urgentCount: urgentCount || 0 }));

      if (opportunities) {
        const mapped = opportunities.slice(0, 6).map((opp: any) => ({
          term: opp.term,
          count: opp.search_count,
          trend: 'stable'
        }));
        setMissedOpportunities(mapped);
        cacheStore.set('stats_missed', mapped);

        // Store full list for modal
        setUrgentList(opportunities.map((opp: any) => ({
          label: opp.term,
          sublabel: `${opp.search_count} recherche(s) échouée(s)`,
          count: opp.search_count
        })));
      }
      
      cacheStore.set('stats_global_kpis', { ...globalKPIs, searchSuccess: successPct, urgentCount: urgentCount || 0 });
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
        supabase.from('notes')
          .select('created_at')
          .or('title.ilike.LOG_SEARCH_%,title.ilike.CONSULTATION_%')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('procedures').select('created_at').gte('created_at', thirtyDaysAgo.toISOString())
      ]);

      const days: Record<string, { display: string; views: number; contributions: number }> = {};
      
      // Initialize days
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // Robust key for matching: YYYY-MM-DD
        const key = d.toISOString().split('T')[0];
        const display = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        days[key] = { display, views: 0, contributions: 0 };
      }

      searches?.forEach(s => {
        const key = new Date(s.created_at).toISOString().split('T')[0];
        if (days[key]) days[key].views++;
      });

      procs?.forEach(p => {
        const key = new Date(p.created_at).toISOString().split('T')[0];
        if (days[key]) days[key].contributions++;
      });

      const chartData = Object.entries(days).map(([key, vals]) => ({
        date: vals.display,
        views: vals.views,
        contributions: vals.contributions
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

  const handleKpiClick = (type: 'urgent' | 'redZone') => {
    if (type === 'urgent') {
      setModalConfig({
        title: 'Recherches Critiques (Manquantes)',
        type: 'urgent',
        items: urgentList
      });
    } else {
      setModalConfig({
        title: 'Procédures Orphelines (Zone Rouge)',
        type: 'redZone',
        items: redZoneList
      });
    }
  };


  // ... (keep handleCreateRedZoneMission for backward compatibility or remove if fully replaced, but user asked for popup on click now)

  // Tabs State
  const [activeTab, setActiveTab] = useState<'urgent' | 'reliability' | 'dynamic' | 'redZone' | 'intensity'>('urgent');

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
      
      {/* 🚀 HEADER & GLOBAL KPIs (NAVIGATION TABS) */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Intelligence Métier
              <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-widest font-black">Pro</span>
            </h1>
            <p className="text-slate-500 font-medium text-lg max-w-2xl">
              Analysez la performance de votre base de connaissances via 5 axes stratégiques.
              Cliquez sur un indicateur pour voir le détail.
            </p>
          </div>
        </div>

        {/* TOP KPI ROW (TABS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <KPICard 
            label="Urgent" 
            value={`${globalKPIs.urgentCount}`} 
            icon="fa-triangle-exclamation" 
            color="text-rose-600"
            bg="bg-rose-50"
            tooltip="Recherches échouées nécessitant une action immédiate."
            isActive={activeTab === 'urgent'}
            onClick={() => setActiveTab('urgent')}
          />
          <KPICard 
            label="Fiabilité" 
            value={`${globalKPIs.healthPct}%`} 
            icon="fa-shield-heart" 
            color="text-emerald-600"
            bg="bg-emerald-50"
            tooltip="Santé documentaire et fraîcheur du contenu."
            isActive={activeTab === 'reliability'}
            onClick={() => setActiveTab('reliability')}
          />
          <KPICard 
            label="Dynamique" 
            value={`+${globalKPIs.totalViews}`} 
            icon="fa-arrow-trend-up" 
            color="text-indigo-600"
            bg="bg-indigo-50"
            tooltip="Croissance d'usage et trafic."
            isActive={activeTab === 'dynamic'}
            onClick={() => setActiveTab('dynamic')}
          />
          <KPICard 
            label="Zone Rouge" 
            value={`${globalKPIs.redZone}`} 
            icon="fa-triangle-exclamation" 
            color="text-rose-600"
            bg="bg-rose-50"
            tooltip="Procédures orphelines (sans référent)."
            isActive={activeTab === 'redZone'}
            onClick={() => setActiveTab('redZone')}
          />
          <KPICard 
            label="Intensité Team" 
            value={`${globalKPIs.teamIntensity}%`} 
            icon="fa-bolt-lightning" 
            color="text-amber-600"
            bg="bg-amber-50"
            tooltip="Engagement et contributions de l'équipe."
            align="right"
            isActive={activeTab === 'intensity'}
            onClick={() => setActiveTab('intensity')}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message="Analyse des données en cours..." />
      ) : (
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 min-h-[500px] animate-fade-in relative overflow-hidden transition-all">
          
          {/* TAB CONTENT: URGENT */}
          {activeTab === 'urgent' && (
            <div className="space-y-8 animate-fade-in">
              <div className="border-b border-rose-100 pb-8 mb-8">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-3">
                   <i className="fa-solid fa-triangle-exclamation text-rose-500"></i>
                   Opportunités de Croissance (Manquantes)
                 </h2>
                 <p className="text-slate-500 text-lg">
                   Ces termes ont été recherchés par vos équipes sans succès. Chaque "Recherche Échouée" est une demande directe d'information non satisfaite.
                   <br/><strong>Action requise :</strong> Créez les procédures manquantes pour combler ces vides.
                 </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {missedOpportunities.length > 0 ? (
                  missedOpportunities.map((opp, idx) => (
                    <div key={idx} className="p-8 rounded-[2rem] bg-rose-50/50 border border-rose-100 hover:border-rose-300 transition-all group cursor-pointer relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-50">
                        <span className="text-4xl font-black text-rose-200">#{idx + 1}</span>
                      </div>
                      <div className="relative z-10">
                        <span className="inline-block px-3 py-1 rounded-lg bg-white border border-rose-200 text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4 shadow-sm">
                          {opp.count} échecs
                        </span>
                        <h3 className="font-black text-slate-900 text-xl capitalize mb-2 leading-tight">
                          "{opp.term}"
                        </h3>
                        <p className="text-sm text-slate-500 font-medium mb-6">
                          Recherché fréquemment cette semaine.
                        </p>
                        <button className="flex items-center gap-2 text-xs font-black text-rose-600 uppercase tracking-widest group-hover:gap-3 transition-all bg-white px-4 py-2 rounded-xl w-fit shadow-sm border border-rose-100">
                          Créer la fiche <i className="fa-solid fa-plus"></i>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-slate-300 flex flex-col items-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 text-3xl mb-4">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <p className="font-black uppercase tracking-widest text-sm text-emerald-600">Aucune opportunité manquante détectée !</p>
                    <p className="text-slate-400 mt-2">Votre base couvre 100% des recherches actuelles.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: RELIABILITY (HEALTH) */}
          {activeTab === 'reliability' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 animate-fade-in">
              <div className="space-y-6">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                   <i className="fa-solid fa-shield-heart text-emerald-500"></i>
                   Qualité du Patrimoine
                </h2>
                <p className="text-slate-500 text-lg">
                  L'index de santé mesure la "fraîcheur" de vos procédures. Une base saine doit être mise à jour régulièrement pour rester fiable.
                  <br/><strong>Objectif :</strong> Maintenir plus de 70% de procédures "Fraîches" (&lt; 6 mois).
                </p>
                
                <div className="space-y-3 pt-4">
                  {healthData.map((item, idx) => (
                    <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between hover:scale-[1.02] transition-transform">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg shadow-sm" style={{ backgroundColor: item.color }}>
                          <i className={`fa-solid ${idx === 0 ? 'fa-check' : idx === 1 ? 'fa-clock' : 'fa-triangle-exclamation'}`}></i>
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">{item.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.value} procédures</p>
                        </div>
                      </div>
                      <span className="text-xl font-black text-slate-900">{Math.round((item.value / (healthData.reduce((a,b)=>a+b.value,0)||1))*100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center bg-slate-50/50 rounded-[2.5rem] p-8">
                 <div className="w-full h-[350px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={healthData}
                          cx="50%"
                          cy="50%"
                          innerRadius={90}
                          outerRadius={120}
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
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                        <span className="block text-5xl font-black text-slate-900">{globalKPIs.healthPct}%</span>
                        <span className="text-xs font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full mt-2">Score Global</span>
                    </div>
                 </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: DYNAMIC (ACTIVITY) */}
          {activeTab === 'dynamic' && (
             <div className="space-y-8 animate-fade-in">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-indigo-100 pb-8 mb-8 gap-6">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 mb-2">
                       <i className="fa-solid fa-arrow-trend-up text-indigo-500"></i>
                       Dynamique Interactive
                    </h2>
                    <p className="text-slate-500 text-lg max-w-2xl">
                       Suivez l'évolution de la consommation (Lectures) par rapport à la production (Contributions) sur 30 jours.
                       Une courbe saine montre une corrélation entre les deux.
                    </p>
                  </div>
                  <div className="flex items-center gap-6 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
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

               <div className="h-[400px] w-full">
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
                     <Area type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorViews)" name="Lectures" />
                     <Area type="monotone" dataKey="contributions" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorContribs)" name="Contributions" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
             </div>
          )}

          {/* TAB CONTENT: RED ZONE (ORPHANS) */}
          {activeTab === 'redZone' && (
             <div className="space-y-8 animate-fade-in">
               <div className="border-b border-rose-100 pb-8 mb-8">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-3">
                    <i className="fa-solid fa-triangle-exclamation text-rose-500"></i>
                    Zone Rouge (Procédures Orphelines)
                  </h2>
                  <p className="text-slate-500 text-lg">
                    Ces procédures n'ont **aucun référent assigné**. Personne n'est responsable de leur mise à jour.
                    C'est un risque majeur d'obsolescence et d'erreur pour les équipes terrain.
                    <br/><strong>Action :</strong> Assignez un manager ou un expert à chaque procédure ci-dessous.
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {redZoneList.length > 0 ? (
                   redZoneList.map((item, idx) => (
                     <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4 relative group hover:border-rose-300 transition-all">
                        <div className="flex items-start justify-between">
                           <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-lg">
                             <i className="fa-solid fa-file-circle-xmark"></i>
                           </div>
                           <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase">Orheline</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 line-clamp-2 mb-1 group-hover:text-rose-600 transition-colors">
                            {item.label}
                          </h3>
                          <p className="text-xs text-slate-400">ID: {item.id.slice(0, 8)}...</p>
                        </div>
                        <button className="mt-auto w-full py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs uppercase hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2">
                           Assigner un référent <i className="fa-solid fa-user-plus"></i>
                        </button>
                     </div>
                   ))
                 ) : (
                   <div className="col-span-full py-12 text-center text-emerald-500">
                     <i className="fa-solid fa-check-circle text-5xl mb-4"></i>
                     <p className="font-black">Aucune procédure orpheline ! Bravo.</p>
                   </div>
                 )}
               </div>
             </div>
          )}

          {/* TAB CONTENT: INTENSITY (TEAM) */}
          {activeTab === 'intensity' && (
             <div className="grid grid-cols-1 xl:grid-cols-5 gap-12 animate-fade-in">
                
                {/* RADAR CHART (Left) */}
                <div className="xl:col-span-2 flex flex-col justify-center border-r border-slate-100 pr-8">
                   <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                     <i className="fa-solid fa-crosshairs text-indigo-500"></i> Cartographie d'Expertise
                   </h3>
                   <div className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillMapData}>
                         <PolarGrid stroke="#e2e8f0" />
                         <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 900 }} />
                         <Radar name="Équipe" dataKey="A" stroke="#6366f1" strokeWidth={4} fill="#6366f1" fillOpacity={0.15} />
                         <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                       </RadarChart>
                     </ResponsiveContainer>
                   </div>
                   <p className="text-center text-xs text-slate-400 font-medium mt-4 max-w-xs mx-auto">
                     Le graphique montre la répartition des compétences validées (Quiz & Missions) par l'équipe.
                   </p>
                </div>

                {/* LEADERBOARD (Right) */}
                <div className="xl:col-span-3 space-y-6">
                   <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <i className="fa-solid fa-users text-amber-500"></i> Top Contributeurs
                      </h3>
                      <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
                        Voir toute l'équipe
                      </button>
                   </div>
                   
                   <div className="space-y-3">
                     {teamLeaderboard.map((member, idx) => (
                       <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-md transition-all group">
                         <div className="flex items-center gap-4">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                              #{idx + 1}
                            </span>
                            <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white" />
                            <div>
                               <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{member.first_name} {member.last_name}</p>
                               <p className="text-[10px] uppercase font-bold text-slate-400">Niveau {member.level} • {member.current_xp} XP</p>
                            </div>
                         </div>
                         
                         <div className="flex items-center gap-1">
                            {(member as any).user_badges?.slice(0, 3).map((ub: any, bIdx: number) => (
                              <div key={bIdx} className="w-6 h-6 rounded bg-white flex items-center justify-center border border-slate-100 text-xs text-indigo-500 shadow-sm" title={ub.badges.name}>
                                <i className={`fa-solid ${ub.badges.icon}`}></i>
                              </div>
                            ))}
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
          )}

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

// Sub-component for KPI Cards (Updated for Active State)
const KPICard = ({ label, value, unit, icon, color, bg, tooltip, align, onClick, isActive }: any) => {
  return (
    <div 
      onClick={onClick}
      className={`
        relative p-6 rounded-[2.5rem] border transition-all duration-300 group flex items-center gap-5 cursor-pointer
        ${isActive 
          ? `bg-white border-indigo-500 ring-4 ring-indigo-500/10 shadow-xl shadow-indigo-500/20 scale-[1.02] z-10` 
          : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 hover:scale-[1.01]'
        }
      `}
    >
      {/* Icon Section - Left */}
      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner transition-colors duration-300
        ${isActive ? 'bg-indigo-600 text-white' : `${bg} ${color}`}
      `}>
        <i className={`fa-solid ${icon}`}></i>
      </div>

      {/* Content Section - Right */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <p className={`text-3xl font-black tracking-tighter leading-none transition-colors duration-300 ${isActive ? 'text-indigo-900' : 'text-slate-900'}`}>
            {value}
            {unit && <span className="text-xs font-bold text-slate-400 ml-1">{unit}</span>}
          </p>
        </div>
        <p className={`text-[10px] font-black uppercase tracking-[0.2em] truncate transition-colors duration-300 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>
          {label}
        </p>
      </div>
      
      {/* Active Indicator Arrow */}
      {isActive && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-b border-r border-indigo-100 rotate-45 transform z-20 hidden lg:block"></div>
      )}
    </div>
  );
};

export default Statistics;
