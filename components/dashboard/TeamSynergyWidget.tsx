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
          // Correction: le rôle en DB est 'technicien' (français) et non 'technician'
          .eq('role', 'technicien')
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
    <div className="bg-white rounded-[2.5rem] p-8 border border-amber-100 shadow-xl shadow-amber-500/5 relative overflow-visible transition-all hover:shadow-2xl hover:shadow-amber-500/10">
      
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



    </div>
  );
};

export default TeamSynergyWidget;
