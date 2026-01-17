
import React, { useState, useEffect } from 'react';
import { User, UserRole, ViewType, Procedure } from './types';
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
import Login from './views/Login';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier la session actuelle au chargement
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        mapSupabaseUser(session.user);
        setIsAuthenticated(true);
      }
      setLoading(false);
    });

    // Ecouter les changements d'auth
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
      avatarUrl: `https://picsum.photos/seed/${sbUser.id}/100/100`,
      position: role === UserRole.MANAGER ? 'Manager IT' : 'Technicien Support',
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
  };

  const handleProcedureSelect = (proc: Procedure) => {
    setSelectedProcedure(proc);
    setCurrentView('procedure-detail');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement de Procedio...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={(role) => setIsAuthenticated(true)} />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard user={user!} />;
      case 'statistics': return <Statistics />;
      case 'procedures': 
        return <Procedures user={user!} onUploadClick={() => setCurrentView('upload')} onSelectProcedure={handleProcedureSelect} />;
      case 'procedure-detail':
        return selectedProcedure 
          ? <ProcedureDetail procedure={selectedProcedure} onBack={() => setCurrentView('procedures')} />
          : <Procedures user={user!} onUploadClick={() => setCurrentView('upload')} onSelectProcedure={handleProcedureSelect} />;
      case 'notes': return <Notes />;
      case 'account': return <Account user={user!} />;
      case 'upload': return <UploadProcedure onBack={() => setCurrentView('procedures')} />;
      default: return <Dashboard user={user!} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        userRole={user!.role} 
        onLogout={handleLogout} 
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header user={user!} currentView={currentView} />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-fade-in">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
