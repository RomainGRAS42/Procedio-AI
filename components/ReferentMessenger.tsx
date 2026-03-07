import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  procedure_id?: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        // Group by conversation partner (the other person)
        const grouped: { [key: string]: DirectMessage[] } = {};
        let unread = 0;

        data.forEach((msg: any) => {
          const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
          if (!grouped[partnerId]) grouped[partnerId] = [];
          grouped[partnerId].push(msg);

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
      const existing = prev[partnerId] || [];
      return {
        ...prev,
        [partnerId]: [...existing, fullMsg],
      };
    });

    if (msg.recipient_id === user?.id) {
      setUnreadCount((prev) => prev + 1);
      // Play notification sound
      const audio = new Audio("/notification.mp3"); // Assuming file exists or fails silently
      audio.play().catch(() => {});
    }
  };

  const markAsRead = async (partnerId: string) => {
    if (!user) return;

    // Optimistic update
    const unreadInConv =
      conversations[partnerId]?.filter((m) => m.recipient_id === user.id && !m.is_read).length || 0;
    if (unreadInConv > 0) {
      setUnreadCount((prev) => Math.max(0, prev - unreadInConv));

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
        [partnerId]: prev[partnerId].map((m) =>
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
      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          sender_id: user.id,
          recipient_id: activeConversation,
          content: content,
          // We can try to infer procedure context from the last message in conversation
          procedure_id: conversations[activeConversation]?.slice(-1)[0]?.procedure_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state immediately
      const partnerId = activeConversation;
      const myMsg = {
        ...data,
        sender: {
          first_name: user.firstName || user.email?.split("@")[0] || "Moi",
          last_name: user.lastName || "",
          avatar_url: user.avatarUrl,
          avatarUrl: user.avatarUrl, // Added both for compatibility
        },
      };

      setConversations((prev) => ({
        ...prev,
        [partnerId]: [...(prev[partnerId] || []), myMsg],
      }));

      setInput("");
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
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
        <div className="fixed bottom-40 right-6 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[90] flex flex-col overflow-hidden animate-slide-up origin-bottom-right">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between shrink-0">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-inbox text-emerald-500"></i>
              Messagerie
            </h3>
            {activeConversation && (
              <button
                onClick={() => setActiveConversation(null)}
                className="text-[10px] font-bold text-slate-400 hover:text-indigo-600">
                <i className="fa-solid fa-arrow-left mr-1"></i> Retour
              </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeConversation ? (
              // Chat View
              <div className="h-full flex flex-col">
                {/* Entête de contexte de procédure (si disponible dans la conversation) */}
                {(() => {
                  const msgs = conversations[activeConversation] || [];
                  const procMsg = [...msgs].reverse().find((m) => m.procedure);
                  if (!procMsg?.procedure) return null;

                  return (
                    <div className="mx-4 mt-3 mb-1 p-2 bg-indigo-50/50 border border-indigo-100/30 rounded-xl flex items-center justify-between gap-3 shadow-sm shrink-0">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-indigo-500 shrink-0">
                          <i className="fa-solid fa-file-lines text-[10px]"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-0.5 whitespace-nowrap">Cette discussion concerne la procédure :</p>
                          <p className="text-[10px] font-bold text-slate-700 truncate">
                            {procMsg.procedure.title}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          const fileUrl = procMsg.procedure.file_url;
                          if (!fileUrl) return;
                          
                          setNotification({ msg: "Génération du lien sécurisé...", type: "info" });
                          const { data } = await supabase.storage.from("procedures").createSignedUrl(fileUrl, 3600);
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, "_blank");
                          } else {
                            setNotification({ msg: "Erreur de lien", type: "error" });
                          }
                        }}
                        className="px-3 py-1.5 bg-white text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-50 hover:shadow-sm transition-all shrink-0 flex items-center gap-2"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        <div className="flex flex-col items-start leading-none -gap-0.5">
                          <span>Lien</span>
                          <span className="text-[7px] opacity-60 italic normal-case tracking-normal">(Valable 1 heure)</span>
                        </div>
                      </button>
                    </div>
                  );
                })()}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                  {conversations[activeConversation]?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2 ${msg.sender_id === user.id ? "flex-row-reverse" : "flex-row"}`}>
                      
                      {/* Avatar outside the bubble */}
                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 mb-1">
                        {msg.sender?.avatar_url || msg.sender?.avatarUrl ? (
                          <img 
                            src={msg.sender?.avatar_url || msg.sender?.avatarUrl} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.first_name || "U")}&background=4f46e5&color=fff&bold=true`;
                            }}
                          />
                        ) : (
                          <img 
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender?.first_name || "U")}&background=4f46e5&color=fff&bold=true`} 
                            alt="Avatar Fallback" 
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      <div
                        className={`max-w-[75%] p-3 rounded-2xl text-xs flex flex-col gap-1 shadow-sm ${
                          msg.sender_id === user.id
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-white border border-slate-100 text-slate-700 rounded-bl-none"
                        }`}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <span
                          className={`text-[8px] block opacity-50 ${msg.sender_id === user.id ? "text-right" : "text-left"}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                <div className="p-3 border-t border-slate-50 bg-white">
                  <div className="relative">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Répondre..."
                      className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-50 border-none text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isSending}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all">
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // List View
              <div className="h-full overflow-y-auto p-2 space-y-1">
                {Object.keys(conversations).length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                    <i className="fa-regular fa-comments text-3xl mb-3 opacity-50"></i>
                    <p className="text-[10px] uppercase font-bold tracking-widest">Aucun message</p>
                  </div>
                ) : (
                  Object.entries(conversations).map(([partnerId, msgs]) => {
                    const lastMsg = msgs[msgs.length - 1];
                    // Déterminer le partenaire de conversation (l'autre personne)
                    const partner = lastMsg.sender_id === user.id ? lastMsg.recipient : lastMsg.sender;

                    const unreadCount = msgs.filter(
                      (m) => m.recipient_id === user.id && !m.is_read
                    ).length;

                    return (
                      <button
                        key={partnerId}
                        onClick={() => setActiveConversation(partnerId)}
                        className={`w-full p-3 rounded-xl transition-all flex items-center gap-3 text-left group border ${
                          unreadCount > 0
                            ? "bg-indigo-50/30 border-indigo-100/50 shadow-sm"
                            : "hover:bg-slate-50 border-transparent hover:border-slate-100"
                        }`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 overflow-hidden transition-transform group-hover:scale-105 ${unreadCount > 0 ? "border-indigo-200 shadow-sm" : "border-slate-100"}`}>
                          {partner?.avatar_url || (partner as any)?.avatarUrl ? (
                            <img 
                              src={partner?.avatar_url || (partner as any)?.avatarUrl} 
                              className="w-full h-full object-cover" 
                              alt="User" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.first_name || "U")}&background=4f46e5&color=fff&bold=true`;
                              }}
                            />
                          ) : (
                            <img 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.first_name || "U")}&background=4f46e5&color=fff&bold=true`} 
                              className="w-full h-full object-cover" 
                              alt="User Fallback" 
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="font-black text-slate-800 text-[11px] truncate uppercase tracking-tight">
                              {partner?.first_name} {partner?.last_name}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold shrink-0">
                              {new Date(lastMsg.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p
                              className={`text-[10px] truncate italic ${unreadCount > 0 ? "font-black text-slate-900" : "text-slate-400"}`}>
                              {lastMsg.sender_id === user.id && (
                                <i className="fa-solid fa-reply mr-1 text-slate-300"></i>
                              )}
                              {lastMsg.content}
                            </p>
                            {(lastMsg.procedure || lastMsg.procedure_id) && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100/80 rounded-lg w-fit border border-slate-200/50">
                                <i className="fa-solid fa-file-lines text-[8px] text-slate-400"></i>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter truncate max-w-[150px]">
                                  {lastMsg.procedure?.title || "Validation Procédure"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {unreadCount > 0 && (
                          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black shadow-sm">
                            {unreadCount}
                          </div>
                        )}
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
          notification.type === "error" ? "bg-rose-500/90 border-rose-400 text-white" :
          "bg-slate-800/90 border-slate-700 text-white"
        }`}>
          <i className={`fa-solid ${
            notification.type === "success" ? "fa-circle-check" :
            notification.type === "error" ? "fa-circle-exclamation" :
            "fa-circle-info"
          }`}></i>
          <span className="text-xs font-bold leading-none">{notification.msg}</span>
        </div>
      )}
    </>
  );
};

export default ReferentMessenger;
