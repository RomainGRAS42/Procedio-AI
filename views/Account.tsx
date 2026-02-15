
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import XPProgressBar from '../components/XPProgressBar';
import { calculateLevelFromXP, getLevelTitle } from '../lib/xpSystem';

interface AccountProps {
  user: User;
  onGoToReset: () => void;
}

const Account: React.FC<AccountProps> = ({ user }) => {
  const [displayName, setDisplayName] = useState(user.firstName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Stats personnelles
  const [personalStats, setPersonalStats] = useState({
    xp: user.currentXp || 0,
    level: user.level || 1,
    badgesCount: user.badges?.length || 0
  });

  // États pour la modale de mot de passe
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ old: '', new: '', confirm: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    fetchLatestStats();
  }, [user.id]);

  const fetchLatestStats = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('xp_points, level')
        .eq('id', user.id)
        .single();
      
      const { count: badgesCount } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (profile) {
        setPersonalStats({
          xp: profile.xp_points || 0,
          level: profile.level || 1,
          badgesCount: badgesCount || 0
        });
      }
    } catch (err) {
      console.error("Error fetching latest stats:", err);
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ 
          first_name: displayName,
          last_name: '',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { firstName: displayName }
      });
      if (authError) throw authError;

      setMessage({ type: 'success', text: 'Profil synchronisé avec succès !' });
      setTimeout(() => window.location.reload(), 1500);
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
    setPasswordLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.old
      });
      if (authError) throw new Error("Ancien mot de passe incorrect.");

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.new
      });
      if (updateError) throw updateError;

      setMessage({ type: 'success', text: 'Mot de passe modifié !' });
      setShowPasswordModal(false);
      setPasswordData({ old: '', new: '', confirm: '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) throw new Error('Fichier requis.');
      const file = event.target.files[0];
      const fileName = `${user.id}_avatar.${file.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      await supabase.from('user_profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      await supabase.auth.updateUser({ data: { avatarUrl: data.publicUrl } });
      
      setAvatarUrl(data.publicUrl);
      setMessage({ type: 'success', text: 'Avatar mis à jour !' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-5xl mx-auto w-full space-y-10">
        
        {/* HEADER SECTION */}
        <div className="text-center space-y-3">
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Mon Compte</h2>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em]">Profil & Synchronisation Base</p>
        </div>

        {message && (
          <div className={`p-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-4 animate-slide-up shadow-sm border ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
          }`}>
            <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check text-base' : 'fa-circle-exclamation text-base'}`}></i>
            {message.text}
          </div>
        )}

        {/* MAIN PROFILE CARD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: AVATAR & STATS */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-xl shadow-indigo-500/5 flex flex-col items-center gap-8 group">
              <div className="relative">
                <div className="w-48 h-48 rounded-[3.5rem] overflow-hidden ring-[16px] ring-slate-50 shadow-2xl transition-all duration-500 group-hover:scale-105 border border-slate-100">
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
                <label className="absolute -bottom-2 -right-2 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-2xl flex items-center justify-center cursor-pointer hover:bg-slate-900 transition-all active:scale-90 border-[6px] border-white">
                  <i className="fa-solid fa-camera text-lg"></i>
                  <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                </label>
              </div>

              <div className="text-center space-y-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{displayName}</h3>
                <div className={`inline-flex px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                  user.role === UserRole.MANAGER ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                }`}>
                  {user.role}
                </div>
              </div>

              {/* MINI STATS STRIP */}
              <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t border-slate-50">
                <div className="text-center">
                  <p className="text-[14px] font-black text-slate-900">{personalStats.xp}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">XP</p>
                </div>
                <div className="text-center border-x border-slate-100">
                  <p className="text-[14px] font-black text-slate-900">{personalStats.level}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">LVL</p>
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-black text-slate-900">{personalStats.badgesCount}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Badges</p>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: PROGRESSION & SETTINGS */}
          <div className="lg:col-span-8 space-y-8">
            {/* PROGRESSION CARD */}
            {user.role === UserRole.TECHNICIAN && (
              <XPProgressBar 
                currentXP={personalStats.xp} 
                currentLevel={personalStats.level} 
              />
            )}

            {/* SETTINGS CARD */}
            <section className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-xl shadow-indigo-500/5 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Nom d'affichage</label>
                  <div className="group">
                    <input 
                      type="text" 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner group-hover:border-slate-100"
                    />
                    <div className="mt-2 flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase tracking-wider">
                       <i className="fa-solid fa-triangle-exclamation"></i>
                       <span>Déconnexion requise après modification</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Email (Lecture seule)</label>
                  <input 
                    type="text" 
                    readOnly
                    value={user.email} 
                    className="w-full px-6 py-4 rounded-2xl bg-slate-100 border-none font-bold text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button 
                  onClick={handleUpdateProfile}
                  disabled={saving || uploading}
                  className="flex-[2] bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Sauvegarde..." : "Enregistrer les modifications"}
                </button>
                
                <button 
                  onClick={() => setShowPasswordModal(true)}
                  className="flex-1 px-8 py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all active:scale-95"
                >
                  <i className="fa-solid fa-key mr-2 text-indigo-600"></i> Sécurité
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* MODALE DE SÉCURITÉ RE-DESIGNÉE */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] backdrop-blur-2xl bg-slate-900/10 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-[0_40px_100px_-20px_rgba(79,70,229,0.25)] space-y-10 border border-indigo-50 relative overflow-hidden animate-slide-up">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-40"></div>
              
              <div className="text-center space-y-3 relative z-10">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <i className="fa-solid fa-shield-halved text-2xl"></i>
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Sécurité</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Mise à jour du mot de passe</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 ml-4 uppercase tracking-widest">Ancien mot de passe</label>
                  <input 
                    type="password" required placeholder="••••••••"
                    className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
                    value={passwordData.old}
                    onChange={e => setPasswordData({...passwordData, old: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-[9px] font-black text-slate-400 ml-4 uppercase tracking-widest">Nouveau mot de passe</label>
                  <input 
                    type="password" required placeholder="Min. 6 caractères"
                    className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
                    value={passwordData.new}
                    onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                  />
                  <input 
                    type="password" required placeholder="Confirmer le nouveau"
                    className="w-full px-8 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner mt-3"
                    value={passwordData.confirm}
                    onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                  />
                </div>

                <div className="pt-6 flex flex-col gap-4">
                  <button 
                    type="submit" 
                    disabled={passwordLoading} 
                    className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50"
                  >
                    {passwordLoading ? "Mise à jour..." : "Confirmer"}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowPasswordModal(false)} 
                    className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors py-2"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;
