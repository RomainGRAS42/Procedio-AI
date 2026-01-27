import React, { useState, useEffect } from "react";
import { User, Procedure, UserRole, Suggestion } from "../types";
import { supabase } from "../lib/supabase";

interface DashboardProps {
  user: User;
  onQuickNote: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  onViewHistory: () => void;
}

interface Announcement {
  id: string;
  content: string;
  author_name: string;
  author_initials: string;
  created_at: string;
  author_id?: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  user,
  onQuickNote,
  onSelectProcedure,
  onViewHistory,
}) => {
  const [isRead, setIsRead] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);

  const [recentProcedures, setRecentProcedures] = useState<Procedure[]>([]);
  const [loadingProcedures, setLoadingProcedures] = useState(true);

  // Suggestions (Manager Only)
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  const stats = [
    {
      label: "Consultations",
      value: "42",
      icon: "fa-book-open",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Suggestions",
      value: "7",
      icon: "fa-check-circle",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Mes Notes",
      value: "12",
      icon: "fa-note-sticky",
      color: "text-cyan-600",
      bg: "bg-cyan-50",
    },
  ];

  useEffect(() => {
    fetchLatestAnnouncement();
    fetchRecentProcedures();
    if (user.role === UserRole.MANAGER) {
      fetchSuggestions();
    }
  }, [user.role]);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from("procedure_suggestions")
        .select(
          `
          id,
          suggestion,
          type,
          priority,
          created_at,
          status,
          user_id,
          procedure_id,
          user:user_profiles!user_id(first_name, last_name, avatar_url),
          procedure:procedures!procedure_id(title)
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        setPendingSuggestions(
          data.map((item: any) => ({
            id: item.id,
            content: item.suggestion,
            status: item.status,
            createdAt: item.created_at,
            type: item.type,
            priority: item.priority,
            userName: item.user ? `${item.user.first_name} ${item.user.last_name}` : "Inconnu",
            procedureTitle: item.procedure ? item.procedure.title : "Procédure inconnue",
            user_id: item.user_id,
            procedure_id: item.procedure_id,
          }))
        );
      }
    } catch (err) {
      console.error("Erreur fetch suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleUpdateStatus = async (status: "approved" | "rejected") => {
    if (!selectedSuggestion) return;

    try {
      const { error } = await supabase
        .from("procedure_suggestions")
        .update({ status })
        .eq("id", selectedSuggestion.id);

      if (error) throw error;

      // Update local state
      setPendingSuggestions((prev) => prev.filter((s) => s.id !== selectedSuggestion.id));
      setShowSuggestionModal(false);
      setSelectedSuggestion(null);

      // Add notification log
      await supabase.from("notes").insert([
        {
          title: `SUGGESTION_${status.toUpperCase()}`,
          content: `Suggestion de ${selectedSuggestion.userName} sur "${selectedSuggestion.procedureTitle}" ${status === "approved" ? "validée" : "refusée"} par ${user.firstName}.`,
          is_protected: false,
          user_id: user.id,
          tags: ["SUGGESTION", status.toUpperCase()],
        },
      ]);
    } catch (err) {
      alert("Erreur lors de la mise à jour du statut");
      console.error(err);
    }
  };

  const fetchRecentProcedures = async () => {
    setLoadingProcedures(true);
    try {
      const { data, error } = await supabase
        .from("procedures")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      if (data) {
        setRecentProcedures(
          data.map((p) => ({
            id: p.uuid,
            file_id: p.uuid,
            title: p.title || "Sans titre",
            category: p.Type || "GÉNÉRAL",
            fileUrl: p.file_url,
            createdAt: p.created_at,
            views: p.views || 0,
            status: p.status || "validated",
          }))
        );
      }
    } catch (err) {
      console.error("Erreur fetch procedures:", err);
    } finally {
      setLoadingProcedures(false);
    }
  };

  const fetchLatestAnnouncement = async () => {
    setLoadingAnnouncement(true);
    try {
      const { data, error } = await supabase
        .from("team_announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setAnnouncement(data);
        setEditContent(data.content);
      } else {
        const defaultAnn = {
          id: "default",
          content: "Bienvenue sur Procedio. Aucune annonce d'équipe pour le moment.",
          author_name: "Système",
          author_initials: "SY",
          created_at: new Date().toISOString(),
        };
        setAnnouncement(defaultAnn);
        setEditContent(defaultAnn.content);
      }
    } catch (err) {
      console.error("Erreur annonces:", err);
    } finally {
      setLoadingAnnouncement(false);
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("team_announcements").insert([
        {
          content: editContent,
          author_name: user.firstName,
          author_initials: user.firstName.substring(0, 2).toUpperCase(),
          author_id: user.id,
        },
      ]);

      if (error) throw error;

      setIsEditing(false);
      await fetchLatestAnnouncement();
      setIsRead(false);
    } catch (err) {
      alert("Erreur lors de l'enregistrement de l'annonce");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!announcement) return;
    setIsRead(true);

    try {
      await supabase.from("notes").insert([
        {
          title: `LOG_READ_${announcement.id}`,
          content: `L'annonce "${announcement.content.substring(0, 30)}..." a été lue par ${user.firstName} ${user.lastName || ""}.`,
          is_protected: false,
          user_id: user.id,
          tags: ["NOTIFICATION", "SYSTEM"],
        },
      ]);
    } catch (err) {
      console.error("Erreur log lecture:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Format Invalide";
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-10 animate-slide-up pb-12">
      <section className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-xl shadow-indigo-500/5 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="space-y-2 text-center md:text-left">
          <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-3">
            {new Date()
              .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
              .toUpperCase()}
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight">
            Hello, <span className="text-indigo-600">{user.firstName}</span>
          </h2>
          <p className="text-slate-400 font-medium text-lg">
            Prêt à simplifier le support IT aujourd'hui ?
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8">
        <section
          className={`relative border border-slate-100 rounded-[3rem] p-10 flex flex-col justify-between items-start gap-10 transition-all duration-500 ${
            isRead ? "bg-slate-50 opacity-60" : "bg-white shadow-xl shadow-indigo-500/5"
          }`}>
          {loadingAnnouncement ? (
            <div className="w-full py-10 flex items-center justify-center gap-4">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Récupération de l'annonce...
              </span>
            </div>
          ) : isEditing ? (
            <div className="w-full space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  Édition de l'annonce équipe
                </h4>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-rose-500 transition-colors">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <textarea
                className="w-full h-32 p-6 bg-slate-50 border-2 border-indigo-100 rounded-3xl focus:bg-white focus:border-indigo-500 outline-none resize-none font-bold text-slate-700 text-lg transition-all"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Écrivez votre message à l'équipe ici..."
              />
              <div className="flex justify-end gap-4">
                <button
                  onClick={handleSaveAnnouncement}
                  disabled={saving || !editContent.trim()}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 shadow-lg disabled:opacity-50 transition-all">
                  {saving ? "Publication..." : "Publier l'annonce"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-6 w-full">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-xl border border-indigo-100">
                  {announcement?.author_initials || "??"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Annonce Équipe • Par {announcement?.author_name}
                    </h4>
                    {user.role === UserRole.MANAGER && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] font-black text-indigo-500 hover:text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-pen-to-square"></i> Modifier
                      </button>
                    )}
                  </div>
                  <p className="text-xl font-semibold leading-relaxed tracking-tight text-slate-700 mt-2">
                    "{announcement?.content}"
                  </p>
                </div>
              </div>
              <div className="w-full flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                  Posté le{" "}
                  {announcement
                    ? new Date(announcement.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "..."}
                </span>
                {user.role === UserRole.TECHNICIAN && !isRead && (
                  <button
                    onClick={handleMarkAsRead}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">
                    Lu et compris
                  </button>
                )}
                {isRead && (
                  <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-circle-check"></i> Lu et notifié
                  </span>
                )}
              </div>
            </>
          )}
        </section>

      {/* Suggestions Widget (Manager Only) */}
      {user.role === UserRole.MANAGER && pendingSuggestions.length > 0 && (
        <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm overflow-hidden animate-slide-up">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl shadow-sm">
              <i className="fa-solid fa-lightbulb"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-xl">Suggestions à traiter</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {pendingSuggestions.length} en attente de validation
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Priorité</th>
                  <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Auteur</th>
                  <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Procédure</th>
                  <th className="p-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pendingSuggestions.map((suggestion) => (
                  <tr key={suggestion.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-[10px] font-bold text-slate-500">
                      {formatDate(suggestion.createdAt)}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                        suggestion.type === 'correction' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        suggestion.type === 'update' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {suggestion.type === 'correction' ? 'Correction' :
                         suggestion.type === 'update' ? 'Mise à jour' : 'Ajout'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                        suggestion.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        suggestion.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                        {suggestion.priority === 'high' ? 'Haute' :
                         suggestion.priority === 'medium' ? 'Moyenne' : 'Basse'}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-700">
                      {suggestion.userName}
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-700">
                      {suggestion.procedureTitle}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedSuggestion(suggestion);
                          setShowSuggestionModal(true);
                        }}
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-sm active:scale-95 flex items-center gap-2 ml-auto"
                      >
                        <i className="fa-regular fa-eye"></i> Examiner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <article
            key={idx}
            className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-8 hover:shadow-md transition-all group">
            <div
              className={`w-20 h-20 rounded-3xl ${stat.bg} ${stat.color} flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110`}>
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
                {stat.value}
              </p>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-3">
                {stat.label}
              </h3>
            </div>
          </article>
        ))}
      </section>

      <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
          <h3 className="font-black text-slate-900 text-xl tracking-tight">Activité Récente</h3>
          <button
            onClick={onViewHistory}
            className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-6 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">
            Tout voir
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {loadingProcedures ? (
            <div className="p-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Chargement des fichiers...
              </p>
            </div>
          ) : recentProcedures.length > 0 ? (
            recentProcedures.map((proc) => (
              <div
                key={proc.id}
                onClick={() => onSelectProcedure(proc)}
                className="p-10 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-all group">
                <div className="flex items-center gap-8">
                  <div className="w-16 h-16 bg-white border border-slate-100 text-slate-300 rounded-2xl flex items-center justify-center group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                    <i className="fa-regular fa-file-lines text-2xl"></i>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 text-xl group-hover:text-indigo-600 transition-colors leading-tight">
                      {proc.title}
                    </h4>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase bg-slate-100 px-3 py-1 rounded-lg">
                        {proc.category}
                      </span>
                      <span className="text-[10px] text-indigo-400 font-black tracking-widest uppercase bg-indigo-50 px-3 py-1 rounded-lg flex items-center gap-2">
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        {formatDate(proc.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all"></i>
              </div>
            ))
          ) : (
            <div className="p-20 text-center text-slate-300 flex flex-col items-center gap-4">
              <i className="fa-solid fa-folder-open text-4xl opacity-20"></i>
              <p className="text-[10px] font-black uppercase tracking-widest">
                Aucune activité récente détectée
              </p>
            </div>
          )}
        </div>
      </section>
      </div>

      {/* MODAL REVIEW SUGGESTION */}
      {showSuggestionModal && selectedSuggestion && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                <i className="fa-solid fa-clipboard-check"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-lg">Examiner la suggestion</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {selectedSuggestion.procedureTitle}
                </p>
              </div>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Type
                </span>
                <span className={`text-xs font-black uppercase tracking-widest ${
                  selectedSuggestion.type === 'correction' ? 'text-rose-500' :
                  selectedSuggestion.type === 'update' ? 'text-amber-500' :
                  'text-emerald-500'
                }`}>
                  {selectedSuggestion.type === 'correction' ? 'Correction' :
                   selectedSuggestion.type === 'update' ? 'Mise à jour' : 'Ajout'}
                </span>
              </div>
              <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Priorité
                </span>
                <span className={`text-xs font-black uppercase tracking-widest ${
                  selectedSuggestion.priority === 'high' ? 'text-rose-500' :
                  selectedSuggestion.priority === 'medium' ? 'text-amber-500' :
                  'text-slate-500'
                }`}>
                  {selectedSuggestion.priority === 'high' ? 'Haute' :
                   selectedSuggestion.priority === 'medium' ? 'Moyenne' : 'Basse'}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Suggestion de {selectedSuggestion.userName}
              </span>
              <div className="w-full p-5 rounded-2xl bg-slate-50 border border-slate-100 font-medium text-slate-600 text-sm max-h-60 overflow-y-auto">
                {selectedSuggestion.content}
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-4 border-t border-slate-50">
              <button
                onClick={() => setShowSuggestionModal(false)}
                className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all">
                Fermer
              </button>
              <button
                onClick={() => handleUpdateStatus('rejected')}
                className="px-6 py-3 rounded-xl bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all">
                Rejeter
              </button>
              <button
                onClick={() => handleUpdateStatus('approved')}
                className="px-8 py-3 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
                <i className="fa-solid fa-check"></i>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
