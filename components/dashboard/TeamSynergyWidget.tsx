import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import InfoTooltip from '../InfoTooltip';

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  xp_points: number;
  level: number;
}

const TeamSynergyWidget: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [loading, setLoading] = useState(true);

  // Team Level Logic (scaled up from individual levels)
  // Level 1: 0 - 5000
  // Level 2: 5000 - 15000
  // ...
  const getTeamLevelInfo = (xp: number) => {
    if (xp < 5000) return { level: 1, title: "Escouade Naissante", nextThreshold: 5000, currentBase: 0 };
    if (xp < 15000) return { level: 2, title: "Unité Tactique", nextThreshold: 15000, currentBase: 5000 };
    if (xp < 30000) return { level: 3, title: "Bataillon Expérimenté", nextThreshold: 30000, currentBase: 15000 };
    if (xp < 60000) return { level: 4, title: "Force d'Élite", nextThreshold: 60000, currentBase: 30000 };
    if (xp < 100000) return { level: 5, title: "Légion d'Honneur", nextThreshold: 100000, currentBase: 60000 };
    return { level: 6, title: "Panthéon des Héros", nextThreshold: 200000, currentBase: 100000 };
  };

  useEffect(() => {
    const fetchTeamSynergy = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, avatar_url, xp_points, level')
          .eq('role', 'technician')
          .order('xp_points', { ascending: false });

        if (error) throw error;

        if (data) {
          const members = data.map((m: any) => ({
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            avatar_url: m.avatar_url,
            xp_points: m.xp_points || 0,
            level: m.level || 1
          }));
          setTeamMembers(members);
          setTotalXP(members.reduce((acc: number, m: TeamMember) => acc + m.xp_points, 0));
        }
      } catch (err) {
        console.error("Error fetching team synergy:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamSynergy();
  }, []);

  const levelInfo = getTeamLevelInfo(totalXP);
  const progress = Math.min(100, Math.max(0, ((totalXP - levelInfo.currentBase) / (levelInfo.nextThreshold - levelInfo.currentBase)) * 100));
  const remainingXP = levelInfo.nextThreshold - totalXP;

  if (loading) return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm animate-pulse h-32 flex items-center justify-center">
      <div className="text-xs font-black text-slate-300 uppercase tracking-widest">Chargement Synergie...</div>
    </div>
  );

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-amber-100 shadow-xl shadow-amber-500/5 relative group/synergy overflow-visible transition-all hover:shadow-2xl hover:shadow-amber-500/10">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-amber-200">
            <i className="fa-solid fa-users-viewfinder"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Synergie d'Équipe</h3>
              <InfoTooltip text="Évolution collective basée sur l'XP cumulée de tous les techniciens." />
            </div>
            <div className="flex items-center gap-2 mt-1">
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest">Niveau {levelInfo.level}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">• {levelInfo.title}</span>
            </div>
          </div>
        </div>
        <div className="text-right hidden sm:block">
             <span className="text-3xl font-black text-slate-900 tracking-tighter">{totalXP.toLocaleString()}</span>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Points XP Cumulés</p>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50 mb-3">
        <div 
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(245,158,11,0.5)]"
          style={{ width: `${progress}%` }}
        >
            <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite] opacity-50"></div>
        </div>
      </div>

      <div className="flex justify-between items-center px-1">
         <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{Math.round(progress)}% Progression</span>
         </div>
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            Prochain Grade : <span className="text-slate-600">+{remainingXP.toLocaleString()} XP</span> 🚀
         </span>
      </div>

      {/* HOVER DETAILS - POPOVER */}
      <div className="absolute left-0 right-0 top-[90%] mt-4 mx-4 bg-white rounded-[2rem] p-6 shadow-2xl shadow-slate-200/50 border border-slate-100 z-50 opacity-0 invisible group-hover/synergy:opacity-100 group-hover/synergy:visible transition-all duration-300 transform group-hover/synergy:translate-y-0 translate-y-4 pointer-events-none group-hover/synergy:pointer-events-auto">
         {/* Little Arrow */}
         <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white transform rotate-45 border-l border-t border-slate-100"></div>
         
         <div className="mb-4 flex items-center justify-between border-b border-slate-50 pb-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-list-ol"></i> Détail des Forces
            </h4>
            <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">{teamMembers.length} Membres Actifs</span>
         </div>

         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-indigo-50 transition-all group/member cursor-default">
                    <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-md overflow-hidden shrink-0 relative">
                        {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.first_name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold bg-slate-100 text-xs uppercase">
                                {member.first_name?.[0]}{member.last_name?.[0]}
                            </div>
                        )}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate group-hover/member:text-indigo-600 transition-colors">{member.first_name} {member.last_name}</p>
                        <div className="flex items-center justify-between mt-0.5">
                             <span className="text-[9px] font-black text-white bg-indigo-400 px-1.5 py-0.5 rounded-md shadow-sm">NV {member.level}</span>
                             <span className="text-[10px] text-slate-400 font-bold">{member.xp_points.toLocaleString()} XP</span>
                        </div>
                    </div>
                </div>
            ))}
         </div>
      </div>

    </div>
  );
};

export default TeamSynergyWidget;
