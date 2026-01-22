
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, ViewType, Procedure } from './types';
import { supabase, checkSupabaseConnection } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import Statistics from './views/Statistics';
import Procedures from './views/Procedures';
import ProcedureDetail from './views/ProcedureDetail';
import Notes from './views/Notes';
import Account from './views/Account';
import Administration from './views/Administration';
import UploadProcedure from './views/UploadProcedure';
import History from './views/History';
import Login from './views/Login';
import ResetPassword from './views/ResetPassword';

export interface ActiveTransfer {
  fileName: string;
  step: string;
  progress: number;
  abortController: AbortController | null;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [lastFolder, setLastFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [autoOpenNoteEditor, setAutoOpenNoteEditor] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'loading' | 'ok' | 'error' | 'warning'>('loading');
  const [initError, setInitError] = useState<string | null>(null);

  const syncUserProfile = useCallback(async (sbUser: any) => {
    try {
      // 1. Profil par défaut immédiat (données Auth)
      const defaultUser: User = {
        id: sbUser.id,
        email: sbUser.email || '',
        firstName: sbUser.user_metadata?.firstName || sbUser.email?.split('@')[0] || 'Utilisateur',
        lastName: '',
        role: UserRole.TECHNICIAN,
        avatarUrl: `https://ui-avatars.com/api/?name=${sbUser.email}&background=4f46e5&color=fff`,
        position: 'Technicien Support',
        level: 1, currentXp: 0, nextLevelXp: 1000, badges: []
      };
      setUser(defaultUser);

      // 2. Tentative d'enrichissement via la table user_profiles
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      if (error) {
        console.warn("Table user_profiles non accessible (RLS ou inexistante).");
      } else if (profile) {
        const finalRole = profile.role?.toUpperCase() === 'MANAGER' ? UserRole.MANAGER : UserRole.TECHNICIAN;
        setUser(prev => prev ? ({
          ...prev,
          firstName: profile.first_name || prev.firstName,
          lastName: profile.last_name || '',
          role: finalRole,
          avatarUrl: profile.avatar_url || prev.avatarUrl,
          position: finalRole === UserRole.MANAGER ? 'Manager IT' : 'Technicien Support'
        }) : null);
      }
    } catch (err) {
      console.error("Erreur critique syncUserProfile:", err);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      // 1. Diagnostic de connexion
      const diag = await checkSupabaseConnection();
      setConnectionStatus(diag.status as any);
      
      if (diag.status === 'error') {
        setInitError("Erreur de configuration Cloud : " + diag.msg);
        setLoading(false);
        return;
      }

      // 2. Vérification Session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setIsAuthenticated(true);
          await syncUserProfile(session.user);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    // 3. Écouteur de hash pour le reset password
    const handleHash = () => {
      if (window.location.hash.includes('type=recovery')) {
        setIsRecoveryMode(true);
        setCurrentView('reset-password');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);

    // 4. Écouteur Auth dynamique
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        syncUserProfile(session.user);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', handleHash);
    };
  }, [syncUserProfile]);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    window.location.reload(); 
  };

  const renderView = () => {
    if (isRecoveryMode) return <ResetPassword userEmail={user?.email || "..."} onBack={() => { setIsRecoveryMode(false); setCurrentView('dashboard'); }} />;
    if (!user) return null;

    switch (currentView) {
      case 'dashboard': return <Dashboard user={user} onQuickNote={() => {setAutoOpenNoteEditor(true); setCurrentView('notes');}} onSelectProcedure={p => {setSelectedProcedure(p); setCurrentView('procedure-detail');}} onViewHistory={() => setCurrentView('history')} />;
      case 'procedures': return <Procedures user={user} onUploadClick={() => setCurrentView('upload')} onSelectProcedure={p => {setSelectedProcedure(p); setCurrentView('procedure-detail');}} initialSearchTerm={globalSearchTerm} onSearchClear={() => setGlobalSearchTerm('')} initialFolder={lastFolder} onFolderChange={setLastFolder} />;
      case 'procedure-detail': return selectedProcedure ? <ProcedureDetail procedure={selectedProcedure} onBack={() => setCurrentView('procedures')} /> : null;
      case 'notes': return <Notes initialIsAdding={autoOpenNoteEditor} onEditorClose={() => setAutoOpenNoteEditor(false)} />;
      case 'account': return <Account user={user} onGoToReset={() => {}} />;
      case 'statistics': return <Statistics />;
      case 'administration': return <Administration />;
      case 'history': return <History onSelectProcedure={p => {setSelectedProcedure(p); setCurrentView('procedure-detail');}} />;
      case 'upload': return <UploadProcedure onBack={() => setCurrentView('procedures')} activeTransfer={activeTransfer} setActiveTransfer={setActiveTransfer} />;
      default: return <Dashboard user={user} onQuickNote={() => {}} onSelectProcedure={() => {}} onViewHistory={() => {}} />;
    }
  };

  if (loading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] animate-pulse">PROCEDIO INITIALIZATION</p>
    </div>
  );

  if (initError) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-white p-10 text-center">
      <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center text-3xl mb-6">
        <i className="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Problème de Configuration</h2>
      <p className="text-slate-500 max-w-md mb-8">{initError}</p>
      <button onClick={() => window.location.reload()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl">Réessayer</button>
    </div>
  );

  if (!isAuthenticated && !isRecoveryMode) return <Login onLogin={() => setLoading(true)} />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {user && (
        <Sidebar 
          currentView={currentView} 
          setView={v => { setLastFolder(null); setCurrentView(v); }} 
          userRole={user.role} 
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          activeTransfer={activeTransfer}
          onCancelTransfer={() => setActiveTransfer(null)}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {user && (
          <Header 
            user={user} 
            currentView={currentView} 
            onMenuClick={() => setIsSidebarOpen(true)}
            onSearch={t => { setGlobalSearchTerm(t); setCurrentView('procedures'); }}
          />
        )}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 scrollbar-hide">
          <div className="max-w-screen-2xl mx-auto w-full">
            {renderView()}
          </div>
        </main>
      </div>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[65] lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Indicateur de statut de connexion Cloud (discret) */}
      <div className="fixed bottom-4 right-4 z-[100] pointer-events-none group">
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'
        } opacity-50 shadow-sm transition-opacity group-hover:opacity-100`}></div>
      </div>
    </div>
  );
};

export default App;
