import React from "react";

export const MissionStatusBadge = ({ status }: { status: string }) => {
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

export default MissionStatusBadge;
