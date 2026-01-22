
import React, { useState, useEffect, useCallback } from 'react';
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

  // Timer de sécurité raccourci pour éviter de laisser l'utilisateur sur un écran blanc trop longtemps
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const syncUserProfile = useCallback(async (sbUser: any) => {
    try {
      // Profil temporaire immédiat pour éviter les erreurs de rendu
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

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', sbUser.id)
        .maybeSingle();

      if (profile) {
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
      console.warn("Profil synchronisé ultérieurement.");
    }
  }, []);

  useEffect(() => {
    // 1. Détection Reset Password
    const handleHash = () => {
      if (window.location.hash.includes('type=recovery')) {
        setIsRecoveryMode(true);
        setCurrentView('reset-password');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);

    // 2. Vérification Session IMMÉDIATE
    const initAuth = async () => {
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
    initAuth();

    // 3. Écouteur de changement d'état
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        syncUserProfile(session.user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', handleHash);
    };
  }, [syncUserProfile]);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
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
      <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] animate-pulse">PROCEDIO</p>
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
          isOpen={