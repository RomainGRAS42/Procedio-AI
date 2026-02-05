import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { User, Procedure, Suggestion, UserRole } from "../types";
import CustomToast from "../components/CustomToast";
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
    mastery: [] as { subject: string; A: number; fullMark: number }[]
  });

  // Sprint Hebdo (XP gagnée cette semaine)
  const [weeklyXP, setWeeklyXP] = useState(0);

  // Trend du moment
  const [trendProcedure, setTrendProcedure] = useState<Procedure | null>(null);

  // Stats dynamiques (Manager)
  const [managerKPIs, setManagerKPIs] = useState({
    searchGaps: 0,
    health: 0,
    usage: 0
  });
  
  // Cockpit Widgets State (Manager)
  const [missedOpportunities, setMissedOpportunities] = useState<{ term: string, count: number, trend: string }[]>([]);
  const [topContributors, setTopContributors] = useState<{ name: string, role: string, score: number, initial: string, color: string }[]>([]);
  const [healthData, setHealthData] = useState<{ name: string, id: string, value: number, color: string }[]>([]);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]);

  const stats = user.role === UserRole.MANAGER && viewMode === "team" ? [
    {
      label: "Opportunités Manquées",
      value: managerKPIs.searchGaps.toString(),
      icon: "fa-magnifying-glass-minus",
      color: managerKPIs.searchGaps > 0 ? "text-amber-600" : "text-slate-400",
      bg: managerKPIs.searchGaps > 0 ? "bg-amber-50" : "bg-slate-50",
      desc: "Recherches sans résultats",
      tooltipTitle: "Contenu non trouvé",
      tooltipDesc: "Nombre de fois où votre équipe a cherché une information qui n'existe pas encore. C'est votre priorité de rédaction."
    },
    {
      label: "Santé du Patrimoine",
      value: `${managerKPIs.health}%`,
      icon: "fa-heart-pulse",
      color: managerKPIs.health > 80 ? "text-emerald-600" : managerKPIs.health > 40 ? "text-amber-600" : "text-rose-600",
      bg: managerKPIs.health > 80 ? "bg-emerald-50" : managerKPIs.health > 40 ? "bg-amber-50" : "bg-rose-50",
      desc: "Procédures à jour",
      tooltipTitle: "Indice de fraîcheur",
      tooltipDesc: "Pourcentage de procédures créées ou mises à jour au cours des 6 derniers mois. Un score élevé garantit une info fiable."
    },
    {
      label: "Usage Documentaire",
      value: managerKPIs.usage.toString(),
      icon: "fa-chart-line",
      color: managerKPIs.usage > 0 ? "text-indigo-600" : "text-slate-400",
      bg: managerKPIs.usage > 0 ? "bg-indigo-50" : "bg-slate-50",
      desc: "Lectures cumulées",
      tooltipTitle: "Adoption de l'outil",
      tooltipDesc: "Nombre total de consultations réalisées par votre équipe. Mesure l'engagement global sur Procedio."
    }
  ] : [
    {
      label: "Niveau d'Expertise",
      value: `Niv. ${personalStats.level}`,
      icon: "fa-award",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      desc: `${personalStats.xp} XP total`,
      tooltipTitle: "Progression & Savoir",
      tooltipDesc: `Tu as accumulé ${personalStats.xp} XP à travers tes lectures (${personalStats.consultations} consultations) et tes contributions.`
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
      if (user.role === UserRole.MANAGER) {
        fetchSuggestions();
        fetchManagerKPIs();
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
        mastery: masteryData
      });
      setWeeklyXP((weeklyConsults || 0) * 5); // +5 XP par lecture
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
          pinecone_document_id: data.pinecone_document_id,
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
      // 1. Opportunités Manquées (Logs de recherches échouées)
      const { data: logData } = await supabase
        .from('notes')
        .select('title, created_at')
        .ilike('title', 'LOG_SEARCH_FAIL_%');

      let searchCount = 0;
      if (logData) {
        searchCount = logData.length;
        // Process Missed Opportunities for Widget
        const counts: Record<string, number> = {};
        logData.forEach(log => {
          const term = log.title?.replace('LOG_SEARCH_FAIL_', '').trim() || "Inconnu";
          counts[term] = (counts[term] || 0) + 1;
        });
        
        const sortedGaps = Object.entries(counts)
          .map(([term, count]) => ({ 
            term: term.length > 20 ? term.substring(0, 17) + '...' : term, 
            count, 
            trend: "récent" 
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4);
        
        setMissedOpportunities(sortedGaps.length > 0 ? sortedGaps : [
          { term: "Aucun manque détecté", count: 0, trend: "Stable" }
        ]);
      }

      // 2. Santé & Usage (depuis les procédures)
      const { data: procs } = await supabase
        .from('procedures')
        .select('*'); // Fetch all for accurate health calculation

      let totalViews = 0;
      let healthPct = 0;

      if (procs) {
        setAllProcedures(procs.map(p => ({ ...p, id: p.uuid }))); // Simple mapping
        totalViews = procs.reduce((acc, p) => acc + (p.views || 0), 0);
        
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const freshCount = procs.filter(p => new Date(p.updated_at || p.created_at) > sixMonthsAgo).length;
        healthPct = procs.length > 0 ? Math.round((freshCount / procs.length) * 100) : 0;

        // Calculate Health Chart Data
        let fresh = 0;
        let warning = 0;
        let obsolete = 0;

        procs.forEach(p => {
            const dateStr = p.updated_at || p.created_at;
            const date = new Date(dateStr);
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays < 90) fresh++;
            else if (diffDays < 180) warning++;
            else obsolete++;
        });

        setHealthData([
            { name: 'Fraîches', id: 'fresh', value: fresh, color: '#10b981' }, 
            { name: 'À vérifier', id: 'warning', value: warning, color: '#f59e0b' }, 
            { name: 'Obsolètes', id: 'obsolete', value: obsolete, color: '#ef4444' } 
        ]);
      }

      setManagerKPIs({
        searchGaps: searchCount || 0,
        health: healthPct,
        usage: totalViews
      });

      // 3. Top Contributors
      const { data: suggData } = await supabase
        .from('procedure_suggestions')
        .select(`
          user_id,
          user:user_profiles!user_id(first_name, last_name, role)
        `);

      if (suggData) {
        const contributors: Record<string, { count: number, name: string, role: string }> = {};
        suggData.forEach((s: any) => {
          if (!s.user_id) return;
          if (!contributors[s.user_id]) {
            contributors[s.user_id] = {
              count: 0,
              name: s.user ? `${s.user.first_name} ${s.user.last_name}` : "Anonyme",
              role: s.user?.role || "Technicien"
            };
          }
          contributors[s.user_id].count++;
        });

        const colors = ["bg-indigo-600", "bg-purple-600", "bg-blue-600"];
        const sortedContribs = Object.values(contributors)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((c, i) => ({
            name: c.name,
            role: c.role,
            score: c.count,
            initial: c.name.split(' ').map(n => n[0]).join('').toUpperCase() || "?",
            color: colors[i % colors.length]
          }));
        
        setTopContributors(sortedContribs.length > 0 ? sortedContribs : []);
      }

    } catch (err) {
      console.error("Erreur KPIs Manager:", err);
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
      const managerId = user.id;

      // 1. Update the suggestion record
      const { error: updateError } = await supabase
        .from("procedure_suggestions")
        .update({ 
          status, 
          manager_response: managerResponse,
          responded_at: now,
          manager_id: managerId
        })
        .eq("id", selectedSuggestion.id);

      if (updateError) throw updateError;

      // 🎮 GAMIFICATION : Gain d'XP pour le technicien si approuvé (+50 XP)
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
      }

      // 2. Create a notification response for the technician (UI sync)
      await supabase
        .from("suggestion_responses")
        .insert({
          suggestion_id: selectedSuggestion.id,
          user_id: selectedSuggestion.user_id,
          manager_id: managerId,
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
          user_id: managerId,
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
            pinecone_document_id: p.pinecone_document_id,
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
        setEditContent(data.content);
        setRequiresConfirmation(data.requires_confirmation || false);
        
        // Vérifier si l'utilisateur a déjà lu cette annonce de manière persistante
        const { data: readRecord } = await supabase
          .from("announcement_reads")
          .select("*")
          .eq("user_id", user.id)
          .eq("announcement_id", data.id)
          .maybeSingle();

        if (readRecord) {
          setIsRead(true);
        } else {
          setIsRead(false);
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
      const { error } = await supabase.from("team_announcements").insert([
        {
          content: editContent,
          author_name: user.firstName,
          author_initials: user.firstName.substring(0, 2).toUpperCase(),
          author_id: user.id,
          requires_confirmation: requiresConfirmation,
        },
      ]);

      if (error) throw error;

      setIsEditing(false);
      await fetchLatestAnnouncement();
      setIsRead(false);
    } catch (err) {
      alert("Erreur lors de l'enregistrement de l'annonce");
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
    <div className="space-y-10 animate-slide-up pb-12">
      <section className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl shadow-indigo-500/5 flex flex-col md:flex-row justify-between items-center gap-8">
        {/* Titre & Toggle de vue */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
              {new Date()
                .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                .toUpperCase()}
            </p>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
              Bonjour, <span className="text-indigo-600">{user.firstName}</span>
            </h1>
            <p className="text-slate-400 font-medium text-lg ml-1">
              {viewMode === "personal" 
                ? "Prêt à piloter tes propres missions aujourd'hui ?" 
                : "Prêt à simplifier le support IT de l'équipe aujourd'hui ?"
              }
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

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Colonne Gauche : Mastery Circle (ou Team Stats) */}
        <div className="flex-1 space-y-8">
          {viewMode === "personal" ? (
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
          ) : (
            <div className="space-y-6 w-full">
              {/* Widget 1: Health Chart */}
              <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
                 <div className="flex-1 min-h-[200px] w-full relative">
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={healthData}
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {healthData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <span className="block text-2xl font-black text-slate-800">{allProcedures.length}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Docs</span>
                        </div>
                    </div>
                 </div>
                 <div className="flex-1 space-y-3 w-full">
                    <h4 className="font-bold text-slate-900 text-sm mb-2">Santé du Patrimoine</h4>
                    {healthData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.name}</span>
                            </div>
                            <span className="text-xs font-black text-slate-700">{Math.round((item.value / (allProcedures.length || 1)) * 100)}%</span>
                        </div>
                    ))}
                 </div>
              </div>

              {/* Widget 2: Missed Opportunities Mini-Grid */}
              <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-900 text-sm">Manques Identifiés</h4>
                    <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">{missedOpportunities.length} sujets</span>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    {missedOpportunities.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-2xl p-3 border border-slate-100 hover:border-rose-200 transition-colors group cursor-pointer" onClick={onUploadClick}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[8px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded uppercase">{item.count} Ech.</span>
                            </div>
                            <p className="font-bold text-slate-700 text-xs line-clamp-2 leading-tight group-hover:text-rose-600 transition-colors">"{item.term}"</p>
                        </div>
                    ))}
                 </div>
                 {missedOpportunities.length > 0 && (
                     <button onClick={onUploadClick} className="w-full mt-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">
                        <i className="fa-solid fa-plus mr-2"></i> Combler un manque
                     </button>
                 )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section
          className={`relative border border-slate-100 rounded-[3rem] p-10 flex flex-col justify-between items-start gap-10 transition-all duration-500 ${
            isRead ? "bg-slate-50 opacity-60" : "bg-white shadow-xl shadow-indigo-500/5"
          }`}>
          {loadingAnnouncement ? (
            <div className="w-full py-10 flex items-center justify-center gap-4">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Récupération de l'annonce...
              </span>
            </div>
          ) : isEditing ? (
            <div className="w-full space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  Édition de l'annonce équipe
                </h4>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-rose-500 transition-colors">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <textarea
                className="w-full h-32 p-6 bg-slate-50 border-2 border-indigo-100 rounded-3xl focus:bg-white focus:border-indigo-500 outline-none resize-none font-bold text-slate-700 text-lg transition-all"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Écrivez votre message à l'équipe ici..."
              />
              <div className="flex items-center justify-between gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                    <i className={`fa-solid ${requiresConfirmation ? "fa-bell text-indigo-500" : "fa-bell-slash text-slate-300"}`}></i>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none">
                      Demander une confirmation de lecture
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 mt-1.5">
                      {requiresConfirmation ? "Exige un clic 'Lu et compris' du technicien" : "Message informatif simple sans validation"}
                    </span>
                  </div>
                  <button
                    onClick={() => setRequiresConfirmation(!requiresConfirmation)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-300 outline-none ml-2 ${
                      requiresConfirmation ? "bg-indigo-600 shadow-md shadow-indigo-100" : "bg-slate-200"
                    }`}>
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-300 transform ${
                      requiresConfirmation ? "translate-x-5" : "translate-x-0 shadow-sm"
                    }`} />
                  </button>
                </div>
                
                <button
                  onClick={handleSaveAnnouncement}
                  disabled={saving || !editContent.trim()}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 shadow-xl shadow-indigo-200 disabled:opacity-50 transition-all active:scale-95 group flex items-center gap-3">
                  {saving ? "Publication..." : "Publier l'annonce"}
                  <i className="fa-solid fa-paper-plane text-[8px] group-hover:translate-x-1 transition-transform"></i>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-6 w-full">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-xl border border-indigo-100">
                  {announcement?.author_initials || "??"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Annonce Équipe • Par {announcement?.author_name}
                    </h4>
                    {user.role === UserRole.MANAGER && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] font-black text-indigo-500 hover:text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-pen-to-square"></i> Modifier
                      </button>
                    )}
                  </div>
                  <p className="text-xl font-semibold leading-relaxed tracking-tight text-slate-700 mt-2">
                    "{announcement?.content}"
                  </p>
                </div>
              </div>
              <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest whitespace-nowrap">
                    Posté le{" "}
                    {announcement
                      ? new Date(announcement.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "..."}
                  </span>
                  {user.role === UserRole.TECHNICIAN && !isRead && announcement?.requires_confirmation && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50/50 rounded-lg border border-indigo-100/50 animate-fade-in">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest leading-none">
                        Le manager attend une confirmation de lecture
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  {!announcement?.requires_confirmation && !isRead && (
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
                      <i className="fa-solid fa-info-circle"></i> Information
                    </span>
                  )}
                  {user.role === UserRole.TECHNICIAN && !isRead && announcement?.requires_confirmation && (
                    <button
                      onClick={handleMarkAsRead}
                      className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 shadow-lg shadow-indigo-100 transition-all active:scale-95 group flex items-center gap-2">
                      <span>Lu et compris</span>
                      <i className="fa-solid fa-check text-[8px] transform group-hover:scale-125 transition-transform"></i>
                    </button>
                  )}
                  {isRead && (
                    <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                      <i className="fa-solid fa-circle-check"></i> Lu et notifié
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>



      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStats.map((stat, idx) => (
          <article
            key={idx}
            className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8 hover:shadow-md transition-all group relative overflow-visible">
            
            {(stat as any).tooltipTitle && (
              <div className="absolute top-6 right-6 group/tooltip">
                <i className="fa-solid fa-circle-info text-slate-200 hover:text-indigo-500 cursor-help transition-colors text-sm"></i>
                <div className="absolute bottom-full right-0 mb-3 w-56 p-4 bg-slate-900 text-white text-[10px] rounded-2xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-[100] pointer-events-none border border-white/10 backdrop-blur-md">
                  <p className="font-black mb-1 text-indigo-300 uppercase tracking-widest">{(stat as any).tooltipTitle}</p>
                  <p className="text-slate-300 leading-relaxed font-medium">{(stat as any).tooltipDesc}</p>
                  <div className="absolute top-full right-3 -translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900 border-r border-b border-white/10"></div>
                </div>
              </div>
            )}

            <div
              className={`w-20 h-20 rounded-3xl ${stat.bg} ${stat.color} flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
                {stat.value}
              </p>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">
                {stat.label}
              </h3>
              {stat.desc && (
                <p className="text-[9px] font-bold text-slate-300 mt-1 italic">
                  {stat.desc}
                </p>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Manager Specific Sections (Operational) */}
      {user.role === UserRole.MANAGER && (
        <div className="flex flex-col lg:flex-row gap-6 mb-12">
          {/* Left Column: Suggestions (70%) */}
          <div className="lg:w-[70%]">
            <section className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm overflow-hidden h-full">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-sm border border-indigo-100">
                  <i className="fa-solid fa-lightbulb"></i>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">Centre de Révision</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/50">
                      {pendingSuggestions.filter(s => s.status === 'pending').length} à traiter
                    </span>
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                      • {pendingSuggestions.length} au total
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {pendingSuggestions.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Priorité</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Auteur</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                        <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {pendingSuggestions.map((suggestion) => (
                        <tr key={suggestion.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                            {formatDate(suggestion.createdAt)}
                          </td>
                          <td className="p-4">
                            <span className="px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-slate-50 text-slate-400 border border-slate-100">
                              {suggestion.type === 'correction' ? 'Correction' :
                               suggestion.type === 'update' ? 'Mise à jour' : 'Ajout'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border ${
                              suggestion.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              suggestion.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                              'bg-slate-50 text-slate-400 border-slate-100'
                            }`}>
                              {suggestion.priority === 'high' ? 'Urgent' :
                               suggestion.priority === 'medium' ? 'Moyenne' : 'Basse'}
                            </span>
                          </td>
                          <td className="p-4 text-[11px] font-bold text-slate-600 truncate max-w-[100px]">
                            {suggestion.userName}
                          </td>
                          <td className="p-4">
                            <span className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${
                              suggestion.status === 'pending' ? 'text-indigo-600' :
                              suggestion.status === 'approved' ? 'text-emerald-500' :
                              'text-slate-400'
                            }`}>
                              <i className={`fa-solid ${
                                suggestion.status === 'pending' ? 'fa-clock animate-pulse' :
                                suggestion.status === 'approved' ? 'fa-circle-check' :
                                'fa-circle-xmark'
                              }`}></i>
                              {suggestion.status === 'pending' ? 'En attente' :
                               suggestion.status === 'approved' ? 'Validé' : 'Refusé'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => {
                                setSelectedSuggestion(suggestion);
                                setShowSuggestionModal(true);
                              }}
                              className="bg-indigo-600 text-white px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors shadow-sm active:scale-95 flex items-center gap-2 ml-auto shadow-indigo-100"
                            >
                              <i className="fa-regular fa-eye"></i> {suggestion.status === 'pending' ? 'Examiner' : 'Consulter'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-20 text-center text-slate-300 flex flex-col items-center gap-4">
                    <i className="fa-solid fa-check-double text-4xl opacity-20"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">Tout est à jour ! Aucune suggestion.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Activity Journal (30%) */}
          <div className="lg:w-[30%] space-y-6">
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
              <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em]">Dernières Activités</h3>
                </div>
                <button 
                  onClick={fetchActivities}
                  className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center">
                  <i className={`fa-solid fa-rotate-right text-[10px] ${loadingActivities ? 'animate-spin' : ''}`}></i>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto divide-y divide-slate-50 scrollbar-hide">
                {activities.length > 0 ? (
                  activities.map((act) => (
                    <div 
                      key={act.id}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] shrink-0">
                        <i className="fa-solid fa-circle-check"></i>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700 leading-tight">
                          {act.content}
                        </p>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter mt-1 block">
                          {new Date(act.created_at || act.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-300 px-6">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Aucune lecture enregistrée.</p>
                  </div>
                )}
              </div>
                
              <div className="p-4 bg-slate-50 border-t border-slate-50">
                <button 
                  onClick={onViewComplianceHistory}
                  className="w-full text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors py-2 border border-indigo-100 rounded-xl bg-white">
                  Voir tout l'historique
                </button>
              </div>
            </section>

             {/* Top Contributors Mini Widget */}
             <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center text-xs">
                        <i className="fa-solid fa-trophy"></i>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">Top Contributeurs</h3>
                 </div>
                 <div className="space-y-4">
                    {topContributors.length > 0 ? topContributors.slice(0, 3).map((contrib, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] text-white ${contrib.color} shadow-sm`}>
                                {contrib.initial}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-800 text-xs">{contrib.name}</p>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">{contrib.score} suggestions</p>
                            </div>
                            {i === 0 && <i className="fa-solid fa-crown text-amber-500 text-xs"></i>}
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-400 italic">Aucune donnée.</p>
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
      </div>

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
      <CustomToast
        message={toast?.message || ""}
        type={toast?.type || "info"}
        visible={!!toast}
        onClose={() => setToast(null)}
      />
    </div>
  );
};

export default Dashboard;
