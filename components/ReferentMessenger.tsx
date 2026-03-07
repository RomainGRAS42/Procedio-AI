import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { UserRole } from "../types";

interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  procedure_id?: string;
  is_resolved?: boolean;
  last_activity_at?: string;
  metadata?: { is_system?: boolean; [key: string]: any };
  attachment_url?: string;
  attachment_name?: string;
  sender?: { first_name: string; last_name: string; avatar_url: string; avatarUrl?: string };
  recipient?: { first_name: string; last_name: string; avatar_url: string; avatarUrl?: string };
  procedure?: { title: string; uuid: string; file_url?: string };
}

interface ReferentMessengerProps {
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  hideTrigger?: boolean;
  onMessagesLoaded?: (hasMessages: boolean) => void;
}

const ReferentMessenger: React.FC<ReferentMessengerProps> = ({ 
  isOpen, 
  onToggle, 
  hideTrigger,
  onMessagesLoaded 
}) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<{ [key: string]: DirectMessage[] }>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeConversation, setActiveConversation] = useState<string | null>(null); // sender_id
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);
  const [showReferralLoopback, setShowReferralLoopback] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (!user) return;

    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel("direct_messages_referent")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("New message received in ReferentMessenger:", payload.new);
          handleNewMessage(payload.new as DirectMessage);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (activeConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      markAsRead(activeConversation);
    }
  }, [activeConversation, conversations]);

  const fetchMessages = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("direct_messages")
        .select(
          `
          *,
          sender:sender_id(first_name, last_name, avatar_url),
          recipient:recipient_id(first_name, last_name, avatar_url),
          procedure:procedure_id(title, uuid, file_url)
        `
        )
        .or(`recipient_id.eq.${user.id},sender_id.eq.${user.id}`)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data) {
        // Group by conversation partner + procedure
        const grouped: { [key: string]: DirectMessage[] } = {};
        let unread = 0;

        data.forEach((msg: any) => {
          const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
          const procId = msg.procedure_id || "no_procedure";
          const threadKey = `${partnerId}:${procId}`;
          
          if (!grouped[threadKey]) grouped[threadKey] = [];
          grouped[threadKey].push(msg);

          if (msg.recipient_id === user.id && !msg.is_read) {
            unread++;
          }
        });

        const hasMessages = data.length > 0;
        setConversations(grouped);
        setUnreadCount(unread);
        if (onMessagesLoaded) onMessagesLoaded(hasMessages);
      } else {
        if (onMessagesLoaded) onMessagesLoaded(false);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  const handleNewMessage = async (msg: DirectMessage) => {
    // Fetch sender details if missing (for real-time updates)
    const { data: senderData } = await supabase
      .from("user_profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", msg.sender_id)
      .single();

    const fullMsg = { ...msg, sender: senderData };

    setConversations((prev) => {
      const partnerId = msg.sender_id;
      const procId = msg.procedure_id || "no_procedure";
      const threadKey = `${partnerId}:${procId}`;
      const existing = prev[threadKey] || [];
      return {
        ...prev,
        [threadKey]: [...existing, fullMsg],
      };
    });

    if (msg.recipient_id === user?.id) {
      setUnreadCount((prev) => prev + 1);
      // Play notification sound
      const audio = new Audio("/notification.mp3"); // Assuming file exists or fails silently
      audio.play().catch(() => {});
    }
  };

  const markAsRead = async (threadKey: string) => {
    if (!user) return;

    // Optimistic update
    const unreadInConv =
      conversations[threadKey]?.filter((m) => m.recipient_id === user.id && !m.is_read).length || 0;
    if (unreadInConv > 0) {
      setUnreadCount((prev) => Math.max(0, prev - unreadInConv));

      const partnerId = threadKey.split(':')[0];

      // DB Update
      await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("sender_id", partnerId)
        .eq("recipient_id", user.id)
        .eq("is_read", false);

      // Update local state
      setConversations((prev) => ({
        ...prev,
        [threadKey]: prev[threadKey].map((m) =>
          m.recipient_id === user.id ? { ...m, is_read: true } : m
        ),
      }));
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !activeConversation || !user) return;
    setIsSending(true);

    try {
      const content = input.trim();
      const [recipient_id, procedure_id_raw] = activeConversation.split(':');
      const procedure_id = procedure_id_raw === 'no_procedure' ? null : procedure_id_raw;

      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: user.id,
          recipient_id: recipient_id,
          content: content,
          procedure_id: procedure_id,
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update resolution status of other messages in this thread (simple approach)
      await supabase
        .from("direct_messages")
        .update({ last_activity_at: new Date().toISOString() })
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipient_id}),and(sender_id.eq.${recipient_id},recipient_id.eq.${user.id})`)
        .eq('procedure_id', procedure_id);

      // Add to local state immediately
      const myMsg = {
        ...data,
        sender: {
          first_name: user.firstName || user.email?.split("@")[0] || "Moi",
          last_name: user.lastName || "",
          avatar_url: user.avatarUrl,
          avatarUrl: user.avatarUrl, // Added both for compatibility
        },
      };

      setConversations((prev) => {
        return {
          ...prev,
          [activeConversation]: [...(prev[activeConversation] || []), myMsg],
        };
      });

      setInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !activeConversation) return;

    try {
      setIsSending(true);
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const [recipientId] = activeConversation.split(':');

      // Use an existing or logically named bucket
      const { error: uploadError } = await supabase.storage
        .from("mission-attachments")
        .upload(`messenger/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("mission-attachments")
        .getPublicUrl(`messenger/${fileName}`);

      // Send message with attachment
      const [recipient_id, procedure_id_raw] = activeConversation.split(':');
      const procedure_id = procedure_id_raw === 'no_procedure' ? null : procedure_id_raw;

      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: user.id,
          recipient_id: recipient_id,
          content: `Pièce jointe : ${file.name}`,
          procedure_id: procedure_id,
          attachment_url: publicUrl,
          attachment_name: file.name,
          last_activity_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      const myMsg = {
        ...data,
        sender: {
          first_name: user.firstName || user.email?.split("@")[0] || "Moi",
          last_name: user.lastName || "",
          avatar_url: user.avatarUrl,
        },
      };

      setConversations((prev) => ({
        ...prev,
        [activeConversation]: [...(prev[activeConversation] || []), myMsg],
      }));

    } catch (err) {
      console.error("Error uploading file:", err);
      setNotification({ msg: "Erreur lors de l'envoi du fichier", type: "error" });
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Bubble */}
      <div className={`fixed bottom-24 right-6 z-[90] flex flex-col gap-4 items-end transition-all duration-300 ${hideTrigger ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100'}`}>
        {unreadCount > 0 && !isOpen && (
          <div className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg animate-bounce absolute -top-2 right-0 z-[90]">
            {unreadCount}
          </div>
        )}
        <button
          onClick={() => onToggle(!isOpen)}
          className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 ${
            isOpen ? "bg-slate-800 text-white rotate-90" : "bg-emerald-500 text-white"
          }`}
          title="Messagerie Référent">
          <i className={`fa-solid ${isOpen ? "fa-xmark" : "fa-comments"}`}></i>
        </button>
      </div>

      {/* Messenger Panel */}
      {isOpen && (
        <div
          className={`fixed bottom-24 right-6 z-[100] flex flex-col bg-white rounded-[2.5rem] shadow-2xl border border-slate-100/50 overflow-hidden transition-all duration-500 ease-out animate-scale-up ${
            isExpanded ? "w-[600px] h-[750px]" : "w-96 h-[650px]"
          }`}>
          
          {/* Header Principle */}
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-white to-slate-50/50 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                <i className="fa-solid fa-comments"></i>
              </div>
              <h2 className="font-black text-slate-800 text-sm uppercase tracking-tight">Messagerie</h2>
            </div>
            
            <div className="flex items-center gap-2 relative z-10">
              {activeConversation && (() => {
                const msgs = conversations[activeConversation] || [];
                const isResolved = msgs.some(m => m.is_resolved);
                if (!isResolved) {
                  return (
                    <button
                      onClick={() => setShowResolveConfirm(true)}
                      className="px-3 py-1.5 bg-white text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center gap-2 shadow-sm mr-2"
                    >
                      <i className="fa-solid fa-flag-checkered"></i>
                      <span>Clôturer</span>
                    </button>
                  );
                }
                return (
                  <div className="px-3 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 mr-2">
                    <i className="fa-solid fa-lock"></i>
                    <span>Close</span>
                  </div>
                );
              })()}

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-all flex items-center justify-center border border-slate-100 shadow-sm"
                title={isExpanded ? "Réduire" : "Agrandir"}
              >
                <i className={`fa-solid ${isExpanded ? "fa-compress" : "fa-expand"} text-xs`}></i>
              </button>
              
              <button
                onClick={() => onToggle(false)}
                className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center border border-slate-100 shadow-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
            {activeConversation ? (
              // --- CHAT VIEW ---
              <div className="h-full flex flex-col">
                {/* Back button and Context Bar */}
                <div className="px-4 py-3 border-b border-slate-50 bg-white shadow-sm flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <button
                      onClick={() => setActiveConversation(null)}
                      className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center border border-slate-100"
                    >
                      <i className="fa-solid fa-arrow-left text-xs"></i>
                    </button>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap leading-tight">
                        Cette discussion concerne
                      </p>
                      <h4 className="font-black text-slate-800 text-xs truncate">
                        {conversations[activeConversation]?.[0]?.procedure?.title || "Validation Procédure"}
                      </h4>
                    </div>
                  </div>
                  
                  {conversations[activeConversation]?.[0]?.procedure?.uuid && (
                    <button
                      onClick={async () => {
                        const proc = conversations[activeConversation]?.[0]?.procedure;
                        if (!proc?.file_url) return;
                        try {
                          const fileUrl = proc.file_url;
                          const { data } = await supabase.storage.from("procedures").createSignedUrl(fileUrl, 3600);
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                        } catch (err) { console.error(err); }
                      }}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 shrink-0"
                    >
                      <i className="fa-solid fa-external-link text-xs"></i>
                      <div className="flex flex-col text-left leading-none">
                        <span className="text-[9px] font-black uppercase">Lien</span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                  {conversations[activeConversation]?.map((msg) => {
                    if (msg.metadata?.is_system) {
                      return (
                        <div key={msg.id} className="flex justify-center my-6 animate-fade-in px-4">
                          <div className="bg-white/80 backdrop-blur-sm border border-emerald-100 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-3">
                            <i className="fa-solid fa-flag-checkered text-emerald-500 text-xs"></i>
                            <div className="flex flex-col">
                              <p className="text-[10px] font-black text-slate-800">{msg.content}</p>
                              <span className="text-[8px] text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${msg.sender_id === user.id ? "flex-row-reverse" : "flex-row"}`}>
                        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                          <img 
                            src={msg.sender?.avatar_url || msg.sender?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.first_name || "U")}&background=4f46e5&color=fff&bold=true`} 
                            className="w-full h-full object-cover"
                            alt="Avatar"
                          />
                        </div>
                        <div className={`max-w-[75%] p-3 rounded-2xl text-xs flex flex-col gap-2 shadow-sm ${
                          msg.sender_id === user.id ? "bg-indigo-600 text-white rounded-br-none" : "bg-white border border-slate-100 text-slate-700 rounded-bl-none"
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          {msg.attachment_url && (
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`p-2 rounded-xl flex items-center gap-3 border transition-all ${msg.sender_id === user.id ? "bg-indigo-500/50 border-indigo-400/50" : "bg-slate-50 border-slate-100"}`}>
                              <i className="fa-solid fa-file-arrow-down text-lg"></i>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black truncate">{msg.attachment_name || "Fichier"}</p>
                                <span className="text-[8px] opacity-60 uppercase font-bold">Ouvrir</span>
                              </div>
                            </a>
                          )}
                          <span className={`text-[8px] block opacity-50 ${msg.sender_id === user.id ? "text-right" : "text-left"}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Footer / Input */}
                <div className="p-3 border-t border-slate-50 bg-white shrink-0">
                  {conversations[activeConversation]?.some(m => m.is_resolved) ? (
                    <div className="py-2 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Discussion terminée
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                       <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                       <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending}
                        className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center shrink-0 border border-slate-100"
                        title="Joindre un fichier"
                      >
                        <i className="fa-solid fa-paperclip"></i>
                      </button>
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Répondre..."
                        className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        disabled={isSending}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={isSending || !input.trim()}
                        className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all group shrink-0"
                      >
                        <i className={`fa-solid fa-paper-plane transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${isSending ? 'animate-pulse' : ''}`}></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // --- LIST VIEW ---
              <div className="h-full overflow-y-auto p-4 space-y-2">
                {Object.keys(conversations).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                    <i className="fa-regular fa-comments text-3xl mb-3 opacity-50"></i>
                    <p className="text-[10px] uppercase font-bold tracking-widest">Aucun message</p>
                  </div>
                ) : (
                  Object.entries(conversations)
                    .sort(([, a], [, b]) => new Date(b[b.length-1].created_at).getTime() - new Date(a[a.length-1].created_at).getTime())
                    .map(([threadKey, msgs]) => {
                      const lastMsg = msgs[msgs.length - 1];
                      const partnerId = threadKey.split(':')[0];
                      const partner = lastMsg.sender_id === user.id ? lastMsg.recipient : lastMsg.sender;
                      const unreadCount = msgs.filter(m => m.recipient_id === user.id && !m.is_read).length;
                      const isResolved = msgs.some(m => m.is_resolved);

                      return (
                        <button
                          key={threadKey}
                          onClick={() => {
                            setActiveConversation(threadKey);
                            markAsRead(threadKey);
                          }}
                          className={`w-full p-4 rounded-2xl transition-all flex items-center gap-4 text-left group border ${
                            unreadCount > 0 ? "bg-indigo-50/50 border-indigo-100 shadow-sm" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
                          } ${isResolved ? "opacity-60 grayscale-[0.5]" : ""}`}
                        >
                          <div className={`w-12 h-12 rounded-full overflow-hidden border-2 shrink-0 ${unreadCount > 0 ? 'border-indigo-200' : 'border-slate-100'}`}>
                            <img src={partner?.avatar_url || (partner as any)?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.first_name || "U")}&background=4f46e5&color=fff&bold=true`} className="w-full h-full object-cover" alt="User" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-black text-slate-800 text-xs truncate uppercase">{partner?.first_name} {partner?.last_name}</span>
                              <span className="text-[9px] text-slate-400 font-bold">{new Date(lastMsg.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className={`text-[10px] truncate ${unreadCount > 0 ? "text-indigo-600 font-bold" : "text-slate-400"}`}>
                              {lastMsg.sender_id === user.id && <i className="fa-solid fa-reply mr-1"></i>}
                              {lastMsg.content}
                            </p>
                          </div>
                          {unreadCount > 0 && (
                            <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-black">{unreadCount}</div>
                          )}
                          {isResolved && <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>}
                        </button>
                      );
                    })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[150] flex items-center gap-3 animate-fade-in border backdrop-blur-md ${
          notification.type === "success" ? "bg-emerald-500/90 border-emerald-400 text-white" :
          notification.type === "error" ? "bg-rose-500/90 border-rose-400 text-white" : "bg-slate-800/90 border-slate-700 text-white"
        }`}>
          <i className={`fa-solid ${notification.type === "success" ? "fa-circle-check" : notification.type === "error" ? "fa-circle-exclamation" : "fa-circle-info"}`}></i>
          <span className="text-xs font-bold leading-none">{notification.msg}</span>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL - Incident Resolved */}
      {showResolveConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-scale-up">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-6 mx-auto"><i className="fa-solid fa-flag-checkered"></i></div>
            <div className="text-center mb-8">
              <h3 className="font-black text-slate-800 text-lg mb-2">Clôturer l'incident ?</h3>
              <p className="text-sm font-medium text-slate-500">Cette discussion sera marquée comme terminée et ne pourra plus recevoir de nouveaux messages.</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  try {
                    const msgs = conversations[activeConversation!] || [];
                    const partnerId = activeConversation!.split(':')[0];
                    const procId = msgs[0]?.procedure_id;

                    const { error } = await supabase
                      .from("direct_messages")
                      .update({ is_resolved: true })
                      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
                      .eq('procedure_id', procId);

                    if (error) throw error;

                    await supabase.from("direct_messages").insert({
                      sender_id: user.id, recipient_id: partnerId, content: `Incident clos par ${user.firstName}`,
                      procedure_id: procId, is_resolved: true, metadata: { is_system: true }
                    });

                    setConversations(prev => ({
                      ...prev,
                      [activeConversation!]: prev[activeConversation!].map(m => ({ ...m, is_resolved: true }))
                    }));

                    setShowResolveConfirm(false);
                    setNotification({ msg: "Discussion clôturée avec succès", type: "success" });
                    setShowReferralLoopback(true);
                  } catch (err) { console.error(err); setShowResolveConfirm(false); }
                }}
                className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase hover:bg-emerald-600 transition-all"
              >Confirmer la résolution</button>
              <button onClick={() => setShowResolveConfirm(false)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL - Referral Loopback */}
      {showReferralLoopback && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-scale-up">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mb-6 mx-auto"><i className="fa-solid fa-wand-magic-sparkles"></i></div>
            <div className="text-center mb-8">
              <h3 className="font-black text-slate-800 text-lg mb-2">Bravo !</h3>
              <p className="text-sm font-medium text-slate-500">Mettre à jour la procédure pour l'équipe ?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const proc = conversations[activeConversation!]?.[0]?.procedure;
                  if (proc) { onToggle(false); window.location.href = `/procedure/${proc.uuid}?action=suggest`; }
                }}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase"
              >Mettre à jour</button>
              <button onClick={() => setShowReferralLoopback(false)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase">Plus tard</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReferentMessenger;
