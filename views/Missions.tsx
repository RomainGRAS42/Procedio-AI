import React, { useState, useEffect } from "react";
import { useMissions } from "../contexts/MissionsContext";
import { supabase } from "../lib/supabase";
import { User, UserRole, Mission, MissionStatus, MissionUrgency, Procedure } from "../types";
import InfoTooltip from "../components/InfoTooltip";
import LoadingState from "../components/LoadingState";
import CustomToast from "../components/CustomToast";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import MissionDetailsModal from "../components/MissionDetailsModal";
import MasteryQuizModal from "../components/MasteryQuizModal";

interface MissionsProps {
  user: User;
  onSelectProcedure?: (procedure: Procedure) => void;
  setActiveTransfer?: (transfer: any | null) => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  sectionKey: string;
  isOpen: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  colorClass?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  count,
  sectionKey,
  isOpen,
  onToggle,
  children,
  colorClass = "bg-indigo-600",
}) => {
  return (
    <div className="space-y-6">
      <div
        onClick={() => onToggle(sectionKey)}
        className="flex items-center justify-between mb-4 cursor-pointer group select-none w-full active:scale-[0.99] transition-transform duration-200">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl ${colorClass} text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-200`}>
            {icon}
          </div>
          {count !== undefined && (
            <div className="bg-slate-100 rounded-lg px-2 py-0.5 text-[10px] font-black text-slate-500">
              {count}
            </div>
          )}
          <h3
            className={`text-sm font-black uppercase tracking-[0.2em] transition-colors ${!isOpen ? "text-slate-400" : "text-slate-900 group-hover:text-indigo-600"}`}>
            {title}
          </h3>
        </div>

        <div
          className={`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 transition-all duration-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 ${!isOpen ? "-rotate-90" : "rotate-0"}`}>
          <i className="fa-solid fa-chevron-down text-xs"></i>
        </div>
      </div>

      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${!isOpen ? "max-h-0 opacity-0" : "max-h-[5000px] opacity-100"}`}>
        {children}
      </div>
    </div>
  );
};

const Missions: React.FC<MissionsProps> = ({ user, onSelectProcedure, setActiveTransfer }) => {
  const { missions, setMissions, loading, refreshMissions } = useMissions();
  // const [loading, setLoading] = useState(true); // From Context
  // const [missions, setMissions] = useState<Mission[]>([]); // From Context
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    user.role === UserRole.MANAGER ? "list" : "grid"
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [personalFilter, setPersonalFilter] = useState<"active" | "history">("active");

  // Form State
  const [newMission, setNewMission] = useState({
    title: "",
    description: "",
    xp_reward: 50,
    urgency: "medium" as MissionUrgency,
    targetType: "team" as "team" | "individual",
    assigned_to: "",
    hasDeadline: false,
    deadline: "",
    needs_attachment: false,
    category: "",
    opportunity_id: null as string | null, // Track the origin opportunity
  });

  // Lifecycle Modals State
  const [completingMission, setCompletingMission] = useState<Mission | null>(null);
  const [cancellingMission, setCancellingMission] = useState<Mission | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [technicians, setTechnicians] = useState<
    { id: string; email: string; first_name: string; last_name: string }[]
  >([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Quiz State
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [currentQuizData, setCurrentQuizData] = useState<any>(null);
  const [currentMasteryRequestId, setCurrentMasteryRequestId] = useState<string | null>(null);
  const [quizProcedure, setQuizProcedure] = useState<Procedure | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  useEffect(() => {
    // fetchMissions(); // Handled by Context
    if (user.role === UserRole.MANAGER) {
      fetchTechnicians();
    }
  }, [user]);

  // Handle Redirection from Statistics
  const location = useLocation();
  useEffect(() => {
    if (location.state && (location.state as any).createMission) {
      const { initialData } = location.state as any;
      if (initialData) {
        setNewMission((prev) => ({ ...prev, ...initialData }));
        setShowCreateModal(true);
      }
      // Clean up state to prevent reopening on refresh (requires router replacement history usually, but simple check works for now)
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchTechnicians = async () => {
    try {
      // On récupère tout et on filtre côté JS pour éviter les erreurs 400
      // si un type ENUM Postgres ne reconnaît pas une valeur (ex: technicien vs TECHNICIAN)
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, first_name, last_name, role");

      if (error) {
        console.error("DEBUG: Erreur Supabase fetchTechnicians:", error);
        throw error;
      }

      if (data) {
        // Filtrage flexible (ignore la casse)
        const techList = data.filter(
          (u) =>
            u.role &&
            (u.role.toLowerCase() === "technicien" || u.role.toLowerCase() === "technician")
        );
        console.log("DEBUG: Techniciens filtrés:", techList);
        setTechnicians(techList);
      }
    } catch (err) {
      console.error("Error fetching technicians:", err);
    }
  };

  // fetchMissions removed - using Context

  const handleCreateMission = async () => {
    if (!newMission.title.trim()) return;
    try {
      let assigned_to = null;

      if (newMission.targetType === "individual" && newMission.assigned_to) {
        assigned_to = newMission.assigned_to;
      }

      const { error } = await supabase.from("missions").insert([
        {
          title: newMission.title,
          description: newMission.description,
          xp_reward: newMission.xp_reward,
          urgency: newMission.urgency,
          deadline: newMission.hasDeadline ? newMission.deadline : null,
          assigned_to: assigned_to,
          created_by: user.id,
          status: assigned_to ? "assigned" : "open",
          needs_attachment: newMission.needs_attachment,
          category: newMission.category || null,
        },
      ]);

      if (error) throw error;

      // Trigger Notification for the assigned technician
      if (assigned_to) {
        await supabase.from("notifications").insert({
          user_id: assigned_to,
          type: "mission",
          title: "Nouvelle mission assignée",
          content: `On vous a confié la mission : ${newMission.title}`,
          link: "/missions", // Navigate to missions view
        });
      }

      // Resolve the opportunity if it came from one
      if ((newMission as any).opportunity_id) {
        await supabase
          .from('search_opportunities')
          .update({ status: 'resolved' })
          .eq('id', (newMission as any).opportunity_id);
      }

      setToast({ message: "Mission stratégique crée !", type: "success" });
      setShowCreateModal(false);
      setNewMission({
        title: "",
        description: "",
        xp_reward: 50,
        urgency: "medium",
        targetType: "team",
        assigned_to: "",
        hasDeadline: false,
        deadline: "",
        needs_attachment: false,
        category: "",
        opportunity_id: null,
      });

      // fetchMissions(); // Handled by Realtime in Context
    } catch (err) {
      setToast({ message: "Erreur lors de la création.", type: "error" });
    }
  };

  const handleClaimMission = async (missionId: string) => {
    try {
      const mission = missions.find((m) => m.id === missionId);
      if (!mission) return;

      const { error } = await supabase
        .from("missions")
        .update({
          assigned_to: user.id,
          status: "assigned",
        })
        .match({ id: missionId, status: "open" })
        .is("assigned_to", null);

      if (error) throw error;

      // Notify Manager/Creator
      if (mission.created_by) {
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: mission.created_by,
          type: "mission",
          title: "Mission réclamée",
          content: `${user.firstName} ${user.lastName} a pris en charge la mission : ${mission.title}`,
          link: "/missions",
        });
        if (notifError) console.error("Error sending claim notification:", notifError);
      }

      setToast({ message: "Mission acceptée ! À vous de jouer.", type: "success" });

      try {
        await refreshMissions();
      } catch (err) {
        console.error("Error refreshing missions:", err);
      }
    } catch (err: any) {
      console.error("Error claiming mission:", err);
      // Detailed logging for RLS debugging
      const session = await supabase.auth.getSession();
      console.log("DEBUG CLAIM FAIL:", {
        missionId,
        userId: user.id,
        authUid: session.data.session?.user.id,
        error: err,
      });
      setToast({
        message: "Impossible de réclamer cette mission. " + (err.message || ""),
        type: "error",
      });
    }
  };

  const handleStatusUpdate = async (
    missionId: string,
    newStatus: MissionStatus,
    notes?: string,
    attachmentUrl?: string
  ) => {
    setIsSubmitting(true);
    try {
      const mission = missions.find((m) => m.id === missionId);
      if (!mission) return;

      // Handle Awaiting Validation Logic (Technician finishes a mission that needs attachment)
      if (
        newStatus === "completed" &&
        mission.needs_attachment &&
        user.role === UserRole.TECHNICIAN
      ) {
        // Call the RPC for submission bonus
        const { error: submitError } = await supabase.rpc("reward_mission_submission", {
          mission_id: missionId,
        });

        if (submitError) throw submitError;

        // Update with notes and file URL
        const { error: updateError } = await supabase
          .from("missions")
          .update({
            status: "awaiting_validation", // Forced state
            completion_notes: notes,
            attachment_url: attachmentUrl,
          })
          .eq("id", missionId);

        if (updateError) throw updateError;

        setToast({
          message: "Livrable envoyé ! En attente de validation du manager (+10 XP bonus).",
          type: "success",
        });
      }
      // Handle Final Validation (Manager validates)
      else if (
        newStatus === "completed" &&
        user.role === UserRole.MANAGER &&
        mission.status === "awaiting_validation"
      ) {
        const { error: validateError } = await supabase.rpc("validate_mission_completion", {
          mission_id: missionId,
          feedback: notes,
        });

        if (validateError) throw validateError;
        setToast({
          message: "Mission validée officiellement ! XP totale versée.",
          type: "success",
        });
      }
      // Standard flow (no attachment needed or manager manual update)
      else {
        const updateData: any = { status: newStatus };
        if (notes) updateData.completion_notes = notes;
        if (attachmentUrl) updateData.attachment_url = attachmentUrl;
        if (newStatus === "cancelled") updateData.cancellation_reason = notes;
        if (newStatus === "assigned") updateData.assigned_to = user.id;

        const { error } = await supabase.from("missions").update(updateData).eq("id", missionId);

        if (error) throw error;

        // Give XP if transitioning to completed directly (standard way)
        if (newStatus === "completed" && mission.assigned_to) {
          await supabase.rpc("increment_user_xp", {
            target_user_id: mission.assigned_to,
            xp_amount: mission.xp_reward || 50,
            reason: `Mission accomplie : ${mission.title}`,
          });
        }

        setToast({
          message:
            newStatus === "completed"
              ? "Mission validée ! XP versée."
              : newStatus === "cancelled"
                ? "Mission annulée."
                : "Statut mis à jour.",
          type: "success",
        });
      }

      setCompletingMission(null);
      setCancellingMission(null);
      setReasonText("");
      setSelectedFile(null);
      // fetchMissions();

      // Lifecycle Notifications
      if (mission) {
        // 1. Manager validates -> Notify user
        if (newStatus === "completed" && user.role === UserRole.MANAGER && mission.assigned_to) {
          await supabase.from("notifications").insert({
            user_id: mission.assigned_to,
            type: "mission",
            title: "Mission validée !",
            content: `Votre mission "${mission.title}" a été validée. XP finale accordée !`,
            link: "/missions",
          });
        }

        // 2. Manager cancels -> Notify technician
        if (newStatus === "cancelled" && mission.assigned_to && mission.assigned_to !== user.id) {
          await supabase.from("notifications").insert({
            user_id: mission.assigned_to,
            type: "mission",
            title: "Mission annulée",
            content: `La mission "${mission.title}" a été annulée.`,
            link: "/missions",
          });
        }

        // 3. Technician starts mission -> Notify Manager (NEW)
        if (newStatus === "in_progress" && mission.created_by && mission.created_by !== user.id) {
          await supabase.from("notifications").insert({
            user_id: mission.created_by,
            type: "mission",
            title: "Mission démarrée \uD83D\uDE80",
            content: `${user.firstName || "Le technicien"} a commencé la mission : "${mission.title}"`,
            link: "/missions",
          });
        }

        // Optimistic Update
        const updatedMission = {
          ...mission,
          status: newStatus,
          assigned_to: newStatus === "assigned" ? user.id : mission.assigned_to,
        };
        setMissions((prev) =>
          prev.map((m) => (m.id === missionId ? { ...m, ...updatedMission } : m))
        );
        if (selectedMission && selectedMission.id === missionId) {
          setSelectedMission({ ...selectedMission, ...updatedMission });
        }

        // fetchMissions(); // Still kept commented to rely on optimistic update first

        // 3. Technician finishes -> Notify manager
        if (
          newStatus === "completed" &&
          user.role === UserRole.TECHNICIAN &&
          mission.created_by !== user.id
        ) {
          await supabase.from("notifications").insert({
            user_id: mission.created_by,
            type: "mission",
            title: mission.needs_attachment ? "Livrable déposé" : "Mission terminée",
            content: `${user.firstName} a soumis son travail pour : ${mission.title}`,
            link: "/missions",
          });
        }
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la mise à jour.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real-time Sync
  // Real-time Sync handled by Context

  const handleStartMission = async (missionId: string) => {
    // Optimistic Update
    // Optimistic Update removed to rely on Context/Realtime consistency
    // const previousMissions = [...missions];
    // setMissions(prev => prev.map(m => m.id === missionId ? { ...m, status: 'in_progress' } : m));
    setToast({ message: "Mission démarrée !", type: "success" });

    try {
      const { error } = await supabase
        .from("missions")
        .update({ status: "in_progress" })
        .eq("id", missionId);

      if (error) throw error;
      // No need to fetchMissions() if subscription works, but keeping it as backup or for consistency if payload implies heavy data not in payload?
      // Payload usually has all columns.
      // Actually, payload might lack joined fields (assignee, creator).
      // So fetching might be safer for complex views, OR we just update status which is fine.
      // But let's rely on subscription for other clients, and this local update for self.
      // The subscription will also trigger an update coming from own change?
      // Yes, Supabase sends back the change. We should handle it gracefully (idempotent map).

      // Notify Creator
      const mission = missions.find((m) => m.id === missionId);
      if (mission && mission.created_by !== user.id) {
        await supabase.from("notifications").insert({
          user_id: mission.created_by,
          type: "mission",
          title: "Mission démarrée",
          content: `${user.firstName} a démarré la mission : ${mission.title}`,
          link: "/missions",
        });
      }
    } catch (err) {
      // Revert
      // setMissions(previousMissions);
      setToast({ message: "Erreur lors du démarrage.", type: "error" });
    }
  };

  const handleStartExam = async (mission: Mission) => {
    if (!mission.procedure_id) {
       setToast({ message: "Erreur : Procédure non liée.", type: "error" });
       return;
    }

    setLoadingQuiz(true);
    try {
      // 1. Check Cooldown (15 days)
      const { data: recentFailures } = await supabase
        .from("mastery_requests")
        .select("created_at, status")
        .eq("user_id", user.id)
        .eq("procedure_id", mission.procedure_id) // Procedure ID must be stored in mission or we infer it? 
        // Note: AssignReferentModal stores procedure_id in mission.
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentFailures && recentFailures.length > 0) {
         const lastFailDate = new Date(recentFailures[0].created_at);
         const daysSince = Math.floor((new Date().getTime() - lastFailDate.getTime()) / (1000 * 3600 * 24));
         if (daysSince < 15) {
            alert(`Vous devez attendre ${15 - daysSince} jours avant de retenter cet examen.`);
            setLoadingQuiz(false);
            return;
         }
      }

      // 2. Create/Get Mastery Request
      // We create a new one for this attempt
      const { data: requestData, error: reqError } = await supabase
        .from("mastery_requests")
        .insert({
           user_id: user.id,
           procedure_id: mission.procedure_id, // Ensure this column is used/available or we use procedure_uuid if that's the FK
           // procedure_id is likely text/uuid in mastery_requests.
           // Mission procedure_id is UUID?
           status: 'approved', // Auto-approved to start quiz
           // manager_id: mission.created_by // REMOVED: Column does not exist in schema
        })
        .select()
        .single();
      
      if (reqError) throw reqError;

      // 3. Trigger Generation
      setToast({ message: "Génération de l'examen en cours...", type: "info" });
      
      // We assume procedure title is needed or ID is enough.
      // We fetch procedure details first to be safe for the Modal
      const { data: procData } = await supabase.from('procedures').select('*').eq('uuid', mission.procedure_id).single();
      if (!procData) throw new Error("Procédure introuvable");
      setQuizProcedure(procData);

      // Trigger invocation but don't crash on timeout (500) because DB might still update
      supabase.functions.invoke('generate-mastery-quiz', {
        body: { 
          procedure_id: mission.procedure_id, 
          request_id: requestData.id,
          manager_name: "Système" 
        }
      }).catch(err => console.warn("Function trigger warning (might be timeout):", err));

      // 4. Poll for Quiz Data
      let attempts = 0;
      const pollInterval = setInterval(async () => {
         attempts++;
         const { data: updatedReq } = await supabase
           .from("mastery_requests")
           .select("quiz_data")
           .eq("id", requestData.id)
           .single();
         
         if (updatedReq?.quiz_data) {
            clearInterval(pollInterval);
            setCurrentQuizData(updatedReq.quiz_data);
            setCurrentMasteryRequestId(requestData.id);
            setLoadingQuiz(false);
            setIsQuizOpen(true);
         }

         if (attempts > 20) {
            clearInterval(pollInterval);
            setToast({ message: "Délai d'attente dépassé.", type: "error" });
            setLoadingQuiz(false);
         }
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setToast({ message: "Erreur lancement examen: " + err.message, type: "error" });
      setLoadingQuiz(false);
    }
  };

  const handleQuizResult = async (score: number, level: number) => {
      // REMOVED: setIsQuizOpen(false); -> Allow user to see results in Modal
      
      if (!selectedMission) return;

      if (score >= 70) {
         // SUCCESS
         setToast({ message: "Examen réussi ! Félicitations.", type: "success" });
         
         // Optimistic UI update: hide the exam button in the local state
         setMissions(prev => prev.map(m => 
           m.id === selectedMission.id ? { ...m, status: 'completed' as MissionStatus } : m
         ));

         // 1. Complete Mission
         await supabase.from("missions").update({ status: "completed" }).eq("id", selectedMission.id);

         // 2. Add as Referent (if not exist)
         if (selectedMission.procedure_id) {
             await supabase.from("procedure_referents").insert({
                 procedure_id: selectedMission.procedure_id,
                 user_id: user.id
             });
         }
      } else {
         // FAILURE
         setToast({ message: `Score: ${score}%. Échec (< 80%). Mode "Cooldown" activé.`, type: "error" });
         
         // 1. Release Mission (Open)
         await supabase.from("missions").update({ 
             status: "open", 
             assigned_to: null,
             title: selectedMission.title // Ensure title stays same
         }).eq("id", selectedMission.id);

         // 2. Notify Manager
         if (selectedMission.created_by) {
            await supabase.from("notifications").insert({
               user_id: selectedMission.created_by,
               type: "mission",
               title: "Échec Certification",
               content: `${user.firstName} a échoué à l'examen de référent (${score}%). Mission remise dans le pool.`,
               link: "/missions"
            });
         }
      }
      
      // Refresh
      refreshMissions();
  };

  const UrgencyBadge = ({ urgency }: { urgency: MissionUrgency }) => {
    const config = {
      critical: {
        color: "text-rose-600",
        bg: "bg-rose-50",
        icon: "fa-triangle-exclamation",
        label: "Urgent",
      },
      high: { color: "text-orange-600", bg: "bg-orange-50", icon: "fa-fire", label: "Prioritaire" },
      medium: {
        color: "text-indigo-600",
        bg: "bg-indigo-50",
        icon: "fa-calendar",
        label: "Standard",
      },
      low: { color: "text-slate-500", bg: "bg-slate-50", icon: "fa-clock", label: "Libre" },
    }[urgency];

    return (
      <span
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${config.bg} ${config.color} text-[9px] font-black uppercase tracking-widest border border-current opacity-70`}>
        <i className={`fa-solid ${config.icon}`}></i>
        {config.label}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: MissionStatus }) => {
    const config = {
      open: { color: "text-emerald-600", bg: "bg-emerald-50", label: "Disponible" },
      assigned: { color: "text-amber-600", bg: "bg-amber-50", label: "Assignée" },
      in_progress: { color: "text-indigo-600", bg: "bg-indigo-50", label: "En cours" },
      awaiting_validation: {
        color: "text-white",
        bg: "bg-amber-500 shadow-sm",
        label: "EN ATTENTE DE VALIDATION",
      },
      completed: { color: "text-slate-500", bg: "bg-slate-100", label: "TERMINEE" },
      cancelled: { color: "text-rose-400", bg: "bg-rose-50", label: "Annulée" },
    }[status];

    return (
      <span
        className={`px-2 py-0.5 rounded-lg ${config.bg} ${config.color} text-[8px] font-black uppercase tracking-widest`}>
        {config.label}
      </span>
    );
  };

  const renderMissionCard = (mission: Mission) => {
    return (
      <div
        key={mission.id}
        onClick={() => setSelectedMission(mission)}
        className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group relative overflow-hidden cursor-pointer">
        {/* Urgency accent border */}
        <div
          className={`absolute top-0 left-0 w-2 h-full ${
            mission.urgency === "critical"
              ? "bg-rose-500"
              : mission.urgency === "high"
                ? "bg-orange-500"
                : mission.urgency === "medium"
                  ? "bg-indigo-500"
                  : "bg-slate-200"
          } opacity-20`}></div>

        <div className="flex justify-between items-start mb-6">
          <div className="flex gap-2">
            <UrgencyBadge urgency={mission.urgency} />
            {mission.title.startsWith("Opportunité Manquée") && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-100/50">
                 <i className="fa-solid fa-magnifying-glass-chart"></i>
                 Opportunité Manquée
              </span>
            )}
          </div>
          <StatusBadge status={mission.status} />
        </div>

        <div className="space-y-4">
          <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">
            {mission.title}
          </h4>
          <p className="text-sm text-slate-500 font-medium line-clamp-3 leading-relaxed">
            {mission.description}
          </p>
        </div>

        <div className="mt-8 flex items-end justify-between">
          <div>
            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Récompense
            </span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs border border-amber-100 font-black">
                {mission.xp_reward}
              </div>
              <span className="text-xs font-black text-slate-600 uppercase tracking-tight">XP</span>
            </div>
          </div>

          {mission.status === "open" && user.role === UserRole.TECHNICIAN && (
            <div className="px-6 py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[9px] uppercase tracking-widest border border-slate-100 flex items-center gap-2">
              <i className="fa-solid fa-eye"></i> Voir détails
            </div>
          )}

          {mission.status === "awaiting_validation" && user.role === UserRole.MANAGER && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMission(mission);
              }}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2">
              <i className="fa-solid fa-microscope"></i>
              Réviser Livrable
            </button>
          )}
        </div>

        {mission.deadline && (
          <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 w-fit">
            <i className="fa-solid fa-calendar-day"></i>À rendre avant :{" "}
            {new Date(mission.deadline).toLocaleDateString("fr-FR")}
          </div>
        )}

        {(mission.assignee_name ||
          user.role === UserRole.MANAGER ||
          (user.role as any) === "manager") && (
          <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase">
                {mission.assignee ? (
                  mission.assignee.first_name.substring(0, 2)
                ) : mission.assignee_name ? (
                  mission.assignee_name.substring(0, 2)
                ) : (
                  <i className="fa-solid fa-users text-[8px]"></i>
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {mission.status === "completed"
                  ? "Complétée par"
                  : mission.status === "cancelled"
                    ? "Annulée"
                    : mission.status === "open" &&
                        (user.role === UserRole.MANAGER || (user.role as any) === "manager")
                      ? "Disponible pour"
                      : "En cours par"}{" "}
                <span className="text-slate-700">
                  {mission.assignee
                    ? `${mission.assignee.first_name} ${mission.assignee.last_name || ""}`
                    : mission.assignee_name || "Toute l'équipe"}
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              {mission.status === "assigned" && mission.assigned_to === user.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartMission(mission.id);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-slate-900 transition-all font-black">
                  Démarrer
                </button>
              )}
              
              {/* Finish Button (Classic) */}
              {mission.status === "in_progress" && 
               mission.assigned_to === user.id && 
               !mission.title.startsWith("Devenir Référent") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCompletingMission(mission);
                    setReasonText("");
                  }}
                  className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-emerald-600 transition-all font-black">
                  Terminer
                </button>
              )}

              {/* Quiz Button (Referent) */}
              {(mission.status === "in_progress" || mission.status === "assigned") && 
               mission.assigned_to === user.id && 
               mission.title.startsWith("Devenir Référent") && (
                 <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartExam(mission);
                    }}
                    disabled={loadingQuiz}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-indigo-700 transition-all font-black flex items-center gap-2 shadow-lg shadow-indigo-200"
                 >
                    {loadingQuiz ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-file-signature"></i>}
                    Passer l'Examen
                 </button>
              )}

              {/* Manager Actions */}
              {(mission.status === "assigned" ||
                mission.status === "in_progress" ||
                (mission.status === "open" &&
                  (user.role === UserRole.MANAGER || (user.role as any) === "manager"))) &&
                (user.role === UserRole.MANAGER || (user.role as any) === "manager") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancellingMission(mission);
                      setReasonText("");
                    }}
                    className="px-4 py-1.5 bg-rose-50 text-rose-500 border border-rose-100 rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-rose-100 transition-all font-black">
                    Annuler
                  </button>
                )}
            </div>
          </div>
        )}

        {mission.status === "completed" && mission.completion_notes && (
          <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
            <span className="block text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1 italic">
              Bilan d'expertise
            </span>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
              {mission.completion_notes}
            </p>
          </div>
        )}
        {mission.status === "cancelled" && mission.cancellation_reason && (
          <div className="mt-4 p-4 bg-rose-50/50 border border-rose-100 rounded-2xl">
            <span className="block text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1 italic">
              Motif d'annulation
            </span>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic">
              {mission.cancellation_reason}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderMissionListRow = (mission: Mission) => {
    return (
      <div
        key={mission.id}
        onClick={() => setSelectedMission(mission)}
        className="flex items-center gap-4 bg-white hover:bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all cursor-pointer group">
        <div
          className="w-1.5 h-8 rounded-full opacity-40 shrink-0"
          style={{
            backgroundColor:
              mission.urgency === "critical"
                ? "#f43f5e"
                : mission.urgency === "high"
                  ? "#f97316"
                  : mission.urgency === "medium"
                    ? "#6366f1"
                    : "#cbd5e1",
          }}></div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
            {mission.title}
          </h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
            {mission.assignee
              ? `${mission.assignee.first_name} ${mission.assignee.last_name || ""}`
              : mission.assignee_name || "Toute l'équipe"}
          </p>

          {mission.title.startsWith("Opportunité Manquée") && (
              <span className="mt-1 flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-widest border border-amber-100/50">
                 <i className="fa-solid fa-magnifying-glass-chart"></i>
                 Opportunité Manquée
              </span>
          )}
        </div>

        <div className="flex items-center gap-6 shrink-0">
          {/* Action Buttons for List View */}
          <div className="flex flex-col items-start min-h-[34px] justify-end">
             {/* Invisible spacer label to align with "URGENCE" / "STATUT" */}
             <span className="block text-[8px] font-black text-transparent uppercase tracking-widest mb-0.5 select-none">
              Action
            </span>
            <div className="flex items-center gap-2">
                {mission.status === "assigned" && mission.assigned_to === user.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartMission(mission.id);
                    }}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-slate-900 transition-all">
                    Démarrer
                  </button>
                )}
                
                {mission.status === "in_progress" && 
                mission.assigned_to === user.id && 
                !mission.title.startsWith("Devenir Référent") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCompletingMission(mission);
                      setReasonText("");
                    }}
                    className="px-3 py-1 bg-emerald-500 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-emerald-600 transition-all">
                    Terminer
                  </button>
                )}

                {(mission.status === "in_progress" || mission.status === "assigned") && 
                mission.assigned_to === user.id && 
                mission.title.startsWith("Devenir Référent") && (
                  <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartExam(mission);
                      }}
                      disabled={loadingQuiz}
                      className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm"
                  >
                      {loadingQuiz ? <i className="fa-solid fa-circle-notch fa-spin text-[8px]"></i> : <i className="fa-solid fa-file-signature text-[8px]"></i>}
                      Examen
                  </button>
                )}
            </div>
          </div>

          <div className="hidden md:block">
            <span className="block text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">
              Urgence
            </span>
            <UrgencyBadge urgency={mission.urgency} />
          </div>

          <div className="hidden sm:block">
            <span className="block text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">
              Statut
            </span>
            <StatusBadge status={mission.status} />
          </div>

          <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-all">
            <i className="fa-solid fa-chevron-right text-xs"></i>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-12 animate-fade-in pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Tableau des Missions
            </h1>
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-compass"></i>
            </div>
          </div>
          <p className="text-slate-500 font-medium text-lg max-w-2xl">
            {user.role === UserRole.MANAGER
              ? "Pilotez le flux de connaissances en assignant des missions stratégiques à votre équipe."
              : "Relevez des défis, complétez votre savoir et gagnez de l'XP pour monter en grade."}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 border border-slate-200 shadow-inner">
            <button
              onClick={() => setViewMode("grid")}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${viewMode === "grid" ? "bg-white text-indigo-600 shadow-md scale-105" : "text-slate-400 hover:text-slate-600"}`}
              title="Vue Grille">
              <i className="fa-solid fa-table-cells-large"></i>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${viewMode === "list" ? "bg-white text-indigo-600 shadow-md scale-105" : "text-slate-400 hover:text-slate-600"}`}
              title="Vue Liste">
              <i className="fa-solid fa-list"></i>
            </button>
          </div>

          {user.role === UserRole.MANAGER && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-3 group">
              <i className="fa-solid fa-plus group-hover:rotate-90 transition-transform"></i>
              Mission Stratégique
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Préparation du tableau des missions..." />
      ) : (
        <div className="flex flex-col xl:flex-row gap-8 items-start">
          {/* Main Pipeline/List */}
          <div className="flex-1 min-w-0 space-y-12 transition-all duration-300">
            {user.role === UserRole.MANAGER ? (
              <div className="space-y-10">
                {/* Section : Needs Review */}
                {missions.filter((m) => m.status === "awaiting_validation").length > 0 && (
                  <CollapsibleSection
                    title="À Valider Prioritairement"
                    icon={<i className="fa-solid fa-bell animate-pulse"></i>}
                    count={missions.filter((m) => m.status === "awaiting_validation").length}
                    sectionKey="needs_review"
                    isOpen={!collapsedSections["needs_review"]}
                    onToggle={toggleSection}
                    colorClass="bg-rose-500">
                    <div
                      className={
                        viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-3"
                      }>
                      {missions
                        .filter((m) => m.status === "awaiting_validation")
                        .map((m) =>
                          viewMode === "grid" ? renderMissionCard(m) : renderMissionListRow(m)
                        )}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Section : Ongoing */}
                <CollapsibleSection
                  title="Missions en cours"
                  icon={<i className="fa-solid fa-bars-progress"></i>}
                  count={
                    missions.filter(
                      (m) =>
                        m.status !== "completed" &&
                        m.status !== "cancelled" &&
                        m.status !== "awaiting_validation"
                    ).length
                  }
                  sectionKey="ongoing"
                  isOpen={!collapsedSections["ongoing"]}
                  onToggle={toggleSection}
                  colorClass="bg-indigo-600">
                  <div
                    className={
                      viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-3"
                    }>
                    {missions.filter(
                      (m) =>
                        m.status !== "completed" &&
                        m.status !== "cancelled" &&
                        m.status !== "awaiting_validation"
                    ).length > 0 ? (
                      missions
                        .filter(
                          (m) =>
                            m.status !== "completed" &&
                            m.status !== "cancelled" &&
                            m.status !== "awaiting_validation"
                        )
                        .map((m) =>
                          viewMode === "grid" ? renderMissionCard(m) : renderMissionListRow(m)
                        )
                    ) : (
                      <div className="py-8 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          Aucune mission en cours
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Section : Archived / Completed */}
                <CollapsibleSection
                  title="Historique Récent"
                  icon={<i className="fa-solid fa-clock-rotate-left"></i>}
                  count={
                    missions.filter((m) => m.status === "completed" || m.status === "cancelled")
                      .length
                  }
                  sectionKey="history"
                  isOpen={!collapsedSections["history"]}
                  onToggle={toggleSection}
                  colorClass="bg-slate-400">
                  <div
                    className={
                      viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-3"
                    }>
                    {missions
                      .filter((m) => m.status === "completed" || m.status === "cancelled")
                      .slice(0, 10)
                      .map((m) =>
                        viewMode === "grid" ? renderMissionCard(m) : renderMissionListRow(m)
                      )}
                  </div>
                </CollapsibleSection>
              </div>
            ) : (
              <>
                {/* Personal Missions Section */}
                <CollapsibleSection
                  title="Mes Missions Personnelles"
                  icon={<i className="fa-solid fa-user-check"></i>}
                  count={
                    missions.filter((m) => {
                      if (m.assigned_to !== user.id) return false;
                      if (personalFilter === "active")
                        return m.status === "assigned" || m.status === "in_progress";
                      return m.status === "completed" || m.status === "cancelled";
                    }).length
                  }
                  sectionKey="personal"
                  isOpen={!collapsedSections["personal"]}
                  onToggle={toggleSection}>
                  <div className="flex items-center justify-end mb-4 px-2">
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                      <button
                        onClick={() => setPersonalFilter("active")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${personalFilter === "active" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                        En cours (
                        {
                          missions.filter(
                            (m) =>
                              m.assigned_to === user.id &&
                              (m.status === "assigned" || m.status === "in_progress")
                          ).length
                        }
                        )
                      </button>
                      <button
                        onClick={() => setPersonalFilter("history")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${personalFilter === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                        Terminées (
                        {
                          missions.filter(
                            (m) =>
                              m.assigned_to === user.id &&
                              (m.status === "completed" || m.status === "cancelled")
                          ).length
                        }
                        )
                      </button>
                    </div>
                  </div>

                  <div
                    className={
                      viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-3"
                    }>
                    {missions.filter((m) => {
                      if (m.assigned_to !== user.id) return false;
                      if (personalFilter === "active")
                        return m.status === "assigned" || m.status === "in_progress";
                      return m.status === "completed" || m.status === "cancelled";
                    }).length > 0 ? (
                      missions
                        .filter((m) => {
                          if (m.assigned_to !== user.id) return false;
                          if (personalFilter === "active")
                            return m.status === "assigned" || m.status === "in_progress";
                          return m.status === "completed" || m.status === "cancelled";
                        })
                        .map((mission) =>
                          viewMode === "grid"
                            ? renderMissionCard(mission)
                            : renderMissionListRow(mission)
                        )
                    ) : (
                      <div
                        className={
                          viewMode === "grid"
                            ? "md:col-span-2 py-12 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center"
                            : "py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center"
                        }>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {personalFilter === "active"
                            ? "Aucune mission en cours"
                            : "Aucune mission terminée"}
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* Team Missions Section */}
                <CollapsibleSection
                  title="Missions d'Équipe"
                  icon={<i className="fa-solid fa-users"></i>}
                  count={missions.filter((m) => m.status === "open").length}
                  sectionKey="team"
                  isOpen={!collapsedSections["team"]}
                  onToggle={toggleSection}
                  colorClass="bg-emerald-500">
                  <div
                    className={
                      viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-3"
                    }>
                    {missions.filter((m) => m.status === "open").length > 0 ? (
                      missions
                        .filter((m) => m.status === "open")
                        .map((mission) =>
                          viewMode === "grid"
                            ? renderMissionCard(mission)
                            : renderMissionListRow(mission)
                        )
                    ) : (
                      <div
                        className={
                          viewMode === "grid"
                            ? "md:col-span-2 py-12 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center"
                            : "py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center"
                        }>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Aucune mission d'équipe disponible
                        </p>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </>
            )}

            {missions.length === 0 && (
              <div className="py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                <i className="fa-solid fa-box-open text-4xl text-slate-300 mb-4 opacity-50"></i>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                  Aucune mission pour le moment
                </p>
              </div>
            )}
          </div>

          {/* Right Sidebar - Info & Stats (Collapsible) */}
          <div
            className={`space-y-12 transition-all duration-300 ease-in-out shrink-0 ${collapsedSections["sidebar"] ? "w-20" : "w-full xl:w-96"}`}>
            <div className="space-y-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                {!collapsedSections["sidebar"] && (
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] whitespace-nowrap overflow-hidden">
                    Performance & Outils
                  </h3>
                )}
                <button
                  onClick={() => toggleSection("sidebar")}
                  className={`w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm ${collapsedSections["sidebar"] ? "w-full rotate-180" : ""}`}
                  title={collapsedSections["sidebar"] ? "Déplier" : "Replier"}>
                  <i className="fa-solid fa-arrow-right-from-bracket"></i>
                </button>
              </div>

              {!collapsedSections["sidebar"] ? (
                <div className="space-y-8 animate-fade-in">
                  <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white shadow-xl shadow-indigo-500/20 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black tracking-tight uppercase">
                        Performance Missions
                      </h3>
                      <div className="hidden xl:flex items-center gap-2 text-[10px] font-bold text-indigo-200 bg-indigo-900/30 px-3 py-1 rounded-full border border-white/5">
                        <i className="fa-solid fa-chart-line"></i>
                        <span>Live</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                        <span className="text-2xl font-black">
                          {missions.reduce(
                            (acc, m) => acc + (m.status === "completed" ? m.xp_reward : 0),
                            0
                          )}
                        </span>
                        <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest leading-tight mt-1">
                          XP Gagné
                        </span>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center hover:bg-white/20 transition-colors">
                        <span className="text-2xl font-black">
                          {missions.filter((m) => m.status === "completed").length}
                        </span>
                        <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest leading-tight mt-1">
                          Complétées
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6">
                      Légende
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center text-sm">
                          <i className="fa-solid fa-fire"></i>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                            Priorité Haute
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Action sous 48h
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-sm">
                          <i className="fa-solid fa-medal"></i>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                            Récompense XP
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Selon la complexité
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="flex flex-col gap-4 animate-fade-in items-center">
                  <div
                    className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-sm shadow-lg shadow-indigo-500/20"
                    title={`XP Gagné: ${missions.reduce((acc, m) => acc + (m.status === "completed" ? m.xp_reward : 0), 0)}`}>
                    <i className="fa-solid fa-chart-line"></i>
                  </div>
                  <div
                    className="w-12 h-12 rounded-2xl bg-white border border-slate-100 text-slate-400 flex items-center justify-center text-sm hover:text-orange-500 hover:bg-orange-50 transition-colors"
                    title="Légende">
                    <i className="fa-solid fa-info"></i>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOADING OVERLAY FOR EXAM GENERATION */}
      {loadingQuiz && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md animate-fade-in text-center p-6">
          <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl mb-8 shadow-2xl shadow-indigo-500/20 animate-bounce">
            <i className="fa-solid fa-brain"></i>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
            Génération de l'examen...
          </h2>
          <p className="text-indigo-200 font-bold max-w-sm">
            Merci de patienter quelques secondes, Procedio analyse la procédure pour créer vos questions.
          </p>
          <div className="mt-8 flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DETAILS + CHAT */}
      {selectedMission && (
        <MissionDetailsModal
          mission={selectedMission}
          user={user}
          onClose={() => setSelectedMission(null)}
          onUpdateStatus={handleStatusUpdate}
          setActiveTransfer={setActiveTransfer}
          onStartQuiz={(mission) => {
            setSelectedMission(null); // Close modal
            handleStartExam(mission); // Start exam
          }}
        />
      )}

      {/* MODAL CREATION MISSION */}
      {showCreateModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-scale-up">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                    <i className="fa-solid fa-bolt"></i>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    Nouvelle Mission
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-300 hover:text-rose-500 transition-colors">
                  <i className="fa-solid fa-xmark text-2xl"></i>
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Titre de la mission
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Rédiger la procédure VPN"
                    className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                    value={newMission.title}
                    onChange={(e) => setNewMission({ ...newMission, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Description & Objectif
                  </label>
                  <textarea
                    placeholder="Expliquez ce qui est attendu..."
                    className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 resize-none"
                    value={newMission.description}
                    onChange={(e) => setNewMission({ ...newMission, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Echéance
                    </label>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="noDeadline"
                          className="w-5 h-5 accent-indigo-600 rounded-lg cursor-pointer"
                          checked={!newMission.hasDeadline}
                          onChange={(e) =>
                            setNewMission({ ...newMission, hasDeadline: !e.target.checked })
                          }
                        />
                        <label
                          htmlFor="noDeadline"
                          className="text-xs font-bold text-slate-600 cursor-pointer">
                          Pas de délai
                        </label>
                      </div>
                      {newMission.hasDeadline && (
                        <input
                          type="date"
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700"
                          value={newMission.deadline}
                          onChange={(e) =>
                            setNewMission({ ...newMission, deadline: e.target.value })
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Destinataire
                    </label>
                    <div className="flex flex-col gap-3">
                      <select
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700 appearance-none cursor-pointer"
                        value={newMission.targetType}
                        onChange={(e) =>
                          setNewMission({
                            ...newMission,
                            targetType: e.target.value as "team" | "individual",
                          })
                        }>
                        <option value="team">Toute l'équipe</option>
                        <option value="individual">Individu spécifique</option>
                      </select>
                      {newMission.targetType === "individual" && (
                        <select
                          className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                          value={newMission.assigned_to}
                          onChange={(e) =>
                            setNewMission({ ...newMission, assigned_to: e.target.value })
                          }>
                          <option value="">Sélectionner un technicien</option>
                          {technicians.map((tech) => (
                            <option key={tech.id} value={tech.id}>
                              {tech.first_name} {tech.last_name} ({tech.email})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Récompense XP
                    </label>
                    <input
                      type="number"
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-indigo-600"
                      value={newMission.xp_reward}
                      onChange={(e) =>
                        setNewMission({ ...newMission, xp_reward: parseInt(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Urgence
                    </label>
                    <select
                      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-indigo-500 outline-none transition-all font-black text-slate-700 appearance-none cursor-pointer"
                      value={newMission.urgency}
                      onChange={(e) =>
                        setNewMission({ ...newMission, urgency: e.target.value as MissionUrgency })
                      }>
                      <option value="low">Libre</option>
                      <option value="medium">Standard</option>
                      <option value="high">Prioritaire</option>
                      <option value="critical">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* New Toggle: Needs Attachment */}
                <div
                  className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between group/toggle hover:border-indigo-200 transition-all cursor-pointer"
                  onClick={() =>
                    setNewMission({ ...newMission, needs_attachment: !newMission.needs_attachment })
                  }>
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all ${newMission.needs_attachment ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border border-slate-100"}`}>
                      <i className="fa-solid fa-paperclip"></i>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                        Preuve de travail requise
                      </p>
                      <p className="text-[10px] font-medium text-slate-500">
                        Le technicien devra uploader un fichier pour valider.
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-12 h-6 rounded-full transition-all relative ${newMission.needs_attachment ? "bg-indigo-600" : "bg-slate-200"}`}>
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newMission.needs_attachment ? "right-1" : "left-1"}`}></div>
                  </div>
                </div>

                <button
                  onClick={handleCreateMission}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:bg-slate-900 transition-all active:scale-95">
                  Lancer la Mission
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL COMPLETION/REVIEW MISSION */}
      {completingMission &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div
              className={`bg-white rounded-[2.5rem] p-10 w-full shadow-2xl animate-scale-up ${completingMission.status === "awaiting_validation" ? "max-w-4xl" : "max-w-lg"}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                      completingMission.status === "awaiting_validation"
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                    <i
                      className={`fa-solid ${completingMission.status === "awaiting_validation" ? "fa-magnifying-glass-chart" : "fa-check-double"}`}></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                      {completingMission.status === "awaiting_validation"
                        ? "Révision Stratégique"
                        : "Mission Terminée"}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                      {completingMission.title}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCompletingMission(null);
                    setSelectedFile(null);
                  }}
                  className="text-slate-300 hover:text-rose-500 transition-colors">
                  <i className="fa-solid fa-xmark text-2xl"></i>
                </button>
              </div>

              <div
                className={`grid gap-10 ${completingMission.status === "awaiting_validation" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                {/* Left Column: Livrable & Info */}
                <div className="space-y-8">
                  {completingMission.status === "awaiting_validation" &&
                    completingMission.attachment_url && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <i className="fa-solid fa-paperclip text-indigo-500"></i>
                          Livrable déposé
                        </label>
                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-between group hover:border-indigo-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white text-indigo-600 flex items-center justify-center text-xl shadow-sm border border-slate-100">
                              <i
                                className={`fa-solid ${completingMission.attachment_url.toLowerCase().endsWith(".pdf") ? "fa-file-pdf" : "fa-file-image"}`}></i>
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-700 uppercase tracking-tight">
                                Pièce jointe
                              </p>
                              <p className="text-[9px] font-medium text-slate-400">
                                Envoyé par le technicien
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <a
                              href={
                                completingMission.attachment_url
                                  .toLowerCase()
                                  .match(/\.(doc|docx|xls|xlsx|ppt|pptx)$/)
                                  ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(completingMission.attachment_url.startsWith("http") ? completingMission.attachment_url : supabase.storage.from("mission-attachments").getPublicUrl(completingMission.attachment_url).data.publicUrl)}`
                                  : completingMission.attachment_url.startsWith("http")
                                    ? completingMission.attachment_url
                                    : supabase.storage
                                        .from("mission-attachments")
                                        .getPublicUrl(completingMission.attachment_url).data
                                        .publicUrl
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 flex items-center gap-3 shadow-sm">
                              <i className="fa-solid fa-eye text-sm"></i>
                              Voir
                            </a>
                            <a
                              href={`${completingMission.attachment_url.startsWith("http") ? completingMission.attachment_url : supabase.storage.from("mission-attachments").getPublicUrl(completingMission.attachment_url).data.publicUrl}${completingMission.attachment_url.includes("?") ? "&" : "?"}download=`}
                              download
                              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-3 shadow-lg">
                              <i className="fa-solid fa-download text-sm"></i>
                              Télécharger
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Notes du Technicien
                    </label>
                    <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[1.5rem] min-h-[100px]">
                      <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                        "{completingMission.completion_notes || "Aucune note."}"
                      </p>
                    </div>
                  </div>

                  {user.role === UserRole.TECHNICIAN &&
                    completingMission.status === "in_progress" &&
                    completingMission.needs_attachment && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                          Livrable (PDF, Image)
                          {selectedFile && (
                            <span className="text-emerald-500 lowercase font-bold">
                              {selectedFile.name}
                            </span>
                          )}
                        </label>

                        <div
                          className={`relative group border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all ${
                            selectedFile
                              ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                              : "bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-300 hover:bg-white hover:text-indigo-600"
                          }`}>
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept="application/pdf,image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setSelectedFile(e.target.files[0]);
                              }
                            }}
                          />
                          <i
                            className={`fa-solid ${selectedFile ? "fa-file-circle-check" : "fa-cloud-arrow-up"} text-2xl mb-2`}></i>
                          <p className="text-[10px] font-black uppercase tracking-widest">
                            {selectedFile ? "Fichier prêt" : "Glisser ou cliquer"}
                          </p>
                        </div>
                      </div>
                    )}
                </div>

                {/* Right Column: Feedback & Actions */}
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {user.role === UserRole.MANAGER
                        ? "Commentaires & Feedback"
                        : "Résumé de l'accomplissement"}
                    </label>
                    <textarea
                      value={reasonText}
                      onChange={(e) => setReasonText(e.target.value)}
                      placeholder={
                        user.role === UserRole.MANAGER
                          ? "Donnez votre avis sur le travail réalisé..."
                          : "Qu'avez-vous réalisé ?"
                      }
                      className="w-full h-48 p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-600 resize-none shadow-inner"
                    />
                  </div>

                  <div className="flex gap-6">
                    {user.role === UserRole.MANAGER &&
                      completingMission.status === "awaiting_validation" && (
                        <button
                          onClick={() =>
                            handleStatusUpdate(completingMission.id, "in_progress", reasonText)
                          }
                          disabled={isSubmitting}
                          className="flex-1 py-5 bg-rose-50 text-rose-500 border border-rose-100 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95">
                          {isSubmitting ? (
                            <i className="fa-solid fa-spinner animate-spin"></i>
                          ) : (
                            "Demander Correction"
                          )}
                        </button>
                      )}

                    <button
                      onClick={async () => {
                        let fileUrl = "";
                        if (selectedFile) {
                          setUploadingFile(true);
                          try {
                            const fileExt = selectedFile.name.split(".").pop();
                            const fileName = `${completingMission.id}/${Date.now()}.${fileExt}`;
                            const { data, error } = await supabase.storage
                              .from("mission-attachments")
                              .upload(fileName, selectedFile);

                            if (error) throw error;
                            fileUrl = data.path;
                          } catch (err) {
                            console.error("Upload error:", err);
                            setToast({ message: "Erreur lors de l'upload.", type: "error" });
                            return;
                          } finally {
                            setUploadingFile(false);
                          }
                        }
                        handleStatusUpdate(completingMission.id, "completed", reasonText, fileUrl);
                      }}
                      disabled={
                        !reasonText.trim() ||
                        (completingMission.needs_attachment &&
                          user.role === UserRole.TECHNICIAN &&
                          !selectedFile) ||
                        isSubmitting ||
                        uploadingFile
                      }
                      className="flex-[1.5] py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                      {uploadingFile || isSubmitting ? (
                        <i className="fa-solid fa-circle-notch animate-spin"></i>
                      ) : user.role === UserRole.MANAGER &&
                        completingMission.status === "awaiting_validation" ? (
                        "Approuver & Libérer XP"
                      ) : completingMission.needs_attachment &&
                        user.role === UserRole.TECHNICIAN ? (
                        "Soumettre Livrable (+10 XP)"
                      ) : (
                        "Valider Mission"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL CANCELLATION MISSION */}
      {cancellingMission &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-lg shadow-2xl animate-scale-up">
              <h3 className="text-2xl font-black text-slate-900 mb-2">Annuler la Mission</h3>
              <p className="text-xs font-bold text-slate-400 uppercase mb-6 tracking-widest">
                Pourquoi arrêter cette mission ?
              </p>

              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Motif d'annulation..."
                className="w-full h-32 p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-rose-500 outline-none transition-all font-medium text-slate-600 resize-none mb-6"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setCancellingMission(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                  Fermer
                </button>
                <button
                  onClick={() => handleStatusUpdate(cancellingMission.id, "cancelled", reasonText)}
                  disabled={!reasonText.trim() || isSubmitting}
                  className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50">
                  Confirmer l'Annulation
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {toast && (
        <CustomToast
          message={toast.message}
          type={toast.type}
          visible={!!toast}
          onClose={() => setToast(null)}
        />
      )}
      {/* Quiz Modal */}
      {isQuizOpen && quizProcedure && currentQuizData && currentMasteryRequestId && (
        <MasteryQuizModal
          isOpen={isQuizOpen}
          onClose={() => setIsQuizOpen(false)}
          procedure={quizProcedure}
          user={user}
          quizData={currentQuizData}
          masteryRequestId={currentMasteryRequestId}
          onSuccess={handleQuizResult}
        />
      )}
    </div>
  );
};

export default Missions;
