import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { User, UserRole } from "../types";
import RadarChart from "../components/RadarChart";

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
  const [activeTab, setActiveTab] = useState<"members" | "invitations" | "candidatures">("members");
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [profileDetails, setProfileDetails] = useState<any>(null);
  const [referentProcedures, setReferentProcedures] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "members") {
        const { data } = await supabase
          .from("user_profiles")
          .select("*, procedure_referents(count)")
          .order("created_at", { ascending: false });
        if (data) setMembers(data);
      } else if (activeTab === "invitations") {
        const { data } = await supabase
          .from("invitations")
          .select("*")
          .order("created_at", { ascending: false });
        if (data) setInvitations(data);
      } else if (activeTab === "candidatures") {
        const { data } = await supabase
          .from("mastery_requests")
          .select(`
            *,
            user:user_profiles(id, first_name, last_name, avatar_url),
            procedure:procedures(id, title, category)
          `)
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (data) setApplications(data);
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

  const handleToggleExpand = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(userId);
    setLoadingDetails(true);
    setProfileDetails(null);
    setReferentProcedures([]);

    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      if (profile) setProfileDetails(profile);

      const { data: refs } = await supabase
        .from("procedure_referents")
        .select(`
          id,
          procedure_id,
          assigned_at,
          procedure:procedures(title, category)
        `)
        .eq("user_id", userId);
      
      if (refs) setReferentProcedures(refs);
    } catch (err) {
      console.error("Error fetching details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleApplicationAction = async (applicationId: string, status: "completed" | "rejected") => {
    try {
      const app = applications.find(a => a.id === applicationId);
      if (!app) return;

      const { error } = await supabase
        .from("mastery_requests")
        .update({ status, completed_at: new Date().toISOString() })
        .eq("id", applicationId);

      if (error) throw error;

      if (status === "completed") {
        // If approved, create the referent record
        await supabase.from("procedure_referents").insert({
          procedure_id: app.procedure_id,
          user_id: app.user_id
        });
        
        // Add XP reward
        const { data: profile } = await supabase.from("user_profiles").select("xp_points").eq("id", app.user_id).single();
        if (profile) {
          await supabase.from("user_profiles").update({ xp_points: (profile.xp_points || 0) + 100 }).eq("id", app.user_id);
        }

        setNotification({ msg: "Candidature approuvée !", type: "success" });
      } else {
        setNotification({ msg: "Candidature refusée", type: "success" });
      }

      setApplications(prev => prev.filter(a => a.id !== applicationId));
    } catch (err) {
      console.error("Error handling application:", err);
      setNotification({ msg: "Erreur lors de l'action", type: "error" });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleRemoveReferent = async (procedureId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("procedure_referents")
        .delete()
        .eq("procedure_id", procedureId)
        .eq("user_id", userId);

      if (!error) {
        setReferentProcedures((prev) => prev.filter((r) => r.procedure_id !== procedureId));
        // Mettre à jour le compteur dans la liste principale
        setMembers(prev => prev.map(m => {
          if (m.id === userId) {
            const currentCount = m.procedure_referents?.[0]?.count || 0;
            return {
              ...m,
              procedure_referents: [{ count: Math.max(0, currentCount - 1) }]
            };
          }
          return m;
        }));
      }
    } catch (err) {
      console.error("Error removing referent:", err);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in pb-20">
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
        {user.role === UserRole.MANAGER && (
          <button
            onClick={() => setActiveTab("candidatures")}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "candidatures"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}>
            Candidatures Référents
            {applications.length > 0 && activeTab !== "candidatures" && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>
        )}
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
                    Expérience / Références
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
                      <React.Fragment key={member.id}>
                        <tr
                          className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${expandedUserId === member.id ? 'bg-slate-50/80 shadow-inner' : ''}`}
                          onClick={() => handleToggleExpand(member.id)}>
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
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-indigo-600 tabular-nums">
                                    {member.xp_points || 0} XP
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">
                                    Niv. {Math.floor((member.xp_points || 0) / 100) + 1}
                                  </span>
                                </div>
                                <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                  <div 
                                    className="h-full bg-indigo-500" 
                                    style={{ width: `${(member.xp_points || 0) % 100}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col ml-4 pl-4 border-l border-slate-100">
                                <span className="text-[10px] font-black text-amber-600 tabular-nums">
                                  {(member.procedure_referents?.[0]?.count || 0)} RÉF.
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                  Gardien
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-6 text-right relative">
                            <div className="flex items-center justify-end gap-2">
                              <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${expandedUserId === member.id ? 'rotate-180' : ''}`}></i>
                              {user.id !== member.id && (
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
                              )}
                            </div>

                            {activeMenuId === member.id && (
                              <div className="absolute right-6 top-12 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Actions
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetPassword(member.email);
                                  }}
                                  className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors">
                                  <i className="fa-solid fa-key w-4 text-center"></i>
                                  Renvoyer accès
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {expandedUserId === member.id && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={5} className="p-0 border-b border-slate-100">
                              <div className="p-8 animate-in slide-in-from-top-2 duration-300">
                                {loadingDetails ? (
                                  <div className="flex items-center justify-center py-8">
                                    <i className="fa-solid fa-circle-notch animate-spin text-xl text-indigo-400"></i>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* XP & Level */}
                                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4">Expérience & Maîtrise</p>
                                      <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-100 text-xl font-black">
                                          {Math.floor((member.xp_points || 0) / 100) + 1}
                                        </div>
                                        <div>
                                          <p className="text-xl font-black text-slate-900">{member.xp_points || 0} XP</p>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Points accumulés</p>
                                        </div>
                                      </div>
                                      <div className="w-full h-2 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${(member.xp_points || 0) % 100}%` }} />
                                      </div>
                                      <p className="text-[8px] text-slate-400 font-bold text-center mt-2 lowercase">PROGRES : {(member.xp_points || 0) % 100}%</p>
                                    </div>

                                    {/* Referent Workload */}
                                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col">
                                      <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-4">Expertise & Gardiennage</p>
                                      {referentProcedures.length > 0 ? (
                                        <div className="space-y-2 overflow-y-auto max-h-48 pr-2 custom-scrollbar">
                                          {referentProcedures.map((ref: any) => (
                                            <div key={ref.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100 group/ref">
                                                <div className="truncate pr-2">
                                                  <p className="text-[10px] font-bold text-slate-800 truncate">
                                                    {Array.isArray(ref.procedure) 
                                                      ? ref.procedure[0]?.title 
                                                      : (ref.procedure as any)?.title || "Sans titre"}
                                                  </p>
                                                  <p className="text-[8px] text-slate-400 font-bold uppercase">
                                                    {Array.isArray(ref.procedure) 
                                                      ? ref.procedure[0]?.category 
                                                      : (ref.procedure as any)?.category || "Divers"}
                                                  </p>
                                                </div>
                                              {user.role === UserRole.MANAGER && (
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveReferent(ref.procedure_id, member.id);
                                                  }}
                                                  title="Retirer ce référent"
                                                  className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-90">
                                                  <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                                          <i className="fa-solid fa-certificate text-2xl mb-2 text-slate-300"></i>
                                          <p className="text-[10px] font-bold uppercase text-slate-400">Aucune référence</p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Skills Radar */}
                                    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center justify-center min-h-[200px]">
                                      <div className="w-full" key={`${expandedUserId}-${loadingDetails}`}>
                                        <RadarChart 
                                          data={Object.entries(profileDetails?.stats_by_category || {}).map(([category, stats]: [string, any]) => {
                                            const value = typeof stats === 'number' 
                                              ? stats 
                                              : (stats?.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0);
                                            return {
                                              subject: category,
                                              value: value,
                                              fullMark: 100,
                                            };
                                          })}
                                          color="#4f46e5"
                                          height={180}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400 text-xs">
                        Aucun membre trouvé.
                      </td>
                    </tr>
                  )
                ) : activeTab === "candidatures" ? (
                  applications.length > 0 ? (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                              <img
                                src={app.user?.avatar_url || `https://ui-avatars.com/api/?name=${app.user?.first_name || "U"}&background=random`}
                                alt="avatar"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {app.user?.first_name} {app.user?.last_name}
                              </p>
                              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">
                                Candidat Référent
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <div>
                            <p className="text-xs font-black text-slate-800 tracking-tight">
                              {app.procedure?.title}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                              {app.procedure?.category}
                            </p>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className="flex items-center gap-2 text-[10px] font-black uppercase text-amber-500 tracking-widest">
                            <i className="fa-solid fa-clock animate-pulse"></i>
                            En attente
                          </span>
                        </td>
                        <td className="p-6">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Postulé le : {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApplicationAction(app.id, "rejected")}
                              className="px-4 py-2 rounded-xl text-rose-600 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all">
                              Refuser
                            </button>
                            <button
                              onClick={() => handleApplicationAction(app.id, "completed")}
                              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                              Approuver
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400">
                        <i className="fa-solid fa-user-plus text-2xl mb-3 opacity-20"></i>
                        <p className="text-[10px] font-bold uppercase tracking-widest">
                          Aucune candidature pour le moment
                        </p>
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
                  className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3">
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
