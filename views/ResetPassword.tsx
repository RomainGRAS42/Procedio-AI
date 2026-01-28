
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ResetPasswordProps {
  onBack: () => void;
  userEmail: string;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ onBack, userEmail }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Mot de passe mis à jour avec succès !' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(onBack, 2000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erreur lors de la mise à jour.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-slide-up">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center">
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sécurité du compte</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Modification du mot de passe</p>
        </div>
      </div>

      <div className="glass-card p-10 shadow-2xl space-y-8 backdrop-blur-2xl bg-white/60">
        <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <i className="fa-solid fa-user-shield"></i>
          </div>
          <div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Compte concerné</p>
            <p className="font-bold text-slate-700 text-sm">{userEmail}</p>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-slide-up ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
          }`}>
            <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
            {message.text}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nouveau mot de passe</label>
            <div className="relative">
              <input 
                type="password" 
                required
                placeholder="••••••••••••"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <i className="fa-solid fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Confirmation</label>
            <div className="relative">
              <input 
                type="password" 
                required
                placeholder="••••••••••••"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <i className="fa-solid fa-shield-check absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? (
              <><i className="fa-solid fa-circle-notch animate-spin"></i> Mise à jour...</>
            ) : (
              <><i className="fa-solid fa-lock-open"></i> Valider le changement</>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
        Une fois validé, vous devrez utiliser votre nouveau mot de passe lors de votre prochaine connexion.
      </p>
    </div>
  );
};

export default ResetPassword;
