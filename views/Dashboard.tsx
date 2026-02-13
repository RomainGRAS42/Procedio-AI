import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { User, Procedure, Suggestion, UserRole, Mission } from "../types";
import CustomToast from "../components/CustomToast";
import TeamPodium from '../components/TeamPodium';
import XPProgressBar from '../components/XPProgressBar';
import LevelUpModal from '../components/LevelUpModal';
import BadgeUnlockedModal from '../components/BadgeUnlockedModal';
import { calculateLevelFromXP, getLevelTitle } from '../lib/xpSystem';
import InfoTooltip from "../components/InfoTooltip";
import { supabase } from "../lib/supabase";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import LoadingState from '../components/LoadingState';
import { cacheStore } from "../lib/CacheStore";

// Widgets
import StatsSummaryWidget from '../components/dashboard/StatsSummaryWidget';
import TeamSynergyWidget from '../components/dashboard/TeamSynergyWidget';
import ActiveMissionWidget from '../components/dashboard/ActiveMissionWidget';
import MissionsWidget from '../components/dashboard/MissionsWidget';
import BadgesWidget from '../components/dashboard/BadgesWidget';
import MasteryWidget from '../components/dashboard/MasteryWidget';
import RecentProceduresWidget from '../components/dashboard/RecentProceduresWidget';
import AnnouncementWidget from '../components/dashboard/AnnouncementWidget';
import ActivityWidget from '../components/dashboard/ActivityWidget';
import ReviewCenterWidget from '../components/dashboard/ReviewCenterWidget';
import ExpertReviewWidget from '../components/dashboard/ExpertReviewWidget';
import RSSWidget from "../components/RSSWidget";
import MasteryQuizModal from "../components/MasteryQuizModal";

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewComplianceHistory: () => void;
  targetAction?: { type: 'suggestion' | 'read' | 'mastery', id: string } | null;
  onActionHandled?: () => void;
  onUploadClick: () => void;
  onNavigate?: (view: string) => void;
  onFlashCountChange?: (count: number) => void;
  onMasteryCountChange?: (count: number) => void;
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
  onFlashCountChange,
  onMasteryCountChange,
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
  const [pendingFlashNotesCount, setPendingFlashNotesCount] = useState(0);

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

  // Approved Exams (Technician Only)
  const [approvedExams, setApprovedExams] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [activeQuizRequest, setActiveQuizRequest] = useState<any | null>(null);
  const [showDashboardQuiz, setShowDashboardQuiz] = useState(false);

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

  const prevLevelRef = React.useRef<number>(0);
  const prevBadgeCountRef = React.useRef<number>(0);

  // Initialize refs and localStorage on mount/user change
  useEffect(() => {
    if (user?.id) {
      const storedLevel = localStorage.getItem(`procedio_seen_level_${user.id}`);
      const storedBadges = localStorage.getItem(`procedio_seen_badges_${user.id}`);
      
      if (storedLevel) prevLevelRef.current = parseInt(storedLevel);
      else prevLevelRef.current = personalStats.level;

      if (storedBadges) prevBadgeCountRef.current = parseInt(storedBadges);
      else prevBadgeCountRef.current = earnedBadges.length;
    }
  }, [user?.id]);

  const getLevelTitle = (level: number) => {
    switch(level) {
      case 1: return "Vagabond";
      case 2: return "Explorateur";
      case 3: return "Initié";
      case 4: return "Adepte";
      case 5: return "Praticien";
      case 6: return "Expert"; // LE MUR
      case 7: return "Virtuose";
      case 8: return "Maître";
      case 9: return "Grand Maître";
      case 10: return "Légende Vivante";
      default: return level > 10 ? "Dieu de la Machine" : "Vagabond";
    }
  };

  // Detection Level Up & Badges
  useEffect(() => {
    if (user.role !== UserRole.TECHNICIAN || !user.id) return;

    // 1. Check Level Up
    // Use CALCULATED level from XP to be the source of truth
    const calculatedLevel = calculateLevelFromXP(personalStats.xp);
    
    // Only trigger if we have a valid previous level (not 0) and it increased
    if (calculatedLevel > prevLevelRef.current && prevLevelRef.current !== 0) {
      console.log(`🎉 Level Up Detected! ${prevLevelRef.current} -> ${calculatedLevel}`);
      setLevelUpData({ 
        level: calculatedLevel, 
        title: getLevelTitle(calculatedLevel) 
      });
      setShowLevelUpModal(true);
      // Update local storage and DB if needed (sync)
      localStorage.setItem(`procedio_seen_level_${user.id}`, calculatedLevel.toString());
    } else if (prevLevelRef.current === 0 && calculatedLevel > 0) {
      // First sync EVER or after clear cache
      // SILENT SYNC into ref and storage to prevent popup on reload
      console.log(`Silent Level Sync: ${calculatedLevel}`);
      localStorage.setItem(`procedio_seen_level_${user.id}`, calculatedLevel.toString());
    }
    
    // Always update ref to current status
    prevLevelRef.current = calculatedLevel;

    // 2. Check Badge Unlocked
    // Sort badges by date to ensure the "last" one is truly the newest
    const sortedBadges = [...earnedBadges].sort((a, b) => 
      new Date(a.awarded_at).getTime() - new Date(b.awarded_at).getTime()
    );

    console.log("DEBUG BADGES:", {
      current: sortedBadges.length,
      prev: prevBadgeCountRef.current,
      diff: sortedBadges.length - prevBadgeCountRef.current
    });

    if (sortedBadges.length > prevBadgeCountRef.current && prevBadgeCountRef.current !== 0) {
      console.log("🏆 Badge Unlock Triggered!", {
        newCount: sortedBadges.length,
        oldCount: prevBadgeCountRef.current
      });
      const newBadge = sortedBadges[sortedBadges.length - 1]?.badges;
      if (newBadge) {
        setUnlockedBadgeData(newBadge);
        setShowBadgeUnlockedModal(true);
        localStorage.setItem(`procedio_seen_badges_${user.id}`, sortedBadges.length.toString());
      }
    } else if (prevBadgeCountRef.current === 0 && sortedBadges.length > 0) {
      // First sync
      console.log("🔄 First Sync Badges (No Modal)");
      localStorage.setItem(`procedio_seen_badges_${user.id}`, sortedBadges.length.toString());
    }
    prevBadgeCountRef.current = sortedBadges.length;
  }, [personalStats.level, earnedBadges, user.id]);
  
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
    },
    {
      label: "Zone Rouge",
      value: `${managerKPIs.redZone}`,
      icon: "fa-triangle-exclamation",
      color: "text-rose-600",
      bg: "bg-rose-50",
      desc: "Sans référent",
      tooltipTitle: "Risque de Perte",
      tooltipDesc: "Nombre de procédures n'ayant aucun référent assigné (risque de non-mise à jour)."
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
        fetchPendingFlashNotes();
      } else {
        fetchApprovedExams();
      }
      
      // Always check for referent workload (anyone can be a referent)
      fetchReferentWorkload();

    }
  }, [user?.id, user?.role]);

  // Support for deep linking to suggestions or mastery exams
  useEffect(() => {
    if (targetAction && (pendingSuggestions.length > 0 || approvedExams.length > 0)) {
      if (targetAction.type === 'suggestion') {
        const sugg = pendingSuggestions.find(s => s.id === targetAction.id);
        if (sugg) {
          setSelectedSuggestion(sugg);
          setShowSuggestionModal(true);
          onActionHandled?.();
        }
      } else if (targetAction.type === 'mastery') {
        const exam = approvedExams.find(e => e.id === targetAction.id);
        if (exam) {
          setActiveQuizRequest(exam);
          setShowDashboardQuiz(true);
          onActionHandled?.();
        }
      }
    }
  }, [targetAction, pendingSuggestions, approvedExams]);




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
        level: calculateLevelFromXP(profile?.xp_points || 0), // Calculate level from XP
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
      // 1. Fetch from mastery_requests table (New System)
      const { data, error } = await supabase
        .from('mastery_requests')
        .select(`
          *,
          user_profiles:user_id (first_name, last_name, avatar_url),
          procedures:procedure_id (title, uuid)
        `)
        .or('status.eq.pending,status.eq.approved') // Fetch both pending and approved
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        // Filter approved ones to only show those from the last 30 seconds (for feedback)
        // or just keep them all for the current session view until manual refresh/navigation
        const now = new Date();
        const filteredData = data.filter(c => 
          c.status === 'pending' || 
          (c.status === 'approved' && (now.getTime() - new Date(c.updated_at || c.created_at).getTime()) < 30000)
        );
        setMasteryClaims(filteredData);
        onMasteryCountChange?.(filteredData.filter(c => c.status === 'pending').length);
      }
    } catch (err) {
      console.error("Error fetching mastery claims:", err);
    } finally {
      setLoadingClaims(false);
    }
  };

  const fetchApprovedExams = async () => {
    if (user.role !== UserRole.TECHNICIAN) return;
    setLoadingExams(true);
    try {
      const { data, error } = await supabase
        .from('mastery_requests')
        .select(`
          *,
          procedures:procedure_id (title, uuid, file_url, Type, views, status)
        `)
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setApprovedExams(data);
    } catch (err) {
      console.error("Error fetching approved exams:", err);
    } finally {
      setLoadingExams(false);
    }
  };

  // State for AI Exam Generation
  const [generatingExamId, setGeneratingExamId] = useState<string | null>(null);

  const handleApproveMastery = async (requestId: string) => {
    try {
      const request = masteryClaims.find(c => c.id === requestId);
      if (!request) return;

      const procedureId = Array.isArray(request.procedures) ? request.procedures[0]?.uuid : request.procedures?.uuid;
      if (!procedureId) throw new Error("ID de procédure introuvable.");

      // 1. Instant UI Feedback (Optimistic)
      setGeneratingExamId(requestId);
      setToast({ message: "Lancement de la génération IA en arrière-plan...", type: "info" });

      // 2. Pre-approve in DB immediately to free up the Manager
      const { error: preUpdateError } = await supabase
        .from('mastery_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (preUpdateError) throw preUpdateError;

      // 3. UI Success - Manager is done
      setToast({ message: "Demande approuvée ! L'examen sera prêt dans quelques instants.", type: "success" });
      setGeneratingExamId(null);
      fetchMasteryClaims(); // Refresh local list

      // 4. Fire and Forget Edge Function (Background)
      supabase.functions.invoke('generate-mastery-quiz', {
        body: { 
          procedure_id: procedureId, 
          request_id: requestId,
          manager_name: user.firstName
        }
      }).then(({ error }) => {
        if (error) console.error("❌ Background AI Generation Error:", error);
        else console.log("✅ Background AI Generation Finished.");
      });

    } catch (err: any) {
      console.error("Error approving mastery:", err);
      setGeneratingExamId(null);
      setToast({ message: err.message || "Erreur lors de l'approbation.", type: "error" });
    }
  };




  const fetchPendingFlashNotes = async () => {
    if (user.role !== UserRole.MANAGER) return;
    try {
      const { count } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('is_flash_note', true)
        .eq('status', 'suggestion');
      setPendingFlashNotesCount(count || 0);
      onFlashCountChange?.(count || 0);
    } catch (err) {
      console.error("Error fetching pending flash notes count:", err);
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


  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .or("title.ilike.LOG_READ_%,title.ilike.CONSULTATION%")
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
    if (!user.id) return;

    // Manager listens to ALL missions, Tech listens only to theirs/open ones
    const filter = user.role === UserRole.MANAGER 
      ? undefined 
      : `assigned_to=eq.${user.id}`;

    const missionChannel = supabase
      .channel('mission_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'missions',
          filter: filter
        },
        (payload) => {
          console.log("Realtime Mission Update:", payload);
          const newMission = payload.new as Mission;
          
          setActiveMissions((prev) => {
            if (newMission.status === 'completed' && user.role !== UserRole.MANAGER) {
              return prev.filter(m => m.id !== newMission.id);
            }
            const exists = prev.find(m => m.id === newMission.id);
            if (exists) {
              return prev.map((m) => m.id === newMission.id ? { ...m, status: newMission.status } : m);
            }
            return prev;
          });
          
          const currentCache = cacheStore.get('dash_active_missions') || [];
          const updatedCache = currentCache.map((m: Mission) => m.id === newMission.id ? { ...m, status: newMission.status } : m);
          cacheStore.set('dash_active_missions', updatedCache);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(missionChannel);
    };
  }, [user.id, user.role]);

  // Real-time Mastery Request Sync (Technician & Manager)
  useEffect(() => {
    if (!user.id) return;

    const masteryChannel = supabase
      .channel('mastery_updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all changes (UPDATE status/quiz_data)
          schema: 'public',
          table: 'mastery_requests',
        },
        (payload) => {
          console.log("Realtime Mastery Update:", payload);
          if (user.role === UserRole.MANAGER) {
            fetchMasteryClaims();
            fetchActivities(); 
          } else {
            const newRequest = payload.new as any;
            if (newRequest.user_id === user.id && newRequest.status === 'approved' && newRequest.quiz_data) {
              fetchApprovedExams();
              setToast({ message: "Ton examen de maîtrise est prêt !", type: "info" });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(masteryChannel);
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
    <div className="space-y-10 pb-10 pt-8 px-4 md:px-10 animate-fade-in relative z-10 w-full overflow-x-hidden">
      {/* RAPPEL MANAGER: SUGGESTIONS FLASH NOTES */}
      {user.role === UserRole.MANAGER && pendingFlashNotesCount > 0 && (
        <div className="animate-slide-up">
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-[2rem] p-6 text-white shadow-xl shadow-amber-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shrink-0">
                <i className="fa-solid fa-lightbulb"></i>
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight leading-none italic">
                  Hey, {user.firstName} !
                </h3>
                <p className="text-white/80 text-sm mt-1 font-bold">
                  Tu as <span className="text-white font-black underline decoration-2 underline-offset-4">{pendingFlashNotesCount} proposition(s)</span> de Flash Notes en attente de validation.
                </p>
              </div>
            </div>
            <button 
              onClick={() => onNavigate?.('flash-notes')}
              className="px-8 py-4 bg-white text-amber-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-slate-50 transition-all active:scale-95 shrink-0"
            >
              Consulter maintenant
            </button>
          </div>
        </div>
      )}
      {/* RAPPEL TECHNICIEN: EXAMEN DE MAITRISE PRÊT */}
      {user.role === UserRole.TECHNICIAN && approvedExams.length > 0 && (
        <div className="animate-slide-up">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl shrink-0">
                <i className="fa-solid fa-graduation-cap"></i>
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight leading-none italic">
                  Examen Prêt !
                </h3>
                <p className="text-white/80 text-sm mt-1 font-bold">
                  Le manager a validé ta demande pour <span className="text-white font-black underline decoration-2 underline-offset-4">{approvedExams[0]?.procedures?.title}</span>. L'examen est prêt.
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setActiveQuizRequest(approvedExams[0]);
                setShowDashboardQuiz(true);
              }}
              className="px-8 py-4 bg-white text-indigo-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-slate-50 transition-all active:scale-95 shrink-0 flex items-center gap-2"
            >
              <i className="fa-solid fa-play text-[10px]"></i>
              Lancer l'Examen
            </button>
          </div>
        </div>
      )}


      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
      <section className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-xl shadow-indigo-500/5 flex flex-col md:flex-row justify-between items-center gap-6">
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
      <div className="">
           <AnnouncementWidget 
             user={user}
             announcement={announcement}
             loadingAnnouncement={loadingAnnouncement}
             isEditing={isEditing}
             editContent={editContent}
             saving={saving}
             requiresConfirmation={requiresConfirmation}
             isRead={isRead}
             setIsEditing={setIsEditing}
             setEditContent={setEditContent}
             setRequiresConfirmation={setRequiresConfirmation}
             handleSaveAnnouncement={handleSaveAnnouncement}
             handleMarkAsRead={handleMarkAsRead}
             formatDate={formatDate}
           />
      </div>
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
          
          {/* ZONE 1: Missions & Centre d'Action */}
          <div className="lg:col-span-2">
             <ActiveMissionWidget 
               user={user}
               activeMissions={activeMissions}
               onNavigate={onNavigate}
               onStartMission={handleStartMission}
               onCompleteMission={setCompletingMission}
             />
          </div>

          <MissionsWidget 
            activeMissions={activeMissions}
            userRole={user.role}
            viewMode={viewMode}
            onNavigate={onNavigate}
            loading={loadingMissions}
          />

          {/* ZONE 2: Expertise & Badges */}
          <div className="lg:col-span-1">
             <BadgesWidget 
               earnedBadges={earnedBadges}
             />
          </div>

          <div className="lg:col-span-2">
             <MasteryWidget personalStats={personalStats} />
          </div>

          {/* ZONE 3: Expert Reviews (Only if referent) & Last Procedure & RSS */}
          {isReferent && pendingReviews.length > 0 && (
            <div className="lg:col-span-2">
               <ExpertReviewWidget 
                 pendingReviews={pendingReviews} 
                 onSelectProcedure={onSelectProcedure} 
               />
            </div>
          )}

          <div className={`${isReferent && pendingReviews.length > 0 ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
            <RSSWidget user={user} />
          </div>

          <div className={`${isReferent && pendingReviews.length > 0 ? '' : 'lg:col-span-3'}`}>
            <RecentProceduresWidget
              recentProcedures={recentProcedures}
              userRole={user.role}
              viewMode={viewMode}
              onSelectProcedure={onSelectProcedure}
              onShowHistory={() => setShowHistoryModal(true)}
              formatDate={formatDate}
            />
          </div>
        </div>
      )}

          {/* Manager Team View */}
          {user.role === UserRole.MANAGER && viewMode === "team" && (
            <div className="space-y-6 animate-fade-in">
              
                {/* ZONE 1: Synergie d'Équipe (Maintenant au dessus des KPIs) */}
                <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                   <TeamSynergyWidget />
                </div>

                {/* ZONE 2: KPIs Flash */}
                <div className="">
                   <StatsSummaryWidget stats={stats} />
                </div>

              {/* ZONE 2: Centre de Révision, Missions & Activité */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 
                 {/* COL 1: Centre de Révision */}
                 <div className="h-full">
                    <ReviewCenterWidget 
                      pendingSuggestions={pendingSuggestions}
                      masteryClaims={masteryClaims}
                      onSelectSuggestion={(s) => { setSelectedSuggestion(s); setShowSuggestionModal(true); }}
                      onApproveMastery={handleApproveMastery}
                    />
                 </div>

                 {/* COL 2: Missions d'Équipe & Team Podium */}
                 <div className="flex flex-col gap-6 h-full">
                     <TeamPodium />
                     <MissionsWidget 
                       activeMissions={activeMissions}
                       userRole={user.role}
                       viewMode={viewMode}
                       onNavigate={onNavigate}
                       loading={loadingMissions}
                     />
                 </div>

                 {/* COL 3: Activité Récente */}
                 <div className="h-full">
                    <ActivityWidget 
                      activities={activities}
                      loadingActivities={loadingActivities}
                      onRefresh={fetchActivities}
                    />
                 </div>

                  {/* COL 4: Veille RSS */}
                  <div className="lg:col-span-3">
                    <RSSWidget user={user} />
                  </div>

                  {/* COL 5: Dernière Procédure (Full Width) */}
                  <div className="lg:col-span-3">
                    <RecentProceduresWidget
                      recentProcedures={recentProcedures}
                      userRole={user.role}
                      viewMode={viewMode}
                      onSelectProcedure={onSelectProcedure}
                      onShowHistory={() => setShowHistoryModal(true)}
                      formatDate={formatDate}
                    />
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

      {/* Modal Quiz de Maîtrise */}
      {showDashboardQuiz && activeQuizRequest && (
        <MasteryQuizModal
          isOpen={showDashboardQuiz}
          onClose={() => {
            setShowDashboardQuiz(false);
            setActiveQuizRequest(null);
            fetchApprovedExams();
            fetchPersonalStats();
          }}
          procedure={{
            ...activeQuizRequest.procedures,
            id: activeQuizRequest.procedure_id,
            db_id: activeQuizRequest.procedure_id
          }}
          user={user}
          quizData={activeQuizRequest.quiz_data}
          masteryRequestId={activeQuizRequest.id}
          onSuccess={() => {
            // Notification or celebration if needed
            fetchApprovedExams();
            fetchPersonalStats();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
