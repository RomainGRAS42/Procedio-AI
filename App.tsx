
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
import UploadProcedure from './views/UploadProcedure';
import History from './views/History';
import Login from './views/Login';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [autoOpenNoteEditor, setAutoOpenNoteEditor] = useState(false);
  
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        mapSupabaseUser(session.user);
        setIsAuthenticated(true);
      }
      setTimeout(() => setLoading(false), 300);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        mapSupabaseUser(session.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapSupabaseUser = (sbUser: any) => {
    const role = sbUser.user_metadata?.role || UserRole.TECHNICIAN;
    setUser({
      id: sbUser.id,
      email: sbUser.email || '',
      firstName: sbUser.user_metadata?.firstName || sbUser.email?.split('@')[0] || 'Utilisateur',
      lastName: sbUser.user_metadata?.lastName || '',
      role: role as UserRole,
      avatarUrl: sbUser.user_metadata?.avatarUrl || `https://ui-avatars.com/api/?name=${sbUser.email?.split('@')[0]}&background=4f46e5&color=fff&size=128`,
      position: role === UserRole.MANAGER ? 'Manager IT' : 'Technicien Support',
      level: 1,
      currentXp: 0,
      nextLevelXp: 1000,
      badges: []
    });
  };

  const trackProcedureView = async (procedureId: string) => {
    if (!user) return;
    try {
      // Simulation d'enregistrement de vue dans Supabase
      // Dans une vraie app, on ferait un insert dans une table 'procedure_views'
      console.log(`Tracking view for ${procedureId} by user ${user.id}`);
      await supabase.from('notes').insert([{ 
        title: `LOG_VIEW_${procedureId}`, 
        content: JSON.stringify({ userId: user.id, date: new Date().toISOString() }),
        user_id: user.id 
      }]);
    } catch (e) {
      console.error("View tracking error", e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleGlobalSearch = (term: string) => {
    setGlobalSearchTerm(term);
    setCurrentView('procedures');
  };

  const handleSelectProcedure = (p: Procedure) => {
    trackProcedureView(p.id);
    setSelectedProcedure(p);
    setCurrentView('procedure-detail');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': 
        return (
          <Dashboard 
            user={user!} 
            onQuickNote={() => {setAutoOpenNoteEditor(true); setCurrentView('notes');}} 
            onSelectProcedure={handleSelectProcedure}
            onViewHistory={() => setCurrentView('history')}
          />
        );
      case 'history':
        return <History onSelectProcedure={handleSelectProcedure} />;
      case 'statistics': return <Statistics />;
      case 'procedures': 
        return (
          <Procedures 
            user={user!} 
            onUploadClick={() => setCurrentView('upload')} 
            onSelectProcedure={handleSelectProcedure} 
            initialSearchTerm={globalSearchTerm}
            onSearchClear={() => setGlobalSearchTerm('')}
          />
        );
      case 'procedure-detail':
        return selectedProcedure 
          ? <ProcedureDetail procedure={selectedProcedure} onBack={() => setCurrentView('history')} onSuggest={(c) => {}} />
          : <Dashboard user={user!} onQuickNote={() => {}} onSelectProcedure={handleSelectProcedure} onViewHistory={() => setCurrentView('history')} />;
      case 'notes': 
        return <Notes initialIsAdding={autoOpenNoteEditor} onEditorClose={() => setAutoOpenNoteEditor(false)} />;
      case 'account': return <Account user={user!} />;
      case 'upload': return <UploadProcedure onBack={() => setCurrentView('procedures')} />;
      default: return <Dashboard user={user!} onQuickNote={() => {}} onSelectProcedure={handleSelectProcedure} onViewHistory={() => setCurrentView('history')} />;
    }
  };

  if (loading) return null;
  if (!isAuthenticated) return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        userRole={user!.role} 
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        <Header 
          user={user!} 
          currentView={currentView} 
          suggestions={suggestions} 
          onMenuClick={() => setIsSidebarOpen(true)}
          onSearch={handleGlobalSearch}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:p-10 scroll-smooth">
          <div className="max-w-screen-2xl mx-auto w-full">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
