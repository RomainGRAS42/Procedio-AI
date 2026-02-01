import React, { useState, useRef, useEffect, useMemo } from "react";
import { Procedure, User } from "../types";
import { supabase } from "../lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProcedureDetailProps {
  procedure: Procedure;
  user: User;
  onBack: () => void;
  onSuggest?: (content: string) => void;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
}

interface SuggestionItem {
  id: string;
  suggestion: string;
  type: string;
  priority: string;
  status: string;
  created_at: string;
  manager_response?: string;
  responded_at?: string;
  user?: { first_name: string; last_name: string };
  manager?: { first_name: string };
}

const ProcedureDetail: React.FC<ProcedureDetailProps> = ({
  procedure,
  user,
  onBack,
  onSuggest,
}) => {
  const cleanTitle = useMemo(() => {
    if (!procedure?.title) return "Procédure sans titre";
    return procedure.title
      .replace(/\.[^/.]+$/, "")
      .replace(/^[0-9a-f.-]+-/i, "")
      .replace(/_/g, " ")
      .trim();
  }, [procedure.title]);

  const chatSessionId = useMemo(() => crypto.randomUUID(), [procedure.id, user.id]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: `Expert Procedio prêt. Je connais parfaitement le document **${cleanTitle}**. En quoi puis-je vous aider, ${user.firstName} ?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    msg: string;
    type: "success" | "info" | "error";
  } | null>(null);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [suggestionContent, setSuggestionContent] = useState("");
  const [suggestionType, setSuggestionType] = useState<"correction" | "update" | "add_step">("correction");
  const [suggestionPriority, setSuggestionPriority] = useState<"low" | "medium" | "high">("medium");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [history, setHistory] = useState<SuggestionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions = [
    {
      label: "Résumé",
      icon: "fa-align-left",
      prompt: "Peux-tu me faire un résumé concis de cette procédure ?",
    },
    {
      label: "Étapes (tirets)",
      icon: "fa-list-ul",
      prompt: "Extrais les étapes à suivre sous forme de liste à puces (tirets).",
    },
    {
      label: "Pré-requis",
      icon: "fa-tools",
      prompt: "Quels sont les pré-requis et outils nécessaires pour cette intervention ?",
    },
    {
      label: "Points de vigilance",
      icon: "fa-triangle-exclamation",
      prompt: "Quels sont les points de vigilance ou erreurs classiques à éviter ?",
    },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!procedure) return;
    if (procedure.fileUrl) {
      setDocUrl(procedure.fileUrl);
    } else {
      const { data } = supabase.storage.from("procedures").getPublicUrl(procedure.id);
      setDocUrl(data.publicUrl);
    }
    fetchHistory();
  }, [procedure]);

  const fetchHistory = async () => {
    if (!procedure?.id) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("procedure_suggestions")
        .select(`
          *,
          user:user_profiles!user_id(first_name, last_name),
          manager:user_profiles!manager_id(first_name)
        `)
        .eq("procedure_id", procedure.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Erreur history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // State pour stocker l'ID Pinecone, initialisé avec la prop si présente
  const [pineconeId, setPineconeId] = useState<string | undefined>(procedure.pinecone_document_id);

  // Sécurité : Si l'ID est manquant, on le récupère en base avec stratégie de repli
  useEffect(() => {
    const fetchMissingPineconeId = async () => {
      if (pineconeId) return;

      console.log("🔍 pinecone_document_id manquant, tentative de récupération...");
      
      try {
        let resultData = null;

        // Tentative 1 : Par UUID (si valide)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(procedure.id);
        
        if (isUUID) {
            const { data, error } = await supabase
                .from('procedures')
                .select('*')
                .eq('uuid', procedure.id)
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                console.log("✅ UUID FETCH RAW KEYS:", Object.keys(data));
                resultData = data;
            } else if (error) {
                console.warn("⚠️ Echec requête UUID (400 possible), passage au fallback Titre...", error.message);
            }
        }

        // Tentative 2 : Par Titre (Fallback) si UUID a échoué ou n'était pas valide
        if (!resultData) {
             console.log("🔄 Tentative via Titre:", procedure.title);
             const { data, error } = await supabase
                .from('procedures')
                .select('*')
                .eq('title', procedure.title)
                .limit(1)
                .maybeSingle();
             
             if (!error && data) {
                 resultData = data;
             }
        }

        // Tentative 3 : Par URL (Ultimate Fallback)
        if (!resultData && procedure.fileUrl) {
             console.log("🔄 Tentative via URL:", procedure.fileUrl);
             const { data, error } = await supabase
                .from('procedures')
                .select('*')
                .eq('file_url', procedure.fileUrl)
                .limit(1)
                .maybeSingle();
             
             if (!error && data) {
                 resultData = data;
             }
        }

        if (resultData && resultData.pinecone_document_id) {
          console.log("✅ pinecone_document_id récupéré avec succès :", resultData.pinecone_document_id);
          setPineconeId(resultData.pinecone_document_id);
        } else {
          console.warn("⚠️ Impossible de récupérer pinecone_document_id (ni part UUID, ni par Titre)");
        }
      } catch (err) {
        console.error("❌ Erreur critique recup pinecone_id:", err);
      }
    };

    fetchMissingPineconeId();
  }, [procedure.id, procedure.title, pineconeId]);

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const fullUserName = `${user.firstName} ${user.lastName || ""}`.trim();

      // ULTIME SÉCURITÉ : Force Fetch avec Failover (UUID -> Titre -> URL)
      let finalPineconeId = pineconeId;
      if (!finalPineconeId) {
          console.log("⚠️ FORCE FETCH START...");
          let resultData = null;

          // Tentative 1 : UUID
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(procedure.id);
          if (isUUID) {
               const { data } = await supabase.from('procedures').select('*').eq('uuid', procedure.id).limit(1).maybeSingle();
               if (data) resultData = data;
          }

          // Tentative 2 : Titre (Fallback)
          if (!resultData) {
               console.log("⚠️ FORCE FETCH Fallback Titre...");
               const { data } = await supabase.from('procedures').select('*').eq('title', procedure.title).limit(1).maybeSingle();
               if (data) resultData = data;
          }

          // Tentative 3 : URL (Ultimate Fallback)
          if (!resultData && procedure.fileUrl) {
               console.log("⚠️ FORCE FETCH Fallback URL...");
               const { data } = await supabase.from('procedures').select('*').eq('file_url', procedure.fileUrl).limit(1).maybeSingle();
               if (data) resultData = data;
          }
            
          if (resultData?.pinecone_document_id) {
            finalPineconeId = resultData.pinecone_document_id;
            setPineconeId(finalPineconeId);
            console.log("✅ FORCE FETCH SUCCESS :", finalPineconeId);
          } else {
             console.warn("❌ FORCE FETCH FAILED (UUID, Titre et URL échoués)");
          }
      }

      // DEBUG: Vérifier ce qui est envoyé
      console.log('🔍 DEBUG - Données envoyées au webhook:', {
        question: textToSend,
        title: cleanTitle,
        file_id: procedure.file_id || procedure.id,
        pinecone_document_id: finalPineconeId, 
        userName: fullUserName,
        sessionid: chatSessionId,
      });

      const response = await fetch("https://n8n.srv901593.hstgr.cloud/webhook/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: textToSend,
          title: cleanTitle,
          documentTitle: cleanTitle,
          file_id: procedure.file_id || procedure.id,
          pinecone_document_id: finalPineconeId,
          userName: fullUserName,
          sessionid: chatSessionId,
        }),
      });

      const responseText = await response.text();
      let data: any = {};

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          data = { output: responseText };
        }
      } else {
        data = { output: "Le serveur n'a pas renvoyé de réponse." };
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.output || data.text || (typeof data === "string" ? data : "Analyse terminée."),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: "err",
          sender: "ai",
          text: "Désolé, je rencontre une difficulté technique avec le moteur IA.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestionContent.trim()) return;
    setIsSubmittingSuggestion(true);

    try {
      // 1. Insertion de la suggestion avec tous les champs
      const { data: newSuggestion, error } = await supabase
        .from("procedure_suggestions")
        .insert({
          procedure_id: procedure.id,
          user_id: user.id,
          suggestion: suggestionContent,
          type: suggestionType,
          priority: suggestionPriority,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Notification temps réel pour le manager
      await supabase.from("notes").insert([
        {
          user_id: user.id,
          title: `LOG_SUGGESTION_${newSuggestion.id}`,
          content: `💡 Suggestion de ${user.firstName} ${user.lastName || ""} sur "${cleanTitle}" [Priorité: ${suggestionPriority.toUpperCase()}]`,
          is_locked: false,
        },
      ]);

      setNotification({ msg: "Suggestion envoyée au manager !", type: "success" });
      setIsSuggestionModalOpen(false);
      setSuggestionContent("");
      fetchHistory(); // Rafraîchir l'historique
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error("Erreur suggestion:", err);
      setNotification({ msg: "Erreur lors de l'envoi.", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-fade-in overflow-hidden">
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
          <div className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4">
            <i className="fa-solid fa-circle-check text-emerald-400"></i>
            <span className="font-black text-xs uppercase tracking-widest">{notification.msg}</span>
          </div>
        </div>
      )}

      {/* CHAT IA */}
      <div className="lg:w-1/3 flex flex-col bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-brain"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">
              Expert Procedio
            </h3>
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">
              IA Connectée
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/10 scrollbar-hide">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] p-5 rounded-3xl shadow-sm ${
                  msg.sender === "user"
                    ? "bg-slate-900 text-white rounded-tr-none font-bold text-sm"
                    : "bg-white text-slate-600 border border-slate-100 rounded-tl-none text-[13px] leading-relaxed"
                }`}>
                {msg.sender === "ai" ? (
                  <div className="procedio-markdown">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-50 space-y-4">
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(action.prompt)}
                disabled={isTyping}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50/50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 shadow-sm active:scale-95 disabled:opacity-50">
                <i className={`fa-solid ${action.icon}`}></i>
                {action.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Posez votre question sur ce document..."
              className="w-full pl-6 pr-14 py-6 rounded-3xl bg-slate-50 border-none outline-none font-bold text-slate-700 text-sm shadow-inner focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={isTyping}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isTyping}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600/20 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-20">
              <i className="fa-solid fa-paper-plane text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      {/* VISIONNEUSE PDF */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-6 overflow-hidden">
            <button
              onClick={onBack}
              className="w-12 h-12 rounded-2xl border border-slate-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="min-w-0">
              <h2 className="font-black text-slate-900 text-xl truncate mb-1">{cleanTitle}</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                {procedure?.category}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsSuggestionModalOpen(true)}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm flex items-center gap-2">
              <i className="fa-regular fa-lightbulb text-sm"></i>
              <span className="hidden sm:inline">Suggérer une modif</span>
            </button>
            <button
              onClick={() => window.open(docUrl || "", "_blank")}
              className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100">
              Plein écran
            </button>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-inner relative overflow-hidden">
          {docUrl ? (
            <iframe
              src={`${docUrl}#toolbar=0`}
              className="w-full h-full"
              title="PDF Viewer"
              allowFullScreen></iframe>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-6">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-black text-[10px] uppercase tracking-widest">
                Récupération du PDF...
              </p>
            </div>
          )}
        </div>

        {/* HISTORIQUE DES SUGGESTIONS - COLLAPSIBLE */}
        <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="w-full p-8 flex items-center justify-between hover:bg-slate-50/50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div className="text-left">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">
                  Historique des améliorations
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {isHistoryExpanded ? 'Cliquez pour masquer' : 'Cliquez pour afficher'}
                </p>
              </div>
            </div>
            <i className={`fa-solid fa-chevron-down text-slate-300 transition-transform ${isHistoryExpanded ? 'rotate-180' : ''}`}></i>
          </button>

          {isHistoryExpanded && (
            <div className="px-8 pb-8 space-y-6 animate-slide-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loadingHistory ? (
              <div className="col-span-full py-10 flex justify-center">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : history.length > 0 ? (
              history.map((item) => (
                <div key={item.id} className="p-5 rounded-3xl bg-slate-50 border border-slate-100 space-y-3 hover:shadow-md transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                        item.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        item.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        PRIORITÉ {item.priority === 'high' ? 'HAUTE' : item.priority === 'medium' ? 'MOYENNE' : 'BASSE'}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(item.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                      item.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {item.status === 'approved' ? 'Validé' : 'En attente'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                    "{item.suggestion}"
                  </p>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase">
                      Par {item.user?.first_name || "Un technicien"}
                    </span>
                  </div>
                  {item.manager_response && (
                    <div className="mt-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 relative">
                      <div className="absolute -top-2 left-4 px-2 bg-white text-[7px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100 rounded">
                        Réponse de {item.manager?.first_name || "Manager"}
                      </div>
                      <p className="text-[11px] font-bold text-slate-600 leading-relaxed mt-1">
                        {item.manager_response}
                      </p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full py-10 text-center text-slate-300">
                <p className="text-[10px] font-black uppercase tracking-widest">Aucune suggestion pour le moment.</p>
              </div>
            )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* MODAL SUGGESTION */}
      {isSuggestionModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                <i className="fa-solid fa-lightbulb"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg">Suggérer une modification</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Aidez-nous à améliorer cette procédure
                </p>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Type de suggestion
                </label>
                <select
                  value={suggestionType}
                  onChange={(e) => setSuggestionType(e.target.value as any)}
                  className="w-full p-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-600 text-xs appearance-none cursor-pointer">
                  <option value="correction">Correction d'erreur</option>
                  <option value="update">Mise à jour du contenu</option>
                  <option value="add_step">Ajout d'étape</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Priorité
                </label>
                <select
                  value={suggestionPriority}
                  onChange={(e) => setSuggestionPriority(e.target.value as any)}
                  className="w-full p-3 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-600 text-xs appearance-none cursor-pointer">
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                </select>
              </div>
            </div>

            <textarea
              value={suggestionContent}
              onChange={(e) => setSuggestionContent(e.target.value)}
              placeholder="Décrivez la modification souhaitée ou l'erreur constatée..."
              className="w-full h-40 p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 resize-none mb-6 text-sm"
              autoFocus
            />

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setIsSuggestionModalOpen(false)}
                className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                Annuler
              </button>
              <button
                onClick={handleSubmitSuggestion}
                disabled={!suggestionContent.trim() || isSubmittingSuggestion}
                className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2">
                {isSubmittingSuggestion ? (
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                ) : (
                  <i className="fa-solid fa-paper-plane"></i>
                )}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcedureDetail;
