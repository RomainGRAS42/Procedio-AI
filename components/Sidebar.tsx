import React from "react";
import { UserRole, ViewType, ActiveTransfer } from "../types";

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  userRole: UserRole;
  onLogout: () => void;
  isOpen: boolean;
  activeTransfer: ActiveTransfer | null;
  onCancelTransfer: () => void;
  pendingFlashNotesCount?: number;
  alertCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  userRole,
  onLogout,
  isOpen,
  activeTransfer,
  onCancelTransfer,
  pendingFlashNotesCount,
  alertCount,
}) => {
  const menuItems = [
    {
      id: "dashboard",
      label: "Accueil",
      icon: "fa-house",
      roles: [UserRole.MANAGER, UserRole.TECHNICIAN],
    },
    {
      id: "procedures",
      label: "Procédures",
      icon: "fa-book-open",
      roles: [UserRole.MANAGER, UserRole.TECHNICIAN],
    },
    {
      id: "notes",
      label: "Mes Notes",
      icon: "fa-note-sticky",
      roles: [UserRole.MANAGER, UserRole.TECHNICIAN],
    },
    {
      id: "flash-notes",
      label: "Flash Notes",
      icon: "fa-bolt", // Lightning icon for "Flash" / "Instant"
      roles: [UserRole.MANAGER, UserRole.TECHNICIAN],
    },
    {
      id: "missions",
      label: "Missions",
      icon: "fa-compass",
      roles: [UserRole.MANAGER, UserRole.TECHNICIAN],
    },
    { id: "statistics", label: "Analyses", icon: "fa-chart-pie", roles: [UserRole.MANAGER] },
    {
      id: "team",
      label: "Équipe",
      icon: "fa-users-line",
      roles: [UserRole.MANAGER],
    },
    {
      id: "account",
      label: "Mon Compte",
      icon: "fa-user-gear",
      roles: [UserRole.MANAGER, UserRole.TECHNICIAN],
    },
  ];

  const normalizedUserRole = userRole.toUpperCase();
  const filteredItems = menuItems.filter((item) =>
    item.roles.some((r) => r.toUpperCase() === normalizedUserRole)
  );

  return (
    <aside
      className={`fixed lg:relative inset-y-0 left-0 w-72 h-full bg-white text-slate-500 flex flex-col z-[70] transition-transform duration-300 ease-in-out lg:translate-x-0 border-r border-slate-100 shadow-xl lg:shadow-none ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ backgroundColor: "#ffffff" }}
      aria-label="Navigation principale">
      <div className="p-8 flex items-center gap-4 shrink-0">
        <div
          className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
          aria-hidden="true">
          <i className="fa-solid fa-bolt"></i>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-black text-slate-900 tracking-tight leading-none">
            Procedio
          </span>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">
            v2.1 Stable
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto mt-4 scrollbar-hide">
        {filteredItems.map((item) => (
          <div key={item.id} className="space-y-2">
            <a
              href={`/${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                setView(item.id as ViewType);
              }}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all duration-200 group relative ${
                currentView === item.id
                  ? "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100"
                  : "hover:bg-slate-50 hover:text-slate-900"
              }`}>
              <div className="w-5 flex justify-center">
                <i
                  className={`fa-solid ${item.icon} text-lg ${
                    currentView === item.id
                      ? "text-indigo-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}></i>
              </div>
              <span className="font-bold tracking-tight text-sm">{item.label}</span>

              {item.id === "procedures" && activeTransfer && (
                <div className="ml-auto w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-lg shadow-indigo-500/50"></div>
              )}

              {item.id === "flash-notes" && userRole === UserRole.MANAGER && (pendingFlashNotesCount || 0) > 0 && (
                <div className="ml-auto min-w-[18px] h-[18px] px-1 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 border border-white">
                  <span className="text-[9px] font-black text-white">{pendingFlashNotesCount}</span>
                </div>
              )}

              {item.id === "statistics" && userRole === UserRole.MANAGER && (alertCount || 0) > 0 && (
                <div className="ml-auto min-w-[18px] h-[18px] px-1 bg-rose-500 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 border border-white">
                  <span className="text-[9px] font-black text-white">{alertCount}</span>
                </div>
              )}
            </a>

            {/* Barre de transfert dynamique sous Procédures */}
            {item.id === "procedures" && activeTransfer && (
              <div className="mx-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-slide-up">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest truncate max-w-[120px]">
                    {activeTransfer.fileName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelTransfer();
                    }}
                    className="text-[10px] text-rose-400/60 hover:text-rose-400 transition-colors">
                    <i className="fa-solid fa-circle-xmark"></i>
                  </button>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                    style={{ width: `${activeTransfer.progress}%` }}></div>
                </div>
                <p className="text-[7px] text-slate-500 font-bold mt-2 uppercase tracking-tighter italic">
                  {activeTransfer.step}
                </p>
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-slate-100 shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-xl bg-rose-50 text-rose-500 font-bold hover:bg-rose-500 hover:text-white transition-all text-xs tracking-wider border border-rose-100 hover:border-rose-500">
          <i className="fa-solid fa-power-off"></i>
          DÉCONNEXION
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
