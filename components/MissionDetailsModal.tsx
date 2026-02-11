import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Mission, User, UserRole, MissionStatus } from '../types';

interface MissionDetailsModalProps {
  mission: Mission;
  user: User;
  onClose: () => void;
  onUpdateStatus: (missionId: string, status: MissionStatus, notes?: string, fileUrl?: string) => void;
}

const MissionDetailsModal: React.FC<MissionDetailsModalProps> = ({ mission, user, onClose, onUpdateStatus }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Status Actions State
  const [completionNotes, setCompletionNotes] = useState(mission.completion_notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'chat') {
      fetchMessages();
      subscribeToMessages();
    }
  }, [activeTab]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeTab]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const fetchMessages = async () => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('mission_messages')
      .select(`
        *,
        user:user_profiles!user_id(first_name, last_name, role)
      `)
      .eq('mission_id', mission.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoadingMessages(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`mission_chat:${mission.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mission_messages', filter: `mission_id=eq.${mission.id}` },
        async (payload) => {
          // Fetch user details for the new message
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('first_name, last_name, role')
            .eq('id', payload.new.user_id)
            .single();

          const newMsg = { ...payload.new, user: userData };
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await supabase.from('mission_messages').insert({
        mission_id: mission.id,
        user_id: user.id,
        content: newMessage.trim()
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleAction = async (action: 'claim' | 'start' | 'complete' | 'cancel') => {
    setIsSubmitting(true);
    if (action === 'claim') {
        // Logic handled by parent but we simulate here for closing modal maybe? 
        // No, parent expects updateStatus.
        // But parent's handleClaimMission might need to be called differently or we adapt onUpdateStatus to handle 'assigned'
        // Let's assume onUpdateStatus can handle 'assigned' for claim.
        // Actually Missions.tsx handleClaimMission updates to 'assigned' and user.id.
        // We might need a specific prop for claiming or update onUpdateStatus signature.
        // For simplicity, let's trigger it directly if user is tech.
        // The parent onUpdateStatus takes (id, status, notes).
        // Let's rely on parent refreshing data.
    }
    
    // We'll delegate to the parent prop mostly.
    // For 'complete', we pass the notes.
    if (action === 'complete') {
        onUpdateStatus(mission.id, 'completed', completionNotes);
    } else if (action === 'start') {
        onUpdateStatus(mission.id, 'in_progress');
    } else if (action === 'cancel') {
        onUpdateStatus(mission.id, 'cancelled', completionNotes); // Notes as reason
    }
    
    // If successful, the parent re-renders or we close.
    // Ideally we wait for parent. But onUpdateStatus is void in prop.
    // We can assume success or pass a callback.
    // Let's just close modal on success actions like 'claim' (which is quick).
    // For 'complete' usually we wait, but let's keep UI responsive.
    onClose(); 
    setIsSubmitting(false);
  };

  // Helper for status badge
  const StatusBadge = ({ status }: { status: string }) => {
     const styles = {
        open: "bg-emerald-50 text-emerald-600",
        assigned: "bg-amber-50 text-amber-600",
        in_progress: "bg-indigo-50 text-indigo-600",
        completed: "bg-slate-50 text-slate-500",
        cancelled: "bg-rose-50 text-rose-500",
        awaiting_validation: "bg-blue-50 text-blue-600"
     }[status] || "bg-gray-50 text-gray-500";
     
     const labels = {
         open: "Disponible",
         assigned: "Assignée",
         in_progress: "En Cours",
         completed: "Terminée",
         cancelled: "Annulée",
         awaiting_validation: "À Valider"
     }[status] || status;

     return (
         <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles}`}>
             {labels}
         </span>
     );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl h-[85vh] shadow-2xl animate-scale-up flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-start justify-between bg-white z-10">
            <div className="flex gap-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                    mission.urgency === 'critical' ? 'bg-rose-500 text-white shadow-rose-500/30' : 
                    mission.urgency === 'high' ? 'bg-orange-500 text-white shadow-orange-500/30' : 
                    'bg-indigo-600 text-white shadow-indigo-500/30'
                }`}>
                    <i className={`fa-solid ${mission.urgency === 'critical' ? 'fa-triangle-exclamation' : 'fa-rocket'}`}></i>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <StatusBadge status={mission.status} />
                        {mission.deadline && (
                            <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg">
                                <i className="fa-solid fa-clock"></i>
                                {new Date(mission.deadline).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 leading-tight">{mission.title}</h2>
                </div>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all">
                <i className="fa-solid fa-xmark text-xl"></i>
            </button>
        </div>

        {/* Tabs */}
        <div className="px-8 border-b border-slate-100 flex gap-8">
            <button 
                onClick={() => setActiveTab('details')}
                className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Détails de la mission
            </button>
            <button 
                onClick={() => setActiveTab('chat')}
                className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'chat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Discussion <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px]">{messages.length}</span>
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
            {activeTab === 'details' ? (
                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Description</h3>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{mission.description}</p>
                        </div>

                        {/* Action Zone for Technician */}
                        {(user.role === UserRole.TECHNICIAN || user.role === UserRole.MANAGER) && (
                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
                                    {mission.status === 'completed' ? 'Rapport de Mission' : 'Espace de Travail'}
                                </h3>
                                
                                {mission.status === 'completed' ? (
                                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <p className="text-emerald-700 italic">{mission.completion_notes || "Aucune note de complétion."}</p>
                                    </div>
                                ) : (
                                    (mission.status === 'in_progress' && mission.assigned_to === user.id) || 
                                    (mission.status === 'awaiting_validation' && user.role === UserRole.MANAGER) ? (
                                        <div className="space-y-4">
                                            <label className="text-xs font-bold text-slate-700">
                                                {user.role === UserRole.MANAGER ? "Feedback de validation / refus" : "Notes de réalisation & Liens"}
                                            </label>
                                            <textarea 
                                                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none"
                                                placeholder={user.role === UserRole.MANAGER ? "Raison du refus ou commentaire..." : "Décrivez le travail réalisé, collez le lien de la procédure..."}
                                                value={completionNotes}
                                                onChange={(e) => setCompletionNotes(e.target.value)}
                                            />
                                            <div className="flex justify-end gap-3">
                                                {user.role === UserRole.MANAGER && (
                                                    <button 
                                                        onClick={() => handleAction('cancel')} // Using cancel as "Refuse/Redo"
                                                        className="px-6 py-3 bg-rose-50 text-rose-500 font-bold rounded-xl hover:bg-rose-100 transition-colors"
                                                    >
                                                        Demander Révision
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleAction('complete')}
                                                    className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                                                >
                                                    {user.role === UserRole.MANAGER ? "Valider la Mission" : "Soumettre le Travail"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                            <p className="text-sm text-slate-500">
                                                {mission.status === 'open' ? "Cette mission est disponible." : 
                                                 mission.status === 'assigned' ? "Mission assignée, prête à démarrer." : 
                                                 "Action requise selon le statut."}
                                            </p>
                                            
                                            {mission.status === 'open' && (
                                                <button onClick={() => {onUpdateStatus(mission.id, 'assigned'); onClose();}} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all">
                                                    Réclamer
                                                </button>
                                            )}
                                            {mission.status === 'assigned' && mission.assigned_to === user.id && (
                                                <button onClick={() => handleAction('start')} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-slate-900 transition-all">
                                                    Démarrer
                                                </button>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Meta Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
                            <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Récompense</span>
                            <div className="text-4xl font-black text-amber-500 mb-1">{mission.xp_reward}</div>
                            <span className="text-xs font-bold text-slate-400 uppercase">Points XP</span>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                            <div>
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigné à</span>
                                {mission.assignee ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                            {mission.assignee.first_name[0]}{mission.assignee.last_name[0]}
                                        </div>
                                        <span className="font-bold text-slate-700">{mission.assignee.first_name} {mission.assignee.last_name}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-slate-400 italic">Personne</span>
                                )}
                            </div>
                            <div>
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Créé par</span>
                                <span className="font-medium text-slate-700 text-sm">
                                    {mission.creator ? `${mission.creator.first_name} ${mission.creator.last_name}` : "Système"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // Chat Tab
                <div className="flex flex-col h-full bg-white">
                    <div className="flex-1 overflow-y-auto p-8 space-y-6" ref={chatContainerRef}>
                        {messages.length === 0 ? (
                            <div className="text-center py-20 text-slate-300">
                                <i className="fa-regular fa-comments text-4xl mb-4"></i>
                                <p>Aucun message. Commencez la discussion !</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = msg.user_id === user.id;
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] ${isMe ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'} p-4 rounded-2xl rounded-tr-sm shadow-sm`}>
                                            <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                                            <div className="mt-2 flex items-center justify-between gap-4 opacity-70">
                                                <span className="text-[10px] uppercase font-bold tracking-wider">
                                                    {msg.user?.first_name}
                                                </span>
                                                <span className="text-[10px]">
                                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-4">
                        <input 
                            type="text" 
                            className="flex-1 p-4 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none shadow-sm font-medium text-slate-700"
                            placeholder="Écrivez votre message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button 
                            onClick={handleSendMessage}
                            className="w-14 h-14 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center"
                        >
                            <i className="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MissionDetailsModal;
