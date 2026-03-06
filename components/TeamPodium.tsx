import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import InfoTooltip from './InfoTooltip';

interface Champion {
  user_id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  metric_value: number;
  metric_label: string;
  badge_title: string;
  badge_icon: string;
  badge_color: 'indigo' | 'emerald' | 'amber';
}

interface PodiumData {
  progression: Champion | null;
  expert: Champion | null;
  explorer: Champion | null;
}

const TeamPodium: React.FC = () => {
  const [data, setData] = useState<PodiumData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChampions = async () => {
      try {
        console.log('[TeamPodium] Fetching weekly champions...');
        const { data: champions, error } = await supabase.rpc('get_weekly_champions');
        
        if (error) {
          console.error('[TeamPodium] RPC Error:', error);
          throw error;
        }
        
        console.log('[TeamPodium] Champions data received:', champions);
        setData(champions);
      } catch (err) {
        console.error('[TeamPodium] Error fetching champions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChampions();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm min-h-[200px] flex items-center justify-center animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"></div>
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Calcul des scores...</span>
        </div>
      </div>
    );
  }

  // If no data at all, show empty state instead of hiding
  if (!data || (!data.progression && !data.expert && !data.explorer)) {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 animate-fade-in relative overflow-hidden min-h-[300px]">
         {/* Decorative Background */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50/30 to-transparent rounded-full blur-3xl -z-10 pointer-events-none"></div>

         <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center text-lg">
            <i className="fa-solid fa-medal"></i>
          </div>
          <div>
              <h3 className="font-black text-slate-900 text-lg tracking-tight">Dynamique d'Équipe</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Champions de la semaine</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center mb-4">
            <i className="fa-solid fa-trophy text-3xl text-slate-300"></i>
          </div>
          <h4 className="font-bold text-slate-700 text-sm mb-2">Pas encore de champions cette semaine</h4>
          <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
            Les champions apparaîtront dès que votre équipe commencera à gagner de l'XP, approuver des suggestions et lire des procédures.
          </p>
        </div>
      </div>
    );
  }

  const renderCard = (champion: Champion | null, type: 'progression' | 'expert' | 'explorer') => {
    // Fallback static data if no champion found for a category (to avoid empty holes)
    // In a real app we might hide it, but for UI consistency we show a placeholder
    if (!champion) {
       // EMPTY STATE: Manager Insight instead of "Empty"
       let emptyMessage = "Aucune donnée";
       let emptyInsight = "En attente d'activité...";
       let emptyIcon = "fa-chart-line";
       let emptyColor = "text-slate-300";

       if (type === 'progression') {
          emptyMessage = "Performance stable";
          emptyInsight = "Pas de pic d'activité notable cette semaine.";
          emptyIcon = "fa-battery-half";
       } else if (type === 'expert') {
          emptyMessage = "Aucune contribution";
          emptyInsight = "0 suggestion validée cette semaine.";
          emptyIcon = "fa-file-circle-question";
          emptyColor = "text-amber-300";
       } else if (type === 'explorer') {
          emptyMessage = "Aucune veille";
          emptyInsight = "Personne n'a consulté de nouvelles procédures.";
          emptyIcon = "fa-eye-slash";
          emptyColor = "text-indigo-300";
       }

       return (
        <div className="flex-1 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-4 flex flex-col items-center justify-center text-center">
             <div className={`w-10 h-10 rounded-full bg-white mb-3 flex items-center justify-center ${emptyColor} shadow-sm`}>
                <i className={`fa-solid ${emptyIcon}`}></i>
             </div>
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-tight mb-1">{emptyMessage}</p>
             <p className="text-[9px] font-medium text-slate-400 leading-tight max-w-[120px]">{emptyInsight}</p>
        </div>
       );
    }

    const colorClasses = {
      indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      amber: 'bg-amber-50 text-amber-600 border-amber-100',
    };

    return (
      <div 
        className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 flex flex-col items-center text-center hover:border-indigo-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-default relative overflow-hidden h-full min-h-[160px]"
        role="article"
        aria-label={`Champion ${champion.badge_title}: ${champion.first_name} ${champion.last_name}`}
      >
        
        {/* Badge Title Pill */}
        <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest mb-3 border ${colorClasses[champion.badge_color]}`} aria-hidden="true">
          <i className={`fa-solid ${champion.badge_icon} mr-1.5`}></i>
          {champion.badge_title}
        </div>

        {/* Avatar */}
        <div className="w-12 h-12 rounded-2xl bg-slate-100 mb-3 overflow-hidden border-2 border-white shadow-md relative z-10 shrink-0" aria-hidden="true">
            {champion.avatar_url ? (
            <img src={champion.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400 font-black text-sm">
                {(champion.first_name || '?')[0]}{(champion.last_name || '')[0]}
            </div>
            )}
        </div>

        {/* Name */}
        <h4 className="font-black text-slate-800 text-xs leading-tight mb-0.5 truncate w-full px-2">
            {champion.first_name} {champion.last_name?.substring(0, 1)}.
        </h4>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-3">
            {champion.role === UserRole.MANAGER ? 'Manager' : 'Technicien'}
        </p>

        {/* Metric */}
        <div className="mt-auto w-full pt-3 border-t border-slate-50">
            <p className={`text-lg font-black leading-none mb-1 ${champion.badge_color === 'indigo' ? 'text-indigo-600' : champion.badge_color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {champion.metric_value}
            </p>
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest truncate">
                {champion.metric_label}
            </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-[2.5rem] px-8 pt-8 pb-16 border border-slate-100 shadow-sm flex flex-col gap-6 animate-fade-in relative min-h-[350px] z-30 mb-8">
       {/* Decorative Background Container - Isolated for overflow-hidden */}
       <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50/30 to-transparent rounded-full blur-3xl -z-10"></div>
       </div>

       <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center text-lg">
          <i className="fa-solid fa-medal"></i>
        </div>
        <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-lg tracking-tight">Dynamique d'Équipe</h3>
              <InfoTooltip text="Les champions de la semaine : Progression fulgurante, Expert validé et Explorateur de connaissances." />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Champions de la semaine</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {renderCard(data.progression, 'progression')}
        {renderCard(data.expert, 'expert')}
        {renderCard(data.explorer, 'explorer')}
      </div>
    </div>
  );
};

export default TeamPodium;
