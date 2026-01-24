import React, { useState } from "react";
import { supabase } from "../lib/supabase";

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [view, setView] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (view === "login") {
        // Tentative de connexion
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // On ne fait rien ici, onAuthStateChange dans App.tsx gérera la transition
      } else {
        // Récupération mot de passe
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/#type=recovery`,
        });
        if (error) throw error;
        setSuccess("Lien de récupération envoyé ! Vérifiez vos emails.");
        setTimeout(() => setView("login"), 3000);
        setLoading(false);
      }
    } catch (e: any) {
      setError(e.message === "Invalid login credentials" ? "Identifiants incorrects." : e.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-50">
      {/* Background Orbs pour le style "détendu" */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-10 animate-slide-up relative z-10">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl mx-auto rotate-6 transition-transform hover:rotate-0">
            <i className="fa-solid fa-bolt text-5xl"></i>
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Procedio</h1>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.5em]">
              L'IT en toute simplicité
            </p>
          </div>
        </div>

        <div className="glass-card p-12 shadow-2xl space-y-10 bg-white/90">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">
              {view === "login" ? "Connexion" : "Récupération"}
            </h2>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              {view === "login" ? "Espace sécurisé entreprise" : "Saisissez votre email pro"}
            </p>
          </div>

          {(error || success) && (
            <div
              className={`p-5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border animate-slide-up ${
                error
                  ? "bg-rose-50 text-rose-600 border-rose-100"
                  : "bg-emerald-50 text-emerald-600 border-emerald-100"
              }`}>
              <i
                className={`fa-solid ${error ? "fa-triangle-exclamation" : "fa-circle-check"} text-base`}></i>
              {error || success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">
                Email Pro
              </label>
              <input
                type="email"
                required
                placeholder="nom@entreprise.fr"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {view === "login" && (
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  autoComplete="off"
                  name="login-password"
                  inputMode="none"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="flex justify-end pr-2">
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors">
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50">
                {loading
                  ? "Chargement..."
                  : view === "login"
                    ? "Démarrer la session"
                    : "Envoyer le lien"}
              </button>

              {view === "forgot" && (
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="w-full text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">
                  Retour à la connexion
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
