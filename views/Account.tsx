
import React, { useState } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface AccountProps {
  user: User;
  onGoToReset: () => void; // Gardé pour la compatibilité types mais géré en local ici
}

const Account: React.FC<AccountProps> = ({ user }) => {
  const [displayName, setDisplayName] = useState(user.firstName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // États pour la modale de mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { firstName: displayName }
      });
      if (error) throw error;
      setMessage({ type: 'success', text: 'Profil mis à jour !' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      setMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }
    if (passwordData.new.length < 6) {
      setMessage({ type: 'error', text: 'Le nouveau mot de passe est trop court (min 6 car.).' });
      return;
    }

    setPasswordLoading(true);
    try {
      // 1. Vérifier l'ancien mot de passe en tentant une ré-authentification
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.old
      });
      if (authError) throw new Error("L'ancien mot de passe est incorrect.");

      // 2. Mettre à jour avec le nouveau
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.new
      });
      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès !' });
      setShowPasswordModal(false);
      setPasswordData({ old: '', new: '', confirm: '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) throw new Error('Sélectionnez une image.');
      const file = event.target.files[0];
      const fileName = `${user.id}_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.auth.updateUser({ data: { avatarUrl: data.publicUrl } });
      setAvatarUrl(data.publicUrl);
      setMessage({ type: 'success', text: 'Photo mise à jour !' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-slide-up pb-24">
      <div className="text-center space-y-3">
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Mon Compte</h2>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em]">Identité & Sécurité</p>
      </div>

      {message && (
        <div className={`p-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-4 animate-slide-up shadow-sm border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
        }`}>
          <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check text-base' : 'fa-circle-exclamation text-base'}`}></i>
          {message.text}
        </div>
      )}

      {/* PROFIL PERSO */}
      <section className="bg-white rounded-[3rem] border border-slate-200 p-12 shadow-xl shadow-indigo-500/5 space-y-12">
        <div className="flex flex-col items-center gap-8">
          <div className="relative group">
            <div className="w-48 h-48 rounded-[3.5rem] overflow-hidden ring-[16px] ring-slate-50 shadow-2xl transition-all duration-500 group-hover:scale-105 border border-slate-200">
              <img 
                src={avatarUrl || `https://ui-avatars.com/api/?name=${displayName}&background=random`} 
                className="w-full h-full object-cover" 
                alt="Profil"
              />
              {uploading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                  <i className="fa-solid fa-circle-notch animate-spin text-indigo-600 text-4xl"></i>
                </div>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-all active:scale-90 border-[6px] border-white">
              <i className="fa-solid fa-camera text-xl"></i>
              <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
            </label>
          </div>
        </div>

        <div className="space-y-8 max-w-md mx-auto text-center">
          <div className="space-y-3 text-left">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nom d'affichage</label>
            <input 
              type="text" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner text-center text-lg"
            />
          </div>

          <div className="space-y-4">
            <button 
              onClick={handleUpdateProfile}
              disabled={saving || uploading || displayName === user.firstName}
              className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Synchronisation..." : "Enregistrer le nom"}
            </button>
            
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="w-full bg-white text-indigo-600 border-2 border-indigo-50 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-50 transition-all active:scale-95"
            >
              <i className="fa-solid fa-key mr-2"></i> Modifier le mot de passe
            </button>
          </div>
        </div>
      </section>

      {/* MODALE CHANGEMENT MOT DE PASSE */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl space-y-10 animate-slide-up border border-white">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                <i className="fa-solid fa-shield-lock text-2xl"></i>
              </div>
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Sécurité</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Mise à jour des identifiants</p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Ancien mot de passe</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all"
                  value={passwordData.old}
                  onChange={e => setPasswordData({...passwordData, old: e.target.value})}
                />
              </div>

              <div className="h-px bg-slate-100 w-full"></div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nouveau mot de passe</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all"
                  value={passwordData.new}
                  onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Confirmer le nouveau</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all"
                  value={passwordData.confirm}
                  onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                />
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <button 
                  type="submit"
                  disabled={passwordLoading || !passwordData.old || !passwordData.new}
                  className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                >
                  {passwordLoading ? "Mise à jour..." : "Valider le changement"}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="w-full py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-[3rem] border border-slate-100 p-8 text-center">
        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">
          Compte lié à l'organisation Procedio • {user.role}
        </p>
      </div>
    </div>
  );
};

export default Account;
