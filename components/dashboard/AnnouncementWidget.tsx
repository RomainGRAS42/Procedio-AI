import React from 'react';
import { User, UserRole } from '../../types';

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
  formatDate
}) => {
  return (
    <section className={`bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4 animate-fade-in ${isRead ? "opacity-75" : "border-indigo-100 shadow-indigo-50"}`}>
      {loadingAnnouncement ? (
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement de l'annonce...</span>
        </div>
      ) : isEditing ? (
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                Édition du message manager
              </h4>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-rose-500">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="flex gap-4">
              <textarea
                  className="flex-1 h-20 p-4 bg-slate-50 border border-indigo-100 rounded-xl focus:bg-white focus:border-indigo-500 outline-none resize-none font-medium text-slate-700 text-sm transition-all"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Message..."
              />
              <div className="flex flex-col gap-2 justify-between">
                   <button
                      onClick={() => setRequiresConfirmation(!requiresConfirmation)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${requiresConfirmation ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-100 text-slate-300"}`}
                      title="Demander confirmation de lecture"
                   >
                      <i className={`fa-solid ${requiresConfirmation ? "fa-bell" : "fa-bell-slash"}`}></i>
                   </button>
                   <button
                      onClick={handleSaveAnnouncement}
                      disabled={saving || !editContent.trim()}
                      className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all disabled:opacity-50"
                   >
                      <i className="fa-solid fa-paper-plane"></i>
                   </button>
              </div>
            </div>
          </div>
      ) : (
        <div className="flex flex-col gap-4">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-lg border border-indigo-100 shadow-sm shadow-indigo-100/50">
                {announcement?.author_initials || "??"}
              </div>
              <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                     <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                       {user.role === UserRole.MANAGER ? "Message à l'équipe" : "Message du manager"}
                     </span>
                     <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                     <span className="text-xs font-bold text-slate-400 uppercase">
                       {announcement ? new Date(announcement.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : ""}
                     </span>
                  </div>
                  <p className="text-xl font-black text-slate-900 leading-tight tracking-tight">"{announcement?.content}"</p>
              </div>
           </div>
           
           <div className="flex items-center justify-end gap-3">
              {user.role === UserRole.MANAGER && (
                  <button onClick={() => setIsEditing(true)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center">
                      <i className="fa-solid fa-pen text-xs"></i>
                  </button>
              )}

              {user.role === UserRole.TECHNICIAN && !isRead && announcement?.requires_confirmation && (
                  <button
                    onClick={handleMarkAsRead}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 shadow-md shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <span className="hidden sm:inline">Lu et compris</span>
                    <i className="fa-solid fa-check"></i>
                  </button>
              )}
              {isRead && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 border border-emerald-100 flex items-center justify-center" title={`Lu le ${formatDate(new Date().toISOString())}`}>
                      <i className="fa-solid fa-check-double text-xs"></i>
                  </div>
              )}
           </div>
        </div>
      )}
    </section>
  );
};

export default AnnouncementWidget;
