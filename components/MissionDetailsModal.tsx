import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { Mission, User, UserRole, MissionStatus, ActiveTransfer } from "../types";
import { useProcedurePublisher } from "../hooks/useProcedurePublisher";
import MissionStatusBadge from "./MissionStatusBadge";
import MissionChat, { MissionMessage } from "./MissionChat";

interface MissionDetailsModalProps {
  mission: Mission;
  user: User;
  onClose: () => void;
  onUpdateStatus: (
    missionId: string,
    status: MissionStatus,
    notes?: string,
    fileUrl?: string
  ) => void;
  setActiveTransfer?: (transfer: ActiveTransfer | null) => void;
  onStartQuiz?: (mission: Mission) => void;
}

const MissionDetailsModal: React.FC<MissionDetailsModalProps> = ({
  mission,
  user,
  onClose,
  onUpdateStatus,
  setActiveTransfer,
  onStartQuiz,
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "chat">("details");
  const [completionNotes, setCompletionNotes] = useState(mission.completion_notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<MissionMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(mission.attachment_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState<string | null>(null);
  const [showPromoteConfirmation, setShowPromoteConfirmation] = useState(false);
  const [promoteTitle, setPromoteTitle] = useState(mission.title);
  const [promoteCategory, setPromoteCategory] = useState("GÉNÉRAL");

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { publishFile } = useProcedurePublisher({ user: { id: user.id }, setActiveTransfer: setActiveTransfer || (() => {}) });

  // Logic for resetting notes based on status
  useEffect(() => {
    if (
      mission.status === "awaiting_validation" &&
      (user.role === UserRole.MANAGER || (user.role as any) === "manager")
    ) {
      setCompletionNotes("");
    }
  }, [mission.status, user.role]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (activeTab === "chat") scrollToBottom();
  }, [messages, activeTab]);

  const fetchMessages = async () => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("mission_messages")
      .select(`
        *,
        user:user_profiles!mission_messages_user_id_fkey_profiles(first_name, last_name, role)
      `)
      .eq("mission_id", mission.id)
      .order("created_at", { ascending: true });

    if (!error) setMessages(data || []);
    setLoadingMessages(false);
  };

  // Reset notes when status changes (especially for technician after manager feedback)
  useEffect(() => {
    // If mission goes back to 'in_progress' (e.g. refused by manager), 
    // we want to clear the "Espage de travail" input so the technician starts fresh 
    // BUT we might want to keep the previous notes visible somewhere as history?
    // For now, per user request: "le texte que j'avais mis en manager en justificatif apparait toujours dans espace de travail"
    // This implies that 'completionNotes' state is persisting the manager's refusal reason.
    
    if (mission.status === 'in_progress' && user.role === UserRole.TECHNICIAN) {
        setCompletionNotes("");
        setAttachmentUrl(null); // Allow re-upload
    }
  }, [mission.status, user.role]);

  useEffect(() => {
    const generateSignedUrl = async () => {
      if (!attachmentUrl) {
        setSignedUrl(null);
        return;
      }
      if (attachmentUrl.startsWith("blob:")) {
        setSignedUrl(attachmentUrl);
        return;
      }
      try {
        const path = attachmentUrl.split("/mission-attachments/")[1];
        if (!path) {
           setSignedUrl(attachmentUrl);
           return;
        }
        const { data, error } = await supabase.storage
          .from("mission-attachments")
          .createSignedUrl(decodeURIComponent(path), 3600);
        if (!error && data) setSignedUrl(data.signedUrl);
        else setSignedUrl(attachmentUrl);
      } catch (err) {
        setSignedUrl(attachmentUrl);
      }
    };
    generateSignedUrl();
  }, [attachmentUrl]);

  useEffect(() => {
    fetchMessages();
  }, [mission.id]);

  useEffect(() => {
    if (activeTab === "chat") {
      const channel = supabase
        .channel(`mission_chat:${mission.id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "mission_messages",
          filter: `mission_id=eq.${mission.id}`,
        }, async (payload) => {
          const { data: userData } = await supabase
            .from("user_profiles")
            .select("first_name, last_name, role")
            .eq("id", payload.new.user_id)
            .single();

          const newMsg: MissionMessage = {
            ...payload.new,
            user: userData || { first_name: "Utilisateur", last_name: "", role: "technicien" },
          } as MissionMessage;

          setMessages((prev) => {
            const exists = prev.find(m => m.id === newMsg.id || (m.tempId && m.content === newMsg.content));
            return exists ? prev : [...prev, newMsg];
          });
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [activeTab, mission.id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const content = newMessage.trim();
    const tempId = "temp-" + Date.now();
    const optimisticMsg: MissionMessage = {
      id: tempId,
      tempId,
      mission_id: mission.id,
      user_id: user.id,
      content,
      created_at: new Date().toISOString(),
      user: { first_name: user.firstName, last_name: user.lastName || "", role: user.role },
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage("");
    try {
      const { data, error } = await supabase.from("mission_messages").insert({ mission_id: mission.id, user_id: user.id, content }).select().single();
      if (error) throw error;
      if (data) setMessages(prev => prev.map(m => m.tempId === tempId ? { ...data, user: optimisticMsg.user } : m));
    } catch (err) {
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${mission.id}/${Date.now()}_${file.name.replace(/[^a-z0-9]/gi, "_")}.${fileExt}`;
      const { error } = await supabase.storage.from("mission-attachments").upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("mission-attachments").getPublicUrl(fileName);
      setAttachmentUrl(publicUrl);
    } catch (err: any) {
      alert(`Erreur d'envoi : ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAction = async (action: string) => {
    setIsSubmitting(true);
    try {
      if (action === "complete") {
        // Fix: Use strict enum comparison for Manager role to ensure correct status
        const isManager = user.role === UserRole.MANAGER || (user.role as any) === "manager" || (user.role as any) === "MANAGER";
        const newStatus: MissionStatus = isManager ? "completed" : "awaiting_validation";
        
        // Send system message for submission (Only if status is awaiting_validation - i.e. Technician submitting)
        if (newStatus === "awaiting_validation") {
            const date = new Date();
            const dateStr = date.toLocaleDateString('fr-FR');
            const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const name = user.firstName ? `${user.firstName} ${user.lastName || ''}` : user.email;
            
            const { error: msgError } = await supabase.from("mission_messages").insert({
                mission_id: mission.id,
                user_id: user.id,
                content: `${name} a soumis son travail le ${dateStr} à ${timeStr}`,
                type: 'system'
            });

            if (msgError) console.error("Error inserting submission message:", msgError);
        }

        await onUpdateStatus(mission.id, newStatus, completionNotes, attachmentUrl || undefined);
        
        if (newStatus === "completed") {
            onClose();
        } else {
            setShowSuccessModal("submit");
        }
      } else if (action === "start") {
        onUpdateStatus(mission.id, "in_progress");
      } else if (action === "cancel") {
        onUpdateStatus(mission.id, "in_progress", completionNotes);
        
        // Add system message for refusal
        await supabase.from("mission_messages").insert({ 
            mission_id: mission.id, 
            user_id: user.id, 
            content: `❌ Mission refusée. Motif : ${completionNotes || "Revoir la copie."}`,
            type: 'system' 
        });
        
        setCompletionNotes("");
        onClose();
      } else if (action === "promote") {
        const res = await fetch(signedUrl || attachmentUrl!);
        const blob = await res.blob();
        const file = new File([blob], `${promoteTitle}.pdf`, { type: blob.type });
        publishFile(file, promoteTitle, promoteCategory, mission.id);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-start justify-between">
          <div className="flex gap-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${mission.urgency === "critical" ? "bg-rose-500 text-white" : "bg-indigo-600 text-white"}`}>
              <i className={`fa-solid ${mission.urgency === "critical" ? "fa-triangle-exclamation" : "fa-rocket"}`}></i>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <MissionStatusBadge status={mission.status} />
              </div>
              <h2 className="text-3xl font-black text-slate-900">{mission.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:text-rose-500 transition-all">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="px-8 border-b border-slate-100 flex gap-8">
          {["details", "chat"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
              {tab === "details" ? "Détails" : "Discussion"} {tab === "chat" && <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px]">{messages.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col">
          {activeTab === "details" ? (
            <div className="flex flex-col lg:flex-row h-full">
              <div className={`flex-1 overflow-y-auto p-8 space-y-8 ${attachmentUrl ? "lg:w-[45%] lg:border-r border-slate-200" : "w-full max-w-5xl mx-auto"}`}>
                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                      <i className="fa-solid fa-trophy"></i>
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-900">{mission.xp_reward}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">Points XP</div>
                    </div>
                  </div>
                  
                  {mission.deadline && (
                    <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
                       <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center animate-pulse">
                          <i className="fa-solid fa-hourglass-half"></i>
                       </div>
                       <div>
                          <div className="text-sm font-black text-rose-500">
                            {(() => {
                                const daysLeft = Math.ceil((new Date(mission.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysLeft > 0 ? `${daysLeft} jours restants` : daysLeft === 0 ? "Aujourd'hui !" : "Expirée";
                            })()}
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">
                            Limite : {new Date(mission.deadline).toLocaleDateString()}
                          </div>
                       </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 px-4 pl-6">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Assigné à</div>
                    {mission.assignee ? (
                      <span className="font-bold text-indigo-900 text-xs bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                        {mission.assignee.first_name} {mission.assignee.last_name}
                      </span>
                    ) : <span className="text-xs text-slate-400 italic">Non assigné</span>}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-align-left"></i> Description
                  </h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium text-sm text-left">{mission.description}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-md space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-briefcase"></i> {mission.status === "completed" ? "Rapport" : "Espace de Travail"}
                  </h3>
                  
                  {mission.status === "completed" ? (
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 italic text-sm text-emerald-700 text-left">
                      {mission.completion_notes || "Aucune note."}
                    </div>
                  ) : mission.title.startsWith("Devenir Référent") && (mission.status === 'assigned' || mission.status === 'in_progress') && mission.assigned_to === user.id ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
                        <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 text-4xl shadow-lg shadow-indigo-100 mb-2">
                            <i className="fa-solid fa-graduation-cap"></i>
                        </div>
                        <div className="space-y-2 max-w-xs mx-auto">
                            <h4 className="text-xl font-black text-slate-900 tracking-tight">Certification</h4>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                Cette mission requiert la validation d'un examen de 10 questions.
                            </p>
                        </div>
                        <button
                            onClick={() => onStartQuiz?.(mission)}
                            className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-3 group"
                        >
                            <span>Commencer le Quiz</span>
                            <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </div>
                  ) : (mission.status === "in_progress" && mission.assigned_to === user.id) || (mission.status === "awaiting_validation" && user.role === UserRole.MANAGER) ? (
                    <div className="space-y-4">
                      {mission.status === "awaiting_validation" && user.role === UserRole.MANAGER && (
                        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-left">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Notes du technicien</p>
                          <p className="text-sm text-indigo-900 font-medium">{mission.completion_notes || "Pas de notes."}</p>
                        </div>
                      )}
                      <textarea
                        className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none shadow-inner text-sm"
                        placeholder="Notes de réalisation..."
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                      />
                      {user.role !== UserRole.MANAGER && (
                         <div className="pt-2">
                           <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                           <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={`w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-2xl transition-all ${attachmentUrl ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-400 hover:border-indigo-300"}`}>
                             <i className={`fa-solid ${isUploading ? 'fa-spin fa-circle-notch' : attachmentUrl ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
                             <span className="text-xs font-black uppercase tracking-widest">{isUploading ? "Envoi..." : attachmentUrl ? "Fichier ajouté" : "Ajouter un fichier"}</span>
                           </button>
                         </div>
                      )}
                      <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                         {user.role === UserRole.MANAGER ? (
                           <>
                             <button onClick={() => handleAction("complete")} disabled={!completionNotes.trim()} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50">Valider la mission</button>
                             <button onClick={() => handleAction("cancel")} disabled={!completionNotes.trim()} className="w-full py-3 border border-rose-200 text-rose-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 disabled:opacity-50">Refuser / Correction</button>
                           </>
                         ) : (
                           <button onClick={() => handleAction("complete")} disabled={!completionNotes.trim() && !attachmentUrl} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 hover:bg-indigo-700 transition-colors">Soumettre mon travail</button>
                         )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center space-y-4">
                       <p className="text-sm text-slate-500 font-medium">{mission.status === "open" ? "Prenez en charge cette mission." : "En attente."}</p>
                       {mission.status === "open" && <button onClick={() => onUpdateStatus(mission.id, "assigned")} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Prendre en charge</button>}
                       {mission.status === "assigned" && mission.assigned_to === user.id && <button onClick={() => handleAction("start")} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg">Démarrer</button>}
                    </div>
                  )}
                </div>
              </div>

              {attachmentUrl && (
                <div className="hidden lg:flex lg:w-[55%] flex-col bg-slate-100 h-full border-l border-white relative z-0">
                  <div className="p-4 bg-white/80 border-b border-slate-200 flex justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i className="fa-regular fa-eye"></i> Aperçu</h3>
                    {signedUrl && <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-all"><i className="fa-solid fa-arrow-up-right-from-square text-xs"></i></a>}
                  </div>
                  <div className="flex-1 p-4">
                    <div className="w-full h-full bg-white rounded-xl shadow-sm border overflow-hidden">
                      {signedUrl ? (
                         attachmentUrl.toLowerCase().endsWith(".pdf") ? (
                           <iframe src={`${signedUrl}#toolbar=0`} className="w-full h-full border-none" title="PDF" onLoad={() => setIframeReady(true)}></iframe>
                         ) : <img src={signedUrl} className="w-full h-full object-contain" alt="Preview" />
                      ) : <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Chargement sécurisé...</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <MissionChat
              messages={messages}
              userId={user.id}
              loadingMessages={loadingMessages}
              newMessage={newMessage}
              onNewMessageChange={setNewMessage}
              onSendMessage={handleSendMessage}
              chatContainerRef={chatContainerRef}
              missionStatus={mission.status}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MissionDetailsModal;
