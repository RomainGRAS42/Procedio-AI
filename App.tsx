
import React, { useState, useEffect } from 'react';
import { User, UserRole, ViewType, Procedure, Suggestion } from './types';
import { supabase } from './lib/supabase';
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

  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    {
      id: 'mock-1',
      procedureId: '1',
      procedureTitle: 'Audit Sécurité Réseau v2.4',
      userId: 'user-2',
      userName: 'Thomas Dubos',
      content: 'Il manque l\'étape de vérification du pare-feu sur le VLAN 20.',
      createdAt: new Date(),
      status: 'pending'
    }
  ]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.includes('type=recovery')) {
        setIsRecoveryMode(true);
        setCurrentView('reset-password');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setCurrentView('reset-password');
      }
      if (session) {
        await mapSupabaseUser(session.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await mapSupabaseUser(session.user);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error("Erreur session:", e);
    } finally {
      setLoading(false);
    }
  };

  const mapSupabaseUser = async (sbUser: any) => {
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      let finalRole: UserRole = UserRole.TECHNICIAN;
      if (profileData?.role) {
        const dbRole = profileData.role.toString().toUpperCase();
        finalRole = dbRole === 'MANAGER' ? UserRole.MANAGER : UserRole.TECHNICIAN;
      }

      const firstName = profileData?.first_name || sbUser.user_metadata?.firstName || sbUser.email?.split('@')[0] || 'Utilisateur';

      setUser({
        id: sbUser.id,
        email: sbUser.email || '',
        firstName: firstName,
        lastName: profileData?.last_name || '',
        role: finalRole,
        avatarUrl: profileData?.avatar_url || `https://ui-avatars.com/api/?name=${firstName}&background=4f46e5&color=fff&size=128`,
        position: finalRole === UserRole.MANAGER ? 'Manager IT' : 'Technicien Support',
        level: 1, currentXp: 0, nextLevelXp: 1000, badges: []
      });
    } catch (err) {
      console.error("Erreur mapping utilisateur:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
    setCurrentView('dashboard');
  };

  const cancelTransfer = () => {
    if (activeTransfer?.abortController) {
      activeTransfer.abortController.abort();
    }
    setActiveTransfer(null);
  };

  const handleBackToProcedures = () => {
    setCurrentView('procedures');
  };

  const renderView = () => {
    if (isRecoveryMode) {
       return <ResetPassword userEmail={user?.email || "Récupération en cours"} onBack={() => { setIsRecoveryMode(false); setCurrentView('dashboard'); }} />;
    }

    switch (currentView) {
      case 'dashboard': 
        return <Dashboard user={user!} onQuickNote={() => {setAutoOpenNoteEditor(true); setCurrentView('notes');}} onSelectProcedure={handleSelectProcedure} onViewHistory={() => setCurrentView('history')} />;
      case 'administration': return <Administration />;
      case 'history': return <History onSelectProcedure={handleSelectProcedure} />;
      case 'statistics': return <Statistics />;
      case 'procedures': 
        return <Procedures 
          user={user!} 
          onUploadClick={() => setCurrentView('upload')} 
          onSelectProcedure={handleSelectProcedure} 
          initialSearchTerm={globalSearchTerm} 
          onSearchClear={() => setGlobalSearchTerm('')}
          initialFolder={lastFolder}
          onFolderChange={(f) => setLastFolder(f)}
        />;
      case 'procedure-detail':
        return selectedProcedure ? <ProcedureDetail procedure={selectedProcedure} onBack={handleBackToProcedures} /> : null;
      case 'notes': 
        return <Notes initialIsAdding={autoOpenNoteEditor} onEditorClose={() => setAutoOpenNoteEditor(false)} />;
      case 'account': return <Account user={user!} onGoToReset={() => {}} />;
      case 'reset-password': return <ResetPassword userEmail={user?.email || ""} onBack={() => setCurrentView('account')} />;
      case 'upload': return <UploadProcedure onBack={() => setCurrentView('procedures')} activeTransfer={activeTransfer} setActiveTransfer={setActiveTransfer} />;
      default: return <Dashboard user={user!} onQuickNote={() => {}} onSelectProcedure={() => {}} onViewHistory={() => {}} />;
    }
  };

  const handleSelectProcedure = (p: Procedure) => {
    setSelectedProcedure(p);
    setCurrentView('procedure-detail');
  };

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-xl"></div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Initialisation Procedio...</p>
      </div>
    </div>
  );
  
  if (!isAuthenticated && !isRecoveryMode) return <Login onLogin={() => checkUser()} />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {!isRecoveryMode && user && (
        <Sidebar 
          currentView={currentView} 
          setView={(v) => { if(v !== 'procedure-detail') setLastFolder(null); setCurrentView(v); }} 
          userRole={user.role} 
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          activeTransfer={activeTransfer}
          onCancelTransfer={cancelTransfer}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {!isRecoveryMode && user && (
          <Header 
            user={user} 
            currentView={currentView} 
            suggestions={suggestions} 
            onMenuClick={() => setIsSidebarOpen(true)}
            onSearch={(t) => { setGlobalSearchTerm(t); setCurrentView('procedures'); }}
          />
        )}
        <main className={`flex-1 overflow-y-auto scroll-smooth ${isRecoveryMode ? 'flex items-center justify-center bg-slate-100' : ''}`}>
          <div className={`${isRecoveryMode ? 'w-full max-w-xl' : 'max-w-screen-2xl mx-auto w-full px-4 py-6 md:p-10'}`}>
            {user ? renderView() : null}
          </div>
        </main>
      </div>
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[65] lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}
    </div>
  );
};

export default App;
