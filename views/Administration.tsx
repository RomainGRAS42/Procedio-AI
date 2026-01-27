import React, { useState, useEffect } from "react";
import { UserRole } from "../types";
import { supabase } from "../lib/supabase";

const Administration: React.FC = () => {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole | null>(null);
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // UTILISATION DE LA TABLE user_profiles
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("email", { ascending: true });

      if (error) {
        console.error("Erreur de récupération :", error.message);
        setUsersList([]);
        return;
      }

      setUsersList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || !inviteRole) return;
    setInviting(true);
    try {
      // 1. Invitation Supabase avec métadonnées immédiates
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
        data: {
          role: inviteRole, // C'est ICI que la magie opère : le rôle est scellé dans le compte
          firstName: inviteEmail.split("@")[0], // Un prénom par défaut sympa
          invitedBy: "Manager",
        },
      });

      if (error) throw error;

      setMessage({
        type: "success",
        text: `Invitation envoyée à ${inviteEmail} (Rôle: ${inviteRole})`,
      });
      setShowInvitePopup(false);
      setInviteEmail("");
      setInviteRole(null);
      // On recharge la liste pour voir le nouvel utilisateur (s'il apparaît déjà)
      fetchUsers();
    } catch (err: any) {
      console.error("Erreur invitation:", err);
      setMessage({
        type: "error",
        text: "Erreur lors de l'envoi : " + (err.message || "Contactez le support."),
      });
    } finally {
      setInviting(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setMessage({
        type: "success",
        text: `Email de récupération envoyé à ${email}`,
      });
    } catch (err: any) {
      setMessage({ type: "error", text: "Erreur : " + err.message });
    } finally {
      setTimeout(() => setMessage(null), 3000);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-slide-up pb-20">
      <div className="text-center space-y-3">
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Administration</h2>
        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em]">
          Comptes réels (user_profiles)
        </p>
      </div>

      {message && (
        <div
          className={`p-5 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center gap-4 animate-slide-up shadow-sm border ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
              : "bg-rose-50 text-rose-600 border-rose-100"
          }`}>
          <i
            className={`fa-solid ${message.type === "success" ? "fa-circle-check text-base" : "fa-circle-exclamation text-base"}`}></i>
          {message.text}
        </div>
      )}

      <section className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-indigo-500/5 space-y-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-10 border-b border-slate-100">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-inner border border-indigo-100">
              <i className="fa-solid fa-users-gear text-2xl"></i>
            </div>
            <div>
              <h4 className="font-black text-2xl text-slate-900 tracking-tight">Utilisateurs</h4>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                Table user_profiles synchronisée
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowInvitePopup(true)}
            className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-200 active:scale-95 flex items-center gap-3">
            <i className="fa-solid fa-plus-circle text-lg"></i>
            Inviter
          </button>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-black text-xs uppercase animate-pulse">
              Chargement...
            </div>
          ) : usersList.length > 0 ? (
            usersList.map((u) => (
              <div
                key={u.id}
                className="group p-6 rounded-[2rem] bg-slate-50 border border-transparent hover:bg-white hover:border-slate-200 transition-all flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-300 text-xl shadow-sm transition-transform group-hover:scale-105 group-hover:text-indigo-400">
                    {u.first_name?.[0] || u.email?.[0].toUpperCase() || "?"}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-lg">
                      {u.first_name || u.email.split("@")[0]}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {u.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${
                      u.role === UserRole.MANAGER
                        ? "bg-amber-50 text-amber-600 border-amber-200"
                        : "bg-indigo-50 text-indigo-600 border-indigo-200"
                    }`}>
                    {u.role || "TECHNICIAN"}
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === u.id ? null : u.id);
                      }}
                      className={`w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center shadow-sm ${
                        activeMenuId === u.id
                          ? "text-indigo-600 border-indigo-500 bg-indigo-50"
                          : ""
                      }`}
                      title="Actions">
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>

                    {activeMenuId === u.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Actions
                          </p>
                        </div>
                        <button
                          onClick={() => handleResetPassword(u.email)}
                          className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors">
                          <i className="fa-solid fa-key w-4 text-center"></i>
                          Renvoyer accès
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                <i className="fa-solid fa-user-slash text-2xl"></i>
              </div>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">
                Aucun profil trouvé dans 'user_profiles'.
              </p>
            </div>
          )}
        </div>
      </section>

      {showInvitePopup && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl space-y-8 animate-slide-up border border-slate-100 relative overflow-hidden">
            {/* Bouton fermeture Croix */}
            <button
              onClick={() => {
                setShowInvitePopup(false);
                setInviteRole(null);
              }}
              className="absolute top-8 right-8 w-10 h-10 rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            <div className="text-center space-y-2 pt-4">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-indigo-100 shadow-lg">
                <i className="fa-solid fa-user-plus text-3xl"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Inviter un collaborateur
              </h3>
              <p className="text-sm font-medium text-slate-400">
                Envoyez un accès sécurisé par email.
              </p>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">
                  Email professionnel
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="prenom.nom@procedio.fr"
                    className="w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <i className="fa-solid fa-envelope absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"></i>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 ml-4 uppercase tracking-widest">
                  Niveau d'accès
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setInviteRole(UserRole.TECHNICIAN)}
                    className={`group relative py-6 px-4 rounded-3xl text-left border-2 transition-all duration-300 ${inviteRole === UserRole.TECHNICIAN ? "bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-200" : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50"}`}>
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${inviteRole === UserRole.TECHNICIAN ? "text-indigo-200" : "text-slate-400"}`}>
                        Standard
                      </span>
                      <span
                        className={`text-sm font-bold ${inviteRole === UserRole.TECHNICIAN ? "text-white" : "text-slate-700"}`}>
                        Technicien
                      </span>
                    </div>
                    {inviteRole === UserRole.TECHNICIAN && (
                      <i className="fa-solid fa-check-circle absolute top-4 right-4 text-white"></i>
                    )}
                  </button>

                  <button
                    onClick={() => setInviteRole(UserRole.MANAGER)}
                    className={`group relative py-6 px-4 rounded-3xl text-left border-2 transition-all duration-300 ${inviteRole === UserRole.MANAGER ? "bg-amber-500 border-amber-500 shadow-xl shadow-amber-200" : "bg-white border-slate-100 hover:border-amber-200 hover:bg-slate-50"}`}>
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${inviteRole === UserRole.MANAGER ? "text-amber-200" : "text-slate-400"}`}>
                        Admin
                      </span>
                      <span
                        className={`text-sm font-bold ${inviteRole === UserRole.MANAGER ? "text-white" : "text-slate-700"}`}>
                        Manager
                      </span>
                    </div>
                    {inviteRole === UserRole.MANAGER && (
                      <i className="fa-solid fa-check-circle absolute top-4 right-4 text-white"></i>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={handleInviteUser}
                  disabled={inviting || !inviteEmail || !inviteRole}
                  className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl hover:shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                  {inviting ? (
                    <>
                      <i className="fa-solid fa-circle-notch animate-spin"></i> Envoi en cours...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i> Envoyer l'invitation
                    </>
                  )}
                </button>
              </div>
            </div>
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

export default Administration;
