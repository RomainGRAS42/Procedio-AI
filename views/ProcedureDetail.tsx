import React, { useState, useRef, useEffect, useMemo } from "react";
import { Procedure, User, UserRole } from "../types";
import { supabase } from "../lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 🚀 PDF.js Integration
import { Viewer, Worker } from "@react-pdf-viewer/core";
import { searchPlugin } from "@react-pdf-viewer/search";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/search/lib/styles/index.css";
import "@react-pdf-viewer/zoom/lib/styles/index.css";

import MasteryQuizModal from "../components/MasteryQuizModal";

// 🎨 Custom Styles to hide unwanted "Whole words" option
const hideWholeWordsStyles = `
  .rpv-search__popover-footer-item:nth-child(2) {
    display: none !important;
  }
`;

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

// 🛡️ ERROR BOUNDARY COMPONENT
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("🛑 ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-900 text-red-400 p-4 rounded-xl border border-red-900/50">
          <i className="fa-solid fa-triangle-exclamation text-3xl mb-3"></i>
          <h3 className="font-bold text-lg mb-2">Erreur du Lecteur PDF</h3>
          <pre className="text-[10px] bg-black/50 p-3 rounded-lg max-w-full overflow-auto text-left font-mono">
            {this.state.error?.toString() || "Erreur inconnue"}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs transition-colors">
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 🛡️ ISOLATED MARKDOWN VIEWER COMPONENT
const MarkdownViewer = React.memo(({ content }: { content: string }) => {
  return (
    <div className="flex-1 min-h-[400px] bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-y-auto p-8 md:p-12 relative group/markdown">
      <div className="procedure-reader">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>

      {/* Decorative gradient corners */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50/50 to-transparent pointer-events-none rounded-tr-[3rem]"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-50/50 to-transparent pointer-events-none rounded-bl-[3rem]"></div>
    </div>
  );
});

// 🛡️ ISOLATED PDF VIEWER COMPONENT
// This prevents high-level re-renders from breaking the PDF.js plugin state
const SafePDFViewer = React.memo(({ fileUrl }: { fileUrl: string }) => {
  // 🔍 PDF Search Plugin
  const searchPluginInstance = searchPlugin();
  const { highlight, ShowSearchPopover } = searchPluginInstance;

  // 🔎 PDF Zoom Plugin
  const zoomPluginInstance = zoomPlugin();
  const { ZoomIn, ZoomOut, Zoom } = zoomPluginInstance;
  const plugins = useMemo(
    () => [searchPluginInstance, zoomPluginInstance],
    [searchPluginInstance, zoomPluginInstance]
  );
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#search=")) {
        const parts = hash.split("=");
        if (parts.length > 1) {
          const rawTerm = parts[1];
          if (rawTerm && typeof rawTerm === "string") {
            const safeTerm = String(rawTerm).replace(/"/g, "");
            const searchTerm = decodeURIComponent(safeTerm);
            if (searchTerm && searchTerm.length > 2) {
              highlight(searchTerm);
            }
          }
        }
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [highlight, fileUrl]);

  return (
    <div className="flex-1 min-h-[400px] bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl relative flex flex-col group/viewer">
      <style>{hideWholeWordsStyles}</style>
      {/* FLOATING TOOLBAR */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-2 bg-slate-800/98 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl opacity-0 group-hover/viewer:opacity-100 transition-all duration-300 translate-y-2 group-hover/viewer:translate-y-0">
        <div className="flex items-center gap-1 pr-2 border-r border-white/10">
          <ZoomOut>
            {(props) => (
              <button
                onClick={props.onClick}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <i className="fa-solid fa-magnifying-glass-minus"></i>
              </button>
            )}
          </ZoomOut>
          <div className="min-w-[45px] text-center">
            <Zoom>
              {(props) => (
                <span className="text-[10px] font-black text-indigo-400">
                  {Math.round(props.scale * 100)}%
                </span>
              )}
            </Zoom>
          </div>
          <ZoomIn>
            {(props) => (
              <button
                onClick={props.onClick}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <i className="fa-solid fa-magnifying-glass-plus"></i>
              </button>
            )}
          </ZoomIn>
        </div>

        <ShowSearchPopover>
          {(props) => (
            <button
              onClick={props.onClick}
              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              title="Rechercher dans le document">
              <i className="fa-solid fa-search"></i>
            </button>
          )}
        </ShowSearchPopover>
      </div>

      <div className="flex-1 overflow-hidden" style={{ filter: "brightness(0.95) contrast(1.05)" }}>
        <ErrorBoundary
          fallback={
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <i className="fa-solid fa-bug text-2xl mb-2"></i>
                <p>Erreur du lecteur PDF</p>
              </div>
            </div>
          }>
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
            <div className="h-full w-full">
              <Viewer
                fileUrl={fileUrl}
                plugins={plugins}
                theme="dark"
                onDocumentLoad={(e) => {
                  try {
                    const hash = window.location.hash;
                    if (hash && hash.startsWith("#search=")) {
                      const parts = hash.split("=");
                      if (parts.length > 1) {
                        const rawTerm = parts[1];
                        if (rawTerm && typeof rawTerm === "string") {
                          // Defensive coding: Ensure we are working with a string
                          const safeTerm = String(rawTerm).replace(/"/g, "");
                          const searchTerm = decodeURIComponent(safeTerm);

                          if (searchTerm && searchTerm.length > 2) {
                            console.log("🔦 Auto-highlighting (onLoad):", searchTerm);
                            highlight(searchTerm);
                          }
                        }
                      }
                    }
                  } catch (err) {
                    console.error("Error highlighting on load:", err);
                  }
                }}
              />
            </div>
          </Worker>
        </ErrorBoundary>
      </div>
    </div>
  );
});

const ProcedureDetail: React.FC<ProcedureDetailProps> = ({
  procedure,
  user,
  onBack,
  onSuggest,
}) => {
  // Ref to prevent race condition between optimistic update and stale fetch
  const justCompletedRef = React.useRef(false);
  
  const cleanTitle = useMemo(() => {
    try {
      if (!procedure?.title) return "Procédure sans titre";
      return String(procedure.title)
        .replace(/\.[^/.]+$/, "")
        .replace(/^[0-9a-f.-]+-/i, "")
        .replace(/_/g, " ")
        .trim();
    } catch (e) {
      console.error("Error cleaning title:", e);
      return "Procédure sans titre";
    }
  }, [procedure?.title]);

  const chatSessionId = useMemo(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return Math.random().toString(36).substring(7);
    }
  }, [procedure?.id, user?.id]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: `Expert Procedio prêt. Je connais parfaitement le document **${cleanTitle}**. En quoi puis-je vous aider${user?.firstName ? `, ${user.firstName}` : ""} ?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [isMarkdownLoading, setIsMarkdownLoading] = useState(false);
  const [notification, setNotification] = useState<{
    msg: string;
    type: "success" | "info" | "error";
  } | null>(null);
  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [suggestionContent, setSuggestionContent] = useState("");
  const [suggestionType, setSuggestionType] = useState<"correction" | "update" | "add_step">(
    "correction"
  );
  const [suggestionPriority, setSuggestionPriority] = useState<"low" | "medium" | "high">("medium");
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [history, setHistory] = useState<SuggestionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [referentExpert, setReferentExpert] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null>(null);
  const [masteryRequest, setMasteryRequest] = useState<any | null>(null);
  const [isMasteryModalOpen, setIsMasteryModalOpen] = useState(false);
  const [procedureExperts, setProcedureExperts] = useState<string[]>([]); // Liste des noms des experts

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

    const resolveDocUrl = async () => {
      let finalUrl = null;
      const path = procedure.fileUrl || (procedure as any).file_url;

      if (path) {
        if (path.startsWith("http")) {
          finalUrl = path;
        } else {
          const { data } = supabase.storage.from("procedures").getPublicUrl(path);
          finalUrl = data?.publicUrl || null;
        }
      } else {
        // Fallback to ID at root
        const fallbackId = procedure.id || procedure.uuid || (procedure as any).file_id;
        if (fallbackId) {
          const { data } = supabase.storage.from("procedures").getPublicUrl(fallbackId);
          finalUrl = data?.publicUrl || null;
        }
      }
      setDocUrl(finalUrl);

      // Check for Markdown (Defensive against query parameters)
      const isMd =
        finalUrl &&
        (finalUrl.split("?")[0].toLowerCase().endsWith(".md") ||
          procedure.fileUrl?.split("?")[0].toLowerCase().endsWith(".md"));

      if (isMd) {
        setIsMarkdownLoading(true);
        try {
          const res = await fetch(finalUrl);
          const text = await res.text();
          setMarkdownContent(text);
        } catch (err) {
          console.error("Error fetching markdown content:", err);
          setMarkdownContent("Erreur lors du chargement de la procédure Markdown.");
        } finally {
          setIsMarkdownLoading(false);
        }
      } else {
        setMarkdownContent(null);
      }
    };

    resolveDocUrl();
    fetchHistory();
    fetchReferent();
    fetchMasteryStatus();
    fetchProcedureExperts();
  }, [procedure?.id, procedure?.fileUrl]);

  const fetchMasteryStatus = async () => {
    const targetUuid = procedure.db_id || (typeof procedure.id === 'string' && procedure.id.includes('-') ? procedure.id : null);
    if (!targetUuid) return;

    try {
      const { data } = await supabase
        .from('mastery_requests')
        .select('*')
        .eq('procedure_id', targetUuid)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setMasteryRequest(data);
    } catch (err) {
      console.error("Error fetching mastery status:", err);
    }
  };

  const fetchReferent = async () => {
    const targetUuid =
      procedure.db_id ||
      (typeof procedure.id === "string" && procedure.id.includes("-") ? procedure.id : null);
    if (!targetUuid) return;

    try {
      const { data, error } = await supabase
        .from("procedure_referents")
        .select(
          `
          user:user_profiles (id, first_name, last_name, avatar_url)
        `
        )
        .eq("procedure_id", targetUuid)
        .maybeSingle();

      if (data && (data as any).user) {
        setReferentExpert((data as any).user);
      } else {
        setReferentExpert(null);
      }
    } catch (err) {
      console.error("Error fetching referent:", err);
    }
  };

  const fetchHistory = async () => {
    // We prioritize UUID for consistency in joins
    const targetUuid =
      procedure.db_id ||
      (typeof procedure.id === "string" && procedure.id.includes("-") ? procedure.id : null);

    if (!targetUuid) {
      console.warn("⚠️ fetchHistory: No UUID found for procedure", procedure.id);
      return;
    }

    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("procedure_suggestions")
        .select(
          `
          *,
          user:user_profiles!user_id(first_name, last_name),
          manager:user_profiles!manager_id(first_name)
        `
        )
        .eq("procedure_id", targetUuid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Erreur history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchProcedureExperts = async () => {
    const targetUuid = procedure.db_id || (typeof procedure.id === 'string' && procedure.id.includes('-') ? procedure.id : null);
    if (!targetUuid) return;

    try {
      const { data, error } = await supabase
        .from('mastery_requests')
        .select(`
          user_profiles:user_id (first_name, last_name)
        `)
        .eq('procedure_id', targetUuid)
        .eq('status', 'completed')
        .gte('score', 70) // Score minimum pour être considéré expert
        .limit(5);

      if (data) {
        const experts = data
          .map((item: any) => `${item.user_profiles?.first_name} ${item.user_profiles?.last_name}`)
          .filter(Boolean);
        setProcedureExperts(experts);
      }
    } catch (err) {
      console.error("Error fetching procedure experts:", err);
    }
  };

  // State pour stocker l'ID Pinecone, initialisé avec la prop si présente (Defensive Coding)
  const [pineconeId, setPineconeId] = useState<string | undefined>(() => {
    try {
      return procedure?.file_id || procedure?.pinecone_document_id;
    } catch {
      return undefined;
    }
  });

  // State pour stocker l'ID réel de la procédure (PK)
  const [realProcedureId, setRealProcedureId] = useState<number | string | null>(null);
  const hasIncrementedView = useRef(false);

  useEffect(() => {
    fetchHistory();

    // 🚀 AUTOMATISATION : Incrémentation des vues dès qu'on a l'ID réel
    if (realProcedureId && !hasIncrementedView.current) {
      const incrementViews = async () => {
        hasIncrementedView.current = true;
        console.log("📈 Tentative d'incrémentation des vues pour:", realProcedureId);

        try {
          const isUUID = typeof realProcedureId === "string" && realProcedureId.includes("-");
          const rpcName = isUUID ? "increment_procedure_views_uuid" : "increment_procedure_views";
          const paramName = isUUID ? "row_uuid" : "row_id";

          const { error: viewError } = await supabase.rpc(rpcName, {
            [paramName]: realProcedureId,
          });

          if (viewError) {
            console.warn("⚠️ RPC increment failed, trying manual update", viewError);
            const { error: updateError } = await supabase
              .from("procedures")
              .update({ views: (procedure.views || 0) + 1 })
              .eq(isUUID ? "uuid" : "id", realProcedureId);

            if (updateError) console.error("❌ Manual view update failed:", updateError);
          }

          // Log de consultation
          await supabase.from("notes").insert([
            {
              user_id: user.id,
              title: `CONSULTATION_${procedure.title.substring(0, 50)}`,
              content: `${user.firstName} a consulté la procédure "${procedure.title}"`,
              procedure_id: isUUID ? realProcedureId : procedure.db_id || procedure.uuid || null,
            },
          ]);

          // 🎮 GAMIFICATION : Gain d'XP (+5) et Stats par catégorie
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("xp_points, stats_by_category")
            .eq("id", user.id)
            .single();

          if (profile) {
            const currentXP = profile.xp_points || 0;
            const currentStats = profile.stats_by_category || {};
            const category = procedure.category || "GÉNÉRAL";

            const newStats = {
              ...currentStats,
              [category]: (currentStats[category] || 0) + 1,
            };

            await supabase
              .from("user_profiles")
              .update({
                xp_points: currentXP + 5,
                stats_by_category: newStats,
                level: Math.floor((currentXP + 5) / 100) + 1, // Niveau = 1 + XP/100
              })
              .eq("id", user.id);
          }
        } catch (err) {
          console.error("❌ Error in incrementViews:", err);
        }
      };
      incrementViews();
    }
  }, [realProcedureId]);

  // Sécurité : Récupération de l'ID réel et du pinecone_id
  useEffect(() => {
    const fetchProcedureDetails = async () => {
      // Si on a déjà un ID numérique valide dans procedure.db_id ou procedure.id, on l'utilise
      if (procedure.db_id) {
        setRealProcedureId(procedure.db_id);
      } else if (procedure.id) {
        // Supporter ID numérique OU UUID
        setRealProcedureId(procedure.id);
      }

      // Si pineconeId est déjà là et qu'on a l'ID réel, on arrête
      if (pineconeId && realProcedureId) return;

      console.log("🔍 Récupération détails procédure...");

      try {
        let resultData = null;

        // Tentative 1 : Par UUID (si valide)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(procedure.id)
        );

        if (isUUID) {
          const { data, error } = await supabase
            .from("procedures")
            .select("*")
            .eq("uuid", procedure.id)
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            resultData = data;
          }
        }

        // Tentative 2 : Par Titre (Fallback)
        if (!resultData) {
          const { data, error } = await supabase
            .from("procedures")
            .select("*")
            .eq("title", procedure.title)
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            resultData = data;
          }
        }

        // Tentative 3 : Par URL (Ultimate Fallback)
        if (!resultData && procedure.fileUrl) {
          const { data, error } = await supabase
            .from("procedures")
            .select("*")
            .eq("file_url", procedure.fileUrl)
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            resultData = data;
          }
        }

        if (resultData) {
          if (resultData.pinecone_document_id) {
            setPineconeId(resultData.pinecone_document_id);
          }
          if (resultData.id) {
            console.log("✅ ID réel procédure trouvé :", resultData.id);
            setRealProcedureId(resultData.id);
          }
        }
      } catch (err) {
        console.error("❌ Erreur récupération détails procédure:", err);
      }
    };

    fetchProcedureDetails();
  }, [procedure.id, procedure.title, procedure.fileUrl, pineconeId, realProcedureId]);

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
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          procedure.id
        );
        if (isUUID) {
          const { data } = await supabase
            .from("procedures")
            .select("file_id, uuid, title, file_url")
            .eq("uuid", procedure.id)
            .limit(1)
            .maybeSingle();
          if (data) resultData = data;
        }

        // Tentative 2 : Titre (Fallback)
        if (!resultData) {
          console.log("⚠️ FORCE FETCH Fallback Titre...");
          const { data } = await supabase
            .from("procedures")
            .select("*")
            .eq("title", procedure.title)
            .limit(1)
            .maybeSingle();
          if (data) resultData = data;
        }

        // Tentative 3 : URL (Ultimate Fallback)
        if (!resultData && procedure.fileUrl) {
          console.log("⚠️ FORCE FETCH Fallback URL...");
          const { data } = await supabase
            .from("procedures")
            .select("*")
            .eq("file_url", procedure.fileUrl)
            .limit(1)
            .maybeSingle();
          if (data) resultData = data;
        }

        const validFileId = resultData?.file_id || resultData?.uuid;
        if (validFileId) {
          finalPineconeId = validFileId;
          setPineconeId(finalPineconeId);
          console.log("✅ FORCE FETCH SUCCESS :", finalPineconeId);
        } else {
          console.warn("❌ FORCE FETCH FAILED (UUID, Titre et URL échoués)");
        }
      }

      // DEBUG: Vérifier ce qui est envoyé
      console.log("🔍 DEBUG - Données envoyées au webhook:", {
        question: textToSend,
        title: cleanTitle,
        file_id: procedure.file_id || procedure.id,
        pinecone_document_id: finalPineconeId || procedure.file_id || procedure.id,
        userName: fullUserName,
        sessionid: chatSessionId,
      });

      const response = await fetch(
        "https://pczlikyvfmrdauufgxai.supabase.co/functions/v1/chat-with-pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: textToSend,
            file_id: finalPineconeId || procedure.file_id || procedure.id,
            pinecone_document_id: finalPineconeId || procedure.file_id || procedure.id,
            userName: fullUserName,
            referentName: referentExpert
              ? `${referentExpert.first_name} ${referentExpert.last_name}`
              : undefined,
            expertNames: procedureExperts, // Envoi des experts au chat
          }),
        }
      );

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

    // CRITICAL: We MUST use the UUID for the procedure_id foreign key
    const targetUuid =
      procedure.db_id ||
      (typeof procedure.id === "string" && procedure.id.includes("-") ? procedure.id : null);

    if (!targetUuid) {
      console.error("❌ handleSubmitSuggestion: Missing procedure UUID", procedure.id);
      setNotification({ msg: "Erreur technique : ID procédure manquant.", type: "error" });
      setIsSubmittingSuggestion(false);
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    try {
      // 1. Insertion de la suggestion
      const { data: newSuggestion, error } = await supabase
        .from("procedure_suggestions")
        .insert({
          procedure_id: targetUuid,
          user_id: user.id,
          suggestion: suggestionContent,
          type: suggestionType,
          priority: suggestionPriority,
          status: "pending",
          viewed: false,
        })
        .select()
        .single();

      if (error) throw error;

      setIsSuggestionModalOpen(false);
      setSuggestionContent("");
      setNotification({ msg: "Suggestion envoyée !", type: "success" });

      fetchHistory(); // Refresh history immediately

      // Log for Manager notification
      await supabase.from("notes").insert({
        user_id: user.id,
        procedure_id: targetUuid,
        title: `LOG_SUGGESTION_${newSuggestion.id}`,
        content: `${user.firstName} a proposé une modification sur : ${procedure.title}`,
        viewed: false,
      });

      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error("Erreur submission suggestion:", err);
      setNotification({ msg: "Erreur lors de l'envoi.", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  const handleRequestMastery = async () => {
    const targetUuid = procedure.db_id || (typeof procedure.id === 'string' && procedure.id.includes('-') ? procedure.id : null);
    if (!targetUuid) return;

    setNotification({ msg: "Demande envoyée au manager !", type: "success" });
    
    try {
      // 1. New Table entry
      const { data, error } = await supabase
        .from('mastery_requests')
        .insert({
          user_id: user.id,
          procedure_id: targetUuid,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) throw error;
      setMasteryRequest(data);

      // 2. Legacy Log entry (for dashboard notifications)
      await supabase.from("notes").insert([
        {
          user_id: user.id,
          title: `CLAIM_MASTERY_${procedure.title.substring(0, 50)}`,
          content: `${user.firstName} demande à valider sa maîtrise sur "${procedure.title}"`,
          procedure_id: targetUuid,
        },
      ]);
    } catch (err) {
      console.error("Error requesting mastery:", err);
    }

    setTimeout(() => setNotification(null), 3000);
  };

  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6 animate-fade-in overflow-hidden relative pt-8 px-4 md:px-10 pb-6">
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
          <div className="bg-indigo-600 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4">
            <i className="fa-solid fa-circle-check text-emerald-400"></i>
            <span className="font-black text-xs uppercase tracking-widest">{notification.msg}</span>
          </div>
        </div>
      )}

      {/* CHAT IA (SIDEBAR) */}
      <div
        className={`flex flex-col bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden transition-all duration-500 ease-in-out
          ${
            isChatOpen
              ? "lg:w-1/3 w-full opacity-100 translate-x-0"
              : "w-0 opacity-0 lg:translate-x-0 hidden lg:block lg:w-0 overflow-hidden border-0 p-0 m-0"
          }
        `}
        style={{ flexBasis: isChatOpen ? "33%" : "0px" }} // Force width 0 when closed
      >
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
          <button
            onClick={() => setIsChatOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* ... (Chat Content) ... */}
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
                    <ErrorBoundary
                      fallback={
                        <p className="text-red-400 text-xs">Erreur d'affichage du message.</p>
                      }>
                      {typeof msg.text === "string" ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                      ) : (
                        <span>{String(msg.text)}</span>
                      )}
                    </ErrorBoundary>
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
          {/* Quick Actions and Input remain here... */}
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
      <div
        className={`flex flex-col gap-6 transition-all duration-500 ease-in-out overflow-y-auto scrollbar-hide ${isChatOpen ? "lg:w-2/3" : "w-full"}`}>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-6 overflow-hidden">
            <button
              onClick={onBack}
              className="w-12 h-12 rounded-2xl border border-slate-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="min-w-0">
              <h2 className="font-black text-slate-900 text-xl truncate mb-1">{cleanTitle}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">
                  {procedure?.category}
                </span>
                {referentExpert && (
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-lg border border-amber-100 flex items-center gap-2">
                    <i className="fa-solid fa-certificate text-[8px]"></i>
                    Expert : {referentExpert.first_name} {referentExpert.last_name}
                  </span>
                )}
                {/* Badge MAITRISE pour l'utilisateur courant s'il a réussi */}
                {masteryRequest?.status === 'completed' && (masteryRequest.score || 0) >= 70 && (
                   <span className="text-[10px] font-black text-white uppercase tracking-widest bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 rounded-lg shadow-lg shadow-emerald-500/30 flex items-center gap-2 animate-fade-in">
                    <i className="fa-solid fa-medal text-[9px]"></i>
                    MAÎTRISE VALIDÉE
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Context Button */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm h-10
                 ${
                   isChatOpen
                     ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200"
                     : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                 }`}>
              <i className={`fa-solid ${isChatOpen ? "fa-xmark" : "fa-comments"}`}></i>
              <span>{isChatOpen ? "Fermer IA" : "Discuter avec le PDF"}</span>
            </button>

            {/* Mastery Button Workflow */}
            {user.role !== UserRole.MANAGER && (
              <>
                {/* 🛡️ SINGLE REFERENT LOGIC */}
                {referentExpert && referentExpert.id !== user.id ? (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-slate-200 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm border-2 border-white shadow-sm">
                                {referentExpert.avatar_url ? (
                                    <img src={referentExpert.avatar_url} alt="Referent" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span className="font-black">{referentExpert.first_name[0]}{referentExpert.last_name[0]}</span>
                                )}
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Gardien de la Procédure</h4>
                                <p className="text-[10px] font-bold text-slate-400">Cette procédure est sous la responsabilité de <span className="text-indigo-600">{referentExpert.first_name} {referentExpert.last_name}</span>.</p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-white text-slate-300 flex items-center justify-center shadow-sm">
                            <i className="fa-solid fa-lock"></i>
                        </div>
                    </div>
                ) : (
                    <>
                        {masteryRequest?.status === 'approved' ? (
                  <button
                    onClick={() => setIsMasteryModalOpen(true)}
                    className="px-4 py-3 h-10 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 animate-bounce"
                  >
                    <i className="fa-solid fa-graduation-cap"></i>
                    <span>Lancer l'Examen</span>
                  </button>
                ) : masteryRequest?.status === 'pending' ? (
                  <div className="px-4 py-3 h-10 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-clock animate-pulse"></i>
                    <span>Examen en attente</span>
                  </div>
                ) : masteryRequest?.status === 'completed' ? (
                  (() => {
                    const score = masteryRequest.score || 0;
                    const isSuccess = score >= 70;
                    const completedAt = new Date(masteryRequest.completed_at || masteryRequest.created_at);
                    const daysSinceCompletion = (new Date().getTime() - completedAt.getTime()) / (1000 * 3600 * 24);
                    const canRetry = !isSuccess && daysSinceCompletion >= 14;
                    const retryDate = new Date(completedAt);
                    retryDate.setDate(retryDate.getDate() + 14);

                    if (canRetry) {
                      return (
                        <button
                          onClick={handleRequestMastery}
                          className="px-4 py-3 h-10 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 transition-all shadow-sm flex items-center gap-2"
                          title="Vous pouvez retenter votre chance !"
                        >
                          <i className="fa-solid fa-rotate-right"></i>
                          <span>Retenter l'examen</span>
                        </button>
                      );
                    }

                    return (
                      <div className={`px-4 py-3 h-10 border rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                        isSuccess
                          ? "bg-indigo-50 text-indigo-600 border-indigo-100" 
                          : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}>
                        <i className={`fa-solid ${isSuccess ? 'fa-circle-check' : 'fa-lock'}`}></i>
                        <span>
                          {isSuccess
                            ? `Maîtrise validée (${score}%)` 
                            : `Réessai possible le ${retryDate.toLocaleDateString()}`}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <button
                    onClick={handleRequestMastery}
                    className="px-4 py-3 h-10 bg-orange-50 text-orange-600 border border-orange-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 transition-all shadow-sm flex items-center gap-2"
                    title="Demander à valider la maîtrise sur cette procédure">
                    <i className="fa-solid fa-certificate"></i>
                    <span className="hidden xl:inline">Demander Maîtrise</span>
                  </button>
                        )}
                      </>
                    )}
              </>
            )}

            {/* Suggestion Button */}

            <button
              onClick={() => setIsSuggestionModalOpen(true)}
              className="px-4 py-3 h-10 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm flex items-center gap-2">
              <i className="fa-regular fa-lightbulb text-sm"></i>
              <span className="hidden sm:inline">Suggérer une modif</span>
            </button>

            {/* Open in New Tab Button (Full Text) */}
            <button
              onClick={() => window.open(docUrl || "", "_blank")}
              className="px-4 py-3 h-10 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all shadow-sm flex items-center gap-2"
              title="Ouvrir le document PDF dans un nouvel onglet">
              <i className="fa-solid fa-arrow-up-right-from-square"></i>
              <span className="hidden sm:inline">Ouvrir dans un onglet</span>
            </button>
          </div>
        </div>

        {isMarkdownLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] border border-slate-100 shadow-xl">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6">
              <i className="fa-solid fa-circle-notch text-2xl animate-spin"></i>
            </div>
            <p className="text-slate-500 font-medium animate-pulse text-sm">
              Traitement IA du document...
            </p>
          </div>
        ) : markdownContent ? (
          <MarkdownViewer content={markdownContent} />
        ) : docUrl ? (
          <SafePDFViewer fileUrl={docUrl} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-900 rounded-[3rem] border border-slate-800 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 mb-6 animate-pulse">
              <i className="fa-solid fa-file-pdf text-2xl"></i>
            </div>
            <p className="text-slate-400 font-medium animate-pulse text-sm">
              Chargement de la procédure...
            </p>
          </div>
        )}

        {/* HISTORIQUE DES SUGGESTIONS - COLLAPSIBLE */}
        <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className="w-full p-8 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div className="text-left">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">
                  Historique des améliorations
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {isHistoryExpanded ? "Cliquez pour masquer" : "Cliquez pour afficher"}
                </p>
              </div>
            </div>
            <i
              className={`fa-solid fa-chevron-down text-slate-300 transition-transform ${isHistoryExpanded ? "rotate-180" : ""}`}></i>
          </button>

          {isHistoryExpanded && (
            <div className="px-8 pb-8 animate-slide-up max-h-[60vh] overflow-y-auto scrollbar-hide relative">
              <div className="space-y-8 relative">
                {/* Continuous Timeline Line connecting all items */}
                {history.length > 0 && (
                  <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-100 z-0"></div>
                )}
                {loadingHistory ? (
                  <div className="py-20 flex justify-center">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : history.length > 0 ? (
                  history.map((item) => {
                    const typeLabels = {
                      correction: {
                        label: "Correction",
                        color: "text-rose-600 bg-rose-50 border-rose-100",
                        icon: "fa-bug",
                      },
                      update: {
                        label: "Mise à jour",
                        color: "text-indigo-600 bg-indigo-50 border-indigo-100",
                        icon: "fa-pen-to-square",
                      },
                      add_step: {
                        label: "Ajout",
                        color: "text-emerald-600 bg-emerald-50 border-emerald-100",
                        icon: "fa-plus-circle",
                      },
                    };
                    const typeInfo =
                      typeLabels[item.type as keyof typeof typeLabels] || typeLabels.update;

                    return (
                      <div key={item.id} className="relative z-10 pl-24 group">
                        {/* Timeline Node */}
                        <div className="absolute left-0 top-0 w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center z-10 group-hover:scale-110 transition-transform hover:border-indigo-200 hover:shadow-md cursor-default">
                          <span className="text-[10px] font-black text-slate-400 group-hover:text-indigo-600 transition-colors">
                            {item.user?.first_name
                              ? item.user.first_name.substring(0, 2).toUpperCase()
                              : "??"}
                          </span>
                        </div>

                        {/* Connector to Card */}
                        <div className="absolute left-12 top-6 w-12 h-0.5 bg-slate-100 group-hover:bg-indigo-50 transition-colors"></div>

                        {/* Content Card */}
                        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group-hover:border-indigo-50/50">
                          {/* Card Header */}
                          <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-slate-50 pb-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 ${typeInfo.color}`}>
                                <i className={`fa-solid ${typeInfo.icon}`}></i>
                                {typeInfo.label}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400">
                                •{" "}
                                {new Date(item.created_at).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </span>
                            </div>

                            {(() => {
                              const statusConfig = {
                                approved: {
                                  label: "Validé",
                                  color: "text-emerald-500",
                                  icon: "fa-circle-check",
                                },
                                rejected: {
                                  label: "Refusé",
                                  color: "text-rose-500",
                                  icon: "fa-circle-xmark",
                                },
                                pending: {
                                  label: "En attente",
                                  color: "text-amber-500",
                                  icon: "fa-clock animate-pulse",
                                },
                              };
                              const config =
                                statusConfig[item.status as keyof typeof statusConfig] ||
                                statusConfig.pending;

                              return (
                                <div
                                  className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ${config.color}`}>
                                  <i className={`fa-solid ${config.icon}`}></i>
                                  {config.label}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Description */}
                          <p className="text-sm font-bold text-slate-700 leading-relaxed italic break-words relative pl-6">
                            <i className="fa-solid fa-quote-left absolute left-0 top-0 text-slate-200 text-xs"></i>
                            {item.suggestion}
                          </p>

                          {/* Manager Response */}
                          {item.manager_response && (
                            <div className="mt-6 pt-6 border-t border-slate-50 relative animate-fade-in">
                              <div className="absolute left-6 -top-3 bg-white px-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] shadow-lg shadow-indigo-200">
                                  <i className="fa-solid fa-user-shield"></i>
                                </div>
                              </div>
                              <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 ml-2">
                                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                                  <span className="font-black text-indigo-600 uppercase text-[9px] tracking-widest mr-2">
                                    Réponse :
                                  </span>
                                  {item.manager_response}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center text-slate-300 flex flex-col items-center gap-4">
                    <i className="fa-solid fa-clipboard-question text-4xl opacity-20"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">
                      Aucune suggestion pour l'instant
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* MODAL SUGGESTION */}
      {isSuggestionModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsSuggestionModalOpen(false)}>
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
      
      {/* QUIZ MODAL */}
      <MasteryQuizModal 
        isOpen={isMasteryModalOpen}
        onClose={async () => {
          setIsMasteryModalOpen(false);
          // Only refetch if we didn't just complete the exam (prevents stale data override)
          if (!justCompletedRef.current) {
            await fetchMasteryStatus(); 
          }
          // Reset ref after a delay just in case
          setTimeout(() => { justCompletedRef.current = false; }, 2000);
        }}
        procedure={procedure}
        user={user}
        quizData={masteryRequest?.quiz_data}
        masteryRequestId={masteryRequest?.id}
        onSuccess={(score, level) => {
          justCompletedRef.current = true; // Mark as just completed
          setNotification({ msg: `Examen terminé ! Score: ${score}% - Niveau ${level}`, type: "success" });
          
          // Optimistic Update to immediately remove the "launch" button
          setMasteryRequest(prev => prev ? ({
            ...prev,
            status: 'completed',
            score: score,
            completed_at: new Date().toISOString()
          }) : null);
        }}
      />
    </div>
  );
};

export default ProcedureDetail;
