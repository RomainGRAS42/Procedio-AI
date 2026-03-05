import React, { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import AppContent from "./components/AppContent";
import Login from "./views/Login";
import ResetPassword from "./views/ResetPassword";
import LoadingState from "./components/LoadingState";

const App: React.FC = () => {
  const { isAuthenticated, user, loading, connectionStatus, handleLogout } = useAuth();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [autoOpenNoteEditor, setAutoOpenNoteEditor] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [pendingFlashNotesCount, setPendingFlashNotesCount] = useState(0);
  const [dashboardAlertCount, setDashboardAlertCount] = useState(0);
  const [lastFolder, setLastFolder] = useState<string | null>(null);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.includes("type=recovery")) {
        setIsRecoveryMode(true);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  if (loading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
      <LoadingState message="Initialisation de Procedio..." />
    </div>
  );

  if (!isAuthenticated && !isRecoveryMode) {
    return <Login onLogin={() => {}} />;
  }

  if (isRecoveryMode) {
    return <ResetPassword onBack={() => setIsRecoveryMode(false)} userEmail={user?.email || ""} />;
  }

  return (
    <BrowserRouter>
      <AppContent 
        user={user} 
        handleLogout={handleLogout}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTransfer={activeTransfer}
        setActiveTransfer={setActiveTransfer}
        connectionStatus={connectionStatus}
        globalSearchTerm={globalSearchTerm}
        setGlobalSearchTerm={setGlobalSearchTerm}
        pendingAction={pendingAction}
        setPendingAction={setPendingAction}
        autoOpenNoteEditor={autoOpenNoteEditor}
        setAutoOpenNoteEditor={setAutoOpenNoteEditor}
        lastFolder={lastFolder}
        setLastFolder={setLastFolder}
        pendingFlashNotesCount={pendingFlashNotesCount}
        setPendingFlashNotesCount={setPendingFlashNotesCount}
        dashboardAlertCount={dashboardAlertCount}
        setDashboardAlertCount={setDashboardAlertCount}
      />
    </BrowserRouter>
  );
};

export default App;
