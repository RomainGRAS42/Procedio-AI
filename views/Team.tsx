import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { User, UserRole } from "../types";

interface TeamProps {
  user: User;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  token?: string;
}

const Team: React.FC<TeamProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Formulaire d'invitation
  const [inviteEmail, setInviteEmail] = useState("");
  // On utilise des valeurs string 'manager'/'technicien' pour correspondre à la DB
  // même si l'état local peut utiliser l'enum pour la logique UI
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.TECHNICIAN);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "members") {
        const { data } = await supabase
          .from("user_profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (data) setMembers(data);
      } else {
        const { data } = await supabase
          .from("invitations")
          .select("*")
          .order("created_at", { ascending: false });
        if (data) setInvitations(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setNotification(null);

    try {
      // 1. Créer l'invitation en base
      const roleToSave = inviteRole === UserRole.MANAGER ? "manager" : "technicien";

      const { error } = await supabase.from("invitations").insert({
        email: inviteEmail,
        role: roleToSave,
        invited_by: user.id,
        status: "pending",
      });

      if (error) throw error;

      // 2. Simulation d'envoi d'email (car pas de backend SMTP ici)
      // Dans une vraie app, une Edge Function écouterait l'insert et enverrait l'email
      console.log(`[SIMULATION] Email envoyé à ${inviteEmail} avec le lien d'invitation.`);

      setNotification({ msg: "Invitation envoyée avec succès !", type: "success" });
      setShowInviteModal(false);
      setInviteEmail("");
      if (activeTab === "invitations") fetchData();
    } catch (err: any) {
      console.error(err);
      setNotification({ msg: "Erreur lors de l'invitation: " + err.message, type: "error" });
    } finally {
      setInviteLoading(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setNotification({
        type: "success",
        msg: `Email de récupération envoyé à ${email}`,
      });
    } catch (err: any) {
      setNotification({ type: "error", msg: "Erreur : " + err.message });
    } finally {
      setActiveMenuId(null);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestion d'Équipe</h2>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
            Membres & Invitations
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2">
          <i className="fa-solid fa-paper-plane"></i>
          Inviter un membre
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
              : "bg-rose-50 border-rose-100 text-rose-600"
          } text-xs font-bold flex items-center gap-3 animate-slide-up`}>
          <i
            className={`fa-solid ${notification.type === "success" ? "fa-check-circle" : "fa-circle-exclamation"}`}></i>
          {notification.msg}
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "members"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}>
          Membres actifs
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "invitations"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}>
          Invitations en attente
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400">
            <i className="fa-solid fa-circle-notch animate-spin text-2xl mb-3"></i>
            <p className="text-[10px] font-bold uppercase tracking-widest">Chargement...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Utilisateur
                  </th>
                  <th className="p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Rôle
                  </th>
                  <th className="p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Statut
                  </th>
                  <th className="p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Date
                  </th>
                  <th className="p-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeTab === "members" ? (
                  members.length > 0 ? (
                    members.map((member) => (
                      <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                              <img
                                src={
                                  member.avatar_url ||
                                  `https://ui-avatars.com/api/?name=${member.first_name || "U"}&background=random`
                                }
                                alt="avatar"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {member.first_name} {member.last_name}
                              </p>
                              <p className="text-[10px] text-slate-400">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <span
                            className={`inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                              member.role === "MANAGER"
                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                : "bg-indigo-50 text-indigo-600 border-indigo-100"
                            }`}>
                            {member.role}
                          </span>
                        </td>
                        <td className="p-6">
                          <span className="flex items-center gap-2 text-[10px] font-bold text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Actif
                          </span>
                        </td>
                        <td className="p-6 text-[10px] text-slate-400 font-medium">
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-6 text-right relative">
                          {user.id !== member.id && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === member.id ? null : member.id);
                                }}
                                className={`text-slate-300 hover:text-slate-600 transition-colors w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center ${
                                  activeMenuId === member.id ? "bg-slate-100 text-slate-600" : ""
                                }`}>
                                <i className="fa-solid fa-ellipsis"></i>
                              </button>

                              {activeMenuId === member.id && (
                                <div className="absolute right-6 top-12 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                      Actions
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleResetPassword(member.email)}
                                    className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors">
                                    <i className="fa-solid fa-key w-4 text-center"></i>
                                    Renvoyer accès
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400 text-xs">
                        Aucun membre trouvé.
                      </td>
                    </tr>
                  )
                ) : invitations.length > 0 ? (
                  invitations.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="p-6">
                        <p className="text-xs font-bold text-slate-900">{inv.email}</p>
                      </td>
                      <td className="p-6">
                        <span
                          className={`inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                            inv.role === "MANAGER"
                              ? "bg-amber-50 text-amber-600 border-amber-100"
                              : "bg-indigo-50 text-indigo-600 border-indigo-100"
                          }`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="p-6">
                        <span
                          className={`flex items-center gap-2 text-[10px] font-bold ${
                            inv.status === "accepted" ? "text-emerald-600" : "text-amber-500"
                          }`}>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              inv.status === "accepted" ? "bg-emerald-500" : "bg-amber-500"
                            }`}></span>
                          {inv.status === "accepted" ? "Acceptée" : "En attente"}
                        </span>
                      </td>
                      <td className="p-6 text-[10px] text-slate-400 font-medium">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-6 text-right">
                        {inv.status === "pending" && (
                          <button
                            className="text-indigo-500 hover:text-indigo-700 text-[10px] font-bold uppercase tracking-wide border border-indigo-100 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/signup?invite=${inv.token}`
                              );
                              setNotification({ msg: "Lien copié !", type: "success" });
                              setTimeout(() => setNotification(null), 2000);
                            }}>
                            Copier lien
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 text-xs">
                      Aucune invitation en attente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal d'invitation */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl animate-slide-up border border-slate-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">Inviter un collaborateur</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                  Envoyer un accès sécurisé
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">
                  Adresse Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="collegue@procedio.com"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm shadow-inner"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">
                  Rôle & Permissions
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setInviteRole(UserRole.TECHNICIAN)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      inviteRole === UserRole.TECHNICIAN
                        ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500/20"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-3 h-3 rounded-full ${inviteRole === UserRole.TECHNICIAN ? "bg-indigo-500" : "bg-slate-200"}`}></div>
                      <span
                        className={`text-xs font-black uppercase tracking-wide ${inviteRole === UserRole.TECHNICIAN ? "text-indigo-900" : "text-slate-500"}`}>
                        Technicien
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Accès lecture, suggestions et édition simple.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole(UserRole.MANAGER)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      inviteRole === UserRole.MANAGER
                        ? "border-amber-500 bg-amber-50/50 ring-1 ring-amber-500/20"
                        : "border-slate-100 bg-white hover:border-slate-200"
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`w-3 h-3 rounded-full ${inviteRole === UserRole.MANAGER ? "bg-amber-500" : "bg-slate-200"}`}></div>
                      <span
                        className={`text-xs font-black uppercase tracking-wide ${inviteRole === UserRole.MANAGER ? "text-amber-900" : "text-slate-500"}`}>
                        Manager
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Accès complet, gestion d'équipe et validations.
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
                  {inviteLoading ? (
                    <>
                      <i className="fa-solid fa-circle-notch animate-spin"></i>
                      Envoi...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      Envoyer l'invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {activeMenuId && (
        <div
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setActiveMenuId(null)}></div>
      )}
    </div>
  );
};

export default Team;
