import { useState, useEffect, useCallback } from "react";
import { User, UserRole, Suggestion } from "../types";
import { supabase } from "../lib/supabase";

export const useNotifications = (user: User) => {
  const [readLogs, setReadLogs] = useState<any[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [suggestionResponses, setSuggestionResponses] = useState<any[]>([]);
  const [flashNoteNotifications, setFlashNoteNotifications] = useState<any[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);

  const fetchPendingSuggestions = useCallback(async () => {
    try {
      let query = supabase
        .from("procedure_suggestions")
        .select(`
          id, suggestion, created_at, user_id, procedure_id, status, viewed,
          user_profiles:user_id (first_name, last_name, email),
          procedures:procedure_id (title)
        `)
        .eq("status", "pending")
        .eq("viewed", false);

      if (user.role === UserRole.TECHNICIAN) {
        const { data: referentData } = await supabase
          .from('procedure_referents')
          .select('procedure_id')
          .eq('user_id', user.id);
        
        const referentProcIds = referentData?.map(r => r.procedure_id) || [];
        if (referentProcIds.length === 0) {
          setPendingSuggestions([]);
          return;
        }
        query = query.in('procedure_id', referentProcIds);
      }

      const { data } = await query.order("created_at", { ascending: false });

      if (data) {
        const formatted = data.map((item: any) => ({
          id: item.id,
          userName: item.user_profiles?.first_name || item.user_profiles?.email || "Utilisateur",
          procedureTitle: item.procedures?.title || "Procédure",
          content: item.suggestion,
          status: item.status,
          viewed: item.viewed,
          createdAt: item.created_at,
        }));
        setPendingSuggestions(formatted);
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
    }
  }, [user.id, user.role]);

  const fetchReadLogs = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("viewed", false)
        .or(user.role === UserRole.MANAGER 
          ? 'title.ilike.LOG_READ_%,title.ilike.LOG_SUGGESTION_%,title.ilike.CLAIM_MASTERY_%'
          : 'title.ilike.MASTERY_APPROVED_%')
        .eq('user_id', user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (data) setReadLogs(data);
    } catch (err) {
      console.error(err);
    }
  }, [user.id, user.role]);

  const fetchSuggestionResponses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("suggestion_responses")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setSuggestionResponses(data);
    } catch (err) {
      console.error("Error fetching responses:", err);
    }
  }, [user.id]);

  const fetchFlashNoteNotifications = useCallback(async () => {
    try {
      let query = supabase.from("notes").select("*");
      if (user.role === UserRole.MANAGER) {
        query = query.eq("title", "FLASH_NOTE_SUGGESTION");
      } else {
        query = query.in("title", ["FLASH_NOTE_VALIDATED", "FLASH_NOTE_REJECTED"]).eq('user_id', user.id);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      if (data) setFlashNoteNotifications(data);
    } catch (err) {
      console.error("Error fetching flash note notifications:", err);
    }
  }, [user.id, user.role]);

  const fetchSystemNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      if (data) setSystemNotifications(data);
    } catch (err) {
      console.error("Error fetching system notifications:", err);
    }
  }, [user.id]);

  useEffect(() => {
    fetchPendingSuggestions();
    if (user.role === UserRole.MANAGER) {
      fetchReadLogs();
      const channel = supabase
        .channel('manager-notifs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
          if (payload.new && payload.new.title?.startsWith("LOG_READ_")) {
            setReadLogs(prev => [payload.new, ...prev].slice(0, 5));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'procedure_suggestions' }, () => fetchPendingSuggestions())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    } else {
      fetchSuggestionResponses();
      const suggestionChannel = supabase
        .channel('tech-suggestions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'procedure_suggestions' }, () => fetchPendingSuggestions())
        .subscribe();
      const responseChannel = supabase
        .channel('tech-responses')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'suggestion_responses', filter: `user_id=eq.${user.id}` }, (payload) => {
          if (payload.new) setSuggestionResponses(prev => [payload.new, ...prev]);
        })
        .subscribe();
      return () => {
        supabase.removeChannel(suggestionChannel);
        supabase.removeChannel(responseChannel);
      };
    }
  }, [user.id, user.role, fetchPendingSuggestions, fetchReadLogs, fetchSuggestionResponses]);

  useEffect(() => {
    fetchSystemNotifications();
    fetchFlashNoteNotifications();
    const interval = setInterval(() => {
      fetchSystemNotifications();
      fetchFlashNoteNotifications();
    }, 10000);
    return () => clearInterval(interval);
  }, [user.id, user.role, fetchSystemNotifications, fetchFlashNoteNotifications]);

  const handleClearAll = async () => {
    if (user.role === UserRole.TECHNICIAN) {
      await supabase.from('suggestion_responses').update({ read: true }).eq('user_id', user.id);
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
      setSuggestionResponses([]);
      setSystemNotifications([]);
      await supabase.from('notes').delete().in('title', ["FLASH_NOTE_VALIDATED", "FLASH_NOTE_REJECTED"]).eq('user_id', user.id);
      setFlashNoteNotifications([]);
    } else {
      const unviewedLogIds = readLogs.map(l => l.id);
      if (unviewedLogIds.length > 0) {
        await supabase.from("notes").update({ viewed: true }).in("id", unviewedLogIds);
      }
      setReadLogs([]);
      const unviewedSuggestionIds = pendingSuggestions.map(s => s.id);
      if (unviewedSuggestionIds.length > 0) {
        await supabase.from("procedure_suggestions").update({ viewed: true }).in("id", unviewedSuggestionIds);
      }
      setPendingSuggestions([]);
      const systemNotifIds = systemNotifications.map(n => n.id);
      if (systemNotifIds.length > 0) {
        await supabase.from("notifications").update({ read: true }).in("id", systemNotifIds);
      }
      setSystemNotifications([]);
      const flashNotifIds = flashNoteNotifications.map(n => n.id);
      if (flashNotifIds.length > 0) {
        await supabase.from("notes").delete().in("id", flashNotifIds);
      }
      setFlashNoteNotifications([]);
    }
  };

  return {
    readLogs,
    setReadLogs,
    pendingSuggestions,
    setPendingSuggestions,
    suggestionResponses,
    setSuggestionResponses,
    flashNoteNotifications,
    setFlashNoteNotifications,
    systemNotifications,
    setSystemNotifications,
    handleClearAll
  };
};
