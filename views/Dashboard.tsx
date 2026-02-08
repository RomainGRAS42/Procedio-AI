import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { User, Procedure, Suggestion, UserRole } from "../types";
import CustomToast from "../components/CustomToast";
import InfoTooltip from "../components/InfoTooltip";
import { supabase } from "../lib/supabase";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewHistory: () => void;
  onViewComplianceHistory: () => void;
  targetAction?: { type: 'suggestion' | 'read', id: string } | null;
  onActionHandled?: () => void;
  onUploadClick: () => void;
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
  onViewHistory,
  onViewComplianceHistory,
  targetAction,
  onActionHandled,
  onUploadClick,
}) => {
  console.log("DEBUG: Dashboard User Object:", { id: user?.id, role: user?.role });
  const [isRead, setIsRead] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [managerResponse, setManagerResponse] = useState("");

  const [recentProcedures, setRecentProcedures] = useState<Procedure[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(true);

  // Suggestions (Manager Only)
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  // Activities
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);



  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);


  
  // Referent System
  const [isReferent, setIsReferent] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<Procedure[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Mastery Claims (Manager Only)
  const [masteryClaims, setMasteryClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);






  // État de la vue (Personnel vs Équipe) - Initialisé selon le rôle
  const [viewMode, setViewMode] = useState<"personal" | "team">(user.role === UserRole.MANAGER ? "team" : "personal");

  // Force update if role changes (though unlikely in session)
  useEffect(() => {
    setViewMode(user.role === UserRole.MANAGER ? "team" : "personal");
  }, [user.role]);

  // Stats personnelles
  const [personalStats, setPersonalStats] = useState({
    consultations: 0,
    suggestions: 0,
    notes: 0,
    xp: 0,
    level: 1,
    mastery: [] as { subject: string; A: number; fullMark: number }[],
  });


  // Sprint Hebdo (XP gagnée cette semaine)
  const [weeklyXP, setWeeklyXP] = useState(0);

  // Trend du moment
  const [trendProcedure, setTrendProcedure] = useState<Procedure | null>(null);

  // Stats dynamiques (Manager)
  const [managerKPIs, setManagerKPIs] = useState({
    searchGaps: 0,
    health: 0,
    usage: 0,
    redZone: 0
  });
  
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

      if (user.role === UserRole.MANAGER) {
        fetchSuggestions();
        fetchManagerKPIs();
        fetchMasteryClaims();
      }

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

      setPersonalStats({
        consultations: consultCount || 0,
        suggestions: suggCount || 0,
        notes: realNotesCount,
        xp: profile?.xp_points || 0,
        level: profile?.level || 1,
        mastery: masteryData,
      });
      setWeeklyXP((weeklyConsults || 0) * 5); // +5 XP par lecture

      // Fetch badges for personal view


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
      // 1. Calculate Search Gaps Count
      const { count: searchCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .ilike('title', 'LOG_SEARCH_FAIL_%');

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
      const { count: totalProcsCount } = await supabase.from('procedures').select('*', { count: 'exact', head: true });
      
      const referentSet = new Set(referents?.map(r => r.procedure_id) || []);
      // Approximation for Red Zone if we don't fetch all IDs. 
      // Ideally we fetch all IDs to compare. 
      const { data: allIds } = await supabase.from('procedures').select('uuid');
      const redZoneCount = allIds?.filter(p => !referentSet.has(p.uuid)).length || 0;

      setManagerKPIs({
        searchGaps: searchCount || 0,
        health: healthPct,
        usage: totalViews,
        redZone: redZoneCount
      });

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
      if (data) setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingActivities(false);
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
        setPendingSuggestions(
          data.map((item: any) => ({
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
          }))
        );
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

      // 🎮 GAMIFICATION : Gain d'XP pour l'auteur (+50 XP) si approuvé
      if (status === 'approved') {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('xp_points')
          .eq('id', selectedSuggestion.user_id)
          .single();
        
        if (profile) {
          const newXP = (profile.xp_points || 0) + 50;
          await supabase
            .from('user_profiles')
            .update({ 
              xp_points: newXP, 
              level: Math.floor(newXP / 100) + 1 
            })
            .eq('id', selectedSuggestion.user_id);
        }

        // 🎮 GAMIFICATION : Gain d'XP pour le RÉFÉRENT (+20 XP) sil a fait la revue
        if (isReferentUser) {
           const { data: refProfile } = await supabase
            .from('user_profiles')
            .select('xp_points')
            .eq('id', user.id)
            .single();
          
          if (refProfile) {
            const newRefXP = (refProfile.xp_points || 0) + 20;
            await supabase
              .from('user_profiles')
              .update({ 
                xp_points: newRefXP, 
                level: Math.floor(newRefXP / 100) + 1 
              })
              .eq('id', user.id);
            
            setToast({ message: "Revue validée ! +20 XP gagnés.", type: "success" });
          }
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
        setRecentProcedures(
          data.map((p) => ({
            id: p.uuid,
            db_id: p.uuid,
            file_id: p.file_id || p.uuid,
            title: p.title || "Sans titre",
            category: p.Type || "GÉNÉRAL",
            fileUrl: p.file_url,
            createdAt: p.created_at,
            views: p.views || 0,
            status: p.status || "validated",
          }))
        );
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
    <div className="space-y-6 animate-slide-up pb-12">
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
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-sm border border-indigo-100">
                  {announcement?.author_initials || "??"}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Message • {announcement?.author_name}</span>
                       <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                       <span className="text-[9px] font-bold text-slate-300 uppercase">
                         {announcement ? new Date(announcement.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}
                       </span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 leading-snug">"{announcement?.content}"</p>
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

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Colonne Gauche : Mastery Circle (ou Team Stats) */}
        <div className="flex-1 space-y-8">
          {viewMode === "personal" ? (
            <div className="space-y-8">
              {/* Expert Review Section (Referents only) */}
              {isReferent && pendingReviews.length > 0 && (
                <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group border border-indigo-500/20">
                  <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                    <i className="fa-solid fa-user-shield text-[12rem] rotate-12"></i>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 backdrop-blur-md flex items-center justify-center text-2xl border border-indigo-400/30 text-indigo-400">
                          <i className="fa-solid fa-microscope"></i>
                        </div>
                        <div>
                          <h2 className="text-2xl font-black tracking-tight uppercase">Revues d'Expert</h2>
                          <p className="text-indigo-400/80 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                             {pendingReviews.length} procédure{pendingReviews.length > 1 ? 's' : ''} à valider
                          </p>
                        </div>
                      </div>
                      <span className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 animate-pulse">
                        Savoir Délégué
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingReviews.slice(0, 2).map((proc) => (
                        <div 
                          key={proc.id}
                          onClick={() => onSelectProcedure(proc)}
                          className="bg-white/5 hover:bg-white/10 backdrop-blur-sm p-6 rounded-[2rem] border border-white/5 hover:border-indigo-500/50 transition-all cursor-pointer group/item"
                        >
                          <div className="flex items-center justify-between mb-3">
                             <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black text-xs">
                                {proc.title.substring(0, 2).toUpperCase()}
                             </div>
                             <i className="fa-solid fa-chevron-right text-white/20 group-hover/item:text-indigo-400 group-hover/item:translate-x-1 transition-all"></i>
                          </div>
                          <h4 className="font-bold text-white text-sm mb-1 group-hover/item:text-indigo-300 transition-colors truncate">{proc.title}</h4>
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{proc.category}</p>
                        </div>
                      ))}
                    </div>

                    {pendingReviews.length > 2 && (
                      <button className="mt-6 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors flex items-center gap-2">
                         Voir toutes les revues
                         <i className="fa-solid fa-arrow-right"></i>
                      </button>
                    )}
                  </div>
                </section>
              )}


              {/* Cercle de Maîtrise - Reservé aux techniciens */}
              {user.role === UserRole.TECHNICIAN && (
                <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-10">

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                    <i className="fa-solid fa-circle-nodes"></i>
                  </div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">Cercle de Maîtrise</h3>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Visualise l'évolution de ton expertise. Plus tu consultes de procédures dans une catégorie, plus ta zone de maîtrise s'étend.
                </p>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">XP Restant</span>
                    <span className="text-lg font-bold text-indigo-600">{(personalStats.level * 100) - personalStats.xp} pts</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Niveau Suivant</span>
                    <span className="text-lg font-bold text-slate-700">Niv. {personalStats.level + 1}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setToast({ message: "Fonctionnalité de réclamation à venir : Contactez votre manager pour valider une maîtrise !", type: "info" })}
                  className="w-full mt-6 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-3 group"
                >
                  <i className="fa-solid fa-medal group-hover:rotate-12 transition-transform"></i>
                  Réclamer une Maîtrise
                </button>
              </div>

              <div className="w-full md:w-[300px] h-[300px] flex items-center justify-center bg-slate-50/50 rounded-[2.5rem] p-4">
                {personalStats.mastery.length > 2 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={personalStats.mastery}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                      <Radar
                        name="Maîtrise"
                        dataKey="A"
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center p-8 space-y-3">
                    <i className="fa-solid fa-chart-pie text-3xl text-slate-200"></i>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Continue tes consultations pour générer ton radar de compétences !</p>
                  </div>
                )}
              </div>
            </section>
              )}
              </div>
            ) : null }
      </div>
      </div>

          {/* Manager Team View */}
          {user.role === UserRole.MANAGER && viewMode === "team" && (
            <div className="space-y-6 animate-fade-in">
              
                {/* ZONE 1: KPIs Flash */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group relative overflow-hidden">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                         <InfoTooltip text={
                            stat.label === "Procédures" ? "Total des documents actifs" : 
                            stat.label === "Vues Hebdo" ? "Consultations sur 7 jours" : 
                            "Moyenne des notes utilisateurs"
                         } />
                      </div>
                      <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center text-xl`}>
                        <i className={`fa-solid ${stat.icon}`}></i>
                      </div>
                    <div>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ZONE 2: Centre de Révision & Activité */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 
                 {/* COL 1: Centre de Révision */}
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden h-full min-h-[400px]">
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
                                  onViewHistory(); // Temporary link or handle
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
                              <div className="flex items-center gap-3 overflow-hidden">
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
 
                 {/* COL 2: Activité Récente */}
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden h-full min-h-[400px]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
                           Activité Récente
                           <InfoTooltip text="Surveillez les dernières actions de l'équipe en temps réel." />
                        </h3>
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
              </div>

            </div>
          )}
          







      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <h3 className="font-black text-slate-900 text-xl tracking-tight">Procédure mise en ligne</h3>
          <button
            onClick={onViewHistory}
            className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">
            Tout voir
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {loadingProcedures ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Chargement des fichiers...
              </p>
            </div>
          ) : recentProcedures.length > 0 ? (
            recentProcedures.map((proc) => (
              <a
                key={proc.id}
                href={`/procedure/${proc.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectProcedure(proc);
                }}
                className="p-10 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all group">
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 bg-white border border-slate-100 text-slate-300 rounded-2xl flex items-center justify-center group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                    <i className="fa-solid fa-file-pdf text-2xl"></i>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 text-xl group-hover:text-indigo-600 transition-colors leading-tight">
                      {proc.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-3 py-1 rounded-lg">
                        {proc.category}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-black tracking-widest uppercase bg-indigo-50 px-3 py-1 rounded-lg flex items-center gap-2">
                        <i className="fa-solid fa-calendar-check"></i>
                        {formatDate(proc.createdAt)}
                      </span>
                      <span className="text-[10px] text-emerald-500 font-black tracking-widest uppercase bg-emerald-50 px-3 py-1 rounded-lg flex items-center gap-2">
                        <i className="fa-solid fa-eye"></i>
                        {proc.views} vues
                      </span>
                    </div>
                  </div>
                </div>
                <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all"></i>
              </a>
            ))
          ) : (
            <div className="p-20 text-center text-slate-300 flex flex-col items-center gap-4">
              <i className="fa-solid fa-folder-open text-4xl opacity-20"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">
                Aucune activité récente détectée
              </p>
            </div>
          )}
        </div>
      </section>


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


    </div>
  );
};

export default Dashboard;
