
import React, { useState } from 'react';
import { UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isRegistering) {
        // Inscription : Force le rôle TECHNICIAN par défaut (ou Manager si email contient 'admin' pour le test)
        const defaultRole = email.includes('admin') ? UserRole.MANAGER : UserRole.TECHNICIAN;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { 
              role: defaultRole,
              firstName: email.split('@')[0], // Nom par défaut basé sur l'email
              lastName: ''
            }
          }
        });
        if (error) throw error;
        alert("Compte créé avec succès ! Connectez-vous maintenant.");
        setIsRegistering(false);
      } else {
        // Connexion
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Récupération du rôle depuis les métadonnées de la BDD
        const userRole = data.user.user_metadata?.role || UserRole.TECHNICIAN;
        onLogin(userRole as UserRole);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Erreur d'authentification. Vérifiez vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/30 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/30 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{animationDelay: '1s'}}></div>

      <div className="w-full max-w-md space-y-10 animate-slide-up relative z-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 mx-auto rotate-6 transition-transform hover:rotate-0">
            <i className="fa-solid fa-layer-group text-4xl"></i>
          </div>
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Procedio</h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs mt-2">Portail Interne Sécurisé</p>
          </div>
        </div>

        <div className="glass-card p-10 shadow-2xl space-y-8 backdrop-blur-2xl bg-white/60">
          <div className="flex flex-col items-center">
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">
               {isRegistering ? 'Initialisation Compte' : 'Identification'}
             </h2>
             <div className="h-1 w-12 bg-blue-500 rounded-full mt-2"></div>
          </div>

          {error && (
            <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-black flex items-center gap-3 border border-rose-100 animate-slide-up">
              <i className="fa-solid fa-triangle-exclamation text-lg"></i>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Identifiant / Email</label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  placeholder="user@procedio.internal"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/50 border border-white focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 placeholder:font-normal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <i className="fa-solid fa-at absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Mot de passe</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/50 border border-white focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 placeholder:font-normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <i className="fa-solid fa-lock-keyhole absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 glossy-button flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                   <i className="fa-solid fa-circle-notch animate-spin"></i> Traitement...
                </>
              ) : (isRegistering ? "Créer l'accès" : 'Connexion Sécurisée')}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-wide"
            >
              {isRegistering ? 'Retour à la connexion' : 'Première visite ? Créer un compte'}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
          <i className="fa-solid fa-shield-halved mr-1"></i> Accès restreint au personnel autorisé
        </p>
      </div>
    </div>
  );
};

export default Login;
