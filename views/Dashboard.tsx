import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { User, Procedure, Suggestion, UserRole, Mission } from "../types";
import CustomToast from "../components/CustomToast";
// MissionSpotlight is defined locally at line 372 so no import needed, remove line 5
import TeamPodium from '../components/TeamPodium';
import XPProgressBar from '../components/XPProgressBar';
import MasteryProgress from '../components/MasteryProgress';
import LevelUpModal from '../components/LevelUpModal';
import BadgeUnlockedModal from '../components/BadgeUnlockedModal';
import InfoTooltip from "../components/InfoTooltip";
import { supabase } from "../lib/supabase";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import LoadingState from '../components/LoadingState';
import { cacheStore } from "../lib/CacheStore";

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewComplianceHistory: () => void;
  targetAction?: { type: 'suggestion' | 'read', id: string } | null;
  onActionHandled?: () => void;
  onUploadClick: () => void;
  onNavigate?: (view: string) => void;
}

interface Announcement {
  id: string;
  content: string;
  author_name: string;
  author_initials: string;
  created_at: string;
  author_id?: string;
  requires_confirmation?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({
  user,
  onQuickNote,
  onSelectProcedure,
  onViewComplianceHistory,
  targetAction,
  onActionHandled,
  onUploadClick,
  onNavigate,
}) => {
  console.log("DEBUG: Dashboard User Object:", { id: user?.id, role: user?.role });
  const [isRead, setIsRead] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(cacheStore.get('dash_announcement') || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(!cacheStore.has('dash_announcement'));
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [managerResponse, setManagerResponse] = useState("");

  const [recentProcedures, setRecentProcedures] = useState<Procedure[]>(cacheStore.get('dash_recent_procs') || []);
  const [loadingProcedures, setLoadingProcedures] = useState(!cacheStore.has('dash_recent_procs'));

  // Suggestions (Manager Only)
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>(cacheStore.get('dash_suggestions') || []);
  const [loadingSuggestions, setLoadingSuggestions] = useState(!cacheStore.has('dash_suggestions') && user.role === UserRole.MANAGER);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Activities
  const [activities, setActivities] = useState<any[]>(cacheStore.get('dash_activities') || []);
  const [loadingActivities, setLoadingActivities] = useState(!cacheStore.has('dash_activities'));

  // Missions
  const [activeMissions, setActiveMissions] = useState<Mission[]>(cacheStore.get('dash_active_missions') || []);
  const [loadingMissions, setLoadingMissions] = useState(!cacheStore.has('dash_active_missions'));



  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Mission Lifecycle State
  const [completingMission, setCompletingMission] = useState<Mission | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);


  
  // Referent System
  const [isReferent, setIsReferent] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<Procedure[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Mastery Claims (Manager Only)
  const [masteryClaims, setMasteryClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  // Badges (Personal View)
  const [earnedBadges, setEarnedBadges] = useState<any[]>(cacheStore.get('dash_earned_badges') || []);
  const [loadingBadges, setLoadingBadges] = useState(!cacheStore.has('dash_earned_badges'));

  // Gamification Celebrations
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string } | null>(null);
  const [showBadgeUnlockedModal, setShowBadgeUnlockedModal] = useState(false);
  const [unlockedBadgeData, setUnlockedBadgeData] = useState<any | null>(null);






  // État de la vue (Personnel vs Équipe) - Initialisé selon le rôle
  const [viewMode, setViewMode] = useState<"personal" | "team">(user.role === UserRole.MANAGER ? "team" : "personal");

  // Force update if role changes (though unlikely in session)
  useEffect(() => {
    setViewMode(user.role === UserRole.MANAGER ? "team" : "personal");
  }, [user.role]);

  // Stats personnelles
  const [personalStats, setPersonalStats] = useState(cacheStore.get('dash_personal_stats') || {
    consultations: 0,
    suggestions: 0,
    notes: 0,
    xp: 0,
    level: 1,
    mastery: [] as { subject: string; A: number; fullMark: number }[],
  });


  // Sprint Hebdo (XP gagnée cette semaine)
  const [weeklyXP, setWeeklyXP] = useState(cacheStore.get('dash_weekly_xp') || 0);

  // Trend du moment
  const [trendProcedure, setTrendProcedure] = useState<Procedure | null>(null);

  // Stats dynamiques (Manager)
  const [managerKPIs, setManagerKPIs] = useState(cacheStore.get('dash_manager_kpis') || {
    searchGaps: 0,
    health: 0,
    usage: 0,
    redZone: 0
  });

  const prevLevelRef = React.useRef<number>(personalStats.level);
  const prevBadgeCountRef = React.useRef<number>(earnedBadges.length);

  const getLevelTitle = (level: number) => {
    if (level >= 10) return "Légende Vivante";
    if (level >= 7) return "Maître Expert";
    if (level >= 5) return "Expert Senior";
    if (level >= 3) return "Pilote Confirmé";
    if (level >= 2) return "Apprenti Actif";
    return "Débutant";
  };

  // Detection Level Up & Badges
  useEffect(() => {
    if (user.role !== UserRole.TECHNICIAN) return;

    // 1. Check Level Up
    if (personalStats.level > prevLevelRef.current && prevLevelRef.current !== 0) {
      setLevelUpData({ 
        level: personalStats.level, 
        title: getLevelTitle(personalStats.level) 
      });
      setShowLevelUpModal(true);
    }
    prevLevelRef.current = personalStats.level;

    // 2. Check Badge Unlocked
    if (earnedBadges.length > prevBadgeCountRef.current && prevBadgeCountRef.current !== 0) {
      const newBadge = earnedBadges[earnedBadges.length - 1]?.badges;
      if (newBadge) {
        setUnlockedBadgeData(newBadge);
        setShowBadgeUnlockedModal(true);
      }
    }
    prevBadgeCountRef.current = earnedBadges.length;
  }, [personalStats.level, earnedBadges.length]);
  
  // Cockpit Widgets State (Manager)
  // Cockpit Widgets State (Manager)
  // const [missedOpportunities, setMissedOpportunities] = useState<{ term: string, count: number, trend: string }[]>([]); // MOVED TO STATISTICS
  // const [topContributors, setTopContributors] = useState<{ name: string, role: string, score: number, initial: string, color: string }[]>([]); // MOVED TO STATISTICS
  // const [healthData, setHealthData] = useState<{ name: string, id: string, value: number, color: string }[]>([]); // MOVED TO STATISTICS
  // const [allAvailableBadges, setAllAvailableBadges] = useState<any[]>([]); // UNUSED
  // const [allProcedures, setAllProcedures] = useState<Procedure[]>([]); // UNUSED

  const stats = user.role === UserRole.MANAGER && viewMode === "team" ? [
    {
      label: "Urgent",
      value: `${managerKPIs.searchGaps}`,
      icon: "fa-triangle-exclamation",
      color: "text-rose-600",
      bg: "bg-rose-50",
      desc: "Recherches échouées",
      tooltipTitle: "Alertes Critiques",
      tooltipDesc: "Nombre de recherches sans résultat nécessitant une création de contenu immédiate."
    },
    {
      label: "Fiabilité",
      value: `${managerKPIs.health}%`,
      icon: "fa-shield-heart",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      desc: "Score de santé",
      tooltipTitle: "Santé du Patrimoine",
      tooltipDesc: "Indicateur global de fraîcheur et de validation des procédures."
    },
    {
      label: "Dynamique",
      value: `+${managerKPIs.usage}`,
      icon: "fa-arrow-trend-up",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      desc: "Lectures période",
      tooltipTitle: "Croissance d'Usage",
      tooltipDesc: "Volume de consultations sur la période en cours."
    }
  ] : user.role === UserRole.MANAGER && viewMode === "personal" ? [
    {
      label: "Pilotage & Impact",
      value: `${personalStats.suggestions + personalStats.notes}`,
      icon: "fa-rocket",
      color: "text-orange-600",
      bg: "bg-orange-50",
      desc: "Actions managériales",
      tooltipTitle: "Contribution Manager",
      tooltipDesc: "Nombre d'annonces, réponses aux suggestions et actions de pilotage effectuées."
    },
    {
      label: "Validation Équipe",
      value: pendingSuggestions.filter(s => s.status === 'approved').length.toString(),
      icon: "fa-certificate",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      desc: "Suggestions validées",
      tooltipTitle: "Amélioration continue",
      tooltipDesc: "Nombre de suggestions de votre équipe que vous avez validées."
    },
    {
      label: "Notes de Terrain",
      value: personalStats.notes.toString(),
      icon: "fa-book-open",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      desc: "Observations partagées",
      tooltipTitle: "Transmission",
      tooltipDesc: "Notes et retours partagés avec l'équipe pour améliorer les processus."
    }
  ] : [
    {
      label: "Rang d'Expertise",
      value: (() => {
        const level = personalStats.level;
        if (level >= 5) return "Oracle";
        if (level >= 4) return "Mentor";
        if (level >= 3) return "Pilote";
        if (level >= 2) return "Acteur";
        return "Éclaireur";
      })(),
      icon: "fa-award",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      desc: `${personalStats.xp} XP total`,
      tooltipTitle: "Progression & Savoir",
      tooltipDesc: `Ton rang évolue avec ton expertise. Tu as accumulé ${personalStats.xp} XP à travers tes lectures (${personalStats.consultations} consultations) et tes contributions.`
    },
    {
      label: "Impact Équipe",
      value: `${personalStats.suggestions * 50} pts`,
      icon: "fa-handshake-angle",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      desc: `${personalStats.suggestions} suggs validées`,
      tooltipTitle: "Ton apport à l'équipe",
      tooltipDesc: `Chaque suggestion validée aide tes collègues et prouve ton expertise métier.`
    },
    {
      label: "Sprint Actuel",
      value: `+${weeklyXP} XP`,
      icon: "fa-bolt-lightning",
      color: "text-amber-600",
      bg: "bg-amber-50",
      desc: "Cette semaine",
      tooltipTitle: "Dynamique hebdomadaire",
      tooltipDesc: "XP gagnée au cours des 7 derniers jours. Garde le rythme !"
    },
  ];

  const filteredStats = stats;

  useEffect(() => {
    if (user?.id) {
      fetchRecentProcedures();
      fetchActivities();
      fetchPersonalStats();
      fetchTrendProcedure();
      fetchLatestAnnouncement();
      fetchActiveMissions();

      if (user.role === UserRole.MANAGER) {
        fetchSuggestions();
        fetchManagerKPIs();
        fetchMasteryClaims();
      }
      
      // Always check for referent workload (anyone can be a referent)
      fetchReferentWorkload();

    }
  }, [user?.id, user?.role]);




  const fetchPersonalStats = async () => {
    try {
      // 1. Profil (XP, Niveau, Maîtrise)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('xp_points, level, stats_by_category')
        .eq('id', user.id)
        .single();

      // 2. Consultations Perso
      const { count: consultCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('title', 'CONSULTATION_%');

      // 3. Suggestions Impact
      const { count: suggCount } = await supabase
        .from('procedure_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'approved');

      // 4. Vraies Notes
      const { data: allNotes } = await supabase
        .from('notes')
        .select('title')
        .eq('user_id', user.id);
      
      const realNotesCount = allNotes?.filter(n => 
        !n.title.startsWith('LOG_') && 
        !n.title.startsWith('CONSULTATION_') && 
        !n.title.startsWith('SUGGESTION_')
      ).length || 0;

      // 5. XP Hebdo (Simplifié: on prend les notes/logs des 7 derniers jours)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: weeklyConsults } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('title', 'CONSULTATION_%')
        .gte('created_at', sevenDaysAgo.toISOString());

      // 6. Transformer les stats par catégorie pour le RadarChart
      const masteryData = profile?.stats_by_category ? Object.keys(profile.stats_by_category).map(cat => ({
        subject: cat,
        A: profile.stats_by_category[cat],
        fullMark: Math.max(...Object.values(profile.stats_by_category as object) as number[]) + 5
      })).slice(0, 6) : [];

      const stats = {
        consultations: consultCount || 0,
        suggestions: suggCount || 0,
        notes: realNotesCount,
        xp: profile?.xp_points || 0,
        level: profile?.level || 1,
        mastery: masteryData,
      };
      setPersonalStats(stats);
      cacheStore.set('dash_personal_stats', stats);

      const weeklyXpVal = (weeklyConsults || 0) * 5;
      setWeeklyXP(weeklyXpVal); // +5 XP par lecture
      cacheStore.set('dash_weekly_xp', weeklyXpVal);

      // Fetch badges for personal view
      setLoadingBadges(true);
      const { data: userBadges, error: badgeError } = await supabase
        .from('user_badges')
        .select(`
          id,
          awarded_at,
          badges (
            id,
            name,
            description,
            icon,
            category
          )
        `)
        .eq('user_id', user.id);
      
      if (!badgeError && userBadges) {
        setEarnedBadges(userBadges);
        cacheStore.set('dash_earned_badges', userBadges);
      }
      setLoadingBadges(false);
    } catch (err) {
      console.error("Erreur stats personnelles:", err);
    }
  };

  const fetchTrendProcedure = async () => {
    try {
      const { data } = await supabase
        .from('procedures')
        .select('*')
        .eq('is_trend', true)
        .limit(1)
        .maybeSingle();
      if (data) {
        setTrendProcedure({
          id: data.uuid,
          uuid: data.uuid,
          file_id: data.file_id || data.uuid,
          title: data.title || "Sans titre",
          category: data.Type || "GÉNÉRAL",
          fileUrl: data.file_url,
          createdAt: data.created_at,
          views: data.views || 0,
          status: data.status || "validated",
          is_trend: true
        });
      }
    } catch (err) {
      // Pas de grave erreur si pas de trend
    }
  };

  const fetchManagerKPIs = async () => {
    try {
      // 1. Calculate Search Gaps Count using the new aggregated table
      const { count: opportunityCount } = await supabase
        .from('search_opportunities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 2. Calculate Health % and Usage
      const { data: procs } = await supabase
        .from('procedures')
        .select('views, updated_at, created_at');

      let totalViews = 0;
      let healthPct = 0;

      if (procs) {
        totalViews = procs.reduce((acc, p) => acc + (p.views || 0), 0);
        
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const freshCount = procs.filter(p => new Date(p.updated_at || p.created_at) > sixMonthsAgo).length;
        healthPct = procs.length > 0 ? Math.round((freshCount / procs.length) * 100) : 0;
      }

      // 3. Zone Rouge: Procédures sans référent
      const { data: referents } = await supabase.from('procedure_referents').select('procedure_id');
      
      const referentSet = new Set(referents?.map(r => r.procedure_id) || []);
      const { data: allIds } = await supabase.from('procedures').select('uuid');
      const redZoneCount = allIds?.filter(p => !referentSet.has(p.uuid)).length || 0;

      const kpis = {
        searchGaps: opportunityCount || 0,
        health: healthPct,
        usage: totalViews,
        redZone: redZoneCount
      };
      setManagerKPIs(kpis);
      cacheStore.set('dash_manager_kpis', kpis);

    } catch (err) {
      console.error("Erreur KPIs Manager:", err);
    }
  };



  const fetchReferentWorkload = async () => {
    setLoadingReviews(true);
    try {
      // Fetch procedures waiting for validation (status 'ready' or 'draft')
      // and where the user is a referent for that procedure (or category)
      const { data: referentSpecs } = await supabase
        .from('procedure_referents')
        .select('procedure_id')
        .eq('user_id', user.id);
      
      const procedureIds = referentSpecs?.map(r => r.procedure_id) || [];

      if (procedureIds.length > 0) {
        setIsReferent(true); // User controls at least one procedure
        const { data: procs } = await supabase
          .from('procedures')
          .select('*')
          .in('uuid', procedureIds)
          .eq('status', 'draft') // Only show draft ones that need review
          .order('created_at', { ascending: false });
        
        if (procs) {
          setPendingReviews(procs.map(p => ({
            ...p,
            id: p.uuid,
            file_id: p.file_id || p.uuid,
            title: p.title || "Sans titre",
            category: p.Type || "GÉNÉRAL",
            fileUrl: p.file_url,
            createdAt: p.created_at,
            status: p.status
          })));
        }
      }
    } catch (err) {
      console.error("Error fetching referent workload:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchMasteryClaims = async () => {
    if (user.role !== UserRole.MANAGER) return;
    setLoadingClaims(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          user_profiles:user_id (first_name, last_name, avatar_url),
          procedures:procedure_id (title, uuid)
        `)
        .ilike('title', 'CLAIM_MASTERY_%')
        .eq('viewed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setMasteryClaims(data);
    } catch (err) {
      console.error("Error fetching mastery claims:", err);
    } finally {
      setLoadingClaims(false);
    }
  };




  const openSuggestionById = async (id: string) => {
    console.log("🔍 Dashboard: Opening suggestion detail for ID:", id);
    let sugg = pendingSuggestions.find(s => String(s.id) === String(id));
    
    if (!sugg) {
      console.log("🔍 Dashboard: Suggestion not found in local state, fetching from DB...");
      try {
        const { data, error } = await supabase
          .from("procedure_suggestions")
          .select(`
            *,
            user:user_profiles!user_id(first_name, last_name, avatar_url),
            procedure:procedures!procedure_id(title)
          `)
          .eq("id", id)
          .single();

        if (error) {
          console.error("❌ Dashboard: Error fetching suggestion detail:", error);
          throw error;
        }

        if (data) {
          sugg = {
            id: data.id,
            content: data.suggestion,
            status: data.status,
            createdAt: data.created_at,
            type: data.type,
            priority: data.priority,
            userName: data.user ? `${data.user.first_name} ${data.user.last_name}` : "Inconnu",
            procedureTitle: data.procedure ? data.procedure.title : "Procédure inconnue",
            user_id: data.user_id,
            procedure_id: data.procedure_id,
            managerResponse: data.manager_response,
            respondedAt: data.responded_at
          };
        }
      } catch (err) {
        console.error("❌ Dashboard: Catch error in openSuggestionById:", err);
      }
    }

    if (!sugg) {
      console.warn("⚠️ Dashboard: Suggestion truly not found or fetch failed.");
      sugg = {
        id,
        content: "Impossible de charger le détail de la suggestion pour le moment. L'ID est peut-être invalide ou l'enregistrement a été supprimé.",
        status: "pending",
        createdAt: new Date().toISOString(),
        userName: "Inconnu",
        procedureTitle: "Procédure inconnue",
      };
    }

    setSelectedSuggestion(sugg);
    setShowSuggestionModal(true);
    onActionHandled?.();
  };

  useEffect(() => {
    if (targetAction) {
      if (targetAction.type === 'suggestion') {
        openSuggestionById(targetAction.id);
      } else {
        onActionHandled?.();
      }
    }
  }, [targetAction]);

  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .or("title.ilike.LOG_READ_%")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) {
        setActivities(data);
        cacheStore.set('dash_activities', data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Real-time Mission Sync
  useEffect(() => {
    // Manager listens to ALL missions, Tech listens only to theirs/open ones
    const filter = user.role === UserRole.MANAGER 
      ? undefined 
      : `assigned_to=eq.${user.id}`;

    const channel = supabase
      .channel('mission_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'missions',
          filter: filter // Manager gets global updates, Tech gets personal updates
        },
        (payload) => {
          console.log("Realtime Mission Update:", payload);
          const newMission = payload.new as Mission;
          
          setActiveMissions((prev) => {
            // If mission is completed and we're not manager viewing history, remove it
            if (newMission.status === 'completed' && user.role !== UserRole.MANAGER) {
              return prev.filter(m => m.id !== newMission.id);
            }
            // Update existing or add if matches criteria (for Manager)
            const exists = prev.find(m => m.id === newMission.id);
            if (exists) {
              return prev.map((m) => m.id === newMission.id ? { ...m, status: newMission.status } : m);
            }
            // If it's a new mission for the feed (e.g. just assigned), we might want to fetch it or ignore
            // For simple status sync, updating existing is enough.
            return prev;
          });
          
          // Also update cache
          const currentCache = cacheStore.get('dash_active_missions') || [];
          const updatedCache = currentCache.map((m: Mission) => m.id === newMission.id ? { ...m, status: newMission.status } : m);
          cacheStore.set('dash_active_missions', updatedCache);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, user.role]);

  const fetchActiveMissions = async () => {
    setLoadingMissions(true);
    try {
      let query = supabase
        .from('missions')
        .select('*');

      if (user.role === UserRole.MANAGER) {
        // Manager sees ALL active missions (not completed)
        // Adjust filter as needed for team scope
        query = query.neq('status', 'completed');
      } else {
        // Technician sees assigned or open
        query = query.or(`status.eq.open,assigned_to.eq.${user.id}`)
                     .not('status', 'eq', 'completed');
      }

      const { data } = await query
        .order('urgency', { ascending: false })
        .limit(10); // Increased limit for Manager view

      if (data) {
        setActiveMissions(data as Mission[]);
        cacheStore.set('dash_active_missions', data);
      }
    } catch (err) {
      console.error("Error fetching active missions:", err);
    } finally {
      setLoadingMissions(false);
    }
  };

  const handleStartMission = async (missionId: string) => {
    // 1. Optimistic Update: Immediately update local state
    const previousMissions = [...activeMissions];
    const updatedMissions = activeMissions.map(m => 
      m.id === missionId ? { ...m, status: 'in_progress' as const } : m
    );
    setActiveMissions(updatedMissions);
    cacheStore.set('dash_active_missions', updatedMissions);
    // User feedback immediately
    setToast({ message: "Mission démarrée ! Bon courage.", type: "success" });

    try {
      const { error } = await supabase
        .from('missions')
        .update({ status: 'in_progress' })
        .eq('id', missionId);
      
      if (error) throw error;
      
      // Notify Creator (Fire and Forget)
      const mission = activeMissions.find(m => m.id === missionId);
      if (mission && mission.created_by !== user.id) {
        await supabase.from('notifications').insert({
          user_id: mission.created_by,
          type: 'mission',
          title: 'Mission démarrée',
          content: `${user.firstName} a démarré la mission : ${mission.title}`,
          link: '/missions'
        });
      }
    } catch (err) {
      console.error("Error starting mission:", err);
      // Revert optimistic update on error
      setActiveMissions(previousMissions);
      cacheStore.set('dash_active_missions', previousMissions);
      setToast({ message: "Erreur lors du démarrage. Veuillez réessayer.", type: "error" });
    }
  };

  const handleCompleteMission = async () => {
    if (!completingMission || !completionNotes.trim()) return;
    
    setIsSubmittingCompletion(true);
    try {
      const { error } = await supabase
        .from('missions')
        .update({ 
          status: 'completed',
          completion_notes: completionNotes.trim()
        })
        .eq('id', completingMission.id);
      
      if (error) throw error;
      
      // Update local state to remove it from active
      const updatedMissions = activeMissions.filter(m => m.id !== completingMission.id);
      setActiveMissions(updatedMissions);
      cacheStore.set('dash_active_missions', updatedMissions);

      // Notify Creator
      if (completingMission.created_by !== user.id) {
        await supabase.from('notifications').insert({
          user_id: completingMission.created_by,
          type: 'mission',
          title: 'Bilan déposé',
          content: `${user.firstName} a terminé la mission : ${completingMission.title}`,
          link: '/missions'
        });
      }

      setToast({ message: "Mission terminée ! XP accordée.", type: "success" });
      setCompletingMission(null);
      setCompletionNotes("");
      
      // Refresh user stats to show XP gain
      fetchPersonalStats();
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la validation.", type: "error" });
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const MissionSpotlight = () => {
    // Priority: 'in_progress' first, then 'assigned'
    const assignedMission = activeMissions.find(m => 
      m.assigned_to === user.id && 
      (m.status === 'in_progress' || m.status === 'assigned')
    );
    
    if (!assignedMission) return null;

    const isInProgress = assignedMission.status === 'in_progress';

    const getDeadlineStatus = (deadline?: string, createdAt?: string) => {
      if (!deadline) return { label: "Pas de délai fixe", percent: 0, color: "bg-slate-200" };
      
      const now = new Date();
      const end = new Date(deadline);
      const start = createdAt ? new Date(createdAt) : new Date(now.getTime() - 1000 * 60 * 60 * 24); // Fallback 1 day ago
      
      const total = end.getTime() - start.getTime();
      const elapsed = now.getTime() - start.getTime();
      const percent = Math.min(Math.max((elapsed / total) * 100, 0), 100);
      
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) return { label: "Échu", percent: 100, color: "bg-rose-500" };
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      
      let label = days > 0 ? `${days}j restants` : `${hours}h restantes`;
      let color = "bg-indigo-600";
      if (percent > 80) color = "bg-rose-500";
      else if (percent > 50) color = "bg-amber-500";
      
      return { label, percent, color };
    };

    const dlStatus = getDeadlineStatus(assignedMission.deadline, assignedMission.created_at);

    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group transition-all duration-500 flex flex-col justify-between h-full min-h-[340px] hover:border-slate-200 hover:shadow-xl hover:shadow-slate-500/5">
        {/* Background decoration - Distinctive */}
        <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full transition-all duration-700 ${
          isInProgress ? 'bg-emerald-50/50' : 'bg-slate-50/50 group-hover:bg-slate-100/50'
        }`}></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-4">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all duration-500 ${
                 isInProgress 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                  : 'bg-slate-50 text-slate-400 group-hover:text-slate-900'
               }`}>
                 <i className={`fa-solid ${isInProgress ? 'fa-scroll' : 'fa-thumbtack'}`}></i>
               </div>
               <div>
                 <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase leading-none">
                      {isInProgress ? 'Mission en cours' : 'Nouvel Ordre'}
                    </h3>
                    {(assignedMission.urgency === 'high' || assignedMission.urgency === 'critical') && (
                      <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                    )}
                 </div>
                 <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">
                   {isInProgress ? 'Objectif stratégique' : 'Assigné par le manager'}
                 </p>
               </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-[0.2em] rounded-lg border ${
                  dlStatus.label === "Échu" 
                    ? "bg-rose-50 border-rose-100 text-rose-500" 
                    : "bg-slate-50 border-slate-100 text-slate-500"
                }`}>
                  <i className="fa-regular fa-calendar-clock mr-1.5"></i>
                  {dlStatus.label}
                </span>
                <span className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-lg border ${
                  isInProgress ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                }`}>
                  {isInProgress ? 'Actif' : 'Prioritaire'}
                </span>
              </div>
              
              <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px]">
                  <i className="fa-solid fa-cube"></i>
                </div>
                <span className="text-slate-800 text-[11px] font-black tracking-tighter">
                  {assignedMission.xp_reward} XP
                </span>
              </div>
            </div>
          </div>
          
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-3 line-clamp-2 leading-tight">
            {assignedMission.title}
          </h3>
          <p className="text-slate-500 text-sm font-medium line-clamp-3 leading-relaxed opacity-80 mb-6">
            {assignedMission.description}
          </p>

          {/* Deadline Progress Bar - Stricter look */}
          <div className="space-y-2 mt-auto">
             <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
                <span>Progression Temps</span>
                <span className={dlStatus.percent > 80 ? 'text-rose-500' : 'text-slate-600'}>{Math.round(dlStatus.percent)}%</span>
             </div>
             <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                <div 
                  className={`h-full transition-all duration-1000 ${dlStatus.color}`}
                  style={{ width: `${dlStatus.percent}%` }}
                ></div>
             </div>
          </div>
        </div>

        <div className="relative z-10 mt-8 flex items-center justify-between">
          <button 
            onClick={() => onNavigate?.('missions')}
            className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors group/link"
          >
            Détails de la mission
            <i className="fa-solid fa-arrow-right group-hover/link:translate-x-1 transition-transform"></i>
          </button>

          {!isInProgress ? (
            <button 
              onClick={() => handleStartMission(assignedMission.id)}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 hover:-translate-y-1 transition-all shadow-xl active:scale-95 flex items-center gap-3 group/btn"
            >
               <i className="fa-solid fa-play text-[9px]"></i>
               C'est parti !
            </button>
          ) : (
            <button 
              onClick={() => setCompletingMission(assignedMission)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:from-emerald-600 hover:to-teal-700 hover:-translate-y-1 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center gap-3 group/btn"
            >
               <i className="fa-solid fa-check text-[11px]"></i>
               Mission accomplie
            </button>
          )}
        </div>
      </div>
    );
  };

  const fetchSuggestions = async () => {

    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from("procedure_suggestions")
        .select(
          `
          id,
          suggestion,
          type,
          priority,
          created_at,
          status,
          user_id,
          procedure_id,
          manager_response,
          responded_at,
          user:user_profiles!user_id(first_name, last_name, avatar_url),
          procedure:procedures!procedure_id(title)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const suggestions = data.map((item: any) => ({
            id: item.id,
            content: item.suggestion,
            status: item.status,
            createdAt: item.created_at,
            type: item.type,
            priority: item.priority,
            userName: item.user ? `${item.user.first_name} ${item.user.last_name}` : "Inconnu",
            procedureTitle: item.procedure ? item.procedure.title : "Procédure inconnue",
            user_id: item.user_id,
            procedure_id: item.procedure_id,
            managerResponse: item.manager_response,
            respondedAt: item.responded_at,
          }));
        setPendingSuggestions(suggestions);
        cacheStore.set('dash_suggestions', suggestions);
      }
    } catch (err) {
      console.error("Erreur fetch suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleUpdateStatus = async (status: "approved" | "rejected") => {
    if (!selectedSuggestion) return;

    if (!managerResponse.trim()) {
      setToast({
        message: "Veuillez fournir une réponse au technicien.",
        type: "error"
      });
      return;
    }

    try {
      const now = new Date().toISOString();
      const isReferentUser = user.role === UserRole.TECHNICIAN;

      // 1. Update the suggestion record
      const updatePayload: any = { 
        status, 
        manager_response: managerResponse,
        responded_at: now
      };

      if (isReferentUser) {
        updatePayload.referent_id = user.id;
      } else {
        updatePayload.manager_id = user.id;
      }

      const { error: updateError } = await supabase
        .from("procedure_suggestions")
        .update(updatePayload)
        .eq("id", selectedSuggestion.id);

      if (updateError) throw updateError;

      // 🎮 GAMIFICATION : Gain d'XP via Secure RPC
      if (status === 'approved') {
        const xpAmount = 50;
        const { error: xpError } = await supabase.rpc('increment_user_xp', {
           target_user_id: selectedSuggestion.user_id,
           xp_amount: xpAmount,
           reason: `Suggestion validée : ${selectedSuggestion.procedureTitle}`
        });

        if (xpError) console.error("Error giving XP to author:", xpError);

        // 🎮 GAMIFICATION : Gain d'XP pour le RÉFÉRENT (+20 XP) s'il a fait la revue
        if (isReferentUser) {
           const { error: refError } = await supabase.rpc('increment_user_xp', {
             target_user_id: user.id,
             xp_amount: 20,
             reason: `Revue d'expert effectuée : ${selectedSuggestion.procedureTitle}`
           });
           
           if (refError) console.error("Error giving XP to referent:", refError);
           else setToast({ message: "Revue validée ! +20 XP gagnés.", type: "success" });
        }
      }

      // 2. Create a notification response for the technician (UI sync)
      await supabase
        .from("suggestion_responses")
        .insert({
          suggestion_id: selectedSuggestion.id,
          user_id: selectedSuggestion.user_id,
          manager_id: !isReferentUser ? user.id : null,
          status,
          manager_response: managerResponse,
          procedure_title: selectedSuggestion.procedureTitle,
          suggestion_content: selectedSuggestion.content,
          read: false
        });

      // 3. Update local state
      setPendingSuggestions((prev) => 
        prev.map((s) => 
          s.id === selectedSuggestion.id 
            ? { ...s, status, managerResponse: managerResponse, respondedAt: now }
            : s
        )
      );

      setToast({
        message: status === 'approved' ? "Suggestion validée avec succès !" : "Suggestion refusée.",
        type: "info"
      });

      setShowSuggestionModal(false);
      setSelectedSuggestion(null);
      setManagerResponse("");

      // 4. Log the action (Activity Feed)
      await supabase.from("notes").insert([
        {
          title: `SUGGESTION_${status.toUpperCase()}`,
          content: `Suggestion sur "${selectedSuggestion.procedureTitle}" ${status === "approved" ? "validée" : "refusée"} par ${user.firstName}.`,
          is_protected: false,
          user_id: user.id,
          tags: ["SUGGESTION", status.toUpperCase()],
        },
      ]);
    } catch (err) {
      console.error("❌ Dashboard: Error updating suggestion status:", err);
      setToast({ message: "Erreur lors de la mise à jour.", type: "error" });
    }
  };

  const fetchRecentProcedures = async () => {
    setLoadingProcedures(true);
    try {
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (data) {
        const procs = data.map((p) => ({
            id: p.uuid,
            db_id: p.uuid,
            file_id: p.file_id || p.uuid,
            title: p.title || "Sans titre",
            category: p.Type || "GÉNÉRAL",
            fileUrl: p.file_url,
            createdAt: p.created_at,
            views: p.views || 0,
            status: p.status || "validated",
          }));
        setRecentProcedures(procs);
        cacheStore.set('dash_recent_procs', procs);
      }
    } catch (err) {
      console.error("Erreur fetch procedures:", err);
    } finally {
      setLoadingProcedures(false);
    }
  };




  const [managerMessage, setManagerMessage] = useState<string | null>(null);

  const fetchLatestAnnouncement = async () => {
    setLoadingAnnouncement(true);
    try {
      const { data, error } = await supabase
        .from("team_announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setAnnouncement(data);
        cacheStore.set('dash_announcement', data);
        setRequiresConfirmation(data.requires_confirmation || false);
        
        // Vérifier si l'utilisateur a déjà lu cette annonce de manière persistante ET récupérer le message manager
        const { data: readRecord } = await supabase
          .from("announcement_reads")
          .select("message_manager, read_at")
          .eq("user_id", user.id)
          .eq("announcement_id", data.id)
          .maybeSingle();

        if (readRecord) {
          setManagerMessage(readRecord.message_manager);
          // Si le message manager est défini, on le met dans l'éditeur par défaut, sinon le contenu global
          setEditContent(readRecord.message_manager || data.content);
          
          if (readRecord.read_at) {
             setIsRead(true);
          } else {
             setIsRead(false);
          }
        } else {
          setIsRead(false);
          setManagerMessage(null);
          setEditContent(data.content);
        }
      } else {
        const defaultAnn = {
          id: "default",
          content: "Bienvenue sur Procedio. Aucune annonce d'équipe pour le moment.",
          author_name: "Système",
          author_initials: "SY",
          created_at: new Date().toISOString(),
        };
        setAnnouncement(defaultAnn);
        setManagerMessage(null);
        setEditContent(defaultAnn.content);
      }
    } catch (err) {
      console.error("Erreur annonces:", err);
    } finally {
      setLoadingAnnouncement(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      // 1. Sauvegarder en BDD (Priorité)
      const announcementData = {
        content: editContent,
        author_name: user.firstName,
        author_initials: user.firstName.substring(0, 2).toUpperCase(),
        author_id: user.id,
        requires_confirmation: requiresConfirmation,
      };

      const { data: savedData, error } = await supabase
        .from("team_announcements")
        .insert([announcementData])
        .select()
        .single();

      if (error) throw error;

      setToast({ message: "Annonce publiée avec succès !", type: "success" });
      setIsEditing(false);
      // Recharger pour avoir les IDs corrects
      await fetchLatestAnnouncement();
      // Reset le flag de lecture locale pour voir le changement "non lu" si applicable
      // setIsRead(false); 
    } catch (err) {
      console.error("Erreur save announcement:", err);
      setToast({ message: "Erreur lors de la publication.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!announcement) return;
    setIsRead(true);

    try {
      // 1. Sauvegarde persistante dans la table dédiée
      await supabase.from("announcement_reads").upsert({
        user_id: user.id,
        announcement_id: announcement.id,
        read_at: new Date().toISOString()
      }, { onConflict: 'user_id,announcement_id' });

      // 2. Log pour le manager (legacy)
      await supabase.from("notes").insert([
        {
          user_id: user.id,
          title: `LOG_READ_${announcement?.id || "unknown"}`,
          content: `✅ ${user.firstName} ${user.lastName || ""} a lu l'annonce le ${new Date().toLocaleString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          is_locked: false,
        },
      ]);
    } catch (err) {
      console.error("Erreur log lecture persistante:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    
    // Fallback if date is invalid, try to parse different formats if needed
    if (isNaN(date.getTime())) {
      const parts = dateStr.split(/[- :]/);
      if (parts.length >= 3) {
        const fallbackDate = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
        if (!isNaN(fallbackDate.getTime())) return fallbackDate.toLocaleDateString("fr-FR");
      }
      return "En attente..."; // More professional than "Format Invalide"
    }

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const toggleTrend = async (e: React.MouseEvent, proc: Procedure) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newTrendStatus = !proc.is_trend;
    
    // Si on active un trend, on peut vouloir désactiver les autres (optionnel)
    // Ici on fait simple: on change juste l'état du document
    try {
      const { error } = await supabase
        .from('procedures')
        .update({ is_trend: newTrendStatus })
        .eq('uuid', proc.id);
      
      if (error) throw error;
      
      // Update local state
      setRecentProcedures(prev => 
        prev.map(p => p.id === proc.id ? { ...p, is_trend: newTrendStatus } : p)
      );
      
      setToast({ 
        message: newTrendStatus ? "Procédure mise en Trend !" : "Trend retiré.", 
        type: "success" 
      });
    } catch (err) {
      console.error("Error toggling trend:", err);
    }
  };

  return (
    <div className="space-y-10 pb-10 px-4 md:px-10 animate-fade-in relative z-10 w-full overflow-x-hidden">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <section className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-xl shadow-indigo-500/5 flex flex-col md:flex-row justify-between items-end gap-6">
        {/* Titre & Toggle de vue */}
        <div className="flex-1">
            <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-1">
              {new Date()
                .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                .toUpperCase()}
            </p>
            <div className="flex flex-col md:flex-row md:items-baseline gap-4 md:gap-8">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">
                Bonjour, <span className="text-indigo-600">{user.firstName}</span>
              </h1>
              <p className="text-slate-400 font-medium text-sm md:text-base border-l-2 border-slate-100 pl-4 hidden md:block">
                {user.role === UserRole.MANAGER 
                  ? "Voici l'état des troupes et du savoir collectif."
                  : viewMode === "personal" 
                    ? "Prêt à piloter tes propres missions aujourd'hui ?" 
                    : "Voici l'état des troupes et du savoir collectif."}
              </p>
              {/* Mobile version of the text without border */}
              <p className="text-slate-400 font-medium text-sm md:hidden">
                {user.role === UserRole.MANAGER 
                  ? "L'état des troupes."
                  : "À toi de jouer !"}
              </p>
            </div>
        </div>


        {/* L'éclair du Trend - Uniquement si activé */}
        {trendProcedure && (
          <div className="mt-8 bg-gradient-to-r from-amber-500/10 via-amber-200/5 to-transparent p-6 rounded-[2.5rem] border border-amber-200/50 flex items-center justify-between gap-6 group hover:border-amber-400 transition-all cursor-pointer shadow-sm shadow-amber-100/20"
               onClick={() => onSelectProcedure(trendProcedure)}>
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-amber-200 animate-pulse">
                <i className="fa-solid fa-bolt"></i>
              </div>
              <div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-lg border border-amber-100 flex items-center gap-2 mb-2 w-fit">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                  Trend du moment
                </span>
                <h3 className="font-bold text-slate-900 text-xl tracking-tight leading-none">
                  {trendProcedure.title}
                </h3>
                <p className="text-slate-400 text-sm mt-1 font-medium">
                  Le manager a mis cette procédure en priorité. Consulte-la maintenant !
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right hidden sm:block">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adoption</p>
                 <p className="text-lg font-bold text-slate-700">{trendProcedure.views} lectures</p>
               </div>
               <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-amber-500 group-hover:border-amber-300 transition-all">
                 <i className="fa-solid fa-arrow-right"></i>
               </div>
            </div>
          </div>
        )}
      </section>

      {/* Message du Manager */}
      <section className={`bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4 animate-fade-in ${isRead ? "opacity-75" : "border-indigo-100 shadow-indigo-50"}`}>
        {loadingAnnouncement ? (
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement de l'annonce...</span>
          </div>
        ) : isEditing ? (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  Édition du message manager
                </h4>
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-rose-500">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="flex gap-4">
                <textarea
                    className="flex-1 h-20 p-4 bg-slate-50 border border-indigo-100 rounded-xl focus:bg-white focus:border-indigo-500 outline-none resize-none font-medium text-slate-700 text-sm transition-all"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Message..."
                />
                <div className="flex flex-col gap-2 justify-between">
                     <button
                        onClick={() => setRequiresConfirmation(!requiresConfirmation)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${requiresConfirmation ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-100 text-slate-300"}`}
                        title="Demander confirmation de lecture"
                     >
                        <i className={`fa-solid ${requiresConfirmation ? "fa-bell" : "fa-bell-slash"}`}></i>
                     </button>
                     <button
                        onClick={handleSaveAnnouncement}
                        disabled={saving || !editContent.trim()}
                        className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all disabled:opacity-50"
                     >
                        <i className="fa-solid fa-paper-plane"></i>
                     </button>
                </div>
              </div>
            </div>
        ) : (
          <div className="flex flex-col gap-4">
             <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-lg border border-indigo-100 shadow-sm shadow-indigo-100/50">
                  {announcement?.author_initials || "??"}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                         {user.role === UserRole.MANAGER ? "Message à l'équipe" : "Message du manager"}
                       </span>
                       <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                       <span className="text-xs font-bold text-slate-400 uppercase">
                         {announcement ? new Date(announcement.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}
                       </span>
                    </div>
                    <p className="text-xl font-black text-slate-900 leading-tight tracking-tight">"{announcement?.content}"</p>
                </div>
             </div>
             
             <div className="flex items-center justify-end gap-3">
                {user.role === UserRole.MANAGER && (
                    <button onClick={() => setIsEditing(true)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center">
                        <i className="fa-solid fa-pen text-xs"></i>
                    </button>
                )}
                
                {user.role === UserRole.TECHNICIAN && !isRead && announcement?.requires_confirmation && (
                    <button
                      onClick={handleMarkAsRead}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 shadow-md shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span className="hidden sm:inline">Lu et compris</span>
                      <i className="fa-solid fa-check"></i>
                    </button>
                )}
                {isRead && (
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 border border-emerald-100 flex items-center justify-center" title={`Lu le ${formatDate(new Date().toISOString())}`}>
                        <i className="fa-solid fa-check-double text-xs"></i>
                    </div>
                )}
             </div>
          </div>
        )}
      </section>
      </div>

      {/* XP Progress Bar - Only for Technicians */}
      {user.role === UserRole.TECHNICIAN && viewMode === "personal" && (
        <XPProgressBar 
          currentXP={personalStats.xp} 
          currentLevel={personalStats.level} 
        />
      )}

      {user.role === UserRole.TECHNICIAN && viewMode === "personal" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* ZONE 1: Missions & Activité */}
          <div className="lg:col-span-2">
             <MissionSpotlight />
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col h-full min-h-[320px]">
             <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-900 text-lg tracking-tight">Activité Équipe</h3>
                <button onClick={fetchActivities} className="text-slate-400 hover:text-indigo-600 transition-colors"><i className="fa-solid fa-rotate-right"></i></button>
             </div>
             <div className="space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                {activities.slice(0, 5).map((act) => (
                   <div key={act.id} className="flex gap-3 items-start p-2 hover:bg-slate-50 rounded-xl transition-colors group">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                      <div>
                          <p className="text-[11px] font-bold text-slate-700 leading-tight">{act.content}</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                       </div>
                   </div>
                ))}
             </div>
          </div>

          {/* ZONE 2: Expertise & Badges */}
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 hover:border-orange-100 transition-all">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg border border-orange-100">
                    <i className="fa-solid fa-trophy"></i>
                  </div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Mes Badges</h3>
                  <div className="relative group/xp-info">
                    <button className="w-5 h-5 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center text-[8px] hover:bg-orange-50 hover:text-orange-600 transition-all border border-slate-100">
                      <i className="fa-solid fa-question"></i>
                    </button>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-slate-900 text-white rounded-2xl p-4 opacity-0 invisible group-hover/xp-info:opacity-100 group-hover/xp-info:visible transition-all z-[60] shadow-2xl border border-white/10 pointer-events-none">
                      <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-3 text-center">Comment gagner de l'XP ?</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] pb-1 border-b border-white/5 opacity-50 font-black">
                          <span>ACTION</span>
                          <span>GAIN</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>Lecture procédure</span>
                          <span className="text-emerald-400">+5 XP</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>Lecture flash note</span>
                          <span className="text-emerald-400">+5 XP</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>Suggestion approuvée</span>
                          <span className="text-amber-400">+50 XP</span>
                        </div>
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-slate-900"></div>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                  {earnedBadges.length} Obtenus
                </span>
             </div>

             <div className="flex-1 space-y-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Collection active</p>
                  <div className="flex flex-wrap gap-3">
                    {earnedBadges.length > 0 ? (
                      earnedBadges.map((ub) => (
                        <div key={ub.id} className="group relative">
                          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center gap-1 hover:border-orange-200 hover:bg-white transition-all cursor-help transform hover:-translate-y-1">
                            <i className={`fa-solid ${ub.badges.icon} text-lg text-orange-600`}></i>
                            <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter truncate w-10 text-center">
                              {ub.badges.name}
                            </span>
                          </div>
                          {/* Improved Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-3 bg-slate-900 text-white rounded-xl text-[10px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                             <p className="font-black text-orange-400 uppercase tracking-widest mb-1">{ub.badges.name}</p>
                             <p className="text-slate-300 leading-relaxed">{ub.badges.description}</p>
                             <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-slate-900"></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="w-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Aucun badge débloqué</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Prochain Défi</p>
                   <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group/challenge hover:bg-white hover:border-amber-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center text-sm group-hover/challenge:bg-amber-50 group-hover/challenge:text-amber-500 transition-colors">
                          <i className="fa-solid fa-book-bookmark"></i>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-700 uppercase leading-none mb-1">Lecteur Assidu</p>
                          <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-amber-400 w-3/4 animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">75%</span>
                   </div>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col h-full hover:border-indigo-100 transition-all">
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
                    <i className="fa-solid fa-graduation-cap"></i>
                  </div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Maitrise Experte</h3>
                </div>
                <InfoTooltip text="Votre niveau de maîtrise par catégorie métier." />
             </div>
             
             <div className="flex-1">
                <MasteryProgress data={personalStats.mastery} />
             </div>

             <div className="mt-8 pt-6 border-t border-slate-50 grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">XP Restant</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-indigo-600">{(personalStats.level * 100) - personalStats.xp}</span>
                    <span className="text-[10px] font-bold text-slate-300 uppercase">Points</span>
                  </div>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cible Suivante</span>
                  <span className="text-xs font-black text-slate-700 uppercase">Rang {personalStats.level + 1}</span>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
                     <i className="fa-solid fa-compass"></i>
                   </div>
                   <h3 className="font-black text-slate-900 text-lg tracking-tight">Missions</h3>
                </div>
                <button onClick={() => onNavigate?.('missions')} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Voir tout</button>
             </div>
             <div className="space-y-3 flex-1">
                {activeMissions.slice(0, 3).map((mission) => (
                  <div key={mission.id} onClick={() => onNavigate?.('missions')} className="p-4 bg-slate-50 border border-transparent hover:border-indigo-100 hover:bg-white rounded-2xl transition-all cursor-pointer group/m">
                     <div className="flex justify-between items-start mb-2">
                        <span className={`text-[7px] font-black uppercase tracking-widest ${mission.urgency === 'critical' ? 'text-rose-500' : 'text-indigo-500'}`}>{mission.urgency}</span>
                        <span className="text-[9px] font-black text-indigo-600">{mission.xp_reward} XP</span>
                     </div>
                     <p className="text-[11px] font-bold text-slate-800 line-clamp-1 group-hover/m:text-indigo-600 transition-colors">{mission.title}</p>
                  </div>
                ))}
                {activeMissions.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center py-6 text-slate-300">
                      <i className="fa-solid fa-mug-hot text-2xl mb-2"></i>
                      <p className="text-[8px] font-black uppercase tracking-widest">Aucune mission</p>
                   </div>
                )}
             </div>
          </div>

          {/* ZONE 3: Expert Reviews (Only if referent) & Last Procedure */}
          {isReferent && pendingReviews.length > 0 && (
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm relative overflow-hidden group">
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl text-indigo-600">
                      <i className="fa-solid fa-microscope"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Revues d'Expert</h3>
                      <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-1">{pendingReviews.length} en attente</p>
                    </div>
                  </div>
                  <div className="flex gap-3 overflow-x-auto max-w-full pb-1 scrollbar-hide">
                    {pendingReviews.slice(0, 2).map((proc) => (
                      <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="shrink-0 w-48 bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all cursor-pointer group/card">
                         <h4 className="font-bold text-slate-800 text-[10px] mb-1 truncate group-hover/card:text-indigo-600 transition-colors">{proc.title}</h4>
                         <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{proc.category}</p>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}

          <div className={`${isReferent && pendingReviews.length > 0 ? '' : 'lg:col-span-3'} bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm`}>
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Dernière Procédure</h3>
               <button onClick={() => setShowHistoryModal(true)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest px-4 py-2 bg-indigo-50 rounded-lg">Historique</button>
             </div>
             {recentProcedures.slice(0, 1).map((proc) => (
                <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl cursor-pointer group transition-all">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white border border-slate-100 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <i className="fa-solid fa-file-pdf text-xl"></i>
                      </div>
                      <div>
                         <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors leading-tight mb-1">{proc.title}</h4>
                         <div className="flex gap-3">
                            <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase">{proc.category}</span>
                            <span className="text-[8px] text-indigo-400 font-black tracking-widest uppercase flex items-center gap-1">
                               <i className="fa-solid fa-clock text-[7px]"></i>
                               {formatDate(proc.createdAt)}
                            </span>
                         </div>
                      </div>
                   </div>
                   <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"></i>
                </div>
             ))}
          </div>
        </div>
      )}

          {/* Manager Team View */}
          {user.role === UserRole.MANAGER && viewMode === "team" && (
            <div className="space-y-6 animate-fade-in">
              
                {/* ZONE 1: KPIs Flash */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group relative">
                      <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center text-xl`}>
                        <i className={`fa-solid ${stat.icon}`}></i>
                      </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
                        <InfoTooltip text={stat.tooltipDesc || "Indicateur clé"} />
                      </div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ZONE 2: Centre de Révision, Missions & Activité */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 
                 {/* COL 1: Centre de Révision */}
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full min-h-[400px]">
                     <div className="flex items-center justify-between mb-6">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-lg">
                           <i className="fa-solid fa-list-check"></i>
                          </div>
                          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
                             Centre de Révision
                             <InfoTooltip text="Validez les suggestions et revendications de votre équipe." />
                          </h3>
                       </div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                         {pendingSuggestions.length} en attente
                       </span>
                     </div>

                     <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px] scrollbar-hide">
                        {/* Mastery Claims Prompt */}
                        {masteryClaims.length > 0 && (
                           <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex items-center justify-between animate-pulse cursor-pointer hover:bg-amber-100 transition-colors"
                                onClick={() => {
                                  // Navigate to Statistics or handle claim
                                }}
                           >
                              <div className="flex items-center gap-2">
                                 <i className="fa-solid fa-medal text-amber-500"></i>
                                 <span className="text-xs font-black text-amber-700 uppercase tracking-tight">{masteryClaims.length} Revendication(s)</span>
                              </div>
                              <i className="fa-solid fa-arrow-right text-amber-500 text-xs"></i>
                           </div>
                        )}

                        {pendingSuggestions.slice(0, 10).map((sugg) => (
                           <div key={sugg.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer" onClick={() => { setSelectedSuggestion(sugg); setShowSuggestionModal(true); }}>
                              <div className="flex items-center gap-3">
                                 <div className={`w-2 h-2 rounded-full shrink-0 ${sugg.priority === 'high' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                                 <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate">{sugg.procedureTitle}</p>
                                    <p className="text-[10px] font-bold text-slate-500 truncate">{sugg.userName} • {sugg.type}</p>
                                 </div>
                              </div>
                              <i className="fa-solid fa-chevron-right text-slate-300 text-[10px]"></i>
                           </div>
                        ))}
                        {pendingSuggestions.length === 0 && (
                           <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400 opacity-50">
                               <i className="fa-solid fa-clipboard-check text-4xl mb-3"></i>
                               <p className="text-xs font-bold uppercase tracking-widest">Tout est à jour</p>
                           </div>
                        )}
                     </div>
                 </div>

                 {/* COL 2: Missions d'Équipe & Team Podium */}
                 <div className="flex flex-col gap-6 h-full">
                     <TeamPodium />
                     
                     <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative flex-1 min-h-[300px]">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-map-location-dot"></i>
                               </div>
                               <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
                                  Missions d'Équipe
                                  <InfoTooltip text="Objectifs prioritaires identifiés par l'IA pour combler les manques." />
                               </h3>
                            </div>
                            <button 
                              onClick={() => onNavigate?.('missions')}
                              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-slate-900 transition-colors"
                            >
                              Tout voir
                            </button>
                          </div>

                          <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px] scrollbar-hide">
                             {loadingMissions ? (
                               <div className="flex flex-col items-center justify-center py-10 gap-3">
                                  <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Analyse en cours...</span>
                               </div>
                             ) : activeMissions.filter(m => m.status === 'open' || m.status === 'in_progress').length > 0 ? (
                               activeMissions
                                 .filter(m => m.status === 'open' || m.status === 'in_progress')
                                 .slice(0, 5)
                                 .map((mission) => (
                                 <div key={mission.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all group cursor-pointer" onClick={() => onNavigate?.('missions')}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                          mission.urgency === 'high' ? 'bg-rose-100 text-rose-600' : 
                                          mission.urgency === 'medium' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                          {mission.urgency === 'high' ? 'Urgent' : mission.urgency === 'medium' ? 'Important' : 'Normal'}
                                        </span>
                                        <span className="text-[8px] font-bold text-indigo-400 flex items-center gap-1">
                                          <i className="fa-solid fa-star text-[7px]"></i> {mission.xp_reward} XP
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-xs leading-tight mb-0.5 line-clamp-1 group-hover:text-indigo-600 transition-colors">{mission.title}</h4>
                                    <p className="text-[9px] text-slate-400 line-clamp-1">{mission.description}</p>
                                 </div>
                               ))
                             ) : (
                               <div className="flex flex-col items-center justify-center py-12 px-6 text-center opacity-50">
                                  <i className="fa-solid fa-flag-checkered text-3xl text-slate-300 mb-2"></i>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aucune mission en cours</p>
                               </div>
                             )}
                          </div>
                     </div>
                 </div>

                 {/* COL 3: Activité Récente */}
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative h-full min-h-[400px]">
                    <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-3">
                        <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
                           Activité Récente
                           <InfoTooltip text="Surveillez les dernières actions de l'équipe en temps réel." />
                        </h3>
                       </div>
                        <button onClick={fetchActivities} className="text-slate-400 hover:text-indigo-600 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 rounded-lg outline-none"><i className="fa-solid fa-rotate-right"></i></button>
                    </div>
                    <div className="space-y-4 overflow-y-auto flex-1 scrollbar-hide">
                       {activities.slice(0, 10).map((act) => (
                          <div key={act.id} className="flex gap-3 items-start p-3 hover:bg-slate-50 rounded-xl transition-colors group">
                             <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0 group-hover:scale-125 transition-transform"></div>
                             <div>
                                 <p className="text-xs font-bold text-slate-700 leading-tight">{act.content}</p>
                                 <p className="text-[10px] font-bold text-slate-400 mt-1 group-hover:text-indigo-400 transition-colors">{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                          </div>
                       ))}
                       {activities.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-400 opacity-50">
                             <i className="fa-solid fa-ghost text-4xl mb-3"></i>
                             <p className="text-xs font-bold uppercase tracking-widest">Le calme plat...</p>
                          </div>
                       )}
                    </div>
                 </div>

              
                 {/* COL 4: Dernière Procédure (Full Width) */}
                 <div className="lg:col-span-3 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Dernière Procédure en Ligne</h3>
                      <button onClick={() => setShowHistoryModal(true)} className="text-[9px] font-black text-indigo-600 uppercase tracking-widest px-4 py-2 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                        Historique
                      </button>
                    </div>
                    {recentProcedures.slice(0, 1).map((proc) => (
                       <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl cursor-pointer group transition-all border border-transparent hover:border-indigo-100">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                               <i className="fa-solid fa-file-pdf text-xl"></i>
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors leading-tight mb-1">{proc.title}</h4>
                                <div className="flex gap-3">
                                   <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase">{proc.category}</span>
                                   <span className="text-[8px] text-indigo-400 font-black tracking-widest uppercase flex items-center gap-1">
                                      <i className="fa-solid fa-clock text-[7px]"></i>
                                      {formatDate(proc.createdAt)}
                                   </span>
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex -space-x-2">
                                  {[...Array(3)].map((_, i) => (
                                    <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-white"></div>
                                  ))}
                                </div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">3 vus</span>
                              </div>
                              <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"></i>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

            </div>
          )}






      {/* MODAL REVIEW SUGGESTION */}
      {showSuggestionModal && selectedSuggestion && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                <i className="fa-solid fa-clipboard-check"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg">
                  {selectedSuggestion.status === 'pending' ? 'Examiner la suggestion' : 'Consulter la suggestion'}
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {selectedSuggestion.procedureTitle}
                </p>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Type
                </span>
                <span className={`text-xs font-black uppercase tracking-widest ${
                  selectedSuggestion.type === 'correction' ? 'text-rose-500' :
                  selectedSuggestion.type === 'update' ? 'text-amber-500' :
                  'text-emerald-500'
                }`}>
                  {selectedSuggestion.type === 'correction' ? 'Correction' :
                   selectedSuggestion.type === 'update' ? 'Mise à jour' : 'Ajout'}
                </span>
              </div>
              <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Priorité
                </span>
                <span className={`text-xs font-black uppercase tracking-widest ${
                  selectedSuggestion.priority === 'high' ? 'text-rose-500' :
                  selectedSuggestion.priority === 'medium' ? 'text-amber-500' :
                  'text-slate-500'
                }`}>
                  {selectedSuggestion.priority === 'high' ? 'Haute' :
                   selectedSuggestion.priority === 'medium' ? 'Moyenne' : 'Basse'}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Suggestion de {selectedSuggestion.userName}
              </span>
              <div className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-600 text-sm max-h-60 overflow-y-auto">
                {selectedSuggestion.content}
              </div>
            </div>

            <div className="mb-6">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                {selectedSuggestion.status === 'pending' ? 'Votre réponse au technicien' : 'Réponse du manager'}
              </span>
              {selectedSuggestion.status === 'pending' ? (
                <textarea
                  value={managerResponse}
                  onChange={(e) => setManagerResponse(e.target.value)}
                  placeholder="Expliquez pourquoi vous validez ou refusez cette suggestion..."
                  className="w-full h-32 p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 resize-none text-sm"
                />
              ) : (
                <div className={`w-full p-5 rounded-2xl border font-medium text-slate-700 text-sm ${
                  selectedSuggestion.status === 'approved' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'
                }`}>
                  {selectedSuggestion.managerResponse || "Aucune réponse fournie."}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 justify-end pt-4 border-t border-slate-50">
              <button
                onClick={() => setShowSuggestionModal(false)}
                className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                  selectedSuggestion.status === 'pending' 
                    ? 'text-slate-400 hover:bg-slate-50 shadow-none' 
                    : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-indigo-500/10'
                }`}>
                {selectedSuggestion.status === 'pending' ? 'Fermer' : 'Compris, Fermer'}
              </button>
              {selectedSuggestion.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus('rejected')}
                    className="px-6 py-3 rounded-xl bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all">
                    Rejeter
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('approved')}
                    className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                    <i className="fa-solid fa-check"></i>
                    Valider
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* MODAL COMPLETION MISSION */}
      {completingMission && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl animate-scale-up border border-slate-100">
            <div className="flex items-center gap-5 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shadow-inner">
                <i className="fa-solid fa-trophy"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight">Mission Terminée</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bilan d'expertise requis</p>
              </div>
            </div>

            <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm mb-1">{completingMission.title}</h4>
              <p className="text-xs text-slate-500 font-medium line-clamp-2">{completingMission.description}</p>
            </div>

            <div className="mb-8">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">
                Notes de clôture
              </label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Décrivez brièvement ce qui a été accompli..."
                autoFocus
                className="w-full h-32 p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium text-slate-700 text-sm resize-none shadow-inner"
              />
              <p className="text-[9px] text-slate-400 font-bold mt-2 italic px-1">
                Ces notes permettront au manager de valider officiellement votre contribution.
              </p>
            </div>

            <div className="flex items-center gap-3 justify-end pt-6 border-t border-slate-50">
              <button
                onClick={() => {
                  setCompletingMission(null);
                  setCompletionNotes("");
                }}
                disabled={isSubmittingCompletion}
                className="px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCompleteMission}
                disabled={isSubmittingCompletion || !completionNotes.trim()}
                className="px-10 py-4 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50 disabled:bg-slate-200 flex items-center gap-2"
              >
                {isSubmittingCompletion ? (
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-check"></i>
                )}
                Terminer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL HISTORY RECENT PROCEDURES */}
      {showHistoryModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowHistoryModal(false)}>
          <div
            className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl animate-scale-up border border-slate-100"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">Dernières Activités</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Historique des 5 publications récentes</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {recentProcedures.map((proc) => (
                <div 
                  key={proc.id}
                  onClick={() => {
                    onSelectProcedure(proc);
                    setShowHistoryModal(false);
                  }}
                  className="flex items-center justify-between p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-indigo-100 hover:bg-white hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-300 group-hover:text-indigo-600 border border-slate-100 transition-colors">
                      <i className="fa-solid fa-file-pdf text-xl"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{proc.title}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{proc.category} • {formatDate(proc.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                       <p className="text-xs font-black text-slate-800">{proc.views}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase">Vues</p>
                    </div>
                    <i className="fa-solid fa-chevron-right text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"></i>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-8 py-3 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* GAMIFICATION CELEBRATIONS */}
      {showLevelUpModal && levelUpData && createPortal(
        <LevelUpModal 
          level={levelUpData.level} 
          title={levelUpData.title} 
          onClose={() => setShowLevelUpModal(false)} 
        />,
        document.body
      )}

      {showBadgeUnlockedModal && unlockedBadgeData && createPortal(
        <BadgeUnlockedModal 
          badge={unlockedBadgeData} 
          onClose={() => setShowBadgeUnlockedModal(false)} 
        />,
        document.body
      )}

    </div>
  );
};

export default Dashboard;
