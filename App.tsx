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
import UploadProcedure from "./views/UploadProcedure";
import History from "./views/History";
import Team from "./views/Team";
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
      console.log("DEBUG: syncUserProfile démarré pour", sbUser.email); // LOG DEBUT

      // 1. Détection optimiste via les métadonnées (disponible immédiatement)
      const metaRole = sbUser.user_metadata?.role;
      let initialRole = UserRole.TECHNICIAN;

      if (metaRole && String(metaRole).trim().toUpperCase() === "MANAGER") {
        initialRole = UserRole.MANAGER;
      }

      console.log("DEBUG: Rôle initial détecté (metadata):", initialRole);

      const defaultUser: User = {
        id: sbUser.id,
        email: sbUser.email || "",
        firstName: sbUser.user_metadata?.firstName || sbUser.email?.split("@")[0] || "Utilisateur",
        lastName: "",
        role: initialRole, // Utilisation immédiate du rôle métadata
        avatarUrl: `https://ui-avatars.com/api/?name=${sbUser.email}&background=4f46e5&color=fff`,
        position: initialRole === UserRole.MANAGER ? "Manager IT" : "Technicien Support",
        level: 1,
        currentXp: 0,
        nextLevelXp: 1000,
        badges: [],
      };
      setUser(defaultUser);

      // 2. Appel Base de Données avec Timeout (pour éviter le blocage infini)
      console.log("DEBUG: Appel DB user_profiles...");

      const fetchProfilePromise = supabase
        .from("user_profiles")
        .select("*")
        .eq("id", sbUser.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 5000)
      );

      let profile = null;
      let error = null;

      try {
        const result: any = await Promise.race([fetchProfilePromise, timeoutPromise]);
        profile = result.data;
        error = result.error;
      } catch (err: any) {
        if (err.message === "DB_TIMEOUT") {
          console.warn(
            "Timeout lors de la récupération du profil utilisateur. Utilisation du profil par défaut."
          );
        } else {
          console.error("Erreur inattendue fetch profile:", err);
        }
      }

      console.log("DEBUG: Réponse DB:", { profile, error });

      if (error) {
        console.error("Erreur lors de la récupération du profil:", error);
      }

      // Logique robuste pour déterminer le rôle final
      let finalRole = initialRole;
      const dbRole = profile?.role;

      // DEBUG: Affichage des rôles bruts pour diagnostic
      console.log("DEBUG ROLE SYNC:", {
        email: sbUser.email,
        metaRole,
        dbRole,
        profileData: profile,
      });

      // Priorité au profil DB s'il existe, sinon on garde le metaRole
      if (dbRole) {
        const normalizedRole = String(dbRole).trim().toUpperCase();
        if (normalizedRole === "MANAGER") {
          finalRole = UserRole.MANAGER;
        } else {
          finalRole = UserRole.TECHNICIAN;
        }
      }

      if (profile) {
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
      } else {
        // Fallback si pas de profil trouvé
        if (finalRole === UserRole.MANAGER) {
          // Rien à faire de plus car defaultUser avait déjà le bon rôle si metadata était bon
        }
        console.warn(
          "Profil utilisateur non trouvé dans 'user_profiles' ou timeout. Vérifiez les politiques RLS."
        );
      }
    } catch (err) {
      console.error("Erreur critique syncUserProfile:", err);
    }
  }, []);

  useEffect(() => {
    // Nettoyage complet du cache à la fermeture/actualisation
    const handleUnload = () => {
      // On vide le stockage local (token Supabase, préférences, etc.)
      localStorage.clear();
      sessionStorage.clear();
      // On tente de vider les cookies accessibles via JS
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    };
    window.addEventListener("beforeunload", handleUnload);

    // Nettoyage drastique au chargement de la page (demande utilisateur)
    // Cela garantit qu'on repart de zéro à chaque visite/rafraîchissement
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    const initApp = async () => {
      // Timeout de sécurité pour éviter le blocage infini (restauré à 10s pour prod)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout d'initialisation")), 10000)
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
            "L'initialisation prend du temps (Timeout 10s). L'application continue en mode optimiste."
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
      window.removeEventListener("beforeunload", handleUnload);
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
      // Vidage complet du cache (localStorage, sessionStorage, cookies)
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

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
        return <Statistics onUploadClick={() => setCurrentView("upload")} />;
      case "team":
        return <Team user={user} />;
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
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all">
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
            onLogout={handleLogout}
            onNavigate={(view) => setCurrentView(view)}
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
