import React, { useState, useMemo } from 'react';
import InfoTooltip from '../InfoTooltip';

interface ActivityItem {
  id: string;
  content: string;
  created_at: string;
  title?: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

interface ActivityWidgetProps {
  activities: ActivityItem[];
  loadingActivities: boolean;
  onRefresh: () => void;
}

const ActivityWidget: React.FC<ActivityWidgetProps> = ({
  activities,
  loadingActivities,
  onRefresh
}) => {
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all'); // 'all' | 'today' | 'week'

  // Extract unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Map();
    activities.forEach(act => {
      if (act.user) {
        const fullName = `${act.user.first_name} ${act.user.last_name}`;
        if (!users.has(fullName)) {
          users.set(fullName, fullName);
        }
      }
    });
    return Array.from(users.values()).sort();
  }, [activities]);

  const getActionIcon = (title: string) => {
    if (title.includes('CONSULTATION')) return 'fa-eye';
    if (title.includes('SUGGESTION')) return 'fa-lightbulb';
    if (title.includes('MISSION')) return 'fa-flag';
    if (title.includes('CLAIM')) return 'fa-trophy';
    if (title.includes('APPLY_REFERENT')) return 'fa-graduation-cap';
    return 'fa-check';
  };

  const getActionColor = (title: string) => {
    if (title.includes('CONSULTATION')) return 'bg-blue-50 text-blue-600';
    if (title.includes('SUGGESTION')) return 'bg-amber-50 text-amber-600';
    if (title.includes('MISSION')) return 'bg-emerald-50 text-emerald-600';
    if (title.includes('CLAIM')) return 'bg-purple-50 text-purple-600';
    if (title.includes('APPLY_REFERENT')) return 'bg-orange-50 text-orange-600';
    return 'bg-slate-50 text-slate-600';
  };

  // Filter and Group Activities
  const groupedActivities = useMemo(() => {
    let filtered = activities;

    // Filter by User
    if (selectedUser !== 'all') {
      filtered = filtered.filter(act => {
        const name = act.user ? `${act.user.first_name} ${act.user.last_name}` : 'Utilisateur';
        return name === selectedUser;
      });
    }

    // Filter by Period
    if (selectedPeriod === 'today') {
      const today = new Date().toDateString();
      filtered = filtered.filter(act => new Date(act.created_at).toDateString() === today);
    } else if (selectedPeriod === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(act => new Date(act.created_at) >= weekAgo);
    }

    // Group by Date
    const groups: { [key: string]: ActivityItem[] } = {};
    filtered.forEach(act => {
      const date = new Date(act.created_at);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      
      if (date.toDateString() === today.toDateString()) {
        dateLabel = "Aujourd'hui";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateLabel = "Hier";
      }

      // Capitalize first letter
      dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(act);
    });

    return groups;
  }, [activities, selectedUser, selectedPeriod]);

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col relative min-h-[500px]">
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 flex items-center justify-center text-lg">
              <i className="fa-solid fa-heart-pulse"></i>
            </div>
            <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center">
              Pouls de l'Équipe
              <InfoTooltip text="Actions des techniciens en temps réel : consultations, missions, suggestions..." />
            </h3>
          </div>
          <button 
            onClick={onRefresh} 
            disabled={loadingActivities}
            className="text-slate-400 hover:text-indigo-600 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 rounded-lg outline-none disabled:opacity-50"
            aria-label="Actualiser"
          >
            <i className={`fa-solid fa-rotate-right ${loadingActivities ? 'animate-spin text-indigo-500' : ''}`}></i>
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl py-2 pl-3 pr-8 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer min-h-[44px]"
              aria-label="Filtrer par technicien"
              title="Filtrer les activités par technicien"
            >
              <option value="all">Tous les techniciens</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
            <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
          </div>

          <div className="relative group">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl py-2 pl-3 pr-8 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer min-h-[44px]"
              aria-label="Filtrer par période"
              title="Filtrer les activités par période"
            >
              <option value="all">Toute la période</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
            </select>
            <i className="fa-solid fa-calendar-days absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 max-h-[600px] scrollbar-thin space-y-8">
        {Object.entries(groupedActivities).length > 0 ? (
          Object.entries(groupedActivities).map(([dateLabel, groupActivities]) => (
            <div key={dateLabel} className="space-y-3">
              <h3 className="sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10 text-xs font-black text-slate-700 uppercase tracking-widest border-b border-slate-100 flex items-center gap-2">
                <i className="fa-regular fa-calendar text-slate-400"></i>
                {dateLabel}
              </h3>
              <div className="space-y-3 pl-2">
                {groupActivities.map((act) => {
                  const actorName = act.user ? `${act.user.first_name} ${act.user.last_name}` : 'Utilisateur';
                  const time = new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  let actionText = act.content;
                  if (act.title?.startsWith('CONSULTATION_')) actionText = `a consulté une procédure`;
                  if (act.title?.startsWith('LOG_SUGGESTION_')) actionText = `a fait une suggestion`;
                  if (act.title?.startsWith('CLAIM_MASTERY_')) actionText = `a demandé une validation`;
                  if (act.title?.startsWith('MISSION_EXPERTISE_LAUNCH')) actionText = `a lancé un appel à expertise`;
                  else if (act.title?.startsWith('MISSION_')) actionText = `a avancé sur une mission`;
                  if (act.title?.startsWith('APPLY_REFERENT_')) actionText = `souhaite devenir Référent`;

                  return (
                    <div key={act.id} className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-all group border border-transparent hover:border-slate-100">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getActionColor(act.title || '')} shadow-sm`}>
                        <i className={`fa-solid ${getActionIcon(act.title || '')} text-xs`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-black text-slate-800 truncate">{actorName}</p>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{time}</span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500 leading-tight mt-1 line-clamp-2">
                          {actionText}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center text-slate-400 opacity-50">
            <i className="fa-solid fa-filter text-4xl mb-3"></i>
            <p className="text-xs font-bold uppercase tracking-widest">Aucune activité trouvée</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityWidget;
