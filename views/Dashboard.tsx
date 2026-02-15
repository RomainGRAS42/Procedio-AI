
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
import AnnouncementWidget from '../components/dashboard/AnnouncementWidget';
import ActivityWidget from '../components/dashboard/ActivityWidget';
import ReviewCenterWidget from '../components/dashboard/ReviewCenterWidget';
import PilotCenterTechWidget from '../components/dashboard/PilotCenterTechWidget';
import RSSWidget from "../components/RSSWidget";
import MasteryQuizModal from "../components/MasteryQuizModal";
import MasteryResultDetailModal from "../components/MasteryResultDetailModal";
import KPIDetailsModal from "../components/KPIDetailsModal";

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewComplianceHistory: () => void;
  targetAction?: { type: 'suggestion' | 'read' | 'mastery' | 'mastery_result', id: string } | null;
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
  const [isRead, setIsRead] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(cacheStore.get('dash_announcement') || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(!cacheStore.has('dash_announcement'));
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [managerResponse, setManagerResponse] = useState("");


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
  const [earnedBadges, setEarnedBadges] = useState<any[]>(cacheStore.get('dash_earned_badges') || []);
  const [loadingBadges, setLoadingBadges] = useState(!cacheStore.has('dash_earned_badges'));

  // KPI Details Modal
  const [modalConfig, setModalConfig] = useState<{title: string, type: 'urgent' | 'redZone', items: any[]} | null>(null);

  // Celebration Queue System (Daisy Chaining)
  interface CelebrationItem {
    type: 'level' | 'badge';
    data: any;
  }
  const [celebrationQueue, setCelebrationQueue] = useState<CelebrationItem[]>([]);
  const [currentCelebration, setCurrentCelebration] = useState<CelebrationItem | null>(null);

  // ViewMode removed


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
    redZone: 0
  });

  const [hasInitialFetchCompleted, setHasInitialFetchCompleted] = useState(false);

  const prevLevelRef = React.useRef<number>(0);
  const prevBadgeCountRef = React.useRef<number>(0);

  // Initialize refs on mount
  useEffect(() => {
    if (user?.id && personalStats.level > 0) {
       if (prevLevelRef.current === 0) prevLevelRef.current = personalStats.level;
       if (prevBadgeCountRef.current === 0) prevBadgeCountRef.current = earnedBadges.length;
    }
  }, [user?.id, personalStats.level, earnedBadges.length]);

  // Detection Level Up & Badges
  useEffect(() => {
    if (user.role !== UserRole.TECHNICIAN || !user.id || !hasInitialFetchCompleted || loadingBadges) return;

    const newQueue: CelebrationItem[] = [];
    
    // Initial Session Check (Only once per session)
    const hasSeenIntro = sessionStorage.getItem(`procedio_session_intro_${user.id}`);

    if (!hasSeenIntro) {
      // 1. Show Level if > 1
      const currentLevel = calculateLevelFromXP(personalStats.xp);
      if (currentLevel > 1) {
         newQueue.push({
          type: 'level',
          data: { level: currentLevel, title: getLevelTitle(currentLevel) }
        });
      }

      // 2. Show Last Badge if exists
      if (earnedBadges.length > 0) {
        const sortedBadges = [...earnedBadges].sort((a, b) => 
          new Date(a.awarded_at).getTime() - new Date(b.awarded_at).getTime()
        );
        const lastBadge = sortedBadges[sortedBadges.length - 1]?.badges;
        if (lastBadge) {
          newQueue.push({ type: 'badge', data: lastBadge });
        }
      }
      
      // Mark session as seen
      sessionStorage.setItem(`procedio_session_intro_${user.id}`, 'true');
      
      // Sync refs to prevent double firing immediately
      prevLevelRef.current = currentLevel;
      prevBadgeCountRef.current = earnedBadges.length;

    } else {
        // REAL-TIME UPDATES
        
        // 1. Check Level Up Realtime
        const calculatedLevel = calculateLevelFromXP(personalStats.xp);
        if (calculatedLevel > prevLevelRef.current && prevLevelRef.current !== 0) {
          newQueue.push({
            type: 'level',
            data: { level: calculatedLevel, title: getLevelTitle(calculatedLevel) }
          });
        }
        prevLevelRef.current = calculatedLevel;

        // 2. Check Badge Unlocked Realtime
        if (earnedBadges.length > prevBadgeCountRef.current && prevBadgeCountRef.current !== 0) {
           const sortedBadges = [...earnedBadges].sort((a, b) => 
            new Date(a.awarded_at).getTime() - new Date(b.awarded_at).getTime()
          );
          const newBadge = sortedBadges[sortedBadges.length - 1]?.badges;
          if (newBadge) {
            newQueue.push({ type: 'badge', data: newBadge });
          }
        }
        prevBadgeCountRef.current = earnedBadges.length;
    }

    if (newQueue.length > 0) {
      setCelebrationQueue(prev => [...prev, ...newQueue]);
    }
  }, [personalStats.level, earnedBadges, user.id, loadingBadges]);

  // Handle Celebration Queue PROCESSING
  useEffect(() => {
    if (!currentCelebration && celebrationQueue.length > 0) {
      const next = celebrationQueue[0];
      setCurrentCelebration(next);
      setCelebrationQueue(prev => prev.slice(1));
    }
  }, [celebrationQueue, currentCelebration]);

  const handleCloseCelebration = () => {
    setCurrentCelebration(null);
  };
  
  const stats = user.role === UserRole.MANAGER ? [
    {
      label: "Succès Recherche",
      value: `${managerKPIs.searchSuccess}%`,
      icon: "fa-magnifying-glass-chart",
      color: managerKPIs.searchSuccess >= 85 ? "text-emerald-600" : "text-amber-600",
      bg: managerKPIs.searchSuccess >= 85 ? "bg-emerald-50" : "bg-amber-50",
      desc: "Efficacité des recherches",
      tooltipTitle: "Taux de Succès",
      tooltipDesc: "Pourcentage de recherches aboutissant à un résultat."
    },
    {
      label: "Fiabilité",
      value: `${managerKPIs.health}%`,
      icon: "fa-shield-heart",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      desc: "Pertinence du contenu",
      tooltipTitle: "Santé du Patrimoine",
      tooltipDesc: "Indicateur global de fraîcheur et de validation des procédures."
    },
    {
      label: "Dynamique",
      value: `+${managerKPIs.usage}`,
      icon: "fa-arrow-trend-up",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      desc: "Niveau d'adoption",
      tooltipTitle: "Croissance d'Usage",
      tooltipDesc: "Volume de consultations sur la période en cours."
    },
    {
      label: "Zone Rouge",
      value: `${managerKPIs.redZone}`,
      icon: "fa-triangle-exclamation",
      color: "text-rose-600",
      bg: "bg-rose-50",
      desc: "Gouvernance manquante",
      tooltipTitle: "Risque de Perte",
      tooltipDesc: "Nombre de procédures n'ayant aucun référent assigné (risque de non-mise à jour)."
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
      fetchActivities();
      fetchPersonalStats();
      fetchLatestAnnouncement();
      fetchActiveMissions();

      if (user.role === UserRole.MANAGER) {
        fetchSuggestions();
        fetchMasteryClaims();
        fetchPendingFlashNotes();
      } else {
        fetchApprovedExams();
      }
      

    }
  }, [user?.id, user?.role]);

  // Realtime Subscriptions for Pilotage Center & Activities
  useEffect(() => {
    if (!user?.id || user.role !== UserRole.MANAGER) return;

    const channel = supabase
      .channel('pilotage_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mastery_requests' },
        () => {
          console.log("Realtime: Mastery update detected");
          fetchMasteryClaims();
          fetchActivities();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'procedure_suggestions' },
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

  // Support for deep linking to suggestions or mastery exams
  useEffect(() => {
    if (targetAction) {
      if (targetAction.type === 'suggestion' && pendingSuggestions.length > 0) {
        const sugg = pendingSuggestions.find(s => s.id === targetAction.id);
        if (sugg) {
          setSelectedSuggestion(sugg);
          setShowSuggestionModal(true);
          onActionHandled?.();
        }
      } else if (targetAction.type === 'mastery' && approvedExams.length > 0) {
        // For Technician: Launch Quiz
        const exam = approvedExams.find(e => e.id === targetAction.id);
        if (exam) {
          setActiveQuizRequest(exam);
          setShowDashboardQuiz(true);
          onActionHandled?.();
        }
      } else if (targetAction.type === 'mastery_result' && masteryClaims.length > 0) {
        // For Manager: View Result Details
        const claim = masteryClaims.find(c => c.id === targetAction.id);
        if (claim) {
          setSelectedMasteryClaim(claim);
          setShowMasteryDetail(true);
          onActionHandled?.();
        }
      }
    }
  }, [targetAction, pendingSuggestions, approvedExams, masteryClaims]);

  const fetchPersonalStats = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('xp_points, level, stats_by_category')
        .eq('id', user.id)
        .single();

      const { count: consultCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('title', 'CONSULTATION_%');

      const { count: suggCount } = await supabase
        .from('procedure_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'approved');

      const { data: allNotes } = await supabase
        .from('notes')
        .select('title')
        .eq('user_id', user.id);
      
      const realNotesCount = allNotes?.filter(n => 
        !n.title.startsWith('LOG_') && 
        !n.title.startsWith('CONSULTATION_') && 
        !n.title.startsWith('SUGGESTION_')
      ).length || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { count: weeklyConsults } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('title', 'CONSULTATION_%')
        .gte('created_at', sevenDaysAgo.toISOString());

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
        level: calculateLevelFromXP(profile?.xp_points || 0),
        mastery: masteryData,
      };
      setPersonalStats(stats);
      cacheStore.set('dash_personal_stats', stats);

      const weeklyXpVal = (weeklyConsults || 0) * 5;
      setWeeklyXP(weeklyXpVal);
      cacheStore.set('dash_weekly_xp', weeklyXpVal);

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
      setHasInitialFetchCompleted(true);
    } catch (err) {
      console.error("Erreur stats personnelles:", err);
    }
  };



  const fetchMasteryClaims = async () => {
    if (user.role !== UserRole.MANAGER) return;
    setLoadingClaims(true);
    try {
      const { data, error } = await supabase
        .from('mastery_requests')
        .select(`
          *,
          user_profiles:user_id (first_name, last_name, avatar_url),
          procedures:procedure_id (title, uuid),
          is_read_by_manager
        `)
        .or('status.eq.pending,status.eq.approved,status.eq.completed') 
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) {
        const mappedData = data.map(d => ({
            ...d,
            isReadByManager: d.is_read_by_manager
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
        .from('mastery_requests')
        .select(`
          *,
          procedure:procedure_id (title, uuid, file_url, Type, views)
        `)
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

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
      const request = masteryClaims.find(c => c.id === requestId);
      if (!request) return;

      const procedureId = Array.isArray(request.procedures) ? request.procedures[0]?.uuid : request.procedures?.uuid;
      if (!procedureId) throw new Error("ID de procédure introuvable.");

      setGeneratingExamId(requestId);
      setToast({ message: "Lancement de la génération IA en arrière-plan...", type: "info" });

      const { error: preUpdateError } = await supabase
        .from('mastery_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (preUpdateError) throw preUpdateError;

      setToast({ message: "Demande approuvée ! L'examen sera prêt dans quelques instants.", type: "success" });
      setGeneratingExamId(null);
      fetchMasteryClaims(); 

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

  const handleToggleReadStatus = async (type: 'suggestion' | 'mastery', id: string, status: boolean) => {
    try {
        const table = type === 'suggestion' ? 'procedure_suggestions' : 'mastery_requests';
        
        if (type === 'suggestion') {
            setPendingSuggestions(prev => prev.map(s => s.id === id ? { ...s, isReadByManager: status } : s));
        } else {
            setMasteryClaims(prev => prev.map(c => c.id === id ? { ...c, isReadByManager: status } : c));
        }

        await supabase
           .from(table)
           .update({ is_read_by_manager: status })
           .eq('id', id);

    } catch (err) {
        console.error("Error toggling read status:", err);
    }
  };

  const [loadingAction, setLoadingAction] = useState<string | null>(null);




  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from('procedure_suggestions')
        .select(`
          *,
          procedures (title),
          user_profiles (first_name, last_name, avatar_url)
        `)
        .in('status', ['pending', 'approved', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (data) {
        const mapped = data.map(d => ({
          ...d,
          procedureTitle: d.procedures?.title,
          authorName: d.user_profiles ? `${d.user_profiles.first_name} ${d.user_profiles.last_name}` : 'Inconnu',
          authorAvatar: d.user_profiles?.avatar_url,
          isReadByManager: d.is_read_by_manager 
        }));
        setPendingSuggestions(mapped);
        cacheStore.set('dash_suggestions', mapped);
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
          .from('flash_notes')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        
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
        .from('notes')
        .select(`
          id, 
          title, 
          content, 
          created_at, 
          user:user_id (first_name, last_name)
        `)
        .or('title.ilike.CONSULTATION%,title.ilike.LOG_SUGGESTION%,title.ilike.CLAIM_MASTERY%,title.ilike.MISSION_%')
        .order('created_at', { ascending: false });

      if (user.role === UserRole.TECHNICIAN) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.limit(20);
      
      if (error) throw error;
      if (data) {
        setActivities(data);
        cacheStore.set('dash_activities', data);
      }
    } catch (err) {
      console.error("Error fetching activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchActiveMissions = async () => {
    try {
      // Fetch missions - Simpler query first to ensure data comes through
      const { data, error } = await supabase
        .from('missions')
        .select(`
          *,
          assignee:user_profiles!missions_assigned_to_fkey (first_name, last_name)
        `)
        // Filter for specific statuses relevant to the team view
        .in('status', ['open', 'assigned', 'in_progress', 'awaiting_validation', 'completed'])
        .order('updated_at', { ascending: false }); 

      if (error) {
         console.error("Error fetching missions:", error);
      } else if (data) {
         console.log("Missions fetched:", data); // Debug log
         setActiveMissions(data);
         cacheStore.set('dash_active_missions', data);
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
        .from('team_announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching announcement:", error);
      } 
      
      if (data) {
        setAnnouncement(data);
        cacheStore.set('dash_announcement', data);
        
        const lastReadId = localStorage.getItem(`announcement_read_${user.id}`);
        setIsRead(lastReadId === data.id);
      } else {
        setAnnouncement(null);
      }
    } catch (err) {
      console.error("Announcement error:", err);
    } finally {
      setLoadingAnnouncement(false);
    }
  };
  
  const handleMarkAsRead = async () => {
    if (announcement) {
      setIsRead(true);
      localStorage.setItem(`announcement_read_${user.id}`, announcement.id);
      setToast({ message: "Annonce marquée comme lue", type: "success" });
    }
  };

  const handleUpdateAnnouncement = async () => {
    console.log("DEBUG: Updating announcement in team_announcements...");
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('team_announcements')
        .insert({
          content: editContent,
          author_id: user.id || 'system',
          author_name: user.firstName ? `${user.firstName} ${user.lastName}` : 'Direction',
          author_initials: user.firstName ? `${user.firstName[0]}${user.lastName[0]}` : 'JD',
          requires_confirmation: requiresConfirmation
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
        .from('missions')
        .insert([{
          ...missionData,
          created_by: user.id,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      setActiveMissions(prev => [...prev, data]);
      setToast({ message: "Mission créée avec succès !", type: "success" });
    } catch (err: any) {
      setToast({ message: "Erreur création mission: " + err.message, type: "error" });
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
        .from('missions')
        .update({ assigned_to: user.id, status: 'in_progress' })
        .eq('id', mission.id);

      if (error) throw error;

      // Update Local State
      setActiveMissions(prev => prev.map(m => m.id === mission.id ? { ...m, assigned_to: user.id, status: 'in_progress' } : m));
      setToast({ message: "Mission acceptée ! Bonne chance.", type: "success" });

      // LOG ACTIVITY
      await supabase.from('notes').insert({
        user_id: user.id,
        title: `MISSION_CLAIM_${mission.id}`,
        content: `a pris en charge la mission "${mission.title}"`,
        category: 'mission_log',
        tags: ['mission_claim'],
        status: 'public'
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
       const { error } = await supabase
         .from('notes')
         .insert({
            user_id: user.id,
            title: `MISSION_COMPLETION_${completingMission.id}`,
            content: `Mission: ${completingMission.title}\n\nPreuve/Notes:\n${completionNotes}`,
            category: 'mission_log',
            tags: ['mission_completion', 'pending_validation'],
            status: 'private' 
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
        
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Bonjour, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">{user.firstName}</span>
              <span className="ml-3 text-2xl">👋</span>
            </h1>
            <p className="text-slate-500 font-medium text-lg flex items-center gap-2">
              {user.role === UserRole.MANAGER ? (
                <>
                  <i className="fa-solid fa-chess-queen text-amber-500"></i>
                  <span>Pilotage de la performance & Bien-être de l'équipe</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wrench text-indigo-500"></i>
                  <span>Prêt à relever les défis d'aujourd'hui ?</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
             {/* Toggle Removed */}

            {user.role === UserRole.MANAGER && (
              <button 
                onClick={onUploadClick}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-3 font-bold text-sm"
              >
                <i className="fa-solid fa-plus"></i>
                <span>Nouvelle Procédure</span>
              </button>
            )}
          </div>
        </header>

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
        />

        {user.role === UserRole.TECHNICIAN ? (
          <div className="grid grid-cols-12 gap-8">
            {/* ROW 1: KPIs (Full Width) */}
            <div className="col-span-12">
              <StatsSummaryWidget 
                stats={filteredStats} 
                isClickable={false}
              />
            </div>

            {/* ROW 2: Pilot Center (Full Width) */}
            <div className="col-span-12">
              <PilotCenterTechWidget 
                missions={activeMissions.filter(m => m.assigned_to === user.id)}
                activities={activities}
                loading={loadingMissions || loadingActivities}
                onNavigate={onNavigate}
              />
            </div>

            {/* ROW 3: Mastery (8/12) + Badges (4/12) */}
            <div className="col-span-12 lg:col-span-8">
               <MasteryWidget 
                 personalStats={personalStats} 
               />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <BadgesWidget 
                earnedBadges={earnedBadges} 
                onNavigate={onNavigate}
              />
            </div>

            {/* ROW 4: RSS (Full Width) */}
            <div className="col-span-12 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 min-h-[400px]">
               <RSSWidget user={user} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
              {/* MANAGER SYNERGY */}
              <section className="mb-4">
                <TeamSynergyWidget />
              </section>

              {/* MANAGER KPIs */}
              <section className="mb-4">
                <StatsSummaryWidget stats={filteredStats} />
              </section>
              
              {/* MANAGER ROW 1: Centre de Pilotage | Podium | Pouls */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 
                 {/* Col 1: Centre de Pilotage */}
                 <div className="space-y-8">
                   <ReviewCenterWidget 
                     pendingSuggestions={pendingSuggestions || []}
                     masteryClaims={masteryClaims || []}
                     onSelectSuggestion={(sugg) => {
                         setSelectedSuggestion(sugg);
                         setShowSuggestionModal(true);
                     }}
                     onNavigateToStatistics={() => onNavigate?.('/statistics')}
                     onApproveMastery={handleApproveMastery}
                     onViewMasteryDetail={(claim) => {
                         setSelectedMasteryClaim(claim);
                         setShowMasteryDetail(true);
                     }}
                     generatingExamId={generatingExamId}
                     onToggleReadStatus={handleToggleReadStatus}
                   />
                 </div>

                 {/* Col 2: Podium (Manager) */}
                 <div className="space-y-8">
                    <TeamPodium />
                    <MissionsWidget 
                      activeMissions={activeMissions}
                      userRole={user.role}
                      viewMode="team"
                      onNavigate={onNavigate}
                      loading={loadingMissions}
                    />
                 </div>

                 {/* Col 3: Pouls de l'Équipe (Activity) */}
                 <div className="space-y-8">
                   <ActivityWidget 
                     activities={activities} 
                     loadingActivities={loadingActivities}
                     onRefresh={fetchActivities}
                   />
                 </div>

              </div>

              {/* MANAGER ROW 2: RSS (Veille Info) */}
              <div className="space-y-8">
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
                 <button className="bg-slate-200 px-4 py-2 rounded" onClick={() => setShowSuggestionModal(false)}>Fermer</button>
              </div>
           </div>
        </div>
      )}

      {currentCelebration && (
        currentCelebration.type === 'level' ? (
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
        )
      )}

      <MasteryQuizModal
        isOpen={showDashboardQuiz}
        onClose={() => setShowDashboardQuiz(false)}
        procedure={activeQuizRequest?.procedure}
        user={user}
        quizData={activeQuizRequest?.quiz_data}
        masteryRequestId={activeQuizRequest?.id}
        onSuccess={(score, level) => {
           setToast({ message: `Examen terminé ! Score: ${score}%`, type: 'success' });
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
