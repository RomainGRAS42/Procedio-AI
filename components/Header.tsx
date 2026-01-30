import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  searchTerm?: string;
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
  searchTerm
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm || "");

  useEffect(() => {
    if (searchTerm !== undefined) {
      setLocalSearch(searchTerm);
    }
  }, [searchTerm]);

  const [readLogs, setReadLogs] = useState<any[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [suggestionResponses, setSuggestionResponses] = useState<any[]>([]);
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);
  const [lastClearedNotifs, setLastClearedNotifs] = useState<string>(
    localStorage.getItem("last_cleared_notifs_at") || new Date(0).toISOString()
  );
  // Track IDs of notifications clicked in this session
  const [viewedNotifIds, setViewedNotifIds] = useState<Set<string>>(new Set());

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
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'procedure_suggestions',
          },
          () => {
            // Re-fetch pour mettre à jour le badge immédiatement
            fetchPendingSuggestions();
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

  // Fermeture des notifications avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showNotifications) {
        setShowNotifications(false);
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showNotifications]);

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
          procedure_id,
          status,
          viewed,
          user_profiles:user_id (first_name, last_name, email),
          procedures:procedure_id (title)
        `
        )
        .eq("status", "pending")
        .eq("viewed", false) // Fetch only unviewed suggestions for the badge count
        .order("created_at", { ascending: false });

      if (data) {
        // Mapping manuel pour adapter la structure si nécessaire
        const formatted = data.map((item: any) => ({
          id: item.id,
          userName: item.user_profiles?.first_name || item.user_profiles?.email || "Utilisateur",
          procedureTitle: item.procedures?.title || "Procédure",
          content: item.suggestion,
          status: item.status,
          viewed: item.viewed,
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
        .eq("viewed", false) // Only fetch unviewed logs for badge
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
    ? (pendingSuggestions.length + readLogs.length) // Simplifié car on filtre déjà à la source (viewed=false)
    : suggestionResponses.length;

  const handleClearAll = async () => {
    if (user.role === UserRole.TECHNICIAN) {
      // Mark all responses as read
      const { error } = await supabase
        .from('suggestion_responses')
        .update({ read: true })
        .eq('user_id', user.id);
      
      if (!error) {
        setSuggestionResponses([]);
      }
    } else {
      // Manager: Mark all as viewed in DB
      const now = new Date().toISOString();
      
      // Update local state immediately
      setLastClearedNotifs(now);
      setReadLogs([]);
      // We don't clear pending suggestions from the list, only from the count (they are still pending tasks)
      // But user asked for "Clear All" to remove them from view? 
      // User said: "si je clique sur supprimertoutes les notification [...] elle réapparaisse"
      
      // Let's mark all currently visible logs as viewed
      const unviewedLogIds = readLogs.map(l => l.id);
      if (unviewedLogIds.length > 0) {
        await supabase.from("notes").update({ viewed: true }).in("id", unviewedLogIds);
      }
    }
    // We don't "clear" pending suggestions as they are tasks to do
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🔍 Header: Recherche soumise avec:", localSearch);
    if (localSearch.trim()) {
      onSearch(localSearch);
    }
  };

  return (
    <>
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
            className="w-full pl-12 pr-12 py-2.5 rounded-2xl bg-slate-100 border-2 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-slate-700 text-sm shadow-inner"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          <button 
            type="submit"
            className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-400 group-focus-within:text-indigo-500 transition-colors hover:text-indigo-600 cursor-pointer">
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
        </form>
      </div>

      <div className="flex items-center gap-3 md:gap-6 min-w-[200px] justify-end">
        {/* Notifications pour tous */}
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
            <>
              {/* Overlay pour fermer au clic extérieur */}
              <div 
                className="fixed inset-0 z-[100] cursor-default" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNotifications(false);
                }}
              ></div>
              
              <div className="absolute top-full right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-slide-up z-[110] overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm tracking-tight">Notifications</h4>
                {totalNotifs > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="text-[10px] font-black text-indigo-500 hover:text-slate-900 uppercase tracking-widest flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-50 transition-all">
                    <i className="fa-solid fa-broom"></i>
                    Tout effacer
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-1 scrollbar-hide">
                {/* Pour les MANAGERS */}
                {user.role === UserRole.MANAGER && (
                  <>
                    {/* Logs de lecture */}
                    {readLogs
                      .filter(log => new Date(log.created_at || log.updated_at) > new Date(lastClearedNotifs))
                      .map((log) => {
                      const isSuggestion = log.title.startsWith("LOG_SUGGESTION_");
                      const priorityMatch = log.content.match(/\[Priorité: (.*?)\]/);
                      const priority = priorityMatch ? priorityMatch[1].toLowerCase() : null;
                      
                      const isUnread = !log.viewed;
                      
                      const borderColor = priority === 'high' ? 'border-rose-200' : 
                                        priority === 'medium' ? 'border-amber-200' : 
                                        isSuggestion ? 'border-indigo-200' : 'border-indigo-100';
                                        
                      // Visually distinct: Unread = Colored Background, Read = White/Grayish
                      const bgColor = !isUnread ? 'bg-white opacity-60 grayscale-[0.5]' :
                                    priority === 'high' ? 'bg-rose-50/50' : 
                                    priority === 'medium' ? 'bg-amber-50/50' : 
                                    isSuggestion ? 'bg-indigo-50/50' : 'bg-indigo-50/50';

                      const textColor = priority === 'high' ? 'text-rose-600' : 
                                      priority === 'medium' ? 'text-amber-600' : 
                                      'text-indigo-600';

                      return (
                        <div
                          key={log.id}
                          onClick={async () => {
                            // Marquer comme vu en BDD
                            await supabase.from("notes").update({ viewed: true }).eq("id", log.id);
                            // Mise à jour locale
                            setReadLogs(prev => prev.filter(l => l.id !== log.id));
                            
                            if (isSuggestion) {
                              const suggestionId = log.title.replace("LOG_SUGGESTION_", "");
                              setViewedNotifIds(prev => new Set(prev).add(log.id)); // Mark as read locally
                              onNotificationClick?.('suggestion', suggestionId);
                            } else {
                              setViewedNotifIds(prev => new Set(prev).add(log.id)); // Mark as read locally
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

                    {/* Suggestions en attente */}
                    {pendingSuggestions.map((s) => (
                      <div 
                        key={s.id} 
                        onClick={async () => {
                          // Marquer comme vu en BDD
                          await supabase.from("procedure_suggestions").update({ viewed: true }).eq("id", s.id);
                          // Mise à jour locale
                          setPendingSuggestions(prev => prev.filter(p => p.id !== s.id));
                          
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
                  </>
                )}

                {/* Pour les TECHNICIENS */}
                {user.role === UserRole.TECHNICIAN && suggestionResponses.map((response) => (
                  <div
                    key={response.id}
                    onClick={async () => {
                      // Marquer comme lu
                      await supabase
                        .from('suggestion_responses')
                        .update({ read: true })
                        .eq('id', response.id);
                      
                      setSuggestionResponses(prev => prev.filter(r => r.id !== response.id));
                      setShowNotifications(false);
                      
                      // Ouvrir le modal stylisé
                      setSelectedResponse(response);
                    }}
                    className={`p-3 rounded-xl border cursor-pointer hover:scale-[1.02] transition-all active:scale-95 group ${
                      response.status === 'approved' 
                        ? 'border-emerald-200 bg-emerald-50/50' 
                        : 'border-rose-200 bg-rose-50/50'
                    }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <i className={`fa-solid ${response.status === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'} ${
                        response.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'
                      } text-[10px]`}></i>
                      <span className={`${response.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'} text-[10px] font-black uppercase tracking-widest`}>
                        {response.status === 'approved' ? 'Suggestion Validée' : 'Suggestion Refusée'}
                      </span>
                      <i className="fa-solid fa-chevron-right ml-auto text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                    <p className="text-[11px] text-slate-700 font-bold leading-relaxed">
                      {response.procedure_title}
                    </p>
                    <p className="text-[10px] text-slate-500 italic mt-1 line-clamp-2">
                      "{response.suggestion_content}"
                    </p>
                    <span className="text-[9px] text-slate-400 font-bold block mt-2">
                      {new Date(response.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}

                {totalNotifs === 0 && (
                  <div className="text-center py-12 px-6 flex flex-col items-center gap-4 animate-fade-in">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200">
                      <i className="fa-solid fa-bell-slash text-xl"></i>
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tout est à jour !</p>
                      <p className="text-[10px] text-slate-300 font-bold mt-1">Vous n'avez aucune nouvelle notification.</p>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </>
          )}
        </div>

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

    {/* Modal Réponse Manager - Stylisé */}
    {selectedResponse && createPortal(
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in"
        onClick={() => setSelectedResponse(null)}>
        <div 
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-slide-up"
          onClick={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                selectedResponse.status === 'approved' 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : 'bg-rose-50 text-rose-600'
              }`}>
                <i className={`fa-solid ${selectedResponse.status === 'approved' ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
              </div>
              <div>
                <h3 className={`font-black text-lg ${
                  selectedResponse.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {selectedResponse.status === 'approved' ? 'Suggestion Validée' : 'Suggestion Refusée'}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Réponse du manager
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedResponse(null)}
              className="w-10 h-10 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Procédure */}
          <div className="mb-6">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Procédure concernée
            </label>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-sm font-bold text-slate-800">
                {selectedResponse.procedure_title}
              </p>
            </div>
          </div>

          {/* Suggestion originale */}
          <div className="mb-6">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Votre suggestion
            </label>
            <div className="bg-indigo-50/30 rounded-xl p-4 border border-indigo-100">
              <p className="text-xs text-slate-700 italic leading-relaxed">
                "{selectedResponse.suggestion_content}"
              </p>
            </div>
          </div>

          {/* Réponse du manager */}
          <div className="mb-6">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
              Commentaire du manager
            </label>
            <div className={`rounded-xl p-4 border ${
              selectedResponse.status === 'approved' 
                ? 'bg-emerald-50/30 border-emerald-100' 
                : 'bg-rose-50/30 border-rose-100'
            }`}>
              <p className="text-sm text-slate-800 leading-relaxed">
                {selectedResponse.manager_response}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end">
            <button
              onClick={() => setSelectedResponse(null)}
              className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-sm active:scale-95">
              Compris
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default Header;
