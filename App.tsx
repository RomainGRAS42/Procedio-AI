
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

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [autoOpenNoteEditor, setAutoOpenNoteEditor] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        mapSupabaseUser(session.user);
        setIsAuthenticated(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setCurrentView('reset-password');
      }
      
      if (session) {
        mapSupabaseUser(session.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const mapSupabaseUser = (sbUser: any) => {
    const email = sbUser.email || '';
    let role = sbUser.user_metadata?.role || UserRole.TECHNICIAN;
    if (email.toLowerCase() === 'romain.gras42@hotmail.fr') {
      role = UserRole.MANAGER;
    }

    setUser({
      id: sbUser.id,
      email: email,
      firstName: sbUser.user_metadata?.firstName || email.split('@')[0] || 'Utilisateur',
      lastName: sbUser.user_metadata?.lastName || '',
      role: role as UserRole,
      avatarUrl: sbUser.user_metadata?.avatarUrl || `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=4f46e5&color=fff&size=128`,
      position: role === UserRole.MANAGER ? 'Manager IT' : 'Technicien Support',
      level: 1,
      currentXp: 0,
      nextLevelXp: 1000,
      badges: []
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
  };

  const renderView = () => {
    if (isRecoveryMode) {
       return <ResetPassword userEmail={user?.email || "Récupération en cours"} onBack={() => { setIsRecoveryMode(false); setCurrentView('dashboard'); }} />;
    }

    switch (currentView) {
      case 'dashboard': 
        return <Dashboard user={user!} onQuickNote={() => {setAutoOpenNoteEditor(true); setCurrentView('notes');}} onSelectProcedure={handleSelectProcedure} onViewHistory={() => setCurrentView('history')} />;
      case 'administration':
        return <Administration />;
      case 'history':
        return <History onSelectProcedure={handleSelectProcedure} />;
      case 'statistics': return <Statistics />;
      case 'procedures': 
        return <Procedures user={user!} onUploadClick={() => setCurrentView('upload')} onSelectProcedure={handleSelectProcedure} initialSearchTerm={globalSearchTerm} onSearchClear={() => setGlobalSearchTerm('')} />;
      case 'procedure-detail':
        return selectedProcedure ? <ProcedureDetail procedure={selectedProcedure} onBack={() => setCurrentView('history')} /> : null;
      case 'notes': 
        return <Notes initialIsAdding={autoOpenNoteEditor} onEditorClose={() => setAutoOpenNoteEditor(false)} />;
      case 'account': 
        return <Account user={user!} onGoToReset={() => {}} />; // Redirection inutile car géré par modale
      case 'reset-password':
        return <ResetPassword userEmail={user?.email || ""} onBack={() => setCurrentView('account')} />;
      case 'upload': return <UploadProcedure onBack={() => setCurrentView('procedures')} />;
      default: return null;
    }
  };

  const handleSelectProcedure = (p: Procedure) => {
    setSelectedProcedure(p);
    setCurrentView('procedure-detail');
  };

  if (loading) return null;
  if (!isAuthenticated && !isRecoveryMode) return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {!isRecoveryMode && (
        <Sidebar 
          currentView={currentView} 
          setView={setCurrentView} 
          userRole={user?.role || UserRole.TECHNICIAN} 
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {!isRecoveryMode && (
          <Header 
            user={user!} 
            currentView={currentView} 
            suggestions={suggestions} 
            onMenuClick={() => setIsSidebarOpen(true)}
            onSearch={(t) => { setGlobalSearchTerm(t); setCurrentView('procedures'); }}
          />
        )}
        <main className={`flex-1 overflow-y-auto scroll-smooth ${isRecoveryMode ? 'flex items-center justify-center bg-slate-100' : ''}`}>
          <div className={`${isRecoveryMode ? 'w-full max-w-xl' : 'max-w-screen-2xl mx-auto w-full px-4 py-6 md:p-10'}`}>
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
