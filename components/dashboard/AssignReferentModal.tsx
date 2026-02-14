import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { UserRole } from "../../types";

interface AssignReferentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  procedureId: string;
  procedureTitle: string;
}

const AssignReferentModal: React.FC<AssignReferentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  procedureId,
  procedureTitle,
}) => {
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // No need to fetch technicians anymore since it is an open mission
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!procedureId) return;

    setIsSubmitting(true);
    try {
      // 1. Check if mission already exists to allow multiple open missions? 
      // User might want to re-open if failed?
      // Let's check if there is an ACTIVE mission (open, assigned, in_progress)
      const { data: existingMission } = await supabase
        .from("missions")
        .select("id")
        .eq("procedure_id", procedureId)
        .in("status", ["open", "assigned", "in_progress"])
        .maybeSingle();

      if (existingMission) {
        // Just close if already exists, maybe toast
        console.log("Mission already exists");
        onSuccess(); 
        onClose();
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Create OPEN Mission (assigned_to: null)
      const { error } = await supabase.from("missions").insert([
        {
          title: `Devenir Référent : ${procedureTitle}`,
          description: `Objectif : Valider votre expertise sur cette procédure orpheline.\n\nAction requise : Passer l'examen de maîtrise (Quiz).\n\nRécompense : Statut de Référent + Prime XP.`,
          xp_reward: 300, // High reward for crucial role
          urgency: "high", // Critical/High
          target_type: "team", // Visible to all
          assigned_to: null, // OPEN
          created_by: user.id,
          status: "open",
          procedure_id: procedureId, // Make sure we link it if column exists
          needs_attachment: false,
        },
      ]);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error creating validation mission:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden animate-scale-up">
        <div className="p-8">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-2xl mx-auto mb-6 shadow-sm">
            <i className="fa-solid fa-fire-flame-curved"></i>
          </div>

          <h2 className="text-2xl font-black text-slate-900 text-center mb-2">
            Appel à Expertise
          </h2>
          <p className="text-center text-slate-500 font-medium mb-8">
            Pour sécuriser la procédure <strong className="text-slate-900">"{procedureTitle}"</strong>, une mission de validation va être ouverte à toute l'équipe.
          </p>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              Détails de la Mission
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <i className="fa-solid fa-users text-indigo-500 w-5"></i>
                Ouverte à toute l'équipe
              </li>
              <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <i className="fa-solid fa-clipboard-question text-emerald-500 w-5"></i>
                Validation par Quiz (Auto)
              </li>
              <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <i className="fa-solid fa-trophy text-amber-500 w-5"></i>
                Récompense : 300 XP
              </li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors rounded-xl hover:bg-slate-50">
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-4 bg-rose-500 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-600 active:scale-95 transition-all flex items-center justify-center gap-2">
              {isSubmitting ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <>
                  <i className="fa-solid fa-bullhorn"></i>
                  Lancer l'Appel
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AssignReferentModal;
