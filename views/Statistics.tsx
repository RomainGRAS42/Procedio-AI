import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import CreateMissionModal from '../components/CreateMissionModal';
import { cacheStore } from '../lib/CacheStore';
import AssignReferentModal from '../components/dashboard/AssignReferentModal';

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
  const navigate = useNavigate();
  // Initialisation à partir du cache pour un affichage instantané
  const [loading, setLoading] = useState(!cacheStore.has('stats_health'));
  
  const [healthData, setHealthData] = useState(cacheStore.get('stats_health') || []);
  const [skillMapData, setSkillMapData] = useState(cacheStore.get('stats_skill_map') || []);
  const [activityData, setActivityData] = useState(cacheStore.get('stats_activity') || []);
  const [teamLeaderboard, setTeamLeaderboard] = useState(cacheStore.get('stats_leaderboard') || []);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  const [globalKPIs, setGlobalKPIs] = useState(cacheStore.get('stats_global_kpis') || {
    searchSuccess: 0,
    searchSuccessRate: 100,
    teamIntensity: 0,
    healthPct: 0,
    contributionPulse: 0,
    redZone: 0,

    totalViews: 0,
    missedOpportunities: [] as { id: string; term: string; count: number; trend: 'up' | 'urgent' | 'new' }[],
    avoidedFailures: 0
  });

  // Modal State
  const [modalConfig, setModalConfig] = useState<{ title: string; type: 'redZone'; items: any[] } | null>(null);
  const [redZoneList, setRedZoneList] = useState<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrphan, setSelectedOrphan] = useState<{id: string, title: string} | null>(null);

  useEffect(() => {
    const fetchAllStats = async () => {
      // Si on a déjà des données en cache, on ne montre pas le loader global
      // On revalide simplement en arrière-plan (SWR)
      const hasCache = cacheStore.has('stats_health');
      if (!hasCache) setLoading(true);

      try {
        await Promise.all([
          fetchHealthData(),
          fetchSearchSuccessRate(),
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
        .select('uuid, title, updated_at, created_at, views, ignore_zone_rouge');

      if (!procs) return;

      const { data: referents } = await supabase.from('procedure_referents').select('procedure_id');
      const referentSet = new Set(referents?.map(r => r.procedure_id) || []);

      // 1. Fetch active missions ("open", "assigned", "in_progress") to check "Mission Launched"
      const { data: activeMissions } = await supabase
        .from('missions')
        .select('procedure_id')
        .in('status', ['open', 'assigned', 'in_progress'])
        .not('procedure_id', 'is', null);
      
      const activeMissionSet = new Set(activeMissions?.map(m => m.procedure_id) || []);

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

        // ZONE ROUGE LOGIC
        if (!referentSet.has(p.uuid) && !p.ignore_zone_rouge) {
          redZoneCount++;
          const hasMission = activeMissionSet.has(p.uuid);
          redZoneItems.push({
            id: p.uuid,
            label: p.title || "Procédure sans titre",
            sublabel: hasMission ? "Mission en cours" : "MANQUE DE RÉFÉRENT",
            hasMission: hasMission,
            isMissingReferent: !hasMission
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

  const fetchSearchSuccessRate = async () => {
    try {
      // RESET DATE: 2026-02-14T09:00:00.000Z
      const RESET_DATE = '2026-02-14T09:00:00.000Z';

      // Count total searches (all LOG_SEARCH_* entries) AFTER Reset Date
      const { count: totalSearches } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .ilike('title', 'LOG_SEARCH_%')
        .gte('created_at', RESET_DATE);

      // Count failed searches AFTER Reset Date
      const { count: failedSearches } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .ilike('title', 'LOG_SEARCH_FAIL_%')
        .gte('created_at', RESET_DATE);

      // Fetch aggregated missed opportunities from DEDICATED TABLE
      // 1. Get ALL pending opportunities for calculation to match Dashboard
      const { data: allOpportunities } = await supabase
        .from('search_opportunities')
        .select('search_count')
        .eq('status', 'pending');

      // 2. Get Top 5 for display
      const { data: topOpportunities } = await supabase
        .from('search_opportunities')
        .select('id, term, search_count, created_at, last_searched_at')
        .eq('status', 'pending')
        .order('search_count', { ascending: false })
        .limit(5);

      // 3. Fetch RESOLVED opportunities to calculate "Avoided Failures"
      const { data: resolvedOpportunities } = await supabase
        .from('search_opportunities')
        .select('search_count')
        .eq('status', 'resolved');

      const avoidedFailures = (resolvedOpportunities || []).reduce((acc, curr) => acc + (curr.search_count || 0), 0);

      const missedOpportunities = (topOpportunities || []).map(op => {
        let trend: 'up' | 'urgent' | 'new' = 'up';
        const created = new Date(op.created_at);
        const now = new Date();
        const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);

        if (op.search_count >= 5) trend = 'urgent';
        else if (diffDays <= 7) trend = 'new';
        
        return {
          id: op.id,
          term: op.term,
          count: op.search_count,
          trend
        };
      });

      // Calculate total failures based on the sum of search_counts in the table (plus current period logic if needed)
      // For simplicity and alignment with the dashboard, we sum pending opportunities counts
      const totalFailedCount = (allOpportunities || []).reduce((acc, curr) => acc + (curr.search_count || 0), 0);

      const successRate = totalSearches && totalSearches > 0 
        ? Math.round(((totalSearches - totalFailedCount) / totalSearches) * 100)
        : 100;

      const finalSuccessRate = Math.max(0, Math.min(100, successRate));

      setGlobalKPIs(prev => ({ ...prev, searchSuccessRate: finalSuccessRate, missedOpportunities, avoidedFailures }));
      cacheStore.set('stats_global_kpis', { ...globalKPIs, searchSuccessRate: finalSuccessRate, missedOpportunities, avoidedFailures });
    } catch (err) {
      console.error("Error fetching search success rate:", err);
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

      const mapData = synchronizedCategories.map(cat => ({
        subject: cat,
        A: stats[cat].count > 0 ? Math.round(stats[cat].total / stats[cat].count) : 0,
        fullMark: 100,
        champion: stats[cat].champion
      }));

      // Calculate Team Intensity (Average Expertise Score)
      const totalScore = mapData.reduce((acc, curr) => acc + curr.A, 0);
      const intensity = mapData.length > 0 ? Math.round(totalScore / mapData.length) : 0;

      setGlobalKPIs(prev => {
        const next = { ...prev, teamIntensity: intensity };
        cacheStore.set('stats_global_kpis', next);
        return next;
      });

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
          xp_points,
          user_badges (
            badges (
              icon,
              name
            )
          )
        `)
        .neq('role', 'manager') // Exclude managers from leaderboard
        .order('xp_points', { ascending: false })
        .limit(5);

      if (data) {
        setTeamLeaderboard(data);
        cacheStore.set('stats_leaderboard', data);
      }

      // Active Users Intensity KPI (Moved to SkillMap calculation for better relevance)
      // Kept here only for reference or fallback if needed, but logic is now in fetchSkillMap
      /* 
      const activeCount = data?.length || 0; 
      const intensity = Math.min(100, (activeCount / 10) * 100);
      setGlobalKPIs(prev => {
        const next = { ...prev, teamIntensity: intensity };
        cacheStore.set('stats_global_kpis', next);
        return next;
      });
      */
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    }
  };

  const handleKpiClick = (type: 'redZone') => {
    if (type === 'redZone') {
      setModalConfig({
        title: 'Procédures Orphelines (Zone Rouge)',
        type: 'redZone',
        items: redZoneList
      });
    }
  };

  const handleIgnoreZoneRouge = async (e: React.MouseEvent, procedureId: string) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment retirer cette procédure de la Zone Rouge ? Elle ne sera plus surveillée.")) return;

    try {
      const { error } = await supabase
        .from('procedures')
        .update({ ignore_zone_rouge: true })
        .eq('uuid', procedureId);

      if (error) throw error;

      // Optimistic update
      setRedZoneList(prev => prev.filter(item => item.id !== procedureId));
      setGlobalKPIs(prev => ({ ...prev, redZone: Math.max(0, prev.redZone - 1) }));
      
      setToast({ message: "Procédure retirée de la Zone Rouge", type: "success" });
    } catch (err) {
      console.error("Error ignoring procedure:", err);
      setToast({ message: "Erreur lors de la mise à jour", type: "error" });
    }
  };


  // ... (keep handleCreateRedZoneMission for backward compatibility or remove if fully replaced, but user asked for popup on click now)

  // Tabs State & Multi-View
  const [layoutMode, setLayoutMode] = useState<'focus' | 'split'>('focus');
  const [selectedSlots, setSelectedSlots] = useState<(string | null)[]>(['searchSuccess', 'reliability']);

  const kpiConfig = [
    { id: 'searchSuccess', label: 'Succès Recherche', icon: 'fa-magnifying-glass-chart', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'reliability', label: 'Fiabilité', icon: 'fa-shield-heart', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'dynamic', label: 'Dynamique', icon: 'fa-arrow-trend-up', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'redZone', label: 'Zone Rouge', icon: 'fa-file-circle-xmark', color: 'text-rose-600', bg: 'bg-rose-50' }, // Fixed icon in config
    { id: 'intensity', label: "Niveau d'Expertise", icon: 'fa-graduation-cap', color: 'text-amber-600', bg: 'bg-amber-50' }
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
    return selectedSlots.slice(0, 2).includes(id);
  };

  const getAvailableKPIs = (currentSlotIndex: number) => {
    // Filter out KPIs that are already selected in OTHER slots
    // We only care about active slots based on mode
    const activeSlotsCount = layoutMode === 'focus' ? 1 : 2;
    const otherSelectedKPIs = selectedSlots.filter((k, i) => i < activeSlotsCount && i !== currentSlotIndex && k !== null);
    return kpiConfig.filter(k => !otherSelectedKPIs.includes(k.id));
  };

  const renderKPIContent = (type: string | null, slotIndex: number) => {
    if (!type) {
      const options = getAvailableKPIs(slotIndex);
      return (
        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 p-8 text-center hover:border-indigo-300 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-slate-300 group-hover:text-indigo-500 ring-1 ring-slate-100">
               <i className="fa-solid fa-plus text-2xl"></i>
            </div>
            <p className="font-bold text-slate-400 mb-8 uppercase tracking-widest text-sm">Ajouter une analyse</p>
            <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
               {options.map(opt => (
                 <button 
                   key={opt.id}
                   onClick={() => updateSlot(slotIndex, opt.id)}
                   className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all text-left group/btn"
                 >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm ${opt.bg} ${opt.color}`}>
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
    const isWide = layoutMode === 'focus';

    return (
      <div className="relative h-full flex flex-col">
        {/* Slot Header (Only in Split mode to allow changing/removing) */}
        {layoutMode !== 'focus' && (
           <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-3">
                 {(() => {
                    const cfg = kpiConfig.find(k => k.id === type);
                    return (
                      <>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${cfg?.bg} ${cfg?.color}`}>
                           <i className={`fa-solid ${cfg?.icon}`}></i>
                        </div>
                        <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">{cfg?.label}</span>
                      </>
                    )
                 })()}
              </div>
              <button 
                onClick={() => updateSlot(slotIndex, null)} 
                className="w-8 h-8 rounded-full hover:bg-rose-50 hover:text-rose-500 text-slate-300 transition-colors flex items-center justify-center"
                title="Retirer ce widget"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
           </div>
        )}

        {/* CONTENT SWITCH */}
        {type === 'searchSuccess' && (
             <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
               <div className="w-full h-full flex flex-col">
                 {layoutMode === 'focus' && (
                   <div className="text-center mb-8">
                     <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2 flex items-center justify-center gap-3">
                       <i className="fa-solid fa-magnifying-glass-chart text-indigo-500"></i>
                       Taux de Succès des Recherches
                     </h2>
                   </div>
                 )}

                 <div className={`flex-1 rounded-[2rem] ${globalKPIs.searchSuccessRate >= 85 ? 'bg-emerald-50/40 border border-emerald-100' : 'bg-amber-50/40 border border-amber-100'} p-8 flex flex-col items-center justify-center relative overflow-hidden`}>
                   
                   {/* Background Decoration */}
                   <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none ${globalKPIs.searchSuccessRate >= 85 ? 'bg-emerald-300' : 'bg-amber-300'}`}></div>
                   <div className={`absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-20 -ml-16 -mb-16 pointer-events-none ${globalKPIs.searchSuccessRate >= 85 ? 'bg-emerald-300' : 'bg-amber-300'}`}></div>

                   <div className="relative z-10 text-center w-full max-w-4xl mx-auto">
                     <div className="mb-8 transform hover:scale-105 transition-transform duration-300">
                       <div className="text-7xl font-black mb-4 drop-shadow-sm flex items-center justify-center gap-4">
                         {globalKPIs.searchSuccessRate >= 85 ? (
                           <>
                            <i className="fa-solid fa-circle-check text-emerald-500 text-5xl"></i>
                            <span className="text-slate-800">{globalKPIs.searchSuccessRate}%</span>
                           </>
                         ) : (
                           <>
                            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-5xl"></i>
                            <span className="text-slate-800">{globalKPIs.searchSuccessRate}%</span>
                           </>
                         )}
                       </div>
                       <p className="text-lg font-bold text-slate-500 uppercase tracking-widest">
                         {globalKPIs.searchSuccessRate >= 85 ? "Performance Excellente" : "Attention Requise"}
                       </p>
                     </div>

                     {/* ENCOURAGING MESSAGE */}
                     {globalKPIs.avoidedFailures > 0 && (
                        <div className="mb-8 bg-white/80 backdrop-blur-sm border border-emerald-100 p-3 rounded-2xl inline-flex items-center gap-3 shadow-sm mx-auto animate-fade-in-up">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
                          </div>
                          <p className="text-emerald-700 text-xs font-bold pr-2">
                            Grâce aux missions créées, <span className="font-black underline decoration-emerald-300 underline-offset-2">{globalKPIs.avoidedFailures} échecs évités</span> ce mois-ci !
                          </p>
                        </div>
                     )}

                     {globalKPIs.searchSuccessRate >= 85 ? (
                       <div className="max-w-lg mx-auto bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-emerald-100/50 shadow-sm">
                         <p className="text-lg font-bold text-slate-800 mb-2">Tout fonctionne parfaitement !</p>
                         <p className="text-slate-600">
                           Vos procédures répondent à la majorité des besoins de l'équipe. Continuez à maintenir ce niveau de qualité.
                         </p>
                       </div>
                     ) : (
                       <div className="w-full">
                         <div className="flex items-center justify-center gap-2 mb-6">
                            <span className="h-px w-12 bg-amber-200"></span>
                            <p className="text-slate-500 font-bold uppercase text-xs tracking-wider">Recherches en échec</p>
                            <span className="h-px w-12 bg-amber-200"></span>
                         </div>
                         
                         <div className={`grid gap-4 ${isWide ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                           {(globalKPIs.missedOpportunities || []).map((op, idx) => (
                              <div key={idx} className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-amber-100/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group/item flex flex-col text-left relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-2 opacity-10 group-hover/item:opacity-20 transition-opacity">
                                    <i className="fa-solid fa-magnifying-glass text-4xl text-amber-500"></i>
                                 </div>
                                 
                                 <div className="mb-3">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="text-lg font-black text-slate-800">{op.term}</h4>
                                      {op.trend === 'urgent' && (
                                        <span className="bg-rose-100 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                          <i className="fa-solid fa-fire"></i> Urgent
                                        </span>
                                      )}
                                      {op.trend === 'new' && (
                                        <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                          <i className="fa-solid fa-sparkles"></i> Nouveau
                                        </span>
                                      )}
                                      {op.trend === 'up' && (
                                        <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                          <i className="fa-solid fa-arrow-trend-up"></i> En hausse
                                        </span>
                                      )}
                                    </div>
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                                      <i className="fa-solid fa-triangle-exclamation"></i>
                                      {op.count} échecs
                                    </span>
                                 </div>

                                 <button
                                   onClick={() => navigate('/missions', { 
                                      state: { 
                                         createMission: true, 
                                         initialData: { 
                                            title: `Opportunité : ${op.term}`,
                                            description: `L'expression "${op.term}" a été recherchée ${op.count} fois sans résultat.`,
                                            urgency: 'high',
                                            category: 'Opportunité',
                                            opportunity_id: op.id
                                         } 
                                      } 
                                   })}
                                   className="mt-auto w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black uppercase tracking-wide hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                 >
                                    Créer la mission <i className="fa-solid fa-arrow-right"></i>
                                 </button>
                              </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             </div>
        )}


        {type === 'reliability' && (
             <div className="flex-1 flex flex-col animate-fade-in">
                {layoutMode === 'focus' && (
                  <div className="mb-8 text-center">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
                       <i className="fa-solid fa-shield-heart text-emerald-500"></i>
                       Qualité du Patrimoine
                    </h2>
                     <p className="text-slate-500 mt-2 font-medium">Objectif : &gt; 70% de procédures fraîches.</p>
                  </div>
                )}
                
                <div className={`flex-1 flex ${isCompact ? 'flex-col gap-6' : 'flex-row items-center gap-12'}`}>
                   {/* Chart Section */}
                   <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={healthData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            cornerRadius={6}
                            stroke="none"
                          >
                            {healthData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }}
                            itemStyle={{ color: '#1e293b', fontWeight: 'bold', fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                          <div className="text-5xl font-black text-slate-800 tracking-tight">{globalKPIs.healthPct}%</div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Santé Globale</div>
                      </div>
                   </div>

                   {/* Legend/Stats Section */}
                   <div className={`flex-1 space-y-4 ${isCompact ? 'w-full' : 'max-w-md'}`}>
                     {healthData.map((item, idx) => (
                       <div key={idx} className="group p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all flex items-center justify-between">
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: item.color }}>
                             <i className={`fa-solid ${idx === 0 ? 'fa-check' : idx === 1 ? 'fa-clock' : 'fa-triangle-exclamation'}`}></i>
                           </div>
                           <div>
                             <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                             <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                               {idx === 0 ? "À jour" : idx === 1 ? "Vérification conseillée" : "Action requise"}
                             </p>
                           </div>
                         </div>
                         <div className="text-right">
                           <span className="block text-xl font-black text-slate-800">{item.value}</span>
                           <span className="text-[10px] text-slate-400 font-bold uppercase">Procédures</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
        )}

        {type === 'dynamic' && (
            <div className="flex-1 flex flex-col animate-fade-in">
               {layoutMode === 'focus' && (
                  <div className="mb-8 text-center">
                     <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
                        <i className="fa-solid fa-arrow-trend-up text-indigo-500"></i>
                        Dynamique d'Usage
                     </h2>
                     <p className="text-slate-500 mt-2 font-medium">Consultations vs Contributions (30 jours)</p>
                  </div>
               )}
               <div className="flex-1 w-full min-h-[300px] bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={activityData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id={`${slotIndex}-colorViews`} x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                         <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                       </linearGradient>
                       <linearGradient id={`${slotIndex}-colorContrib`} x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                         <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                     <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                     />
                     <YAxis hide={true} />
                     <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                     />
                     <Area 
                        type="monotone" 
                        dataKey="views" 
                        name="Vues"
                        stroke="#6366f1" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill={`url(#${slotIndex}-colorViews)`} 
                     />
                     <Area 
                        type="monotone" 
                        dataKey="contributions" 
                        name="Contributions"
                        stroke="#10b981" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill={`url(#${slotIndex}-colorContrib)`} 
                     />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
               
               {/* Stats Summary underneath */}
               <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-indigo-50/50 rounded-2xl p-4 flex items-center justify-between border border-indigo-100">
                      <div>
                          <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Vues Totales</p>
                          <p className="text-2xl font-black text-indigo-700">{activityData.reduce((a,b) => a + b.views, 0)}</p>
                      </div>
                      <i className="fa-solid fa-eye text-indigo-200 text-2xl"></i>
                  </div>
                  <div className="bg-emerald-50/50 rounded-2xl p-4 flex items-center justify-between border border-emerald-100">
                      <div>
                          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Nouveaux</p>
                          <p className="text-2xl font-black text-emerald-700">{activityData.reduce((a,b) => a + b.contributions, 0)}</p>
                      </div>
                      <i className="fa-solid fa-plus text-emerald-200 text-2xl"></i>
                  </div>
               </div>
            </div>
        )}
        
        {type === 'redZone' && (
             <div className="flex-1 flex flex-col animate-fade-in h-full overflow-hidden">
               {layoutMode === 'focus' && (
                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-black text-slate-900 mb-2 flex items-center justify-center gap-3">
                        <i className="fa-solid fa-file-circle-xmark text-rose-500"></i> Zone Rouge
                    </h2>
                    <p className="text-slate-500">Procédures nécessitant une attention immédiate</p>
                  </div>
               )}
               <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 p-1">
                 {redZoneList.map((item, idx) => (
                   <div key={idx} className="bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-between group hover:border-rose-200 hover:shadow-md hover:-translate-x-1 transition-all">
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <h3 className="font-bold text-slate-900 truncate text-sm">{item.label}</h3>
                        </div>
                        <p className={`text-[10px] font-bold pl-3.5 uppercase tracking-wider ${item.isMissingReferent ? "text-rose-500" : "text-slate-400"}`}>
                          {item.sublabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handleIgnoreZoneRouge(e, item.id)}
                          className="w-8 h-8 rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-500 flex items-center justify-center transition-all"
                          title="Ignorer cette alerte"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                        <button 
                          onClick={() => {
                              setSelectedOrphan({ id: item.id, title: item.label });
                              setAssignModalOpen(true);
                          }}
                          className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                          title="Assigner un référent"
                        >
                          <i className="fa-solid fa-user-plus text-sm"></i>
                        </button>
                      </div>
                   </div>
                 ))}
                 {redZoneList.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                        <i className="fa-solid fa-check-circle text-4xl mb-3 text-emerald-200"></i>
                        <p className="font-medium">Tout est en ordre</p>
                    </div>
                 )}
               </div>
             </div>
        )}

        {type === 'intensity' && (
            <div className="flex-1 flex flex-col animate-fade-in">
               {layoutMode === 'focus' && (
                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-3">
                        <i className="fa-solid fa-graduation-cap text-amber-500"></i>
                         Cartographie d'Expertise
                    </h2>
                    <p className="text-slate-500 mt-2">Répartition des compétences et leaders.</p>
                  </div>
               )}
               
               <div className="flex-1 flex flex-col gap-6">
                   {/* Radar Chart */}
                   <div className="flex-1 min-h-[200px] w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillMapData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} />
                          <Radar name="Score Moyen" dataKey="A" stroke="#f59e0b" strokeWidth={3} fill="#f59e0b" fillOpacity={0.2} />
                          <RechartsTooltip 
                             formatter={(value: number) => [`${value} XP`, 'Score Moyen']}
                             contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '8px 12px' }}
                             itemStyle={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '12px' }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                      <div className="absolute top-0 right-0">
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 uppercase tracking-wider shadow-sm">
                            Niveau Global: {globalKPIs.teamIntensity}%
                          </span>
                      </div>
                      
                      {/* Legend */}
                      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2 pointer-events-none">
                         <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-amber-500/20 border-2 border-amber-500"></span>
                            <span className="text-[10px] font-medium text-slate-500">Score d'expertise moyen de l'équipe (XP)</span>
                         </div>
                      </div>
                   </div>

                   {/* Leaderboard Section */}
                   <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                             <i className="fa-solid fa-trophy text-amber-500"></i> Cartographie d'Équipe - Top Contributeurs
                          </h3>
                      </div>
                      
                      <div className="space-y-3">
                          {teamLeaderboard.length > 0 ? (
                              teamLeaderboard.slice(0,3).map((m, i) => (
                                 <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-inner ${i===0 ? 'bg-amber-100 text-amber-700' : i===1 ? 'bg-slate-200 text-slate-600' : 'bg-orange-100 text-orange-700'}`}>
                                       {i+1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 truncate">{m.first_name} {m.last_name}</p>
                                        <p className="text-[9px] text-slate-400 capitalize">{m.role}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-xs font-black text-indigo-600">{m.xp_points} XP</span>
                                    </div>
                                 </div>
                              ))
                          ) : (
                              <div className="text-center py-4 text-slate-400 text-xs">
                                  Aucune donnée disponible.
                              </div>
                          )}
                      </div>
                   </div>
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
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 pb-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
              Intelligence Métier
              <span className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-widest font-black shadow-sm shadow-indigo-200">Pro</span>
            </h1>
            <p className="text-slate-500 font-medium text-lg max-w-2xl leading-relaxed">
              Analysez la performance de votre base de connaissances via 5 axes stratégiques.
            </p>
          </div>
          
          {/* LAYOUT SWITCHER */}
          <div className="bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50 flex items-center gap-1 shadow-inner backdrop-blur-sm">
             <button 
               onClick={() => setLayoutMode('focus')}
               className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${layoutMode === 'focus' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
               title="Focus View (1)"
             >
                <i className="fa-regular fa-square text-sm"></i>
                <span className="text-xs font-black uppercase tracking-wider hidden md:block">Focus</span>
             </button>
             <div className="w-px h-5 bg-slate-300/50 mx-1"></div>
             <button 
               onClick={() => setLayoutMode('split')}
               className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${layoutMode === 'split' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
               title="Comparatif View (2)"
             >
                <i className="fa-solid fa-table-columns text-sm"></i>
                <span className="text-xs font-black uppercase tracking-wider hidden md:block">Comparatif</span>
             </button>
          </div>
        </div>

        {/* TOP KPI ROW (TABS/PALETTE) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          <KPICard 
            label="Succès Recherche" 
            value={`${globalKPIs.searchSuccessRate}%`} 
            icon="fa-magnifying-glass-chart" 
            color={globalKPIs.searchSuccessRate >= 85 ? "text-emerald-600" : "text-amber-600"}
            bg={globalKPIs.searchSuccessRate >= 85 ? "bg-emerald-50" : "bg-amber-50"}
            isActive={isKpiSelected('searchSuccess')}
            onClick={() => updateSlot(0, 'searchSuccess')}
          />
          <KPICard 
            label="Fiabilité" 
            value={`${globalKPIs.healthPct}%`} 
            icon="fa-shield-heart" 
            color="text-emerald-600"
            bg="bg-emerald-50"
            isActive={isKpiSelected('reliability')}
            onClick={() => updateSlot(0, 'reliability')}
          />
          <KPICard 
            label="Dynamique" 
            value={`+${globalKPIs.totalViews}`} 
            icon="fa-arrow-trend-up" 
            color="text-indigo-600"
            bg="bg-indigo-50"
            isActive={isKpiSelected('dynamic')}
            onClick={() => updateSlot(0, 'dynamic')}
          />
          <KPICard 
            label="Zone Rouge" 
            value={`${globalKPIs.redZone}`} 
            icon="fa-file-circle-xmark" 
            color="text-rose-600"
            bg="bg-rose-50"
            isActive={isKpiSelected('redZone')}
            onClick={() => updateSlot(0, 'redZone')}
          />
          <KPICard 
            label="Niveau d'Expertise" 
            value={`${globalKPIs.teamIntensity}%`} 
            icon="fa-graduation-cap" 
            color="text-amber-600"
            bg="bg-amber-50"
            isActive={isKpiSelected('intensity')}
            onClick={() => updateSlot(0, 'intensity')}
          />
        </div>
      </div>

      {loading ? (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
          <div className="relative w-24 h-24">
             <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
             <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
               <i className="fa-solid fa-chart-pie text-indigo-300 text-2xl animate-pulse"></i>
             </div>
          </div>
          <p className="text-slate-400 font-medium animate-pulse">Analyse des données en cours...</p>
        </div>
      ) : (
        <div className={`
           grid gap-8 transition-all duration-500 ease-in-out
           ${layoutMode === 'focus' ? 'grid-cols-1' : ''}
           ${layoutMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : ''}
        `}>
           {layoutMode === 'focus' ? (
              // Focus Mode: Show only 1st slot, full width
              <div className="col-span-1 min-h-[600px] bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-10 ring-1 ring-slate-50 transition-all hover:shadow-2xl hover:shadow-indigo-100/50">
                 {renderKPIContent(selectedSlots[0], 0)}
              </div>
           ) : (
              // Split Mode: Show 2 slots
              <>
                <div className="min-h-[550px] bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 ring-1 ring-slate-50 transition-all hover:shadow-2xl hover:shadow-indigo-100/50">
                   {renderKPIContent(selectedSlots[0], 0)}
                </div>
                <div className="min-h-[550px] bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 ring-1 ring-slate-50 transition-all hover:shadow-2xl hover:shadow-indigo-100/50">
                   {renderKPIContent(selectedSlots[1], 1)}
                </div>
              </>
           )}
        </div>
      )}

      {/* Modal Zone Rouge */}
      {modalConfig && (
        <KPIDetailsModal
          onClose={() => setModalConfig(null)}
          title={modalConfig.title}
          type={modalConfig.type}
          items={modalConfig.items}
        />
      )}

      {selectedOrphan && (
        <AssignReferentModal
          isOpen={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          onSuccess={() => {
            setToast({ message: "Mission de validation envoyée !", type: "success" });
            fetchHealthData(); // Refresh list (though item will stay red until validated)
          }}
          procedureId={selectedOrphan.id}
          procedureTitle={selectedOrphan.title}
        />
      )}

      {/* Toast */}
      {toast && (
        <CustomToast
          visible={!!toast}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

// Sub-component for KPI Cards in Header
const KPICard = ({ label, value, icon, color, bg, isActive, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`
      relative overflow-hidden rounded-2xl p-5 border text-left transition-all duration-300 group outline-none
      ${isActive 
         ? 'bg-white border-indigo-500 shadow-lg shadow-indigo-100 ring-2 ring-indigo-500 transform -translate-y-1' 
         : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5'
      }
    `}
  >
     <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg shadow-sm transition-transform group-hover:scale-110 ${bg} ${color}`}>
           <i className={`fa-solid ${icon}`}></i>
        </div>
        {isActive && (
          <div className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
          </div>
        )}
     </div>
     <div className="space-y-1">
        <span className={`block text-3xl font-black tracking-tight ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>{value}</span>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
     </div>
     
     {/* Subtle decorative glow */}
     {isActive && (
       <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl opacity-50 pointer-events-none"></div>
     )}
  </button>
);

export default Statistics;
