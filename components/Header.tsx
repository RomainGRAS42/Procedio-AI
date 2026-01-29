import React, { useState, useEffect } from "react";
import { User, ViewType, UserRole, Suggestion } from "../types";
import { supabase } from "../lib/supabase";

interface HeaderProps {
  user: User;
  currentView: ViewType;
  suggestions?: Suggestion[];
  onMenuClick: () => void;
  onSearch: (term: string) => void;
  onLogout: () => void;
  onNavigate: (view: ViewType) => void;
  onNotificationClick?: (type: 'suggestion' | 'read', id: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  user,
  currentView,
  suggestions = [],
  onMenuClick,
  onSearch,
  onLogout,
  onNavigate,
  onNotificationClick,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [readLogs, setReadLogs] = useState<any[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [suggestionResponses, setSuggestionResponses] = useState<any[]>([]);

  const titles: Record<string, string> = {
    dashboard: "Tableau de bord",
    statistics: "Analyses",
    procedures: "Procédures",
    notes: "Mes Notes",
    account: "Mon Compte",
    upload: "Publication",
    team: "Gestion d'Équipe",
  };

  useEffect(() => {
    if (user.role === UserRole.MANAGER) {
      fetchReadLogs();
      fetchPendingSuggestions();

      // Real-time subscription pour les confirmations de lecture
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notes',
          },
          (payload) => {
            if (payload.new && payload.new.title) {
              if (payload.new.title.startsWith("LOG_READ_") || payload.new.title.startsWith("LOG_SUGGESTION_")) {
                setReadLogs(prev => [payload.new, ...prev].slice(0, 5));
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (user.role === UserRole.TECHNICIAN) {
      fetchSuggestionResponses();

      // Real-time pour nouvelles réponses
      const channel = supabase
        .channel('tech-responses')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'suggestion_responses',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              setSuggestionResponses(prev => [payload.new, ...prev]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user.role, user.id]);

  const fetchPendingSuggestions = async () => {
    try {
      const { data } = await supabase
        .from("procedure_suggestions")
        .select(
          `
          id,
          suggestion,
          created_at,
          user_id,
          procedure_id,
          status,
          user_profiles:user_id (first_name, last_name, email),
          procedures:procedure_id (title)
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (data) {
        // Mapping manuel pour adapter la structure si nécessaire
        const formatted = data.map((item: any) => ({
          id: item.id,
          userName: item.user_profiles?.first_name || item.user_profiles?.email || "Utilisateur",
          procedureTitle: item.procedures?.title || "Procédure",
          content: item.suggestion,
          status: item.status,
          createdAt: item.created_at,
        }));
        setPendingSuggestions(formatted);
      }
    } catch (err) {
      console.error("Erreur suggestions header:", err);
    }
  };

  const fetchReadLogs = async () => {
    try {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .or("title.ilike.LOG_READ_%,title.ilike.LOG_SUGGESTION_%")
        .order("updated_at", { ascending: false })
        .limit(5);

      if (data) setReadLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSuggestionResponses = async () => {
    try {
      const { data, error } = await supabase
        .from("suggestion_responses")
        .select("*")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setSuggestionResponses(data);
    } catch (err) {
      console.error("Erreur fetch responses:", err);
    }
  };

  const totalNotifs = user.role === UserRole.MANAGER
    ? pendingSuggestions.length + readLogs.length
    : suggestionResponses.length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim()) {
      onSearch(localSearch);
    }
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4 min-w-[200px]">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-xl"
          aria-label="Ouvrir le menu">
          <i className="fa-solid fa-bars-staggered text-xl"></i>
        </button>
        <h2 className="hidden md:block text-xl font-black text-slate-800 tracking-tight">
          {titles[currentView] || "Procedio"}
        </h2>
      </div>

      <div className="flex-1 max-w-2xl px-4">
        <form onSubmit={handleSearchSubmit} className="relative group">
          <input
            type="text"
            placeholder="Rechercher une procédure..."
            className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-slate-700 text-sm shadow-inner"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"></i>
          <button type="submit" className="hidden">
            Rechercher
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3 md:gap-6 min-w-[200px] justify-end">
        {user.role === UserRole.MANAGER && (
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center relative border border-slate-100"
              aria-label={`${totalNotifs} notifications`}>
              <i className={`fa-solid fa-bell ${totalNotifs > 0 ? "animate-bounce" : ""}`}></i>
              {totalNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white">
                  {totalNotifs}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-slide-up z-50 overflow-hidden">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-sm tracking-tight">Notifications</h4>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1 scrollbar-hide">
                  {/* Logs de lecture */}
                  {readLogs.map((log) => {
                    const isSuggestion = log.title.startsWith("LOG_SUGGESTION_");
                    const priorityMatch = log.content.match(/\[Priorité: (.*?)\]/);
                    const priority = priorityMatch ? priorityMatch[1].toLowerCase() : null;
                    
                    const borderColor = priority === 'high' ? 'border-rose-200' : 
                                      priority === 'medium' ? 'border-amber-200' : 
                                      isSuggestion ? 'border-indigo-200' : 'border-indigo-100';
                                      
                    const bgColor = priority === 'high' ? 'bg-rose-50/50' : 
                                  priority === 'medium' ? 'bg-amber-50/50' : 
                                  isSuggestion ? 'bg-indigo-50/50' : 'bg-indigo-50/50';

                    const textColor = priority === 'high' ? 'text-rose-600' : 
                                    priority === 'medium' ? 'text-amber-600' : 
                                    'text-indigo-600';

                    return (
                      <div
                        key={log.id}
                        onClick={() => {
                          if (isSuggestion) {
                            const suggestionId = log.title.replace("LOG_SUGGESTION_", "");
                            onNotificationClick?.('suggestion', suggestionId);
                          } else {
                            onNotificationClick?.('read', log.id);
                          }
                          setShowNotifications(false);
                        }}
                        className={`p-3 rounded-xl border ${borderColor} ${bgColor} cursor-pointer hover:scale-[1.02] transition-all active:scale-95 group`}>
                        <div className="flex items-center gap-2 mb-1">
                          <i className={`fa-solid ${isSuggestion ? 'fa-lightbulb' : 'fa-circle-check'} ${textColor} text-[10px]`}></i>
                          <span className={`${textColor} text-[10px] font-black uppercase tracking-widest`}>
                            {isSuggestion ? "Nouvelle Suggestion" : "Confirmation de lecture"}
                          </span>
                          <i className="fa-solid fa-chevron-right ml-auto text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                        <p className="text-[11px] text-slate-700 font-bold leading-relaxed">
                          {log.content}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block mt-1">
                          {new Date(log.created_at || log.updated_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    );
                  })}

                  {/* Suggestions */}
                  {pendingSuggestions.map((s) => (
                    <div 
                      key={s.id} 
                      onClick={() => {
                        onNotificationClick?.('suggestion', s.id);
                        setShowNotifications(false);
                      }}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all group relative"
                    >
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {s.userName}
                        </span>
                        <i className="fa-solid fa-chevron-right text-[8px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-4"></i>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 pr-4">{s.procedureTitle}</p>
                      <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg mt-2 group-hover:bg-indigo-50/30 transition-colors">
                        "{s.content}"
                      </p>
                    </div>
                  ))}

                  {totalNotifs === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">Tout est à jour</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pl-4 border-l border-slate-200 relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 hover:bg-slate-50 p-2 -mr-2 rounded-xl transition-all outline-none">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-black text-slate-800 leading-none">
                {user.firstName}
              </span>
              <span className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                {user.role}
              </span>
            </div>
            <img
              src={user.avatarUrl}
              alt="Mon profil"
              className="w-10 h-10 rounded-xl border border-slate-200 object-cover shadow-sm"
            />
          </button>

          {isUserMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setIsUserMenuOpen(false)}></div>
              <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Mon Compte
                  </p>
                </div>
                <button
                  onClick={() => {
                    onNavigate("account");
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-5 py-3 text-[11px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors">
                  <i className="fa-solid fa-user-gear w-4 text-center"></i>
                  Profil & Préférences
                </button>
                <div className="border-t border-slate-50"></div>
                <button
                  onClick={() => {
                    onLogout();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-5 py-3 text-[11px] font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-3 transition-colors">
                  <i className="fa-solid fa-power-off w-4 text-center"></i>
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
