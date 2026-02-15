import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { User, ViewType } from "../types";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Dashboard from "../views/Dashboard";
import Statistics from "../views/Statistics";
import Procedures from "../views/Procedures";
import ProcedureDetailWrapper from "../views/ProcedureDetailWrapper";
import Notes from "../views/Notes";
import Account from "../views/Account";
import UploadProcedure from "../views/UploadProcedure";
import Team from "../views/Team";
import Missions from "../views/Missions";
import SearchResults from "../views/SearchResults";
import XPProgressBarTest from "../views/XPProgressBarTest";
import MouseTrailEffect from "./MouseTrailEffect";
import ChatAssistant from "./ChatAssistant";
import { MissionsProvider } from "../contexts/MissionsContext";

const AppContent: React.FC<any> = ({ 
  user, handleLogout, isSidebarOpen, setIsSidebarOpen, activeTransfer, setActiveTransfer,
  connectionStatus, globalSearchTerm, setGlobalSearchTerm, pendingAction, setPendingAction,
  autoOpenNoteEditor, setAutoOpenNoteEditor, lastFolder, setLastFolder,
  pendingFlashNotesCount, setPendingFlashNotesCount,
  dashboardAlertCount, setDashboardAlertCount
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
          Chargement du profil...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
      <div id="build-marker" style={{ display: 'none' }}>v2.1.2-b9e4d1a2</div>
      <MouseTrailEffect />

      <Sidebar
        currentView={location.pathname.split('/')[1] as any || "dashboard"}
        setView={(v) => {
          setLastFolder(null);
          navigate(`/${v}`);
        }}
        userRole={user.role}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        activeTransfer={activeTransfer}
        onCancelTransfer={() => setActiveTransfer(null)}
        pendingFlashNotesCount={pendingFlashNotesCount}
        alertCount={dashboardAlertCount}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        <Header
          user={user}
          currentView={location.pathname.split('/')[1] as any || "dashboard"}
          searchTerm={globalSearchTerm}
          onMenuClick={() => setIsSidebarOpen(true)}
          onSearch={(t) => {
            setGlobalSearchTerm(t);
            navigate("/search");
          }}
          onSelectProcedure={(p) => {
            setGlobalSearchTerm("");
            navigate(`/procedure/${p.id}`);
          }}
          onLogout={handleLogout}
          onNavigate={(view) => navigate(`/${view}`)}
          onNotificationClick={(type, id) => {
            setPendingAction({ type, id });
            navigate("/dashboard");
          }}
        />
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="mx-auto w-full">
            <MissionsProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={
                  <Dashboard
                    user={user}
                    onQuickNote={() => {
                      setAutoOpenNoteEditor(true);
                      navigate("/notes");
                    }}
                    onUploadClick={() => navigate("/upload")}
                    onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)}
                    onViewComplianceHistory={() => navigate("/dashboard")}
                    targetAction={pendingAction}
                    onActionHandled={() => setPendingAction(null)}
                    onNavigate={(v) => navigate(`/${v}`)}
                    onFlashCountChange={setPendingFlashNotesCount}
                    onAlertCountChange={setDashboardAlertCount}
                  />
                } />
                <Route path="/procedures" element={
                  <Procedures
                    user={user}
                    onUploadClick={() => navigate("/upload")}
                    onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)}
                    onSearchClear={() => setGlobalSearchTerm("")}
                    initialFolder={lastFolder}
                    onFolderChange={setLastFolder}
                  />
                } />
                <Route path="/search" element={
                  <SearchResults
                    user={user}
                    searchTerm={globalSearchTerm}
                    onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)}
                    onBack={() => navigate(-1)}
                  />
                } />
                <Route path="/procedure/:id" element={<ProcedureDetailWrapper user={user} />} />
                <Route path="/notes" element={
                  <Notes
                    user={user}
                    initialIsAdding={autoOpenNoteEditor}
                    onEditorClose={() => setAutoOpenNoteEditor(false)}
                  />
                } />
                <Route path="/flash-notes" element={
                  <Notes 
                    mode="flash" 
                    user={user}
                    initialIsAdding={autoOpenNoteEditor} 
                    onEditorClose={() => setAutoOpenNoteEditor(false)} 
                  />
                } />
                <Route path="/statistics" element={
                  <Statistics 
                    user={user!}
                    onUploadClick={() => navigate("/upload")} 
                    onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)}
                  />
                } />
                <Route path="/team" element={<Team user={user} />} />
                <Route path="/missions" element={<Missions user={user} setActiveTransfer={setActiveTransfer} />} />
                <Route path="/xp-test" element={<XPProgressBarTest />} />
                <Route path="/account" element={<Account user={user} onGoToReset={() => {}} />} />

                <Route path="/upload" element={
                  <UploadProcedure
                    onBack={() => navigate("/procedures")}
                    user={user}
                    activeTransfer={activeTransfer}
                    setActiveTransfer={setActiveTransfer}
                  />
                } />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </MissionsProvider>
          </div>
        </main>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[65] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <div className="fixed bottom-4 right-4 z-[100] pointer-events-none group">
        <div
          className={`w-2 h-2 rounded-full ${connectionStatus === "ok" ? "bg-emerald-500" : "bg-rose-500"} opacity-50 shadow-sm transition-opacity group-hover:opacity-100`}></div>
      </div>

      <ChatAssistant 
        user={user} 
        onSelectProcedure={(p) => {
          let hash = "";
          if (p.fileUrl && p.fileUrl.includes('#')) {
            const parts = p.fileUrl.split('#');
            if (parts.length > 1) {
              hash = `#${parts[1]}`;
            }
          }
          navigate(`/procedure/${p.id}${hash}`);
        }} 
      />
    </div>
  );
};

export default AppContent;
