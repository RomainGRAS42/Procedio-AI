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

  // Tabs State & Multi-View
  const [layoutMode, setLayoutMode] = useState<'focus' | 'split' | 'grid'>('focus');
  const [selectedSlots, setSelectedSlots] = useState<(string | null)[]>(['urgent', 'reliability', 'dynamic']);

  const kpiConfig = [
    { id: 'urgent', label: 'Urgent', icon: 'fa-triangle-exclamation', color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'reliability', label: 'Fiabilité', icon: 'fa-shield-heart', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'dynamic', label: 'Dynamique', icon: 'fa-arrow-trend-up', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'redZone', label: 'Zone Rouge', icon: 'fa-file-circle-xmark', color: 'text-rose-600', bg: 'bg-rose-50' }, // Fixed icon in config
    { id: 'intensity', label: 'Intensité', icon: 'fa-bolt-lightning', color: 'text-amber-600', bg: 'bg-amber-50' }
  ];

  const updateSlot = (index: number, kpiId: string | null) => {
    const newSlots = [...selectedSlots];
    newSlots[index] = kpiId;
    setSelectedSlots(newSlots);
  };

  const isKpiSelected = (id: string) => {
    // In focus mode, only check the first slot
    if (layoutMode === 'focus') return selectedSlots[0] === id;
    
    // In split mode, check first 2 slots
    if (layoutMode === 'split') return selectedSlots.slice(0, 2).includes(id);
    
    // In grid mode, check all 3
    return selectedSlots.slice(0, 3).includes(id);
  };

  const getAvailableKPIs = (currentSlotIndex: number) => {
    // Filter out KPIs that are already selected in OTHER slots
    // We only care about active slots based on mode
    const activeSlotsCount = layoutMode === 'focus' ? 1 : layoutMode === 'split' ? 2 : 3;
    const otherSelectedKPIs = selectedSlots.filter((k, i) => i < activeSlotsCount && i !== currentSlotIndex && k !== null);
    return kpiConfig.filter(k => !otherSelectedKPIs.includes(k.id));
  };

  const renderKPIContent = (type: string | null, slotIndex: number) => {
    if (!type) {
      const options = getAvailableKPIs(slotIndex);
      return (
        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50 p-8 text-center animate-fade-in hover:border-indigo-300 hover:bg-slate-50 transition-all group">
            <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-slate-300 group-hover:text-indigo-500">
               <i className="fa-solid fa-plus text-2xl"></i>
            </div>
            <p className="font-black text-slate-400 mb-6 uppercase tracking-widest text-sm">Ajouter une analyse</p>
            <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
               {options.map(opt => (
                 <button 
                   key={opt.id}
                   onClick={() => updateSlot(slotIndex, opt.id)}
                   className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all text-left group/btn"
                 >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${opt.bg} ${opt.color}`}>
                      <i className={`fa-solid ${opt.icon}`}></i>
                    </div>
                    <span className="font-bold text-slate-700 group-hover/btn:text-indigo-700">{opt.label}</span>
                 </button>
               ))}
            </div>
        </div>
      );
    }

    const isCompact = layoutMode !== 'focus';

    return (
      <div className={`relative h-full flex flex-col ${isCompact ? '' : ''}`}>
        {/* Slot Header (Only in Split/Grid mode to allow changing/removing) */}
        {layoutMode !== 'focus' && (
           <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                 {(() => {
                    const cfg = kpiConfig.find(k => k.id === type);
                    return (
                      <>
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] ${cfg?.bg} ${cfg?.color}`}>
                           <i className={`fa-solid ${cfg?.icon}`}></i>
                        </div>
                        <span className="font-black text-slate-700 text-sm uppercase tracking-wider">{cfg?.label}</span>
                      </>
                    )
                 })()}
              </div>
              <div className="flex items-center gap-1">
                 <button onClick={() => updateSlot(slotIndex, null)} className="w-8 h-8 rounded-full hover:bg-rose-50 hover:text-rose-500 text-slate-300 transition-colors flex items-center justify-center">
                    <i className="fa-solid fa-xmark"></i>
                 </button>
              </div>
           </div>
        )}

        {/* CONTENT SWITCH */}
        {type === 'urgent' && (
             <div className="space-y-6 animate-fade-in flex-1">
               {layoutMode === 'focus' && (
                 <div className="border-b border-rose-100 pb-6 mb-6">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-3">
                      <i className="fa-solid fa-triangle-exclamation text-rose-500"></i>
                      Opportunités (Manquantes)
                    </h2>
                    <p className="text-slate-500 text-lg">
                      Termes recherchés sans succès. <br/><strong>Action :</strong> Créez les procédures manquantes.
                    </p>
                 </div>
               )}

               <div className={`grid gap-4 ${layoutMode === 'focus' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                 {missedOpportunities.slice(0, layoutMode === 'focus' ? 6 : 4).map((opp, idx) => (
                   <div key={idx} className="p-5 rounded-[1.5rem] bg-rose-50/50 border border-rose-100 hover:border-rose-300 transition-all group cursor-pointer relative overflow-hidden">
                     <div className="relative z-10">
                       <span className="inline-block px-2 py-0.5 rounded-md bg-white border border-rose-200 text-[9px] font-black text-rose-600 uppercase tracking-widest mb-2 shadow-sm">
                         {opp.count} échecs
                       </span>
                       <h3 className="font-black text-slate-900 text-lg capitalize mb-1 leading-tight truncate">
                         "{opp.term}"
                       </h3>
                       <button className="mt-3 flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg w-fit shadow-sm border border-rose-100 hover:bg-rose-600 hover:text-white transition-all">
                         Créer <i className="fa-solid fa-plus"></i>
                       </button>
                     </div>
                   </div>
                 ))}
                 {missedOpportunities.length === 0 && (
                    <div className="py-10 text-center text-slate-400">
                       <i className="fa-solid fa-check text-3xl mb-2 text-emerald-500"></i>
                       <p className="font-bold">Tout est sous contrôle</p>
                    </div>
                 )}
               </div>
             </div>
        )}

        {type === 'reliability' && (
             <div className="space-y-6 animate-fade-in flex-1">
                {layoutMode === 'focus' && (
                  <div className="mb-6">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                       <i className="fa-solid fa-shield-heart text-emerald-500"></i>
                       Qualité du Patrimoine
                    </h2>
                     <p className="text-slate-500 mt-2">Objectif : &gt; 70% de procédures fraîches.</p>
                  </div>
                )}
                
                <div className={`flex ${layoutMode === 'split' ? 'flex-col-reverse' : layoutMode === 'grid' ? 'flex-col-reverse' : 'grid grid-cols-2 gap-8'}`}>
                   <div className="space-y-3">
                     {healthData.map((item, idx) => (
                       <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs shadow-sm" style={{ backgroundColor: item.color }}>
                             <i className={`fa-solid ${idx === 0 ? 'fa-check' : idx === 1 ? 'fa-clock' : 'fa-triangle-exclamation'}`}></i>
                           </div>
                           <div>
                             <p className="font-bold text-slate-800 text-xs">{item.name}</p>
                           </div>
                         </div>
                         <span className="text-sm font-black text-slate-900">{Math.round((item.value / (healthData.reduce((a,b)=>a+b.value,0)||1))*100)}%</span>
                       </div>
                     ))}
                   </div>

                   <div className="flex items-center justify-center relative min-h-[200px]">
                      <ResponsiveContainer width="100%" height={200}>
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
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                          <span className="block text-2xl font-black text-slate-900">{globalKPIs.healthPct}%</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Santé</span>
                      </div>
                   </div>
                </div>
             </div>
        )}

        {type === 'dynamic' && (
            <div className="space-y-6 animate-fade-in flex-1">
               {layoutMode === 'focus' && (
                  <div className="mb-6">
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <i className="fa-solid fa-arrow-trend-up text-indigo-500"></i>
                        Dynamique
                     </h2>
                     <p className="text-slate-500 mt-2">Lectures vs Créations (30 jours)</p>
                  </div>
               )}
               <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={activityData}>
                     <defs>
                       <linearGradient id={`${slotIndex}-colorViews`} x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="date" hide={layoutMode === 'grid'} tick={{ fontSize: 10 }} />
                     <YAxis hide={true} />
                     <RechartsTooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }}/>
                     <Area type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill={`url(#${slotIndex}-colorViews)`} />
                     <Area type="monotone" dataKey="contributions" stroke="#10b981" strokeWidth={3} fillOpacity={0} fill="transparent" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </div>
        )}
        
        {type === 'redZone' && (
             <div className="space-y-6 animate-fade-in flex-1 h-full overflow-y-auto pr-2 custom-scrollbar">
               {layoutMode === 'focus' && (
                  <h2 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3"><i className="fa-solid fa-file-circle-xmark text-rose-500"></i> Zone Rouge</h2>
               )}
               <div className="grid grid-cols-1 gap-3">
                 {redZoneList.map((item, idx) => (
                   <div key={idx} className="bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-between group hover:border-rose-200">
                      <div className="overflow-hidden">
                        <h3 className="font-bold text-slate-900 truncate text-sm">{item.label}</h3>
                        <p className="text-[10px] text-slate-400">ID: {item.id.slice(0,6)}</p>
                      </div>
                      <button className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all">
                        <i className="fa-solid fa-user-plus text-xs"></i>
                      </button>
                   </div>
                 ))}
                 {redZoneList.length === 0 && <p className="text-center text-slate-400">Aucune procédure orpheline</p>}
               </div>
             </div>
        )}

        {type === 'intensity' && (
            <div className="space-y-6 animate-fade-in flex-1">
               {layoutMode === 'focus' && (
                  <h2 className="text-3xl font-black text-slate-900 mb-6 flex items-center gap-3"><i className="fa-solid fa-bolt-lightning text-amber-500"></i> Intensité</h2>
               )}
               <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillMapData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 800 }} />
                      <Radar name="Team" dataKey="A" stroke="#f59e0b" strokeWidth={3} fill="#f59e0b" fillOpacity={0.2} />
                      <RechartsTooltip />
                    </RadarChart>
                  </ResponsiveContainer>
               </div>
               <div className="space-y-2">
                  {teamLeaderboard.slice(0,3).map((m, i) => (
                     <div key={i} className="flex items-center gap-3 p-2 border-b border-slate-50 last:border-0">
                        <span className="text-xs font-black text-slate-300">#{i+1}</span>
                        <div className="flex-1 text-xs font-bold text-slate-700">{m.first_name} {m.last_name}</div>
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-black">{m.current_xp} XP</span>
                     </div>
                  ))}
               </div>
            </div>
        )}
      </div>
    );
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
            </p>
          </div>
          
          {/* LAYOUT SWITCHER */}
          <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-100 flex items-center gap-1 shadow-inner">
             <button 
               onClick={() => setLayoutMode('focus')}
               className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${layoutMode === 'focus' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
               title="Focus View (1)"
             >
                <i className="fa-regular fa-square"></i>
                <span className="text-xs font-black uppercase tracking-wider hidden md:block">Focus</span>
             </button>
             <div className="w-px h-6 bg-slate-200 mx-1"></div>
             <button 
               onClick={() => setLayoutMode('split')}
               className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${layoutMode === 'split' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
               title="Split View (2)"
             >
                <i className="fa-solid fa-table-columns"></i>
                <span className="text-xs font-black uppercase tracking-wider hidden md:block">Comparatif</span>
             </button>
             <button 
               onClick={() => setLayoutMode('grid')}
               className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${layoutMode === 'grid' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
               title="Grid View (3)"
             >
                <i className="fa-solid fa-grip"></i>
                <span className="text-xs font-black uppercase tracking-wider hidden md:block">Global</span>
             </button>
          </div>
        </div>

        {/* TOP KPI ROW (TABS/PALETTE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <KPICard 
            label="Urgent" 
            value={`${globalKPIs.urgentCount}`} 
            icon="fa-triangle-exclamation" 
            color="text-rose-600"
            bg="bg-rose-50"
            tooltip="Recherches échouées nécessitant une action immédiate."
            isActive={isKpiSelected('urgent')}
            onClick={() => updateSlot(0, 'urgent')}
          />
          <KPICard 
            label="Fiabilité" 
            value={`${globalKPIs.healthPct}%`} 
            icon="fa-shield-heart" 
            color="text-emerald-600"
            bg="bg-emerald-50"
            tooltip="Santé documentaire et fraîcheur du contenu."
            isActive={isKpiSelected('reliability')}
            onClick={() => updateSlot(0, 'reliability')}
          />
          <KPICard 
            label="Dynamique" 
            value={`+${globalKPIs.totalViews}`} 
            icon="fa-arrow-trend-up" 
            color="text-indigo-600"
            bg="bg-indigo-50"
            tooltip="Croissance d'usage et trafic."
            isActive={isKpiSelected('dynamic')}
            onClick={() => updateSlot(0, 'dynamic')}
          />
          <KPICard 
            label="Zone Rouge" 
            value={`${globalKPIs.redZone}`} 
            icon="fa-file-circle-xmark" 
            color="text-rose-600"
            bg="bg-rose-50"
            tooltip="Procédures orphelines (sans référent)."
            isActive={isKpiSelected('redZone')}
            onClick={() => updateSlot(0, 'redZone')}
          />
          <KPICard 
            label="Intensité Team" 
            value={`${globalKPIs.teamIntensity}%`} 
            icon="fa-bolt-lightning" 
            color="text-amber-600"
            bg="bg-amber-50"
            tooltip="Engagement et contributions de l'équipe."
            align="right"
            isActive={isKpiSelected('intensity')}
            onClick={() => updateSlot(0, 'intensity')}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState message="Analyse des données en cours..." />
      ) : (
        <div className={`
           grid gap-6 transition-all duration-500 ease-in-out
           ${layoutMode === 'focus' ? 'grid-cols-1' : ''}
           ${layoutMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : ''}
           ${layoutMode === 'grid' ? 'grid-cols-1 lg:grid-cols-3' : ''}
        `}>
           
           {/* SLOT 1: Always visible */}
           <div className={`bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 min-h-[500px] overflow-hidden ${selectedSlots[0] ? '' : 'flex flex-col'}`}>
              {renderKPIContent(selectedSlots[0], 0)}
           </div>

           {/* SLOT 2: Visible in Split & Grid */}
           {layoutMode !== 'focus' && (
             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 min-h-[500px] overflow-hidden">
                {renderKPIContent(selectedSlots[1], 1)}
             </div>
           )}

           {/* SLOT 3: Visible in Grid */}
           {layoutMode === 'grid' && (
             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 min-h-[500px] overflow-hidden">
                {renderKPIContent(selectedSlots[2], 2)}
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
