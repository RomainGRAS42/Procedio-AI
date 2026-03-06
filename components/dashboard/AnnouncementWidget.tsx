import React from "react";
import { User, UserRole } from "../../types";

interface AnnouncementWidgetProps {
  user: User;
  announcement: any;
  loadingAnnouncement: boolean;
  isEditing: boolean;
  editContent: string;
  saving: boolean;
  requiresConfirmation: boolean;
  isRead: boolean;
  setIsEditing: (val: boolean) => void;
  setEditContent: (val: string) => void;
  setRequiresConfirmation: (val: boolean) => void;
  handleSaveAnnouncement: () => Promise<void>;
  handleMarkAsRead: () => Promise<void>;
  formatDate: (date: string) => string;
  embedded?: boolean;
  compact?: boolean; // New prop for Banner Style
}

const AnnouncementWidget: React.FC<AnnouncementWidgetProps> = ({
  user,
  announcement,
  loadingAnnouncement,
  isEditing,
  editContent,
  saving,
  requiresConfirmation,
  isRead,
  setIsEditing,
  setEditContent,
  setRequiresConfirmation,
  handleSaveAnnouncement,
  handleMarkAsRead,
  formatDate,
  embedded = false,
  compact = false,
}) => {
  if (loadingAnnouncement) {
    return (
      <div className={`${compact ? 'h-[70px] rounded-[1.2rem]' : 'h-[120px] rounded-[2rem]'} w-full bg-white border border-slate-100 shadow-sm p-4 flex items-center gap-4 animate-pulse relative overflow-hidden`}>
         <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-50 to-transparent animate-shimmer"></div>
         <div className="w-10 h-10 bg-slate-100 rounded-xl shrink-0"></div>
         <div className="flex-1 space-y-2.5">
            <div className="h-2.5 bg-slate-100 rounded-full w-32"></div>
            <div className="h-2 bg-slate-100 rounded-full w-64"></div>
         </div>
         <div className="w-16 h-6 bg-slate-100 rounded-full shrink-0"></div>
      </div>
    );
  }

  const containerClasses = embedded
    ? "flex flex-col justify-center h-full animate-fade-in"
    : compact
    ? "bg-sky-50 rounded-2xl p-3 border border-sky-100 shadow-sm flex flex-col justify-center animate-fade-in"
    : `bg-sky-50 rounded-[2rem] p-4 md:p-5 border border-sky-100 shadow-lg shadow-sky-500/5 flex flex-col justify-center animate-fade-in ${isRead ? "opacity-75" : "border-sky-100/50 shadow-sky-500/10"}`;
    
  // Override fade-in duration for faster appearance
  const animationStyle = { animationDuration: '0.3s' };

  return (
    <section className={containerClasses} style={animationStyle}>
      {isEditing ? (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-sky-700 uppercase tracking-widest">
              Édition du message manager
            </h4>
            <button
              onClick={() => setIsEditing(false)}
              className="text-sky-400 hover:text-rose-500 transition-colors">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="flex gap-3">
            <textarea
              className="flex-1 h-20 p-3 bg-white border border-sky-200 rounded-xl focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 outline-none resize-none font-medium text-slate-700 text-sm transition-all"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Écrivez votre message à l'équipe ici..."
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setRequiresConfirmation(!requiresConfirmation)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${requiresConfirmation ? "bg-amber-50 border-amber-200 text-amber-600 shadow-sm" : "bg-white border-sky-100 text-sky-300"}`}
                title="Demander confirmation de lecture">
                <i
                  className={`fa-solid ${requiresConfirmation ? "fa-bell text-xs" : "fa-bell-slash text-xs"}`}></i>
              </button>
              <button
                onClick={handleSaveAnnouncement}
                disabled={saving || !editContent.trim()}
                className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-200 hover:bg-slate-900 transition-all disabled:opacity-50">
                <i className="fa-solid fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center text-lg shadow-sm shrink-0">
              <i className="fa-solid fa-circle-info"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 h-10">
                <div className="flex items-center gap-2 shrink-0">
                  <h3 className="font-bold text-sky-900 text-base tracking-tight leading-none">
                    Message du Manager
                  </h3>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100/50 px-2 py-0.5 rounded-full leading-none">
                    {announcement ? formatDate(announcement.created_at) : ""}
                  </span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-sky-200 shrink-0"></div>
                <div className="flex-1 min-w-0 mt-0.5">
                  <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-700 font-medium tracking-tight leading-none truncate italic`}>
                    "{announcement?.content || "Aucun message pour le moment."}"
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 shrink-0">
                  {user.role === UserRole.MANAGER ? (
                    <button
                      onClick={() => {
                        setEditContent(announcement?.content || "");
                        setIsEditing(true);
                      }}
                      className="w-10 h-10 rounded-xl bg-white text-sky-500 hover:bg-sky-50 hover:text-sky-700 hover:scale-105 hover:shadow-md transition-all flex items-center justify-center border border-sky-100/50 shadow-sm"
                      aria-label="Modifier le message">
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                  ) : (
                    announcement && (
                      !isRead ? (
                        announcement.requires_confirmation ? (
                          <button
                            onClick={handleMarkAsRead}
                            className="group relative bg-gradient-to-r from-sky-600 to-blue-600 hover:from-slate-800 hover:to-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-sky-200/50 hover:shadow-slate-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center gap-2 shrink-0 border border-white/20 ring-2 ring-transparent focus:ring-sky-200 outline-none"
                            aria-label="Marquer le message comme lu">
                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                              <i className="fa-solid fa-check text-[10px]"></i>
                            </span>
                            <span>J'ai compris</span>
                          </button>
                        ) : null
                      ) : (
                        // EVEN IF READ, KEEP THE BUTTON IF CONTENT HASN'T CHANGED (Persistent "Read" State)
                        // Actually, user requested: "si le technicien a cliqué 1 fois sur j'ai compris, tant que le message du manager ne change pas, le btn doit rester en LU"
                        // This implies showing a "Lu" indicator permanently for this message ID.
                        announcement.requires_confirmation && (
                          <div className="px-5 py-2.5 rounded-xl bg-sky-600 text-white border border-sky-500 flex items-center gap-2 select-none shadow-sm opacity-90">
                            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                               <i className="fa-solid fa-check text-[10px]"></i>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-widest">J'ai compris</span>
                          </div>
                        )
                      )
                    )
                  )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AnnouncementWidget;
