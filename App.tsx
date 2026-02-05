import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from "react-router-dom";
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
import History from "./views/ComplianceHistory";
import Team from "./views/Team";
import Login from "./views/Login";
import ResetPassword from "./views/ResetPassword";
import MouseTrailEffect from "./components/MouseTrailEffect";
import ChatAssistant from "./components/ChatAssistant";

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
  const [pendingAction, setPendingAction] = useState<{type: 'suggestion' | 'read', id: string} | null>(null);

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
    // Nettoyage drastique au chargement de la page (UNIQUEMENT si on n'a pas de session active)
    const checkAndClear = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
      }
    };
    checkAndClear();

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
      />
    </BrowserRouter>
  );
};


// Composant interne pour utiliser les hooks de Router
const AppContent: React.FC<any> = ({ 
  user, handleLogout, isSidebarOpen, setIsSidebarOpen, activeTransfer, setActiveTransfer,
  connectionStatus, globalSearchTerm, setGlobalSearchTerm, pendingAction, setPendingAction,
  autoOpenNoteEditor, setAutoOpenNoteEditor, lastFolder, setLastFolder
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Sécurité d'initialisation : si on est authentifié mais que l'objet user n'est pas encore là, 
  // on attend pour éviter que les composants enfants (qui dépendent de user) ne crash.
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
      <MouseTrailEffect />

      {user && (
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
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10">
        {user && (
          <Header
            user={user}
            currentView={location.pathname.split('/')[1] as any || "dashboard"}
            searchTerm={globalSearchTerm}
            onMenuClick={() => setIsSidebarOpen(true)}
            onSearch={(t) => {
              setGlobalSearchTerm(t);
              navigate("/procedures");
            }}
            onLogout={handleLogout}
            onNavigate={(view) => navigate(`/${view}`)}
            onNotificationClick={(type, id) => {
              setPendingAction({ type, id });
              navigate("/dashboard");
            }}
          />
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 scrollbar-hide">
          <div className="max-w-screen-2xl mx-auto w-full">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <Dashboard
                  user={user}
                  onQuickNote={() => {
                    setAutoOpenNoteEditor(true);
                    navigate("/notes");
                  }}
                  onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)}
                  onViewHistory={() => navigate("/history")}
                  onViewComplianceHistory={() => navigate("/history")}
                  targetAction={pendingAction}
                  onActionHandled={() => setPendingAction(null)}
                />
              } />
              <Route path="/procedures" element={
                <Procedures
                  user={user}
                  onUploadClick={() => navigate("/upload")}
                  onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)}
                  initialSearchTerm={globalSearchTerm}
                  onSearchClear={() => setGlobalSearchTerm("")}
                  initialFolder={lastFolder}
                  onFolderChange={setLastFolder}
                />
              } />
              <Route path="/procedure/:id" element={<ProcedureDetailWrapper user={user} />} />
              <Route path="/notes" element={
                <Notes
                  initialIsAdding={autoOpenNoteEditor}
                  onEditorClose={() => setAutoOpenNoteEditor(false)}
                />
              } />
              <Route path="/statistics" element={
                <Statistics 
                  onUploadClick={() => navigate("/upload")} 
                  onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)}
                />
              } />
              <Route path="/team" element={<Team user={user} />} />
              <Route path="/account" element={<Account user={user} onGoToReset={() => {}} />} />
              <Route path="/history" element={
                <History user={user} onBack={() => navigate("/dashboard")} />
              } />
              <Route path="/upload" element={
                <UploadProcedure
                  onBack={() => navigate("/procedures")}
                  activeTransfer={activeTransfer}
                  setActiveTransfer={setActiveTransfer}
                />
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
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

      {user && (
        <ChatAssistant 
          user={user} 
          onSelectProcedure={(p) => navigate(`/procedure/${p.id}`)} 
        />
      )}
    </div>
  );
};

// Wrapper pour charger la procédure par ID si nécessaire (ouverture directe via URL)
const ProcedureDetailWrapper: React.FC<{ user: User }> = ({ user }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProcedure = async () => {
      if (!id) return;
      setLoading(true);
      
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      let query = supabase.from("procedures").select("*");
      
      if (isUUID) {
        // On cherche dans les deux colonnes UUID possibles
        query = query.or(`uuid.eq.${id},file_id.eq.${id}`);
      } else {
        // Fallback pour les IDs numériques (au cas où, même si plus présents)
        query = query.eq("id", id);
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (data) {
        // IMPORTANT : Mapper explicitement pour supporter le camelCase attendu par le composant
        setProcedure({
          id: data.uuid,
          uuid: data.uuid,
          file_id: data.file_id || data.uuid,
          title: data.title || "Sans titre",
          category: data.Type || "GÉNÉRAL",
          fileUrl: data.file_url,
          pinecone_document_id: data.pinecone_document_id,
          createdAt: data.created_at,
          views: data.views || 0,
          status: data.status || "validated",
        });
      }
      setLoading(false);
    };
    fetchProcedure();
  }, [id]);

  if (loading) return <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  if (!procedure) return <div className="text-center p-20 text-slate-500 font-bold">Procédure introuvable.</div>;

  return (
    <ProcedureDetail
      procedure={procedure}
      user={user}
      onBack={() => navigate("/procedures")}
    />
  );
};

export default App;
