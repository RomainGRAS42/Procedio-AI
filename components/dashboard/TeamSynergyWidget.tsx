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

const TEAM_LEVELS = [
  { level: 1, title: "Escouade Naissante", threshold: 5000 },
  { level: 2, title: "Unité Tactique", threshold: 15000 },
  { level: 3, title: "Bataillon Expérimenté", threshold: 30000 },
  { level: 4, title: "Force d'Élite", threshold: 60000 },
  { level: 5, title: "Légion d'Honneur", threshold: 100000 },
  { level: 6, title: "Panthéon des Héros", threshold: Infinity }
];

const TeamSynergyWidget: React.FC = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [loading, setLoading] = useState(true);

  const getTeamLevelInfo = (xp: number) => {
    let current = TEAM_LEVELS[0];
    let next = TEAM_LEVELS[1];
    let currentBase = 0;

    for (let i = 0; i < TEAM_LEVELS.length; i++) {
      if (xp < TEAM_LEVELS[i].threshold) {
        current = TEAM_LEVELS[i];
        next = TEAM_LEVELS[i + 1] || null;
        currentBase = i === 0 ? 0 : TEAM_LEVELS[i-1].threshold;
        break;
      } else if (i === TEAM_LEVELS.length - 1) {
        // Max level reached
        current = TEAM_LEVELS[i];
        next = null;
        currentBase = TEAM_LEVELS[i-1].threshold;
      }
    }
    
    return { 
      level: current.level, 
      title: current.title, 
      nextThreshold: current.threshold, 
      currentBase,
      nextTitle: next ? next.title : "Niveau Max"
    };
  };

  useEffect(() => {
    const fetchTeamSynergy = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name, avatar_url, xp_points, level')
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
  const progress = levelInfo.nextThreshold === Infinity 
    ? 100 
    : Math.min(100, Math.max(0, ((totalXP - levelInfo.currentBase) / (levelInfo.nextThreshold - levelInfo.currentBase)) * 100));
  
  const remainingXP = levelInfo.nextThreshold === Infinity 
    ? 0 
    : levelInfo.nextThreshold - totalXP;

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
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-widest">Niveau {levelInfo.level}</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">• {levelInfo.title}</span>
            </div>
          </div>
        </div>
        <div className="text-right hidden sm:block">
             <span className="text-3xl font-black text-slate-900 tracking-tighter">{totalXP.toLocaleString()}</span>
             <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Points XP Cumulés</p>
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
            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">{Math.round(progress)}% Progression</span>
         </div>
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            Prochain Grade : <span className="text-slate-600 font-black">{levelInfo.nextTitle}</span> 🚀
         </span>
      </div>

    </div>
  );
};

export default TeamSynergyWidget;
