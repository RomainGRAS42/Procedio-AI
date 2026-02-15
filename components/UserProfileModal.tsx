import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import RadarChart from "./RadarChart";

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  currentUserRole: string;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url?: string;
  xp: number;
  stats_by_category?: Record<string, { success: number; total: number }>;
}

interface ReferentProcedure {
  id: string;
  procedure_id: string;
  assigned_at: string;
  procedure: {
    title: string;
    category: string;
  }[];
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  onClose,
  currentUserRole,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [referentProcedures, setReferentProcedures] = useState<ReferentProcedure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      const { data: referentData } = await supabase
        .from("procedure_referents")
        .select(
          `
          id,
          procedure_id,
          assigned_at,
          procedure:procedures(title, category)
        `
        )
        .eq("user_id", userId);

      if (referentData) {
        setReferentProcedures(referentData as ReferentProcedure[]);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveReferent = async (procedureId: string) => {
    try {
      const { error } = await supabase
        .from("procedure_referents")
        .delete()
        .eq("procedure_id", procedureId)
        .eq("user_id", userId);

      if (!error) {
        setReferentProcedures((prev) => prev.filter((r) => r.procedure_id !== procedureId));
      }
    } catch (err) {
      console.error("Error removing referent:", err);
    }
  };

  const getRadarData = () => {
    if (!profile?.stats_by_category) return [];

    return Object.entries(profile.stats_by_category).map(([category, stats]) => ({
      subject: category,
      value: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
      fullMark: 100,
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-[2rem] w-full max-w-3xl p-8 shadow-2xl animate-slide-up border border-slate-100">
          <div className="flex items-center justify-center py-20">
            <i className="fa-solid fa-circle-notch animate-spin text-4xl text-indigo-500"></i>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const radarData = getRadarData();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl animate-slide-up border border-slate-100">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-200 overflow-hidden">
              <img
                src={
                  profile.avatar_url ||
                  `https://ui-avatars.com/api/?name=${profile.first_name || "U"}&background=random&size=128`
                }
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {profile.first_name} {profile.last_name}
              </h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                {profile.email}
              </p>
              <span
                className={`inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border mt-2 ${
                  profile.role === "MANAGER"
                    ? "bg-amber-50 text-amber-600 border-amber-100"
                    : "bg-indigo-50 text-indigo-600 border-indigo-100"
                }`}>
                {profile.role}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl p-6 border border-indigo-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500 text-white flex items-center justify-center">
                <i className="fa-solid fa-star text-lg"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  Expérience
                </p>
                <p className="text-3xl font-black text-indigo-900">{profile.xp} XP</p>
              </div>
            </div>
            <div className="mt-4 bg-white/50 rounded-2xl p-3">
              <div className="flex justify-between text-[10px] font-bold mb-2">
                <span className="text-indigo-600">Niveau actuel</span>
                <span className="text-indigo-900">
                  {Math.floor(profile.xp / 100)} / {Math.floor(profile.xp / 100) + 1}
                </span>
              </div>
              <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${profile.xp % 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center">
                  <i className="fa-solid fa-certificate text-lg"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                    Référent de
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    {referentProcedures.length} procédure
                    {referentProcedures.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>

            {referentProcedures.length > 0 ? (
              <div className="space-y-2">
                {referentProcedures.map((ref) => (
                  <div
                    key={ref.id}
                    className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center justify-between group hover:border-orange-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                        <i className="fa-solid fa-file-lines text-sm"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {ref.procedure[0]?.title || "Titre inconnu"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {ref.procedure[0]?.category || "Catégorie inconnue"} • Depuis le{" "}
                          {new Date(ref.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {currentUserRole === "MANAGER" && (
                      <button
                        onClick={() => handleRemoveReferent(ref.procedure_id)}
                        className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-black uppercase tracking-widest transition-all">
                        <i className="fa-solid fa-xmark mr-1"></i>
                        Retirer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <i className="fa-solid fa-certificate text-xl"></i>
                </div>
                <p className="text-slate-500 font-bold text-sm">Aucune procédure référente</p>
                <p className="text-slate-400 text-[10px] mt-1">
                  Cet utilisateur n'est référent d'aucune procédure.
                </p>
              </div>
            )}
          </div>

          <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
                <i className="fa-solid fa-chart-radar text-lg"></i>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Compétences
                </p>
                <p className="text-sm font-black text-slate-900">Taux de réussite par catégorie</p>
              </div>
            </div>

            <RadarChart
              data={radarData}
              color="#10b981"
              fillOpacity={0.25}
              strokeWidth={3}
              height={300}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
