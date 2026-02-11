import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { Mission, User, UserRole, MissionStatus } from "../types";

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
}

interface MissionMessage {
  id: string;
  mission_id: string;
  user_id: string;
  content: string;
  created_at: string;
  tempId?: string;
  user?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

const MissionDetailsModal: React.FC<MissionDetailsModalProps> = ({
  mission,
  user,
  onClose,
  onUpdateStatus,
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "chat">("details");
  const [messages, setMessages] = useState<MissionMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Status Actions State
  const [completionNotes, setCompletionNotes] = useState(mission.completion_notes || "");
  const [attachmentUrl, setAttachmentUrl] = useState(mission.attachment_url || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delay iframe rendering to fix white screen issue on initial load (animation timing)
  useEffect(() => {
    if (activeTab === "details") {
      setIframeReady(false);
      const timer = setTimeout(() => setIframeReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // For managers on awaiting_validation, we want a fresh notes field for feedback
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
    scrollToBottom();
  }, [messages, activeTab]);

  const fetchMessages = async () => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("mission_messages")
      .select(
        `
        *,
        user:user_profiles!mission_messages_user_id_fkey_profiles(first_name, last_name, role)
      `
      )
      .eq("mission_id", mission.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
    } else {
      setMessages(data || []);
    }
    setLoadingMessages(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`mission_chat:${mission.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mission_messages",
          filter: `mission_id=eq.${mission.id}`,
        },
        async (payload) => {
          console.log("New message payload:", payload);

          // Fetch user details for the new message to match the state structure
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
            const exists = prev.find(
              (m: MissionMessage) =>
                m.id === newMsg.id ||
                (m.tempId && m.content === newMsg.content && m.user_id === newMsg.user_id)
            );

            if (exists) {
              if (exists.tempId && exists.id !== newMsg.id) {
                return prev.map((m: MissionMessage) => (m.tempId === exists.tempId ? newMsg : m));
              }
              return prev;
            }

            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // Fetch messages once on mount to get the count for the tab badge
  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    if (activeTab === "chat") {
      const cleanup = subscribeToMessages();
      return () => {
        cleanup();
      };
    }
  }, [activeTab]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    const tempId = "temp-" + Date.now();

    // Optimistic message
    const optimisticMsg: MissionMessage = {
      id: tempId,
      tempId: tempId,
      mission_id: mission.id,
      user_id: user.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      user: {
        first_name: user.firstName || "Moi",
        last_name: user.lastName || "",
        role: user.role,
      },
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage("");

    try {
      const { data, error } = await supabase
        .from("mission_messages")
        .insert({
          mission_id: mission.id,
          user_id: user.id,
          content: messageContent,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setMessages((prev) =>
          prev.map((m) => (m.tempId === tempId ? { ...data, user: optimisticMsg.user } : m))
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      // Sanitize filename: remove spaces and special characters
      const cleanName = file.name
        .split(".")[0]
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const fileName = `${mission.id}/${Date.now()}_${cleanName}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("mission-attachments")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("mission-attachments").getPublicUrl(filePath);

      setAttachmentUrl(publicUrl);
    } catch (error: any) {
      console.error("Error uploading file (Full details):", {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      alert(`Erreur lors de l'envoi du fichier : ${error.message || "Erreur inconnue"}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAction = async (action: "claim" | "start" | "complete" | "cancel" | "promote") => {
    setIsSubmitting(true);

    try {
      if (action === "complete") {
        // If technician is submitting, status goes to 'awaiting_validation'
        // If manager is validating, status goes to 'completed'
        const newStatus: MissionStatus =
          user.role === UserRole.MANAGER || (user.role as any) === "manager"
            ? "completed"
            : "awaiting_validation";

        onUpdateStatus(mission.id, newStatus, completionNotes, attachmentUrl);
      } else if (action === "start") {
        onUpdateStatus(mission.id, "in_progress");
      } else if (action === "cancel") {
        // Refusal: Back to in_progress so tech can work on it again
        onUpdateStatus(mission.id, "in_progress", completionNotes);

        // Auto-send a chat message with the reason
        // If Manager provided a reason in the textarea, use it.
        const refusalReason = completionNotes || "Merci de revoir votre copie.";

        await supabase.from("mission_messages").insert({
          mission_id: mission.id,
          user_id: user.id,
          content: `❌ Mission refusée. Motif : ${refusalReason}`,
        });

        // Clear notes after refusal to avoid confusion
        setCompletionNotes("");
      } else if (action === "promote") {
        // 1. Create the procedure
        const { data: proc, error: procError } = await supabase
          .from("procedures")
          .insert({
            title: mission.title,
            content: mission.description,
            file_url: attachmentUrl,
            status: "published",
            category: "Missions / Transferts",
          })
          .select()
          .single();

        if (procError) throw procError;

        // 2. Mark mission as completed (if not already) and link procedure
        const { error: updateError } = await supabase
          .from("missions")
          .update({
            status: "completed",
            procedure_id: proc.id,
            completion_notes: completionNotes || "Promu en procédure officielle.",
          })
          .eq("id", mission.id);

        if (updateError) throw updateError;

        alert("Procédure créée avec succès !");
      }

      onClose();
    } catch (err) {
      console.error("Action error:", err);
      alert("Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      open: "bg-emerald-50 text-emerald-600",
      assigned: "bg-amber-50 text-amber-600",
      in_progress: "bg-indigo-50 text-indigo-600",
      completed: "bg-slate-50 text-slate-500",
      cancelled: "bg-rose-50 text-rose-500",
      awaiting_validation: "bg-amber-500 text-white shadow-lg shadow-amber-500/20",
    } as any;

    const labels = {
      open: "Disponible",
      assigned: "Assignée",
      in_progress: "En Cours",
      completed: "TERMINEE",
      cancelled: "Annulée",
      awaiting_validation: "EN ATTENTE DE VALIDATION",
    } as any;

    return (
      <span
        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[status] || "bg-gray-50 text-gray-500"}`}>
        {labels[status] || status}
      </span>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] w-full max-w-6xl h-[90vh] shadow-2xl animate-scale-up flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-start justify-between bg-white z-10">
          <div className="flex gap-6">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                mission.urgency === "critical"
                  ? "bg-rose-500 text-white shadow-rose-500/30"
                  : mission.urgency === "high"
                    ? "bg-orange-500 text-white shadow-orange-500/30"
                    : "bg-indigo-600 text-white shadow-indigo-500/30"
              }`}>
              <i
                className={`fa-solid ${mission.urgency === "critical" ? "fa-triangle-exclamation" : "fa-rocket"}`}></i>
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
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 border-b border-slate-100 flex gap-8">
          <button
            onClick={() => setActiveTab("details")}
            className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "details" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            Détails de la mission
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === "chat" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            Discussion{" "}
            <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px]">
              {messages.length}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col">
          {activeTab === "details" ? (
            <div className="flex flex-col lg:flex-row h-full">
              {/* LEFT COLUMN: Context & Actions (Scrollable) */}
              <div
                className={`flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar ${attachmentUrl ? "lg:w-[45%] lg:border-r border-slate-200" : "w-full max-w-5xl mx-auto"}`}>
                {/* Meta Info Bar */}
                <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3 pr-6 border-r border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-lg shadow-sm">
                      <i className="fa-solid fa-trophy"></i>
                    </div>
                    <div>
                      <div className="text-xl font-black text-slate-900">{mission.xp_reward}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Points XP
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-2">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-right text-slate-400">
                      Assigné
                      <br />à
                    </div>
                    {mission.assignee ? (
                      <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-[10px]">
                          {mission.assignee.first_name[0]}
                          {mission.assignee.last_name[0]}
                        </div>
                        <span className="font-bold text-indigo-900 text-xs">
                          {mission.assignee.first_name} {mission.assignee.last_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic bg-slate-50 px-3 py-1 rounded-lg">
                        Non assigné
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-align-left"></i> Description
                  </h3>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap font-medium text-sm">
                    {mission.description}
                  </p>
                </div>

                {/* Action Zone */}
                {(user.role === UserRole.TECHNICIAN ||
                  user.role === UserRole.MANAGER ||
                  (user.role as any) === "technicien") && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-md space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>

                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-briefcase"></i>{" "}
                      {mission.status === "completed" ? "Rapport de Mission" : "Espace de Travail"}
                    </h3>

                    {mission.status === "completed" ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                          <p className="text-emerald-700 italic text-sm">
                            {mission.completion_notes || "Aucune note de complétion."}
                          </p>
                        </div>
                        {/* Manager retroactive actions */}
                        {(user.role === UserRole.MANAGER || (user.role as any) === "manager") && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                            <button
                              onClick={() => handleAction("complete")}
                              className="py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
                              <i className="fa-solid fa-check"></i> Valider
                            </button>
                            <button
                              onClick={() => handleAction("cancel")}
                              className="py-3 bg-white text-rose-500 border border-rose-200 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                              <i className="fa-solid fa-rotate-left"></i> Révision
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (mission.status === "in_progress" && mission.assigned_to === user.id) ||
                      (mission.status === "awaiting_validation" &&
                        (user.role === UserRole.MANAGER || (user.role as any) === "manager")) ? (
                      <div className="space-y-4">
                        {/* Tech Notes Display for Manager */}
                        {mission.status === "awaiting_validation" &&
                          (user.role === UserRole.MANAGER || (user.role as any) === "manager") && (
                            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 mb-2">
                              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                                Notes du technicien
                              </p>
                              <p className="text-sm text-indigo-900 font-medium">
                                {mission.completion_notes || "Pas de notes."}
                              </p>
                            </div>
                          )}

                        {/* Input Area */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-700 ml-1">
                            {user.role === UserRole.MANAGER || (user.role as any) === "manager"
                              ? "Feedback / Motif refus"
                              : "Notes de réalisation"}
                          </label>
                          <textarea
                            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all resize-none shadow-inner text-sm"
                            placeholder={
                              user.role === UserRole.MANAGER || (user.role as any) === "manager"
                                ? "Raison du refus ou commentaire..."
                                : "Décrivez le travail réalisé..."
                            }
                            value={completionNotes}
                            onChange={(e) => setCompletionNotes(e.target.value)}
                          />
                        </div>

                        {/* File Upload for Tech */}
                        {user.role !== UserRole.MANAGER && (
                          <div className="pt-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileUpload}
                              className="hidden"
                              accept=".pdf,.doc,.docx,.jpg,.png"
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                              className={`w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-2xl transition-all group ${
                                attachmentUrl
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                  : "border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30"
                              }`}>
                              {isUploading ? (
                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                              ) : (
                                <i
                                  className={`fa-solid ${attachmentUrl ? "fa-check-circle" : "fa-cloud-arrow-up group-hover:scale-110 transition-transform"}`}></i>
                              )}
                              <span className="text-xs font-black uppercase tracking-widest">
                                {isUploading
                                  ? "Envoi..."
                                  : attachmentUrl
                                    ? "Fichier ajouté (Changer)"
                                    : "Ajouter un fichier"}
                              </span>
                            </button>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
                          {user.role === UserRole.MANAGER || (user.role as any) === "manager" ? (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                  onClick={() => handleAction("complete")}
                                  className="py-4 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2">
                                  <i className="fa-solid fa-check"></i> Valider
                                </button>
                                <button
                                  onClick={() => {
                                    if (!completionNotes.trim()) {
                                      alert(
                                        "Merci de saisir un motif de refus ou un feedback pour le technicien."
                                      );
                                      return;
                                    }
                                    handleAction("cancel");
                                  }}
                                  disabled={!completionNotes.trim()}
                                  className={`py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
                                    !completionNotes.trim()
                                      ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                                      : "bg-white text-rose-500 border-rose-200 hover:bg-rose-50"
                                  }`}>
                                  <i className="fa-solid fa-xmark"></i> Refuser
                                </button>
                              </div>
                              {attachmentUrl && (
                                <button
                                  onClick={() => handleAction("promote")}
                                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2">
                                  <i className="fa-solid fa-star"></i> Promouvoir en Procédure
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleAction("complete")}
                              disabled={!completionNotes.trim() && !attachmentUrl}
                              className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                              <i className="fa-solid fa-paper-plane"></i> Soumettre mon travail
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl text-slate-300">
                          <i className="fa-solid fa-lock"></i>
                        </div>
                        <p className="text-sm text-slate-500 font-medium">
                          {mission.status === "open"
                            ? "Réclamez cette mission pour commencer."
                            : mission.status === "assigned"
                              ? "Démarrez la mission pour activer l'espace."
                              : "En attente d'action."}
                        </p>

                        {mission.status === "open" && (
                          <button
                            onClick={() => {
                              onUpdateStatus(mission.id, "assigned");
                              onClose();
                            }}
                            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg">
                            Réclamer la mission
                          </button>
                        )}
                        {mission.status === "assigned" && mission.assigned_to === user.id && (
                          <button
                            onClick={() => handleAction("start")}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30">
                            Démarrer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Document Preview (Fixed/Sticky) */}
              {attachmentUrl && (
                <div className="hidden lg:flex lg:w-[55%] flex-col bg-slate-100 h-full border-l border-white shadow-inner relative z-0">
                  <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm border-b border-slate-200">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <i className="fa-regular fa-eye"></i> Aperçu du document
                    </h3>
                    <a
                      href={`${attachmentUrl}${attachmentUrl.includes("?") ? "&" : "?"}download=`}
                      download
                      className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm"
                      title="Télécharger">
                      <i className="fa-solid fa-download text-xs"></i>
                    </a>
                  </div>
                  <div className="flex-1 overflow-hidden p-4 flex flex-col relative">
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
                      {attachmentUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                        <img
                          src={attachmentUrl}
                          alt="Preview"
                          className="w-full h-full object-contain"
                        />
                      ) : attachmentUrl.toLowerCase().endsWith(".pdf") ? (
                        iframeReady ? (
                          <iframe
                            key={attachmentUrl}
                            src={`${attachmentUrl}#toolbar=0`}
                            className="w-full h-full border-none"
                            title="PDF Preview"></iframe>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50">
                            <i className="fa-solid fa-circle-notch fa-spin text-slate-300 text-3xl"></i>
                          </div>
                        )
                      ) : (
                        <iframe
                          src={`https://docs.google.com/gview?url=${encodeURIComponent(attachmentUrl)}&embedded=true`}
                          className="w-full h-full border-none"
                          title="Office Preview"></iframe>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Chat Tab
            <div className="flex flex-col h-full bg-white">
              <div className="flex-1 overflow-y-auto p-8 space-y-6" ref={chatContainerRef}>
                {messages.length === 0 && !loadingMessages ? (
                  <div className="text-center py-20 text-slate-300">
                    <i className="fa-regular fa-comments text-4xl mb-4"></i>
                    <p>Aucun message. Commencez la discussion !</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.user_id === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] ${isMe ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"} p-4 rounded-2xl rounded-tr-sm shadow-sm`}>
                          <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                          <div className="mt-2 flex items-center justify-between gap-4 opacity-70">
                            <span className="text-[10px] uppercase font-bold tracking-wider">
                              {msg.user?.first_name || "Utilisateur"}
                            </span>
                            <span className="text-[10px]">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {loadingMessages && (
                  <div className="text-center py-10 text-slate-400 italic">Chargement...</div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-4">
                <input
                  type="text"
                  className="flex-1 p-4 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none shadow-sm font-medium text-slate-700"
                  placeholder="Écrivez votre message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  className="w-14 h-14 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center">
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
