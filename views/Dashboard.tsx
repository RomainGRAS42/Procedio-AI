import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { User, Procedure, Suggestion, UserRole, Mission } from "../types";
import CustomToast from "../components/CustomToast";
import TeamPodium from "../components/TeamPodium";
import XPProgressBar from "../components/XPProgressBar";
import LevelUpModal from "../components/LevelUpModal";
import BadgeUnlockedModal from "../components/BadgeUnlockedModal";
import { calculateLevelFromXP, getLevelTitle } from "../lib/xpSystem";
import InfoTooltip from "../components/InfoTooltip";
import { supabase } from "../lib/supabase";
import { useNotifications } from "../hooks/useNotifications";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";
import LoadingState from "../components/LoadingState";
import { cacheStore } from "../lib/CacheStore";

// Widgets
import StatsSummaryWidget from "../components/dashboard/StatsSummaryWidget";
import TeamSynergyWidget from "../components/dashboard/TeamSynergyWidget";
import ActiveMissionWidget from "../components/dashboard/ActiveMissionWidget";
import MissionsWidget from "../components/dashboard/MissionsWidget";
import BadgesWidget from "../components/dashboard/BadgesWidget";
import MasteryWidget from "../components/dashboard/MasteryWidget";
import AnnouncementWidget from "../components/dashboard/AnnouncementWidget";
import ActivityWidget from "../components/dashboard/ActivityWidget";
import ReviewCenterWidget from "../components/dashboard/ReviewCenterWidget";
import PilotCenterTechWidget from "../components/dashboard/PilotCenterTechWidget";
import RecentHistoryWidget from "../components/dashboard/RecentHistoryWidget";
import RSSWidget from "../components/RSSWidget";
import MasteryQuizModal from "../components/MasteryQuizModal";
import MasteryResultDetailModal from "../components/MasteryResultDetailModal";
import KPIDetailsModal from "../components/KPIDetailsModal";

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewComplianceHistory: () => void;
  targetAction?: { type: "suggestion" | "read" | "mastery" | "mastery_result"; id: string } | null;
  onActionHandled?: () => void;
  onUploadClick: () => void;
  onNavigate?: (view: string) => void;
  onFlashCountChange?: (count: number) => void;
  onAlertCountChange?: (count: number) => void;
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
  onAlertCountChange,
}) => {
  console.log("DEBUG: Dashboard User Object:", { id: user?.id, role: user?.role });
  const { systemNotifications, markAsRead } = useNotifications(user);
  const location = useLocation();
  const [isRead, setIsRead] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(
    cacheStore.get("dash_announcement") || null
  );
  // Simuler un chargement initial pour l'effet "skeleton" si pas de cache
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [managerResponse, setManagerResponse] = useState("");

  // Suggestions (Manager Only)
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>(
    cacheStore.get("dash_suggestions") || []
  );
  const [loadingSuggestions, setLoadingSuggestions] = useState(
    !cacheStore.has("dash_suggestions") && user.role === UserRole.MANAGER
  );
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [pendingFlashNotesCount, setPendingFlashNotesCount] = useState(0);

  // Activities
  const [activities, setActivities] = useState<any[]>(cacheStore.get("dash_activities") || []);
  const [loadingActivities, setLoadingActivities] = useState(!cacheStore.has("dash_activities"));

  // Missions
  const [activeMissions, setActiveMissions] = useState<Mission[]>(
    cacheStore.get("dash_active_missions") || []
  );
  const [loadingMissions, setLoadingMissions] = useState(!cacheStore.has("dash_active_missions"));

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Mission Lifecycle State
  const [completingMission, setCompletingMission] = useState<Mission | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Mastery Claims (Manager Only)
  const [masteryClaims, setMasteryClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  // Approved Exams (Technician Only)
  const [approvedExams, setApprovedExams] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [activeQuizRequest, setActiveQuizRequest] = useState<any | null>(null);
  const [showDashboardQuiz, setShowDashboardQuiz] = useState(false);
  const [selectedMasteryClaim, setSelectedMasteryClaim] = useState<any | null>(null);
  const [showMasteryDetail, setShowMasteryDetail] = useState(false);

  // Badges (Personal View)
  const [earnedBadges, setEarnedBadges] = useState<any[]>(
    cacheStore.get("dash_earned_badges") || []
  );
  const [loadingBadges, setLoadingBadges] = useState(!cacheStore.has("dash_earned_badges"));

  // KPI Details Modal
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    type: "urgent" | "redZone";
    items: any[];
  } | null>(null);

  // Celebration Queue System (Daisy Chaining)
  interface CelebrationItem {
    type: "level" | "badge";
    data: any;
  }
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationItem[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<CelebrationItem | null>(null);

  // ViewMode removed

  // Stats personnelles
  const [personalStats, setPersonalStats] = useState(
    cacheStore.get("dash_personal_stats") || null
  );
  const [loadingPersonalStats, setLoadingPersonalStats] = useState(true);

  // Sprint Hebdo (XP gagnée cette semaine)
  const [weeklyXP, setWeeklyXP] = useState(cacheStore.get("dash_weekly_xp") || 0);

  // Trend du moment
  const [trendProcedure, setTrendProcedure] = useState<Procedure | null>(null);

  // Stats dynamiques (Manager)
  const [managerKPIs, setManagerKPIs] = useState(
    cacheStore.get("dash_manager_kpis") || {
      redZone: 0,
      searchSuccess: 100,
      health: 0,
      usage: 0,
    }
  );

  const [hasInitialFetchCompleted, setHasInitialFetchCompleted] = useState(false);

  const prevLevelRef = React.useRef<number>(0);
  const prevBadgeCountRef = React.useRef<number>(0);

  // Initialize refs on mount
  useEffect(() => {
    if (user?.id && personalStats?.level > 0) {
      if (prevLevelRef.current === 0) prevLevelRef.current = personalStats.level;
      if (prevBadgeCountRef.current === 0) prevBadgeCountRef.current = earnedBadges.length;
    }
  }, [user?.id, personalStats?.level, earnedBadges.length]);

  // Detection Level Up & Badges
  useEffect(() => {
    if (user.role !== UserRole.TECHNICIAN || !user.id || !hasInitialFetchCompleted || loadingBadges || !personalStats)
      return;

    const newQueue: CelebrationItem[] = [];

    // Initial Session Check (Only once per session)
    const hasSeenIntro = sessionStorage.getItem(`procedio_session_intro_${user.id}`);

    if (!hasSeenIntro) {
      // 1. Show Level if > 1
      const currentLevel = calculateLevelFromXP(personalStats.xp || 0);
      if (currentLevel > 1) {
        newQueue.push({
          type: "level",
          data: { level: currentLevel, title: getLevelTitle(currentLevel) },
        });
      }

      // 3. Self-Healing Badges (Lectures, Suggestions, Missions) WITH RETRY & SAFETY CHECKS
      const checkAndRepairBadges = async () => {
        if (!personalStats || typeof personalStats.consultations === 'undefined') {
           console.warn("⚠️ Self-Healing reporté : stats non chargées", personalStats);
           return;
        }

        const totalLectures = personalStats.consultations || 0;
        const totalSuggestions = personalStats.suggestions || 0;
        const totalMissions = personalStats.missions || 0;
        const missingBadges = [];

        console.log(`🔍 Vérification Badges : ${totalLectures} lectures, ${totalSuggestions} suggestions, ${totalMissions} missions.`);

        // --- LECTURE ---
        if (totalLectures >= 10 && !earnedBadges.some(b => b.badges.name === 'Lecteur Assidu')) missingBadges.push('Lecteur Assidu');
        if (totalLectures >= 50 && !earnedBadges.some(b => b.badges.name === 'Lecteur Confirmé')) missingBadges.push('Lecteur Confirmé');
        if (totalLectures >= 100 && !earnedBadges.some(b => b.badges.name === 'Expert Visionnaire')) missingBadges.push('Expert Visionnaire');
        if (totalLectures >= 250 && !earnedBadges.some(b => b.badges.name === 'Rat de Bibliothèque')) missingBadges.push('Rat de Bibliothèque');
        if (totalLectures >= 500 && !earnedBadges.some(b => b.badges.name === 'Archiviste Suprême')) missingBadges.push('Archiviste Suprême');
        if (totalLectures >= 1000 && !earnedBadges.some(b => b.badges.name === 'Omniscient')) missingBadges.push('Omniscient');

        // --- SUGGESTIONS ---
        if (totalSuggestions >= 1 && !earnedBadges.some(b => b.badges.name === 'Innovateur')) missingBadges.push('Innovateur');
        if (totalSuggestions >= 5 && !earnedBadges.some(b => b.badges.name === 'Esprit Critique')) missingBadges.push('Esprit Critique');
        if (totalSuggestions >= 20 && !earnedBadges.some(b => b.badges.name === 'Architecte du Futur')) missingBadges.push('Architecte du Futur');
        if (totalSuggestions >= 50 && !earnedBadges.some(b => b.badges.name === 'Visionnaire')) missingBadges.push('Visionnaire');

        // --- MISSIONS ---
        if (totalMissions >= 1 && !earnedBadges.some(b => b.badges.name === 'Stratège')) missingBadges.push('Stratège');
        if (totalMissions >= 5 && !earnedBadges.some(b => b.badges.name === 'Agent de Terrain')) missingBadges.push('Agent de Terrain');
        if (totalMissions >= 20 && !earnedBadges.some(b => b.badges.name === 'Commandant')) missingBadges.push('Commandant');
        if (totalMissions >= 50 && !earnedBadges.some(b => b.badges.name === 'Légende Opérationnelle')) missingBadges.push('Légende Opérationnelle');

        if (missingBadges.length > 0) {
           console.log("🛠️ Badges manquants détectés (Self-Healing) :", missingBadges);
           
           // Find badge IDs
           const { data: badgesDefs, error: badgeErr } = await supabase
             .from('badges')
             .select('id, name')
             .in('name', missingBadges);
             
           if (badgeErr) {
              console.error("❌ Erreur récupération badgesDefs :", badgeErr);
              return;
           }
             
           if (badgesDefs && badgesDefs.length > 0) {
               console.log("🚀 Application Optimiste des badges...");
               
               // 1. Optimistic Update: Update UI IMMEDIATELY
               const newBadgesForUI = badgesDefs.map(def => ({
                 id: `temp-${def.id}`, // Temp ID until refresh
                 awarded_at: new Date().toISOString(),
                 badges: {
                   id: def.id,
                   name: def.name,
                   description: "Badge débloqué automatiquement", // Placeholder
                   icon: 'fa-trophy', // Fallback icon
                   category: 'achievement'
                 }
               }));
               
               setEarnedBadges(prev => {
                  // Avoid duplicates
                  const existingIds = new Set(prev.map(b => b.badges.id));
                  const uniqueNew = newBadgesForUI.filter(b => !existingIds.has(b.badges.id));
                  return [...prev, ...uniqueNew];
               });
 
               // 2. Background Sync
               const newBadgesInserts = badgesDefs.map(def => ({
                 user_id: user.id,
                 badge_id: def.id,
                 awarded_at: new Date().toISOString()
               }));
               
               console.log("📥 Tentative insertion background...", newBadgesInserts);
               
               // Fire and forget (almost)
               supabase.from('user_badges').upsert(newBadgesInserts, { onConflict: 'user_id, badge_id' })
                 .then(({ error }) => {
                    if (error) console.warn("⚠️ Sync background échouée (mais UI à jour):", error);
                    else console.log("✅ Sync background réussie !");
                 });
            }
         } else {
            console.log("✅ Tous les badges (lectures, suggestions, missions) sont à jour.");
         }
       };
       
       // Delay check slightly to ensure state is settled
       setTimeout(checkAndRepairBadges, 500);

      // Mark session as seen
      sessionStorage.setItem(`procedio_session_intro_${user.id}`, "true");

      // Sync refs to prevent double firing immediately
      prevLevelRef.current = currentLevel;
      prevBadgeCountRef.current = earnedBadges.length;
    } else {
      // REAL-TIME UPDATES

      // 1. Check Level Up Realtime
      const calculatedLevel = calculateLevelFromXP(personalStats.xp || 0);
      if (calculatedLevel > prevLevelRef.current && prevLevelRef.current !== 0) {
        newQueue.push({
          type: "level",
          data: { level: calculatedLevel, title: getLevelTitle(calculatedLevel) },
        });
      }
      prevLevelRef.current = calculatedLevel;

      // 2. Check Badge Unlocked Realtime
      if (earnedBadges.length > prevBadgeCountRef.current && prevBadgeCountRef.current !== 0) {
        const sortedBadges = [...earnedBadges].sort(
          (a, b) => new Date(a.awarded_at).getTime() - new Date(b.awarded_at).getTime()
        );
        const newBadge = sortedBadges[sortedBadges.length - 1]?.badges;
        if (newBadge) {
          newQueue.push({ type: "badge", data: newBadge });
        }
      }
      prevBadgeCountRef.current = earnedBadges.length;
    }

    if (newQueue.length > 0) {
      setCelebrationQueue((prev) => [...prev, ...newQueue]);
    }
  }, [personalStats?.level, personalStats?.consultations, earnedBadges, user.id, loadingBadges, hasInitialFetchCompleted]);

  // Handle Celebration Queue PROCESSING
  useEffect(() => {
    if (!currentCelebration && celebrationQueue.length > 0) {
      const next = celebrationQueue[0];
      setCurrentCelebration(next);
      setCelebrationQueue((prev) => prev.slice(1));
    }
  }, [celebrationQueue, currentCelebration]);

  const handleCloseCelebration = () => {
    setCurrentCelebration(null);
  };

  const stats =
    user.role === UserRole.MANAGER
      ? [
          {
            label: "Succès Recherche",
            value: `${managerKPIs.searchSuccess}%`,
            icon: "fa-magnifying-glass-chart",
            color: managerKPIs.searchSuccess >= 85 ? "text-emerald-600" : "text-amber-600",
            bg: managerKPIs.searchSuccess >= 85 ? "bg-emerald-50" : "bg-amber-50",
            desc: "Efficacité des recherches",
            tooltipTitle: "Taux de Succès",
            tooltipDesc: "Pourcentage de recherches aboutissant à un résultat.",
            ariaLabel: `Taux de succès des recherches: ${managerKPIs.searchSuccess}%`
          },
          {
            label: "Fiabilité",
            value: `${managerKPIs.health}%`,
            icon: "fa-shield-heart",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            desc: "Pertinence du contenu",
            tooltipTitle: "Santé du Patrimoine",
            tooltipDesc: "Indicateur global de fraîcheur et de validation des procédures.",
            ariaLabel: `Taux de fiabilité du contenu: ${managerKPIs.health}%`
          },
          {
            label: "Dynamique",
            value: `+${managerKPIs.usage}`,
            icon: "fa-arrow-trend-up",
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            desc: "Niveau d'adoption",
            tooltipTitle: "Croissance d'Usage",
            tooltipDesc: "Volume de consultations sur la période en cours.",
            ariaLabel: `Dynamique d'adoption: +${managerKPIs.usage} consultations`
          },
          {
            label: "Zone Rouge",
            value: `${managerKPIs.redZone}`,
            icon: "fa-triangle-exclamation",
            color: "text-rose-600",
            bg: "bg-rose-50",
            desc: "Gouvernance manquante",
            tooltipTitle: "Risque de Perte",
            tooltipDesc:
              "Nombre de procédures n'ayant aucun référent assigné (risque de non-mise à jour).",
            ariaLabel: `${managerKPIs.redZone} procédures en zone rouge`
          },
        ]
      : [
          {
            label: "Impact Équipe",
            value: `${(personalStats?.suggestions || 0) * 50} pts`,
            icon: "fa-handshake-angle",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            desc: `${personalStats?.suggestions || 0} suggs validées`,
            tooltipTitle: "Ton apport à l'équipe",
            tooltipDesc: `Chaque suggestion validée aide tes collègues et prouve ton expertise métier.`,
            ariaLabel: `Impact équipe: ${(personalStats?.suggestions || 0) * 50} points`
          },
          {
            label: "Sprint Actuel",
            value: `+${weeklyXP} XP`,
            icon: "fa-bolt-lightning",
            color: "text-amber-600",
            bg: "bg-amber-50",
            desc: "Cette semaine",
            tooltipTitle: "Dynamique hebdomadaire",
            tooltipDesc: "XP gagnée au cours des 7 derniers jours. Garde le rythme !",
            ariaLabel: `Sprint actuel: +${weeklyXP} XP cette semaine`
          },
        ];

  const filteredStats = stats;

  useEffect(() => {
    if (user?.id) {
      fetchActivities();
      fetchPersonalStats();
      fetchLatestAnnouncement();
      fetchActiveMissions();

      if (user.role === UserRole.MANAGER) {
        fetchSuggestions();
        fetchMasteryClaims();
        fetchPendingFlashNotes();
        fetchManagerKPIs();
      } else {
        fetchApprovedExams();
      }
    }
  }, [user?.id, user?.role]);

  // Realtime Subscriptions for Pilotage Center & Activities
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.MANAGER) return;

    const channel = supabase
      .channel("pilotage_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "mastery_requests" }, () => {
        console.log("Realtime: Mastery update detected");
        fetchMasteryClaims();
        fetchActivities();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "procedure_suggestions" },
        () => {
          console.log("Realtime: Suggestion update detected");
          fetchSuggestions();
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role]);

  // Support for deep linking to suggestions or mastery exams (via URL or Prop)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const id = params.get('id');

    // 1. Check URL Params first
    if (action === 'mastery' && id && approvedExams.length > 0) {
      const exam = approvedExams.find(e => e.id === id);
      if (exam) {
        setActiveQuizRequest(exam);
        setShowDashboardQuiz(true);
        // Clear URL silently to avoid re-triggering on refresh
        window.history.replaceState({}, '', '/dashboard');
      }
    }

    // 2. Check Prop (Legacy/Internal Navigation)
    if (targetAction) {
      if (targetAction.type === "suggestion" && pendingSuggestions.length > 0) {
        const sugg = pendingSuggestions.find((s) => s.id === targetAction.id);
        if (sugg) {
          setSelectedSuggestion(sugg);
          setShowSuggestionModal(true);
          onActionHandled?.();
        }
      } else if (targetAction.type === "mastery" && approvedExams.length > 0) {
        // For Technician: Launch Quiz
        const exam = approvedExams.find((e) => e.id === targetAction.id);
        if (exam) {
          setActiveQuizRequest(exam);
          setShowDashboardQuiz(true);
          onActionHandled?.();
        }
      } else if (targetAction.type === "mastery_result" && masteryClaims.length > 0) {
        // For Manager: View Result Details
        const claim = masteryClaims.find((c) => c.id === targetAction.id);
        if (claim) {
          setSelectedMasteryClaim(claim);
          setShowMasteryDetail(true);
          onActionHandled?.();
        }
      }
    }
  }, [targetAction, pendingSuggestions, approvedExams, masteryClaims, location.search]);

  // Retry helper
  const retryPromise = async <T extends unknown>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (retries <= 0) throw err;
      console.warn(`⚠️ Retry operation... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryPromise(fn, retries - 1, delay * 1.5);
    }
  };

  const fetchPersonalStats = async () => {
    try {
      console.log("🔄 Chargement des stats personnelles...");
      setLoadingPersonalStats(true);
      
      const { data: profile } = await retryPromise(async () => await supabase
        .from("user_profiles")
        .select("xp_points, level, stats_by_category")
        .eq("id", user.id)
        .single());

      const { count: consultCount } = await retryPromise(async () => await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .ilike("title", "CONSULTATION_%"));

      const { count: suggCount } = await supabase
        .from("procedure_suggestions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "approved");

      const { data: allNotes } = await supabase
        .from("notes")
        .select("title")
        .eq("user_id", user.id);

      const realNotesCount =
        allNotes?.filter(
          (n) =>
            !n.title.startsWith("LOG_") &&
            !n.title.startsWith("CONSULTATION_") &&
            !n.title.startsWith("SUGGESTION_")
        ).length || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: weeklyConsults } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .ilike("title", "CONSULTATION_%")
        .gte("created_at", sevenDaysAgo.toISOString());

      const masteryData = profile?.stats_by_category
        ? Object.keys(profile.stats_by_category)
            .map((cat) => ({
              subject: cat,
              A: profile.stats_by_category[cat],
              fullMark:
                Math.max(...(Object.values(profile.stats_by_category as object) as number[])) + 5,
              certifications: 0, // Placeholder, will be populated below
            }))
            .slice(0, 6)
        : [];

      // Fetch Certifications (Completed Mastery Requests) by Category
      const { data: completedMasteries } = await supabase
        .from("mastery_requests")
        .select("procedure:procedure_id(category)")
        .eq("user_id", user.id)
        .eq("status", "completed");

      if (completedMasteries) {
        masteryData.forEach((item) => {
          const certCount = completedMasteries.filter(
            (m: any) => m.procedure?.category === item.subject
          ).length;
          item.certifications = certCount;
        });
      }

      const { count: missionsCount } = await retryPromise(async () => await supabase
        .from("missions")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .eq("status", "completed"));

      // Fallback: Si le count 'notes' échoue ou est 0, on utilise la somme des stats par catégorie
      const totalMasteryLectures = masteryData.reduce((acc, curr) => acc + curr.A, 0);
      const finalConsultations = (consultCount && consultCount > totalMasteryLectures) ? consultCount : totalMasteryLectures;

      const stats = {
        consultations: finalConsultations,
        suggestions: suggCount || 0,
        missions: missionsCount || 0,
        notes: realNotesCount,
        xp: profile?.xp_points || 0,
        level: calculateLevelFromXP(profile?.xp_points || 0),
        mastery: masteryData,
      };
      setPersonalStats(stats);
      cacheStore.set("dash_personal_stats", stats);

      const weeklyXpVal = (weeklyConsults || 0) * 5;
      setWeeklyXP(weeklyXpVal);
      cacheStore.set("dash_weekly_xp", weeklyXpVal);

      setLoadingBadges(true);
      const { data: userBadges, error: badgeError } = await retryPromise(async () => await supabase
        .from("user_badges")
        .select(
          `
          id,
          awarded_at,
          badges (
            id,
            name,
            description,
            icon,
            category
          )
        `
        )
        .eq("user_id", user.id));

      if (!badgeError && userBadges) {
        setEarnedBadges(userBadges);
        cacheStore.set("dash_earned_badges", userBadges);
      }
      setLoadingBadges(false);
      setHasInitialFetchCompleted(true);
    } catch (err) {
      console.error("❌ Erreur CRITIQUE stats personnelles (après retries):", err);
      setToast({ message: "Erreur de connexion. Certaines données peuvent manquer.", type: "error" });
    } finally {
      // Artificial delay for smoother loading UX
      setTimeout(() => setLoadingPersonalStats(false), 800);
    }
  };

  const fetchMasteryClaims = async () => {
    if (user.role !== UserRole.MANAGER) return;
    setLoadingClaims(true);
    try {
      const { data, error } = await supabase
        .from("mastery_requests")
        .select(
          `
          *,
          user_profiles:user_id (first_name, last_name, avatar_url),
          procedures:procedure_id (title, uuid),
          is_read_by_manager
        `
        )
        .or("status.eq.pending,status.eq.approved,status.eq.completed")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) {
        const mappedData = data.map((d) => ({
          ...d,
          isReadByManager: d.is_read_by_manager,
        }));
        setMasteryClaims(mappedData);
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
        .from("mastery_requests")
        .select(
          `
          *,
          procedure:procedure_id (title, uuid, file_url, Type, views)
        `
        )
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) {
        setApprovedExams(data);
        onAlertCountChange?.(data.length);
      }
    } catch (err) {
      console.error("Error fetching approved exams:", err);
    } finally {
      setLoadingExams(false);
    }
  };

  const [generatingExamId, setGeneratingExamId] = useState<string | null>(null);

  const handleApproveMastery = async (requestId: string) => {
    try {
      const request = masteryClaims.find((c) => c.id === requestId);
      if (!request) return;

      const procedureId = Array.isArray(request.procedures)
        ? request.procedures[0]?.uuid
        : request.procedures?.uuid;
      if (!procedureId) throw new Error("ID de procédure introuvable.");

      setGeneratingExamId(requestId);
      setToast({ message: "Lancement de la génération IA en arrière-plan...", type: "info" });

      const { error: preUpdateError } = await supabase
        .from("mastery_requests")
        .update({ status: "approved" })
        .eq("id", requestId);

      if (preUpdateError) throw preUpdateError;

      setToast({
        message: "Demande approuvée ! L'examen sera prêt dans quelques instants.",
        type: "success",
      });
      setGeneratingExamId(null);
      fetchMasteryClaims();

      // Notify Technician immediately
      if (request.user_id) {
        await supabase.from("notifications").insert({
          user_id: request.user_id,
          type: "mission", // Use 'mission' type to ensure it appears in dashboard alerts if needed
          title: "Examen Prêt 🎓",
          content: `Votre demande pour "${request.procedures?.title}" a été validée. Cliquez ici pour passer l'examen !`,
          link: `/dashboard?action=mastery&id=${requestId}`,
        });
      }

      supabase.functions
        .invoke("generate-mastery-quiz", {
          body: {
            procedure_id: procedureId,
            request_id: requestId,
            manager_name: user.firstName,
          },
        })
        .then(({ error }) => {
          if (error) console.error("❌ Background AI Generation Error:", error);
          else console.log("✅ Background AI Generation Finished.");
        });
    } catch (err: any) {
      console.error("Error approving mastery:", err);
      setGeneratingExamId(null);
      setToast({ message: err.message || "Erreur lors de l'approbation.", type: "error" });
    }
  };

  const handleToggleReadStatus = async (
    type: "suggestion" | "mastery" | "notification",
    id: string,
    status: boolean
  ) => {
    try {
      if (type === 'notification') {
        if (status) await markAsRead(id);
        return;
      }

      const table = type === "suggestion" ? "procedure_suggestions" : "mastery_requests";

      if (type === "suggestion") {
        setPendingSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isReadByManager: status } : s))
        );
      } else {
        setMasteryClaims((prev) =>
          prev.map((c) => (c.id === id ? { ...c, isReadByManager: status } : c))
        );
      }

      await supabase.from(table).update({ is_read_by_manager: status }).eq("id", id);
    } catch (err) {
      console.error("Error toggling read status:", err);
    }
  };

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from("procedure_suggestions")
        .select(
          `
          *,
          procedures (title),
          user_profiles!user_id (first_name, last_name, avatar_url)
        `
        )
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) {
        const mapped = data.map((d) => ({
          ...d,
          procedureTitle: d.procedures?.title,
          authorName: d.user_profiles
            ? `${d.user_profiles.first_name} ${d.user_profiles.last_name}`
            : "Inconnu",
          userName: d.user_profiles
            ? `${d.user_profiles.first_name} ${d.user_profiles.last_name}`
            : "Inconnu",
          authorAvatar: d.user_profiles?.avatar_url,
          isReadByManager: d.is_read_by_manager,
        }));
        setPendingSuggestions(mapped);
        cacheStore.set("dash_suggestions", mapped);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const fetchPendingFlashNotes = async () => {
    try {
      const { count } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("is_flash_note", true)
        .eq("status", "suggestion");

      if (count !== null) setPendingFlashNotesCount(count);
      onFlashCountChange?.(count || 0);
    } catch (err) {
      console.error("Error fetching flash notes count:", err);
    }
  };

  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      let query = supabase
        .from("notes")
        .select(
          `
          id, 
          title, 
          content, 
          created_at, 
          user:user_id (first_name, last_name)
        `
        )
        .or(
          "title.ilike.CONSULTATION%,title.ilike.LOG_SUGGESTION%,title.ilike.CLAIM_MASTERY%,title.ilike.MISSION_%,title.ilike.APPLY_REFERENT%"
        )
        .order("created_at", { ascending: false });

      if (user.role === UserRole.TECHNICIAN) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      if (data) {
        setActivities(data);
        cacheStore.set("dash_activities", data);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchActiveMissions = async () => {
    try {
      // Define statuses for ACTIVE missions only (for Dashboard)
      // Technician: assigned, in_progress, awaiting_validation
      // Manager: open, assigned, in_progress, awaiting_validation (completed kept for team view only if recent?)
      
      const statuses = user.role === UserRole.TECHNICIAN 
        ? ["assigned", "in_progress", "awaiting_validation"] 
        : ["open", "assigned", "in_progress", "awaiting_validation"];

      let query = supabase
        .from("missions")
        .select(
          `
          *,
          assignee:user_profiles!assigned_to (first_name, last_name)
        `
        )
        .in("status", statuses)
        .order("created_at", { ascending: false });

      // For Technician, only fetch their own missions
      if (user.role === UserRole.TECHNICIAN) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching missions:", error);
      } else if (data) {
        setActiveMissions(data);
        cacheStore.set("dash_active_missions", data);
      }
    } catch (err) {
      console.error("Fetch missions error:", err);
    } finally {
      setLoadingMissions(false);
    }
  };

  const fetchLatestAnnouncement = async () => {
    console.log("DEBUG: Fetching latest announcement from team_announcements...");
    setLoadingAnnouncement(true);
    try {
      const { data, error } = await supabase
        .from("team_announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching announcement:", error);
      }

      if (data) {
        setAnnouncement(data);
        cacheStore.set("dash_announcement", data);

        const lastReadId = localStorage.getItem(`announcement_read_${user.id}`);
        setIsRead(lastReadId === data.id);
      } else {
        setAnnouncement(null);
      }
    } catch (err) {
      console.error("Announcement error:", err);
    } finally {
      // Artificial delay of 1s as requested for skeleton effect
      setTimeout(() => setLoadingAnnouncement(false), 1000);
    }
  };

  const handleMarkAsRead = async () => {
    if (announcement) {
      setIsRead(true);
      localStorage.setItem(`announcement_read_${user.id}`, announcement.id);
      setToast({ message: "Annonce marquée comme lue", type: "success" });

      // Notify Manager
      if (announcement.author_id && announcement.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: announcement.author_id,
          type: "info",
          title: "Message Lu",
          content: `${user.firstName} ${user.lastName} a confirmé la lecture de votre message.`,
          link: "/dashboard",
        });
      }
    }
  };

  const handleUpdateAnnouncement = async () => {
    console.log("DEBUG: Updating announcement in team_announcements...");
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("team_announcements")
        .insert({
          content: editContent,
          author_id: user.id || "system",
          author_name: user.firstName ? `${user.firstName} ${user.lastName}` : "Direction",
          author_initials: user.firstName ? `${user.firstName[0]}${user.lastName[0]}` : "JD",
          requires_confirmation: requiresConfirmation,
        })
        .select()
        .single();

      if (error) throw error;

      setAnnouncement(data);
      setIsEditing(false);
      setEditContent("");
      setIsRead(false);
      setToast({ message: "Annonce publiée avec succès", type: "success" });
    } catch (err) {
      console.error("Error updating announcement:", err);
      setToast({ message: "Erreur lors de la publication", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMission = async (missionData: Partial<Mission>) => {
    try {
      const { data, error } = await supabase
        .from("missions")
        .insert([
          {
            ...missionData,
            created_by: user.id,
            status: "active",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setActiveMissions((prev) => [...prev, data]);
      setToast({ message: "Mission créée avec succès !", type: "success" });
    } catch (err: any) {
      setToast({ message: "Erreur création mission: " + err.message, type: "error" });
    }
  };

  const fetchManagerKPIs = async () => {
    if (user.role !== UserRole.MANAGER) return;
    try {
      // 1. Health & RedZone
      const { data: procs } = await supabase
        .from("procedures")
        .select("uuid, updated_at, created_at, views");

      if (!procs) return;

      const { data: referents } = await supabase.from("procedure_referents").select("procedure_id");
      const referentSet = new Set(referents?.map((r) => r.procedure_id) || []);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      let fresh = 0;
      let redZoneCount = 0;
      let totalUsage = 0;

      procs.forEach((p: any) => {
        const date = new Date(p.updated_at || p.created_at);
        if (date > sixMonthsAgo) fresh++;
        if (!referentSet.has(p.uuid)) redZoneCount++;
        totalUsage += p.views || 0;
      });

      const healthPct = procs.length > 0 ? Math.round((fresh / procs.length) * 100) : 0;

      // 2. Search Success Rate - Logic adapted from Statistics.tsx
      const RESET_DATE = "2026-02-14T09:00:00.000Z";
      const { count: totalSearches } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .ilike("title", "LOG_SEARCH_%")
        .gte("created_at", RESET_DATE);

      const { data: opportunities } = await supabase
        .from("search_opportunities")
        .select("search_count")
        .eq("status", "pending");

      const totalFailedCount =
        opportunities?.reduce((acc, curr) => acc + (curr.search_count || 0), 0) || 0;

      const successRate =
        totalSearches && totalSearches > 0
          ? Math.max(
              0,
              Math.min(100, Math.round(((totalSearches - totalFailedCount) / totalSearches) * 100))
            )
          : 100;

      const kpis = {
        searchSuccess: successRate,
        health: healthPct,
        usage: totalUsage,
        redZone: redZoneCount,
      };

      setManagerKPIs(kpis);
      cacheStore.set("dash_manager_kpis", kpis);
    } catch (err) {
      console.error("Error fetching manager KPIs:", err);
    }
  };

  const handleClaimMission = async (mission: Mission) => {
    if (!user.id) return;

    // Check if user is already assigned
    if (mission.assigned_to === user.id) {
      setToast({ message: "Vous participez déjà à cette mission.", type: "info" });
      return;
    }

    try {
      // Update DB - Assignments are single user based on types.ts
      const { error } = await supabase
        .from("missions")
        .update({ assigned_to: user.id, status: "in_progress" })
        .eq("id", mission.id);

      if (error) throw error;

      // Update Local State
      setActiveMissions((prev) =>
        prev.map((m) =>
          m.id === mission.id ? { ...m, assigned_to: user.id, status: "in_progress" } : m
        )
      );
      setToast({ message: "Mission acceptée ! Bonne chance.", type: "success" });

      // LOG ACTIVITY
      await supabase.from("notes").insert({
        user_id: user.id,
        title: `MISSION_CLAIM_${mission.id}`,
        content: `a pris en charge la mission "${mission.title}"`,
        category: "mission_log",
        tags: ["mission_claim"],
        status: "public",
      });
    } catch (err) {
      console.error("Error claiming mission:", err);
      setToast({ message: "Impossible de rejoindre la mission.", type: "error" });
    }
  };

  const handleCompleteMission = async () => {
    if (!completingMission) return;
    setIsSubmittingCompletion(true);

    try {
      const { error } = await supabase.from("notes").insert({
        user_id: user.id,
        title: `MISSION_COMPLETION_${completingMission.id}`,
        content: `Mission: ${completingMission.title}\n\nPreuve/Notes:\n${completionNotes}`,
        category: "mission_log",
        tags: ["mission_completion", "pending_validation"],
        status: "private",
      });

      if (error) throw error;

      setToast({ message: "Validation envoyée au manager !", type: "success" });
      setCompletingMission(null);
      setCompletionNotes("");
    } catch (err) {
      setToast({ message: "Erreur lors de l'envoi.", type: "error" });
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  if (!user) return <LoadingState />;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <CustomToast
        visible={!!toast}
        message={toast?.message || ""}
        type={toast?.type || "info"}
        onClose={() => setToast(null)}
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-1 shrink-0">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Bonjour,
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                {user.firstName}
              </span>
              <span className="text-xl">👋</span>
            </h1>
            <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
              {user.role === UserRole.MANAGER ? (
                <>
                  <span>Piloter la performance et le bien-être de l'équipe</span>
                  <i className="fa-solid fa-chess-queen text-amber-500"></i>
                </>
              ) : (
                <>
                  <span>Prêt à relever les défis d'aujourd'hui ?</span>
                  <i className="fa-solid fa-wrench text-indigo-500"></i>
                </>
              )}
            </p>
          </div>

          {/* MANAGER MESSAGE (In Header) */}
          {user.role === UserRole.MANAGER && (
            <div className="flex-1 mx-4 min-w-[300px]">
               <AnnouncementWidget
                  user={user}
                  announcement={announcement}
                  isRead={isRead}
                  handleMarkAsRead={handleMarkAsRead}
                  handleSaveAnnouncement={handleUpdateAnnouncement}
                  loadingAnnouncement={loadingAnnouncement}
                  saving={saving}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  editContent={editContent}
                  setEditContent={setEditContent}
                  requiresConfirmation={requiresConfirmation}
                  setRequiresConfirmation={setRequiresConfirmation}
                  formatDate={(d) => new Date(d).toLocaleDateString()}
                  compact={true} 
                />
            </div>
          )}

          <div className="flex items-center gap-3 shrink-0">
            {user.role === UserRole.MANAGER && (
              <button
                onClick={onUploadClick}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2 font-bold text-xs">
                <i className="fa-solid fa-plus"></i>
                <span>Nouvelle Procédure</span>
              </button>
            )}
          </div>
        </header>

        {user.role === UserRole.TECHNICIAN ? (
          <div className="grid grid-cols-12 gap-y-4 gap-x-8">
            {/* Barre de progression XP avec style unifié */}
            <div className="col-span-12 mt-6 mb-4">
              {loadingPersonalStats || !personalStats ? (
                <div className="w-full h-32 bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm flex flex-col justify-center animate-pulse">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full"></div>
                    <div className="space-y-2">
                      <div className="h-6 w-32 bg-slate-100 rounded-full"></div>
                      <div className="h-4 w-48 bg-slate-100 rounded-full"></div>
                    </div>
                  </div>
                  <div className="h-4 w-full bg-slate-100 rounded-full"></div>
                </div>
              ) : (
                <XPProgressBar currentXP={personalStats.xp} currentLevel={personalStats.level} />
              )}
            </div>

            {/* ROW 2: Action & Stats Grid */}
            <div className="col-span-12 grid grid-cols-12 gap-8">
              {/* Message du Manager (Full Width Above Grid) */}
              <div className="col-span-12">
                <AnnouncementWidget
                  user={user}
                  announcement={announcement}
                  isRead={isRead}
                  handleMarkAsRead={handleMarkAsRead}
                  handleSaveAnnouncement={handleUpdateAnnouncement}
                  loadingAnnouncement={loadingAnnouncement}
                  saving={saving}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                  editContent={editContent}
                  setEditContent={setEditContent}
                  requiresConfirmation={requiresConfirmation}
                  setRequiresConfirmation={setRequiresConfirmation}
                  formatDate={(d) => new Date(d).toLocaleDateString()}
                  compact={true} 
                />
              </div>

              {/* 1. Mon Fil d'Activité (LEFT - 50%) */}
              <div className="col-span-12 lg:col-span-6 lg:h-[600px]">
                <RecentHistoryWidget
                  activities={activities}
                  loading={loadingActivities}
                  notifications={systemNotifications}
                  onNavigate={onNavigate}
                />
              </div>

              {/* 2. Mes Missions (RIGHT - 50%) */}
              <div className="col-span-12 lg:col-span-6 lg:h-[600px]">
                <PilotCenterTechWidget
                  missions={activeMissions.filter((m) => m.assigned_to === user.id)}
                  exams={approvedExams}
                  activities={activities}
                  loading={loadingMissions || loadingActivities}
                  onNavigate={onNavigate}
                />
              </div>
            </div>

            {/* ROW 3: Trophées | Maitrise | Journal (3 cols) */}
            <div className="col-span-12 grid grid-cols-12 gap-8">
                {/* Mes Trophées */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
                  <BadgesWidget
                    earnedBadges={earnedBadges}
                    totalConsultations={personalStats?.consultations || 0}
                    totalSuggestions={personalStats?.suggestions || 0}
                    totalMissions={personalStats?.missions || 0}
                    onNavigate={onNavigate}
                  />
                </div>

                {/* Maitrise Experte */}
                <div className="col-span-12 lg:col-span-4">
                     {personalStats && <MasteryWidget personalStats={personalStats} />}
                </div>

                {/* Journal des Succès */}
                <div className="col-span-12 lg:col-span-4">
                     <RecentHistoryWidget
                      activities={activities}
                      loading={loadingActivities}
                      notifications={systemNotifications}
                      onNavigate={onNavigate}
                      title="Journal des Succès"
                      subtitle="Vos victoires, badges et missions validées."
                    />
                </div>
            </div>

            {/* ROW 5: RSS (Full Width) */}
            <div className="col-span-12 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 min-h-[400px]">
              <RSSWidget user={user} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* MANAGER ROW 0: Team Synergy (Top Priority) */}
            <div className="w-full">
              <TeamSynergyWidget />
            </div>

            {/* MANAGER ROW 1: KPIs Summary */}
            <div className="w-full">
              <StatsSummaryWidget stats={filteredStats} orientation="horizontal" />
            </div>

            {/* MANAGER ROW 2: 3 Columns Layout (Review Center | Team Podium | Activity) */}
            <div className="grid grid-cols-12 gap-8">
              {/* Col 1: Centre de Pilotage (ReviewCenter) - 4/12 */}
              <div className="col-span-12 lg:col-span-4 h-full">
                <ReviewCenterWidget
                  pendingSuggestions={pendingSuggestions || []}
                  masteryClaims={masteryClaims || []}
                  notifications={systemNotifications}
                  activeMissions={activeMissions}
                  onSelectSuggestion={(sugg) => {
                    setSelectedSuggestion(sugg);
                    setShowSuggestionModal(true);
                  }}
                  onNavigateToStatistics={() => onNavigate?.("/statistics")}
                  onNavigateToMission={(id) => onNavigate?.(`missions?id=${id}`)}
                  onApproveMastery={handleApproveMastery}
                  onViewMasteryDetail={(claim) => {
                    setSelectedMasteryClaim(claim);
                    setShowMasteryDetail(true);
                  }}
                  generatingExamId={generatingExamId}
                  onToggleReadStatus={handleToggleReadStatus}
                />
              </div>

              {/* Col 2: Podium (TeamPodium) - 4/12 */}
              <div className="col-span-12 lg:col-span-4 h-full flex flex-col gap-8">
                <TeamPodium />
                <MissionsWidget
                  activeMissions={activeMissions}
                  userRole={user.role}
                  viewMode="team"
                  onNavigate={onNavigate}
                  loading={loadingMissions}
                />
              </div>

              {/* Col 3: Pouls de l'Équipe (Activity) - 4/12 */}
              <div className="col-span-12 lg:col-span-4 h-full">
                <ActivityWidget
                  activities={activities}
                  loadingActivities={loadingActivities}
                  onRefresh={fetchActivities}
                />
              </div>
            </div>

            {/* MANAGER ROW 3: RSS (Veille Info) */}
            <div className="w-full">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 min-h-[400px]">
                <RSSWidget user={user} />
              </div>
            </div>
          </div>
        )}
      </div>

      {showSuggestionModal && selectedSuggestion && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{selectedSuggestion.procedureTitle}</h2>
              <p className="border-b pb-4 mb-4">{selectedSuggestion.content}</p>
              <button
                className="bg-slate-200 px-4 py-2 rounded"
                onClick={() => setShowSuggestionModal(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {currentCelebration &&
        (currentCelebration.type === "level" ? (
          <LevelUpModal
            level={currentCelebration.data.level}
            title={currentCelebration.data.title}
            onClose={handleCloseCelebration}
          />
        ) : (
          <BadgeUnlockedModal
            badge={currentCelebration.data}
            currentXP={personalStats.xp}
            currentLevel={personalStats.level}
            onClose={handleCloseCelebration}
          />
        ))}

      <MasteryQuizModal
        isOpen={showDashboardQuiz}
        onClose={() => setShowDashboardQuiz(false)}
        procedure={activeQuizRequest?.procedure}
        user={user}
        quizData={activeQuizRequest?.quiz_data}
        masteryRequestId={activeQuizRequest?.id}
        onSuccess={(score, level) => {
          setToast({ message: `Examen terminé ! Score: ${score}%`, type: "success" });
          setShowDashboardQuiz(false);
          fetchPersonalStats();
        }}
      />

      {modalConfig && (
        <KPIDetailsModal
          onClose={() => setModalConfig(null)}
          title={modalConfig.title}
          type={modalConfig.type}
          items={modalConfig.items}
        />
      )}
    </div>
  );
};

export default Dashboard;
