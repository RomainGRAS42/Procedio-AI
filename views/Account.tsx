
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

const Account: React.FC<{ user: User }> = ({ user }) => {
  const [displayName, setDisplayName] = useState(user.firstName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { firstName: displayName }
      });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });
      // On rafraîchit la page pour propager les changements dans l'App State
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Vous devez sélectionner une image.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}_${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload vers le bucket 'avatars' (assurez-vous qu'il existe et est public)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // Mise à jour des métadonnées de l'utilisateur
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatarUrl: publicUrl }
      });

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setMessage({ type: 'success', text: 'Photo de profil mise à jour !' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Mon Profil</h2>
        <p className="text-slate-500 font-medium">Gérez votre identité sur Procedio</p>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 animate-slide-up ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
        }`}>
          <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
          {message.text}
        </div>
      )}

      <section className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-xl space-y-10">
        {/* Section Photo */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            <div className="w-32 h-32 rounded-[2rem] overflow-hidden ring-4 ring-slate-50 shadow-2xl transition-transform group-hover:scale-105">
              <img 
                src={avatarUrl || `https://ui-avatars.com/api/?name=${displayName}&background=random`} 
                className="w-full h-full object-cover" 
                alt="Profil"
              />
              {uploading && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                  <i className="fa-solid fa-circle-notch animate-spin text-white text-2xl"></i>
                </div>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-all active:scale-90">
              <i className="fa-solid fa-camera text-sm"></i>
              <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
            </label>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Format: JPG, PNG • Max 2MB</p>
          </div>
        </div>

        {/* Section Nom */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-[0.2em]">Nom d'affichage</label>
            <div className="relative">
              <input 
                type="text" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Jean Tech"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-slate-700"
              />
              <i className="fa-solid fa-user-tag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
          </div>

          <button 
            onClick={handleUpdateProfile}
            disabled={saving || uploading || displayName === user.firstName}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {saving ? (
              <><i className="fa-solid fa-circle-notch animate-spin"></i> Enregistrement...</>
            ) : (
              <><i className="fa-solid fa-check-circle"></i> Mettre à jour mon nom</>
            )}
          </button>
        </div>
      </section>

      <div className="text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
          ID Utilisateur: {user.id}
        </p>
      </div>
    </div>
  );
};

export default Account;
