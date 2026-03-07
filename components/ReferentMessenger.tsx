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
  sender?: { first_name: string; last_name: string; avatar_url: string };
  procedure?: { title: string; uuid: string };
}

const ReferentMessenger: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<{ [key: string]: DirectMessage[] }>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeConversation, setActiveConversation] = useState<string | null>(null); // sender_id
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    fetchMessages();
    
    // Subscribe to new messages
    const subscription = supabase
      .channel('direct_messages_referent')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
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
        .select(`
          *,
          sender:sender_id(first_name, last_name, avatar_url),
          procedure:procedure_id(title, uuid)
        `)
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

        setConversations(grouped);
        setUnreadCount(unread);
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
        const audio = new Audio('/notification.mp3'); // Assuming file exists or fails silently
        audio.play().catch(() => {});
    }
  };

  const markAsRead = async (partnerId: string) => {
    if (!user) return;
    
    // Optimistic update
    const unreadInConv = conversations[partnerId]?.filter(m => m.recipient_id === user.id && !m.is_read).length || 0;
    if (unreadInConv > 0) {
        setUnreadCount(prev => Math.max(0, prev - unreadInConv));
        
        // DB Update
        await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("sender_id", partnerId)
        .eq("recipient_id", user.id)
        .eq("is_read", false);
        
        // Update local state
        setConversations(prev => ({
            ...prev,
            [partnerId]: prev[partnerId].map(m => 
                m.recipient_id === user.id ? { ...m, is_read: true } : m
            )
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
          procedure_id: conversations[activeConversation]?.slice(-1)[0]?.procedure_id || null
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state immediately
      const partnerId = activeConversation;
      const myMsg = {
          ...data,
          sender: { first_name: user.firstName, last_name: user.lastName, avatar_url: user.avatarUrl }
      };

      setConversations(prev => ({
          ...prev,
          [partnerId]: [...(prev[partnerId] || []), myMsg]
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
      <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-4 items-end">
        {unreadCount > 0 && !isOpen && (
            <div className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg animate-bounce absolute -top-2 right-0 z-50">
                {unreadCount}
            </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 ${
            isOpen ? "bg-slate-800 text-white rotate-90" : "bg-emerald-500 text-white"
          }`}
          title="Messagerie Référent"
        >
          <i className={`fa-solid ${isOpen ? "fa-xmark" : "fa-comments"}`}></i>
        </button>
      </div>

      {/* Messenger Panel */}
      {isOpen && (
        <div className="fixed bottom-40 right-6 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden animate-slide-up origin-bottom-right">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between shrink-0">
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-inbox text-emerald-500"></i>
              Messagerie
            </h3>
            {activeConversation && (
                <button 
                    onClick={() => setActiveConversation(null)}
                    className="text-[10px] font-bold text-slate-400 hover:text-indigo-600"
                >
                    <i className="fa-solid fa-arrow-left mr-1"></i> Retour
                </button>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeConversation ? (
              // Chat View
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20">
                    {conversations[activeConversation]?.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                                msg.sender_id === user.id 
                                    ? "bg-emerald-500 text-white rounded-tr-none" 
                                    : "bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm"
                            }`}>
                                <p>{msg.content}</p>
                                <span className={`text-[9px] block mt-1 ${msg.sender_id === user.id ? "text-emerald-100" : "text-slate-300"}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Répondre..."
                            className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-50 border-none text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isSending}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                        >
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
                        const partner = lastMsg.sender_id === user.id 
                            ? (msgs.find(m => m.sender_id !== user.id)?.sender || { first_name: 'Utilisateur', last_name: '', avatar_url: '' }) // Fallback if user initiated
                            : lastMsg.sender;
                        
                        const unreadCount = msgs.filter(m => m.recipient_id === user.id && !m.is_read).length;

                        return (
                            <button
                                key={partnerId}
                                onClick={() => setActiveConversation(partnerId)}
                                className="w-full p-3 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-3 text-left group border border-transparent hover:border-slate-100"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200 group-hover:border-emerald-200 overflow-hidden">
                                    {partner?.avatar_url ? (
                                        <img src={partner.avatar_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="font-black text-xs">{partner?.first_name?.[0]}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-0.5">
                                        <span className="font-bold text-slate-700 text-xs truncate">
                                            {partner?.first_name} {partner?.last_name}
                                        </span>
                                        <span className="text-[9px] text-slate-400">
                                            {new Date(lastMsg.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className={`text-[10px] truncate ${unreadCount > 0 ? "font-bold text-slate-800" : "text-slate-400"}`}>
                                        {lastMsg.sender_id === user.id && <i className="fa-solid fa-reply mr-1 opacity-50"></i>}
                                        {lastMsg.content}
                                    </p>
                                    {lastMsg.procedure && (
                                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 rounded text-[8px] text-slate-500 truncate max-w-full">
                                            <i className="fa-regular fa-file-pdf mr-1"></i>
                                            {lastMsg.procedure.title}
                                        </span>
                                    )}
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
    </>
  );
};

export default ReferentMessenger;
