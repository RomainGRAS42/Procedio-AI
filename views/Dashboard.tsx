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
  onViewHistory: () => void;
  onSelectProcedure: (proc: Procedure) => void;
  onUploadClick: () => void;
  targetAction?: { type: string; id: string };
  onActionHandled?: () => void;
  onViewComplianceHistory?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  user, 
  onQuickNote, 
  onViewHistory, 
  onSelectProcedure, 
  onUploadClick,
  targetAction,
  onActionHandled,
  onViewComplianceHistory
}) => {
  const [viewMode, setViewMode] = useState<"personal" | "team">("personal");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  // États
  const [recentProcedures, setRecentProcedures] = useState<Procedure[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(true);
  
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [managerResponse, setManagerResponse] = useState("");

  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Manager Stats (KPIs)
  const [stats, setStats] = useState([
    { label: "Procédures", value: 0, icon: "fa-file-lines", color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Vues Hebdo", value: 0, icon: "fa-eye", color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Satisfaction", value: "0%", icon: "fa-heart", color: "text-rose-600", bg: "bg-rose-50" },
  ]);

  const [managerKPIs, setManagerKPIs] = useState({
    searchGaps: 0,
    health: 0,
    usage: 0,
    redZone: 0
  });

  // Referent Review Logic
  const [pendingReviews, setPendingReviews] = useState<Procedure[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const isReferent = user.role === UserRole.TECHNICIAN; // Assuming techs can be referents

  // Mastery Claims (Manager only)
  const [masteryClaims, setMasteryClaims] = useState<any[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);

  // Annonces
  const [announcement, setAnnouncement] = useState<any>(null);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [isRead, setIsRead] = useState(false);

  useEffect(() => {
    if (user.role === UserRole.MANAGER) {
      setViewMode("team"); 
    } else {
      setViewMode("personal");
    }
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

  useEffect(() => {
    fetchRecentProcedures();
    fetchSuggestions();
    fetchActivities(); 
    fetchLatestAnnouncement();
    fetchTrendProcedure();

    if (user.role === UserRole.MANAGER) {
      fetchManagerKPIs();
      fetchMasteryClaims();
    } else {
      fetchPersonalStats();
      fetchWeeklyStats();
    }
    // Always fetch workload as managers can be referents too
    fetchReferentWorkload();
  }, [user.role]);

  // UseEffect pour rafraîchir les stats KPIs Team visualisables (legacy stats array)
  useEffect(() => {
    if (user.role === UserRole.MANAGER) {
      setStats([
        { label: "Procédures", value: managerKPIs.usage, icon: "fa-file-lines", color: "text-indigo-600", bg: "bg-indigo-50" }, // Using usage as placeholder count
        { label: "Vues Hebdo", value: managerKPIs.usage, icon: "fa-eye", color: "text-emerald-600", bg: "bg-emerald-50" }, // Placeholder
        { label: "Satisfaction", value: `${managerKPIs.health}%`, icon: "fa-heart", color: "text-rose-600", bg: "bg-rose-50" },
      ]);
    }
  }, [managerKPIs, user.role]);

  const fetchWeeklyStats = async () => {
    // Calcul de l'XP de la semaine (basé sur logs ou autre)
    // Placeholder logic
    setWeeklyXP(0);
  };

  const fetchPersonalStats = async () => {
    try {
      // 1. Consultations (Vues)
      const { count: consultCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('title', 'LOG_READ_%');

      // 2. Suggestions
      const { count: suggCount } = await supabase
        .from('procedure_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // 3. Notes Perso
      const { count: notesCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('tags', 'ov', '{SUGGESTION}') 
        .not('title', 'like', 'LOG_%');

      // Filtrer les logs systÃ¨mes caches
      const { data: realNotes } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', user.id)
        .not('title', 'ilike', 'LOG_%')
        .not('title', 'ilike', 'CLAIM_%');
      
      const realNotesCount = realNotes?.length || 0;

      // 4. XP & Level (Profile)
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('xp_points, level')
        .eq('id', user.id)
        .single();
      
      // 5. Mastery (Radar Data) - Mock based on Categories viewed
      const { data: views } = await supabase
        .from('notes') // Assuming logs are in notes
        .select('content') // Content often contains Proc Title or ID
        .eq('user_id', user.id)
        .ilike('title', 'LOG_READ_%');
      
      // Since we don't have direct category link in logs easily without join, 
      // we'll fetch profile mastery json if exists, or compute mock
      // UPDATE: We do not have a mastery JSON column. We'll standard mock for now or fetch procedures.
      
      const masteryData = [
         { subject: 'Logiciel', A: 65, fullMark: 100 },
         { subject: 'RH', A: 30, fullMark: 100 },
         { subject: 'SÃ©curitÃ©', A: 80, fullMark: 100 },
         { subject: 'Infrastr.', A: 45, fullMark: 100 },
         { subject: 'Juridique', A: 20, fullMark: 100 },
         { subject: 'Finance', A: 50, fullMark: 100 },
      ];

      // Weekly Consults
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { count: weeklyConsults } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('title', 'LOG_READ_%')
        .gt('created_at', oneWeekAgo.toISOString());

      setPersonalStats({
        consultations: consultCount || 0,
        suggestions: suggCount || 0,
        notes: realNotesCount,
        xp: profile?.xp_points || 0,
        level: profile?.level || 1,
        mastery: masteryData,
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
      
      const referentSet = new Set(referents?.map(r => r.procedure_id) || []);
      // Approximation for Red Zone if we don't fetch all IDs. 
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
          .eq('status', 'draft') 
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
    let sugg = pendingSuggestions.find(s => String(s.id) === String(id));
    
    if (!sugg) {
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

        if (error) throw error;

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
        console.error("Dashboard: Error fetching suggestion:", err);
      }
    }

    if (!sugg) {
       // Fallback
      sugg = {
        id,
        content: "Détail introuvable.",
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
        .limit(10);
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
        .select(`
          id, suggestion, type, priority, created_at, status, user_id, procedure_id, manager_response, responded_at,
          user:user_profiles!user_id(first_name, last_name, avatar_url),
          procedure:procedures!procedure_id(title)
        `)
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
      setToast({ message: "Veuillez fournir une réponse au technicien.", type: "error" });
      return;
    }

    try {
      const now = new Date().toISOString();
      const isReferentUser = user.role === UserRole.TECHNICIAN;

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

      // XP Logic reused (simplified sync)
       if (status === 'approved') {
        const { data: profile } = await supabase.from('user_profiles').select('xp_points').eq('id', selectedSuggestion.user_id).single();
        if (profile) {
           const newXP = (profile.xp_points || 0) + 50;
           await supabase.from('user_profiles').update({ xp_points: newXP, level: Math.floor(newXP / 100) + 1 }).eq('id', selectedSuggestion.user_id);
        }
        if (isReferentUser) {
           const { data: refProfile } = await supabase.from('user_profiles').select('xp_points').eq('id', user.id).single();
           if (refProfile) {
             const newRefXP = (refProfile.xp_points || 0) + 20;
             await supabase.from('user_profiles').update({ xp_points: newRefXP, level: Math.floor(newRefXP / 100) + 1 }).eq('id', user.id);
             setToast({ message: "Revue validée ! +20 XP gagnés.", type: "success" });
           }
        }
      }

      // Notification Response
      await supabase.from("suggestion_responses").insert({
          suggestion_id: selectedSuggestion.id,
          user_id: selectedSuggestion.user_id,
          manager_id: !isReferentUser ? user.id : null,
          status,
          manager_response: managerResponse,
          procedure_title: selectedSuggestion.procedureTitle,
          suggestion_content: selectedSuggestion.content,
          read: false
      });

      // Update Local
      setPendingSuggestions((prev) => prev.map((s) => s.id === selectedSuggestion.id ? { ...s, status, managerResponse: managerResponse, respondedAt: now } : s));
      setToast({ message: status === 'approved' ? "Suggestion validée !" : "Suggestion refusée.", type: "info" });
      setShowSuggestionModal(false);
      setSelectedSuggestion(null);
      setManagerResponse("");

      // Log
       await supabase.from("notes").insert([{
          title: `SUGGESTION_${status.toUpperCase()}`,
          content: `Suggestion sur "${selectedSuggestion.procedureTitle}" ${status === "approved" ? "validée" : "refusée"} par ${user.firstName}.`,
          is_protected: false,
          user_id: user.id,
          tags: ["SUGGESTION", status.toUpperCase()],
       }]);

    } catch (err) {
      console.error("Error updating suggestion:", err);
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
        .limit(10);

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
      const { data } = await supabase
        .from("team_announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setAnnouncement(data);
        setRequiresConfirmation(data.requires_confirmation || false);
        const { data: readRecord } = await supabase.from("announcement_reads").select("message_manager, read_at").eq("user_id", user.id).eq("announcement_id", data.id).maybeSingle();
        if (readRecord) {
          setManagerMessage(readRecord.message_manager);
          setEditContent(readRecord.message_manager || data.content);
          setIsRead(!!readRecord.read_at);
        } else {
          setIsRead(false);
          setManagerMessage(null);
          setEditContent(data.content);
        }
      } else {
         // Default
         setAnnouncement({ id: "default", content: "Bienvenue sur Procedio.", author_name: "Système", author_initials: "SY", created_at: new Date().toISOString() });
         setEditContent("Bienvenue sur Procedio.");
      }
    } catch (err) {
      // ignore
    } finally {
      setLoadingAnnouncement(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const announcementData = {
        content: editContent,
        author_name: user.firstName,
        author_initials: user.firstName.substring(0, 2).toUpperCase(),
        author_id: user.id,
        requires_confirmation: requiresConfirmation,
      };
      await supabase.from("team_announcements").insert([announcementData]);
      setToast({ message: "Annonce publiée !", type: "success" });
      setIsEditing(false);
      await fetchLatestAnnouncement();
    } catch (err) {
      setToast({ message: "Erreur publication.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!announcement) return;
    setIsRead(true);
    try {
      await supabase.from("announcement_reads").upsert({
        user_id: user.id,
        announcement_id: announcement.id,
        read_at: new Date().toISOString()
      }, { onConflict: 'user_id,announcement_id' });
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "En attente...";
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const toggleTrend = async (e: React.MouseEvent, proc: Procedure) => {
    e.preventDefault();
    e.stopPropagation();
    const newTrendStatus = !proc.is_trend;
    try {
      await supabase.from('procedures').update({ is_trend: newTrendStatus }).eq('uuid', proc.id);
      setRecentProcedures(prev => prev.map(p => p.id === proc.id ? { ...p, is_trend: newTrendStatus } : p));
      setToast({ message: "Trend mis à jour", type: "success" });
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] overflow-hidden gap-4 pb-4 animate-fade-in relative">
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} visible={!!toast} />}
      
      {/* HEADER & STATS (Fixed Height) */}
      <div className="shrink-0 space-y-4 px-4 pt-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Bonjour, {user.firstName}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {user.role === UserRole.MANAGER ? 'Pilotage & Supervision' : 'Espace Opérationnel'}
            </p>
          </div>
          <div className="flex gap-2">
             <button onClick={onQuickNote} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-200 active:scale-95 flex items-center gap-2">
                <i className="fa-solid fa-plus"></i>
                <span className="hidden sm:inline">Note Rapide</span>
             </button>
             {user.role === UserRole.MANAGER && (
               <button onClick={onUploadClick} className="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2">
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                  <span className="hidden sm:inline">Importer</span>
               </button>
             )}
          </div>
        </div>

        {/* COMPACT ANNOUNCEMENT */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
             <i className="fa-solid fa-bullhorn text-6xl -rotate-12"></i>
          </div>
          
          {loadingAnnouncement ? (
             <div className="animate-pulse flex gap-4 items-center">
                <div className="w-8 h-8 bg-white/10 rounded-lg"></div>
                <div className="h-2 bg-white/10 rounded w-1/3"></div>
             </div>
          ) : isEditing ? (
             <div className="relative z-10 flex gap-2">
                <input 
                  type="text" 
                  value={editContent} 
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-1 text-xs text-white placeholder-white/30 outline-none focus:bg-white/20 transition-all"
                  placeholder="Votre annonce..."
                  autoFocus
                />
                <button 
                  onClick={handleSaveAnnouncement}
                  disabled={saving}
                  className="bg-white text-indigo-900 px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50"
                >
                  {saving ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-check"></i>}
                </button>
                 <button 
                  onClick={() => setIsEditing(false)}
                  className="bg-white/10 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-white/20 transition-colors"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
             </div>
          ) : (
             <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-indigo-300 border border-white/5">
                      <i className="fa-solid fa-rss text-xs"></i>
                   </div>
                   <div>
                      <p className="text-xs font-medium text-indigo-100/80 uppercase tracking-widest text-[9px]">Flash Info • {announcement?.author_name}</p>
                      <p className="text-sm font-bold text-white leading-none mt-0.5 line-clamp-1">{announcement?.content || "Aucune annonce pour le moment."}</p>
                   </div>
                </div>
                {user.role === UserRole.MANAGER && (
                    <button onClick={() => setIsEditing(true)} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-all flex items-center justify-center">
                        <i className="fa-solid fa-pen text-[10px]"></i>
                    </button>
                )}
             </div>
          )}
        </section>
      </div>

      {/* MANAGER TEAM VIEW (NO SCROLL INTERNALLY HANDLED) */}
      {user.role === UserRole.MANAGER && viewMode === "team" && (
        <div className="flex flex-col flex-1 min-h-0 gap-4 px-4 pb-2">
            {/* ZONE 1: KPIs Flash (Compact) */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              {stats.map((stat, idx) => (
                <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 group relative overflow-hidden">
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                     <InfoTooltip text={
                        stat.label === "Procédures" ? "Total des documents actifs" : 
                        stat.label === "Vues Hebdo" ? "Consultations sur 7 jours" : 
                        "Moyenne des notes utilisateurs"
                     } />
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center text-sm shrink-0`}>
                    <i className={`fa-solid ${stat.icon}`}></i>
                  </div>
                <div>
                  <p className="text-lg font-black text-slate-900 tracking-tighter leading-none">{stat.value}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ZONE 2: Centre de Révision & Activité (FILL HEIGHT) */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
             
             {/* COL 1: Centre de Révision */}
             <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
            {/* TABS / HEADER */}
            <div className="flex items-center gap-2 mb-4">
               <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <i className="fa-solid fa-list-check"></i>
               </div>
               <h3 className="font-bold text-slate-900">Centre de Révision</h3>
               {(pendingSuggestions.length > 0 || pendingReviews.length > 0 || masteryClaims.length > 0) && (
                  <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {pendingSuggestions.length + pendingReviews.length + masteryClaims.length}
                  </span>
               )}
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
               {/* 1. MASTERY CLAIMS */}
               {masteryClaims.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Requêtes d'Expertise</h4>
                    {masteryClaims.map((claim) => (
                      <div key={claim.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all cursor-pointer group" onClick={() => {
                        // Handle Claim
                      }}>
                         <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                               <img src={claim.user_profiles?.avatar_url || `https://ui-avatars.com/api/?name=${claim.user_profiles?.first_name}+${claim.user_profiles?.last_name}&background=random`} className="w-6 h-6 rounded-full" />
                               <div>
                                  <p className="text-xs font-bold text-slate-900">{claim.user_profiles?.first_name} {claim.user_profiles?.last_name}</p>
                                  <p className="text-[10px] text-slate-500">Prétend à l'expertise sur <span className="text-indigo-600 font-bold">{claim.procedures?.title}</span></p>
                               </div>
                            </div>
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                         </div>
                      </div>
                    ))}
                  </div>
               )}

               {/* 2. PROCEDURE REVIEWS (VALIDATIONS) - NOW VISIBLE FOR MANAGERS */}
               {pendingReviews.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Validations en Attente</h4>
                    {pendingReviews.map((proc) => (
                      <div key={proc.id} onClick={() => onViewComplianceHistory && onViewComplianceHistory()} className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                         <div className="flex justify-between items-start mb-1">
                            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded">À Valider</span>
                            <span className="text-[10px] text-slate-400">{formatDate(proc.createdAt)}</span>
                         </div>
                         <h4 className="font-bold text-sm text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors mb-1">
                            {proc.title}
                         </h4>
                         <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <i className="fa-solid fa-folder-open"></i>
                            {proc.category}
                         </div>
                      </div>
                    ))}
                  </div>
               )}

               {/* 3. SUGGESTIONS */}
               {pendingSuggestions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Suggestions Terrain</h4>
                    {pendingSuggestions.map((sugg) => (
                      <div key={sugg.id} onClick={() => openSuggestionById(sugg.id)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-1">
                           <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${sugg.priority === 'high' ? 'bg-rose-500' : 'bg-amber-400'}`}></span>
                              <span className="text-[10px] font-bold text-slate-600 uppercase">{sugg.type}</span>
                           </div>
                           <span className="text-[10px] text-slate-400">{formatDate(sugg.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 mb-2 group-hover:text-slate-900 transition-colors">
                           {sugg.content}
                        </p>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                           <div className="flex items-center gap-1">
                              <i className="fa-solid fa-file-lines text-[10px] text-slate-300"></i>
                              <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">{sugg.procedureTitle}</span>
                           </div>
                           <div className="flex items-center gap-1">
                              <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700">
                                 {sugg.userName.charAt(0)}
                              </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
               )}

               {pendingSuggestions.length === 0 && pendingReviews.length === 0 && masteryClaims.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                     <i className="fa-solid fa-check-circle text-4xl mb-2 opacity-20"></i>
                     <p className="text-xs font-bold uppercase tracking-widest">Tout est à jour</p>
                  </div>
               )}
            </div>
             </div>

             {/* COL 2: Activité Récente */}
             <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
            {/* TABS / HEADER */}
            <div className="flex items-center gap-2 mb-4">
               <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <i className="fa-solid fa-bolt"></i>
               </div>
               <h3 className="font-bold text-slate-900">Activité Récente</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
               {/* 1. FLUX D'ACTIVITÉ */}
               {activities.length > 0 ? activities.map((act) => (
                  <div key={act.id} className="flex gap-3 items-start group">
                     <div className="mt-1 w-2 h-2 rounded-full bg-slate-200 group-hover:bg-indigo-500 transition-colors shrink-0"></div>
                     <div>
                        <p className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                           <span className="font-bold text-slate-900">Système</span> : {act.title.replace('LOG_', '')}
                        </p>
                        <p className="text-[10px] text-slate-400">{formatDate(act.created_at)}</p>
                     </div>
                  </div>
               )) : (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-300 border-b border-slate-50 mb-4">
                     <i className="fa-solid fa-ghost text-2xl mb-2 opacity-20"></i>
                     <p className="text-[10px] font-bold uppercase tracking-widest">Calme plat...</p>
                  </div>
               )}

               {/* 2. PROCEDURES RÉCENTES (Pour combler le vide manager) */}
               {recentProcedures.length > 0 && (
                  <div className="pt-4 mt-4 border-t border-dashed border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <i className="fa-solid fa-clock-rotate-left"></i> Derniers ajouts
                      </h4>
                      <div className="space-y-2">
                         {recentProcedures.slice(0, 5).map(proc => (
                            <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                               <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm group-hover:text-indigo-600 transition-all">
                                  <i className={`fa-solid ${proc.category === 'RH' ? 'fa-users' : proc.category === 'TECH' ? 'fa-microchip' : 'fa-file-lines'}`}></i>
                               </div>
                               <div className="flex-1 min-w-0">
                                  <h5 className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">{proc.title}</h5>
                                  <p className="text-[10px] text-slate-400">{formatDate(proc.createdAt)}</p>
                               </div>
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

      {/* PERSONAL VIEW (Container Scroll) */}
      {(viewMode === "personal" || user.role !== UserRole.MANAGER) && (
         <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-6 scrollbar-hide">
            
            {/* L'éclair du Trend */}
            {trendProcedure && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-200/5 to-transparent p-6 rounded-[2.5rem] border border-amber-200/50 flex items-center justify-between gap-6 group hover:border-amber-400 transition-all cursor-pointer shadow-sm shadow-amber-100/20"
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
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-amber-500 group-hover:border-amber-300 transition-all">
                   <i className="fa-solid fa-arrow-right"></i>
                </div>
              </div>
            )}

            {/* Expert Review Section (Referents only) */}
            {isReferent && pendingReviews.length > 0 && (
                <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden group border border-indigo-500/20">
                   <div className="flex items-center justify-between mb-8 relative z-10">
                      <h2 className="text-xl font-black tracking-tight uppercase">Revues d'Expert ({pendingReviews.length})</h2>
                      <span className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 animate-pulse">Action Requise</span>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                      {pendingReviews.slice(0, 4).map((proc) => (
                        <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="bg-white/5 hover:bg-white/10 p-4 rounded-2xl cursor-pointer">
                           <h4 className="font-bold text-white text-sm mb-1">{proc.title}</h4>
                           <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{proc.category}</p>
                        </div>
                      ))}
                   </div>
                </section>
            )}

            {/* Recent Procedures List */}
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
             <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
               <h3 className="font-black text-slate-900 text-xl tracking-tight">Procédure mise en ligne</h3>
             </div>
             <div className="divide-y divide-slate-50">
               {loadingProcedures ? (
                 <div className="p-10 text-center"><i className="fa-solid fa-spinner animate-spin"></i></div>
               ) : recentProcedures.length > 0 ? (
                 recentProcedures.map((proc) => (
                   <div key={proc.id} onClick={() => onSelectProcedure(proc)} className="p-6 flex items-center justify-between hover:bg-slate-50 cursor-pointer group">
                      <div className="flex items-center gap-6">
                         <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-indigo-600 transition-colors"><i className="fa-solid fa-file-pdf"></i></div>
                         <div>
                            <h4 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{proc.title}</h4>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{proc.category} • {formatDate(proc.createdAt)}</span>
                         </div>
                      </div>
                      <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 transition-colors"></i>
                   </div>
                 ))
               ) : (
                 <div className="p-10 text-center text-slate-300">Aucune procédure récente</div>
               )}
             </div>
            </section>
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
                className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                Fermer
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
