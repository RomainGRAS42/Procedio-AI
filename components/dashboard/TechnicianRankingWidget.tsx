import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserRole } from '../../types';
import InfoTooltip from '../InfoTooltip';

interface TechnicianRankingWidgetProps {
  onNavigate?: (path: string) => void;
}

interface RankedUser {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  xp_points: number;
  level: number;
  top_badge: {
    name: string;
    icon: string;
    category: string;
  } | null;
}

const TechnicianRankingWidget: React.FC<TechnicianRankingWidgetProps> = ({ onNavigate }) => {
  const [users, setUsers] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        // 1. Fetch top technicians by XP
        const { data: profiles, error } = await supabase
          .from('user_profiles')
          .select(`
            id, 
            first_name, 
            last_name, 
            avatar_url, 
            xp_points, 
            level,
            user_badges (
              created_at,
              badges (
                name,
                icon,
                category,
                level_required
              )
            )
          `)
          .eq('role', 'technicien') // Enum value in DB is lowercase 'technicien'
          .order('xp_points', { ascending: false })
          .limit(10);

        if (error) throw error;

        if (profiles) {
          const ranked: RankedUser[] = profiles.map((p: any) => {
            // Determine "Top Badge" (e.g. latest awarded or highest level)
            // Here we pick the most recent one for now, or maybe the one with highest requirement?
            // Let's go with most recent.
            const sortedBadges = (p.user_badges || [])
                .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            
            const bestBadge = sortedBadges.length > 0 ? sortedBadges[0].badges : null;

            return {
              id: p.id,
              first_name: p.first_name || 'Inconnu',
              last_name: p.last_name || '',
              avatar_url: p.avatar_url,
              xp_points: p.xp_points || 0,
              level: p.level || 1,
              top_badge: bestBadge
            };
          });

          setUsers(ranked);
        }
      } catch (err) {
        console.error("Error fetching ranking:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, []);

  return (
    <div className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 border border-amber-100 flex items-center justify-center text-lg">
            <i className="fa-solid fa-trophy"></i>
          </div>
          <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
            TOP TECHNICIENS
            <InfoTooltip text="Classement des techniciens basé sur l'expérience (XP) cumulée." />
          </h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-3">
        {loading ? (
           [1, 2, 3, 4, 5].map((i) => (
             <div key={i} className="flex items-center gap-4 p-3 rounded-2xl border border-slate-50 animate-pulse">
                <div className="w-8 h-8 bg-slate-100 rounded-lg"></div>
                <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 bg-slate-100 rounded-full"></div>
                    <div className="h-2 w-16 bg-slate-100 rounded-full"></div>
                </div>
             </div>
           ))
        ) : users.length > 0 ? (
          users.map((user, index) => {
            const isTop3 = index < 3;
            const rankColor = index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-700' : 'text-slate-400';
            const rankBg = index === 0 ? 'bg-amber-50 border-amber-100' : index === 1 ? 'bg-slate-50 border-slate-200' : index === 2 ? 'bg-orange-50 border-orange-100' : 'bg-transparent border-transparent';
            
            return (
              <div 
                key={user.id} 
                className={`flex items-center gap-4 p-3 rounded-2xl border transition-all hover:bg-slate-50 ${isTop3 ? 'bg-white border-slate-100 shadow-sm' : 'border-transparent'}`}
              >
                {/* RANK */}
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm border ${rankBg} ${rankColor}`}>
                    {index + 1}
                </div>

                {/* AVATAR */}
                <div className="relative">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt={`${user.first_name} ${user.last_name}`} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold border-2 border-white shadow-sm">
                            {user.first_name[0]}{user.last_name[0]}
                        </div>
                    )}
                    {/* LEVEL BADGE */}
                    <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white">
                        Lvl {user.level}
                    </div>
                </div>

                {/* INFO */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                        {user.first_name} {user.last_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-slate-500">
                            {user.xp_points} XP
                        </span>
                        {user.top_badge && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                                <i className={`fa-solid ${user.top_badge.icon || 'fa-medal'}`}></i>
                                <span className="truncate">{user.top_badge.name}</span>
                            </span>
                        )}
                    </div>
                </div>
              </div>
            );
          })
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                <i className="fa-solid fa-users-slash text-2xl mb-2"></i>
                <p className="text-xs font-bold uppercase tracking-widest">Aucun technicien</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default TechnicianRankingWidget;
