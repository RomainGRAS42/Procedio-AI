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
  const containerClasses = embedded
    ? "flex flex-col justify-center h-full animate-fade-in"
    : compact
    ? "bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-center animate-fade-in"
    : `bg-white rounded-[2rem] p-4 md:p-5 border border-slate-100 shadow-lg shadow-indigo-500/5 flex flex-col justify-center animate-fade-in ${isRead ? "opacity-75" : "border-indigo-100/50 shadow-indigo-500/10"}`;

  return (
    <section className={containerClasses}>
      {loadingAnnouncement ? (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Chargement...
          </span>
        </div>
      ) : isEditing ? (
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
              Édition du message manager
            </h4>
            <button
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-rose-500 transition-colors">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div className="flex gap-3">
            <textarea
              className="flex-1 h-20 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none resize-none font-medium text-slate-700 text-sm transition-all"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Écrivez votre message à l'équipe ici..."
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setRequiresConfirmation(!requiresConfirmation)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${requiresConfirmation ? "bg-amber-50 border-amber-200 text-amber-600 shadow-sm" : "bg-white border-slate-100 text-slate-300"}`}
                title="Demander confirmation de lecture">
                <i
                  className={`fa-solid ${requiresConfirmation ? "fa-bell text-xs" : "fa-bell-slash text-xs"}`}></i>
              </button>
              <button
                onClick={handleSaveAnnouncement}
                disabled={saving || !editContent.trim()}
                className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all disabled:opacity-50">
                <i className="fa-solid fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100 shrink-0">
              <i className="fa-solid fa-bullhorn"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 h-10">
                <div className="flex items-center gap-2 shrink-0">
                  <h3 className="font-bold text-slate-900 text-base tracking-tight leading-none">
                    Message du Manager
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full leading-none">
                    {announcement ? formatDate(announcement.created_at) : ""}
                  </span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-slate-200 shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-600 font-medium tracking-tight leading-none truncate`}>
                    "{announcement?.content || "Aucun message pour le moment."}"
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
                  {user.role === UserRole.MANAGER ? (
                    <button
                      onClick={() => {
                        setEditContent(announcement?.content || "");
                        setIsEditing(true);
                      }}
                      className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center border border-slate-100">
                      <i className="fa-solid fa-pen-to-square text-xs"></i>
                    </button>
                  ) : (
                    announcement &&
                    !isRead && (
                      <button
                        onClick={handleMarkAsRead}
                        className="bg-indigo-600 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 shrink-0 active:scale-95">
                        <i className="fa-solid fa-check"></i>
                        Compris
                      </button>
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
