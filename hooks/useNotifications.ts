import { useState, useEffect, useCallback } from "react";
import { User, UserRole, Suggestion, Notification } from "../types";
import { supabase } from "../lib/supabase";

export const useNotifications = (user: User) => {
  const [readLogs, setReadLogs] = useState<any[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [suggestionResponses, setSuggestionResponses] = useState<any[]>([]);
  const [flashNoteNotifications, setFlashNoteNotifications] = useState<any[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);

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
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      if (data) setSystemNotifications(data as Notification[]);
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

    // Add Realtime for notifications
    const notificationChannel = supabase
        .channel('system-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setSystemNotifications((prev) => {
          if (prev.some(n => n.id === payload.new.id)) return prev;
          // When a new notification arrives, add it to the list
          return [payload.new as Notification, ...prev];
      });
          }
        )
        .subscribe();

    const interval = setInterval(() => {
      // Keep polling for other types and as backup
      fetchFlashNoteNotifications();
      fetchSystemNotifications(); 
    }, 10000);

    return () => {
        clearInterval(interval);
        supabase.removeChannel(notificationChannel);
    };
  }, [user.id, user.role, fetchSystemNotifications, fetchFlashNoteNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
      setSystemNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleClearAll = async () => {
    try {
      if (user.role === UserRole.TECHNICIAN) {
        // Bulk update for Technician (Mark as Read only, no deletion)
        await supabase
          .from('suggestion_responses')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false);
          
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false);
          
        // For flash notes, we mark them as "viewed" implicitly by clearing local state, 
        // or we could add a 'viewed' column if needed. For now, we just clear the UI list
        // but to respect "no deletion", we stop calling .delete().
        // Instead, we might need to update a status if the schema supports it.
        // Assuming 'notes' has a 'viewed' column (it does based on Manager logic):
        await supabase
          .from('notes')
          .update({ viewed: true })
          .in('title', ["FLASH_NOTE_VALIDATED", "FLASH_NOTE_REJECTED"])
          .eq('user_id', user.id);

        setSuggestionResponses([]);
        // setSystemNotifications([]); // Don't clear local state entirely, just mark as read?
        // Actually, "Tout marquer comme lu" usually keeps them in the list but unbolded.
        // But the user said "pas de suppression".
        // Let's refetch to update UI state properly instead of emptying the array.
        fetchSystemNotifications();
        setFlashNoteNotifications([]); // These are transient, maybe okay to clear from view?
      } else {
        // Bulk update for Manager (Mark as Read)
        // 1. Logs
        await supabase
          .from("notes")
          .update({ viewed: true })
          .eq('user_id', user.id)
          .eq('viewed', false)
          .or('title.ilike.LOG_READ_%,title.ilike.LOG_SUGGESTION_%,title.ilike.CLAIM_MASTERY_%');

        // 2. Suggestions (Global queue)
        await supabase
          .from("procedure_suggestions")
          .update({ viewed: true })
          .eq("status", "pending")
          .eq("viewed", false);

        // 3. System Notifications
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user.id)
          .eq("read", false);

        // 4. Flash Notes - Mark as viewed instead of delete
        await supabase
          .from("notes")
          .update({ viewed: true })
          .eq("title", "FLASH_NOTE_SUGGESTION")
          .eq("viewed", false); // Only unread ones

        // Refresh lists to show "read" state
        fetchReadLogs();
        fetchPendingSuggestions();
        fetchSystemNotifications();
        // For flash notes, they disappear when viewed usually
        setFlashNoteNotifications([]); 
      }
    } catch (err) {
      console.error("Error clearing notifications:", err);
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
    handleClearAll,
    markAsRead
  };
};
