
import React, { useState } from 'react';
import { UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (view === 'register') {
        let role = UserRole.TECHNICIAN;
        if (email.toLowerCase() === 'romain.gras42@hotmail.fr') role = UserRole.MANAGER;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { role, firstName: email.split('@')[0] } }
        });
        if (error) throw error;
        setSuccess("Compte créé ! Vérifiez vos emails pour confirmer.");
        setView('login');
      } else if (view === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccess("Un lien de récupération a été envoyé à votre adresse email.");
        setView('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Identifiants incorrects.");
        onLogin(UserRole.TECHNICIAN);
      }
    } catch (e: any) {
      setError(e.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-50">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 animate-slide-up relative z-10">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center text-white shadow-2xl mx-auto rotate-3">
            <i className="fa-solid fa-layer-group text-4xl"></i>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Procedio</h1>
        </div>

        <div className="glass-card p-10 shadow-2xl space-y-8 backdrop-blur-2xl bg-white/70">
          <div className="text-center">
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">
               {view === 'login' ? 'Identification' : view === 'register' ? 'Créer un compte' : 'Récupération'}
             </h2>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Accès sécurisé</p>
          </div>

          {(error || success) && (
            <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-slide-up border ${
              error ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
            }`}>
              <i className={`fa-solid ${error ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}></i>
              {error || success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Email Professionnel</label>
              <div className="relative">
                <input type="email" required placeholder="votre@email.fr" className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" value={email} onChange={(e) => setEmail(e.target.value)} />
                <i className="fa-solid fa-at absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              </div>
            </div>

            {view !== 'forgot' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Mot de passe</label>
                <div className="relative">
                  <input type="password" required placeholder="••••••••••••" className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <i className="fa-solid fa-lock-keyhole absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl active:scale-95 disabled:opacity-50">
              {loading ? 'Traitement...' : view === 'forgot' ? 'Envoyer le lien' : view === 'register' ? 'Créer mon accès' : 'Se connecter'}
            </button>
          </form>

          <div className="flex flex-col gap-3 text-center pt-4 border-t border-slate-100">
            {view === 'login' && (
              <button type="button" onClick={() => setView('forgot')} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest">Mot de passe oublié ?</button>
            )}
            <button type="button" onClick={() => setView(view === 'login' ? 'register' : 'login')} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
              {view === 'login' ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
