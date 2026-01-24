import React, { useState, useEffect, useCallback } from "react";
import { User, UserRole, ViewType, Procedure } from "./types";
import { supabase, checkSupabaseConnection } from "./lib/supabase";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./views/Dashboard";
import Statistics from "./views/Statistics";
import Procedures from "./views/Procedures";
import ProcedureDetail from "./views/ProcedureDetail";
import Notes from "./views/Notes";
import Account from "./views/Account";
import Administration from "./views/Administration";
import UploadProcedure from "./views/UploadProcedure";
import History from "./views/History";
import Login from "./views/Login";
import ResetPassword from "./views/ResetPassword";
import MouseTrailEffect from "./components/MouseTrailEffect";

export interface ActiveTransfer {
  fileName: string;
  step: string;
  progress: number;
  abortController: AbortController | null;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [lastFolder, setLastFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [autoOpenNoteEditor, setAutoOpenNoteEditor] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"loading" | "ok" | "error" | "warning">(
    "loading"
  );
  const [initError, setInitError] = useState<string | null>(null);

  const syncUserProfile = useCallback(async (sbUser: any) => {
    try {
      const defaultUser: User = {
        id: sbUser.id,
        email: sbUser.email || "",
        firstName: sbUser.user_metadata?.firstName || sbUser.email?.split("@")[0] || "Utilisateur",
        lastName: "",
        role: UserRole.TECHNICIAN,
        avatarUrl: `https://ui-avatars.com/api/?name=${sbUser.email}&background=4f46e5&color=fff`,
        position: "Technicien Support",
        level: 1,
        currentXp: 0,
        nextLevelXp: 1000,
        badges: [],
      };
      setUser(defaultUser);

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", sbUser.id)
        .maybeSingle();

      if (profile) {
        const finalRole =
          profile.role?.toUpperCase() === "MANAGER" ? UserRole.MANAGER : UserRole.TECHNICIAN;
        setUser((prev) =>
          prev
            ? {
                ...prev,
                firstName: profile.first_name || prev.firstName,
                lastName: profile.last_name || "",
                role: finalRole,
                avatarUrl: profile.avatar_url || prev.avatarUrl,
                position: finalRole === UserRole.MANAGER ? "Manager IT" : "Technicien Support",
              }
            : null
        );
      }
    } catch (err) {
      console.error("Erreur critique syncUserProfile:", err);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      // Timeout de sécurité pour éviter le blocage infini (augmenté à 15s)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout d'initialisation")), 15000)
      );

      try {
        await Promise.race([
          (async () => {
            // Optimisation : On lance la connexion en parallèle mais on ne bloque pas si c'est lent
            checkSupabaseConnection().then((diag) => {
              setConnectionStatus(diag.status as any);
              if (diag.status === "error") {
                console.error("Erreur Cloud : " + diag.msg);
              }
            });

            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.user) {
              setIsAuthenticated(true);
              await syncUserProfile(session.user);
            }
          })(),
          timeoutPromise,
        ]);
      } catch (err: any) {
        if (err.message === "Timeout d'initialisation") {
          console.warn(
            "L'initialisation a pris trop de temps (Timeout 15s). Passage en mode déconnecté."
          );
        } else {
          console.error("Auth init error:", err);
        }
        // En cas de timeout ou erreur critique, on laisse l'utilisateur accéder (mode dégradé ou login)
      } finally {
        setLoading(false);
      }
    };
    initApp();
    const handleHash = () => {
      if (window.location.hash.includes("type=recovery")) {
        setIsRecoveryMode(true);
        setCurrentView("reset-password");
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        await syncUserProfile(session.user);
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
      } else if (event === "INITIAL_SESSION") {
        // Si aucune session initiale n'est trouvée, on arrête le chargement
        if (!session) setLoading(false);
      }
    });
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("hashchange", handleHash);
    };
  }, [syncUserProfile]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // On tente une déconnexion serveur avec un timeout de 2s
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Logout Timeout")), 2000)),
      ]);
    } catch (error) {
      console.warn("Déconnexion serveur incomplète, forçage local:", error);
    } finally {
      // Nettoyage impératif de l'état local pour ne jamais bloquer l'UI
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
      // Retour à l'accueil
      window.location.hash = "";
    }
  };

  const renderView = () => {
    if (isRecoveryMode)
      return (
        <ResetPassword
          userEmail={user?.email || "..."}
          onBack={() => {
            setIsRecoveryMode(false);
            setCurrentView("dashboard");
          }}
        />
      );
    if (!user) return null;
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            user={user}
            onQuickNote={() => {
              setAutoOpenNoteEditor(true);
              setCurrentView("notes");
            }}
            onSelectProcedure={(p) => {
              setSelectedProcedure(p);
              setCurrentView("procedure-detail");
            }}
            onViewHistory={() => setCurrentView("history")}
          />
        );
      case "procedures":
        return (
          <Procedures
            user={user}
            onUploadClick={() => setCurrentView("upload")}
            onSelectProcedure={(p) => {
              setSelectedProcedure(p);
              setCurrentView("procedure-detail");
            }}
            initialSearchTerm={globalSearchTerm}
            onSearchClear={() => setGlobalSearchTerm("")}
            initialFolder={lastFolder}
            onFolderChange={setLastFolder}
          />
        );
      case "procedure-detail":
        return selectedProcedure ? (
          <ProcedureDetail
            key={selectedProcedure.id}
            procedure={selectedProcedure}
            user={user}
            onBack={() => setCurrentView("procedures")}
          />
        ) : null;
      case "notes":
        return (
          <Notes
            initialIsAdding={autoOpenNoteEditor}
            onEditorClose={() => setAutoOpenNoteEditor(false)}
          />
        );
      case "account":
        return <Account user={user} onGoToReset={() => {}} />;
      case "statistics":
        return <Statistics />;
      case "administration":
        return <Administration />;
      case "history":
        return (
          <History
            onBack={() => setCurrentView("dashboard")}
            onSelectProcedure={(p) => {
              setSelectedProcedure(p);
              setCurrentView("procedure-detail");
            }}
          />
        );
      case "upload":
        return (
          <UploadProcedure
            onBack={() => setCurrentView("procedures")}
            activeTransfer={activeTransfer}
            setActiveTransfer={setActiveTransfer}
          />
        );
      default:
        return (
          <Dashboard
            user={user}
            onQuickNote={() => {}}
            onSelectProcedure={() => {}}
            onViewHistory={() => {}}
          />
        );
    }
  };

  if (loading)
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">
          PROCEDIO INITIALIZATION
        </p>
      </div>
    );

  if (initError)
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mb-6">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Problème de Configuration</h2>
        <p className="text-slate-500 max-w-md mb-8">{initError}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">
          Réessayer
        </button>
      </div>
    );

  if (!isAuthenticated && !isRecoveryMode)
    return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
      <MouseTrailEffect />

      {user && (
        <Sidebar
          currentView={currentView}
          setView={(v) => {
            setLastFolder(null);
            setCurrentView(v);
          }}
          userRole={user.role}
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          activeTransfer={activeTransfer}
          onCancelTransfer={() => setActiveTransfer(null)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        {user && (
          <Header
            user={user}
            currentView={currentView}
            onMenuClick={() => setIsSidebarOpen(true)}
            onSearch={(t) => {
              setGlobalSearchTerm(t);
              setCurrentView("procedures");
            }}
          />
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 scrollbar-hide">
          <div className="max-w-screen-2xl mx-auto w-full">{renderView()}</div>
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
    </div>
  );
};

export default App;
