
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
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
        
        {/* HEADER SECTION ALIGNÉ GAUCHE (COMME DASHBOARD) */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Mon Compte
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                & Profil
              </span>
            </h1>
            <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
              <i className="fa-solid fa-id-card text-indigo-500"></i>
              <span>Gérez vos informations personnelles et votre sécurité.</span>
            </p>
          </div>
        </header>

        {message && (
          <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-slide-up shadow-sm border ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
          }`}>
            <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`}></i>
            {message.text}
          </div>
        )}

        {/* MAIN GRID LAYOUT */}
        <div className="grid grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: IDENTITY CARD (4/12) */}
          <div className="col-span-12 lg:col-span-4">
            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm h-full flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-32 bg-slate-50 rounded-t-[2.5rem]"></div>
              
              <div className="relative z-10 mt-12 mb-6">
                <div className="w-40 h-40 rounded-[2.5rem] p-1.5 bg-white shadow-xl shadow-slate-200/50">
                  <div className="w-full h-full rounded-[2rem] overflow-hidden relative group-hover:scale-[1.02] transition-transform duration-500">
                    <img 
                      src={avatarUrl || `https://ui-avatars.com/api/?name=${displayName}&background=random`} 
                      className="w-full h-full object-cover" 
                      alt="Profil"
                    />
                    {uploading && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                        <i className="fa-solid fa-circle-notch animate-spin text-indigo-600 text-2xl"></i>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-slate-900/0 hover:bg-slate-900/20 flex items-center justify-center cursor-pointer transition-all group/edit">
                      <div className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl flex items-center justify-center text-slate-900 opacity-0 group-hover/edit:opacity-100 transform translate-y-2 group-hover/edit:translate-y-0 transition-all shadow-lg">
                        <i className="fa-solid fa-camera text-sm"></i>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} disabled={uploading} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-8 relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">{displayName}</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{user.email}</p>
                </div>
                <div className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  user.role === UserRole.MANAGER ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                }`}>
                  {user.role === UserRole.MANAGER ? 'Manager' : 'Technicien'}
                </div>
              </div>

              {/* STATS ROW */}
              <div className="grid grid-cols-3 w-full border-t border-slate-50 pt-6 mt-auto">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-black text-slate-900 leading-none">{personalStats.xp}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">XP Total</span>
                </div>
                <div className="flex flex-col items-center gap-1 border-x border-slate-50">
                  <span className="text-lg font-black text-indigo-600 leading-none">{personalStats.level}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Niveau</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-black text-amber-500 leading-none">{personalStats.badgesCount}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Badges</span>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: SETTINGS & PROGRESS (8/12) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
            
            {/* PROGRESSION WIDGET REUSED */}
            {user.role === UserRole.TECHNICIAN && (
              <div className="w-full">
                <XPProgressBar 
                  currentXP={personalStats.xp} 
                  currentLevel={personalStats.level} 
                />
              </div>
            )}

            {/* SETTINGS FORM CARD */}
            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm flex-1">
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-50">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-user-gear"></i>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight">Paramètres du profil</h3>
                  <p className="text-xs font-medium text-slate-400">Modifiez vos informations de connexion.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 ml-1 uppercase tracking-widest">Nom d'affichage</label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm group-hover:bg-slate-50/80"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                      <i className="fa-solid fa-pen text-xs"></i>
                    </div>
                  </div>
                  <p className="text-[10px] font-medium text-amber-500 flex items-center gap-1.5 mt-1.5">
                    <i className="fa-solid fa-circle-info"></i>
                    Déconnexion requise après modification
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 ml-1 uppercase tracking-widest">Email (Lecture seule)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      readOnly
                      value={user.email} 
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-100/50 border border-transparent text-slate-400 font-bold text-sm cursor-not-allowed select-none"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                      <i className="fa-solid fa-lock text-xs"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button 
                  onClick={handleUpdateProfile}
                  disabled={saving || uploading}
                  className="flex-[2] bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-3"
                >
                  {saving ? (
                    <>
                      <i className="fa-solid fa-circle-notch animate-spin"></i>
                      Sauvegarde...
                    </>
                  ) : (
                    "Enregistrer les modifications"
                  )}
                </button>
                
                <button 
                  onClick={() => setShowPasswordModal(true)}
                  className="flex-1 px-6 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-key"></i> 
                  Mot de passe
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* MODALE DE SÉCURITÉ */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] backdrop-blur-sm bg-slate-900/20 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6 border border-slate-100 animate-scale-up">
              
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <i className="fa-solid fa-shield-halved text-xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Sécurité du compte</h3>
                <p className="text-xs text-slate-500 font-medium">Mettez à jour votre mot de passe pour sécuriser votre accès.</p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 ml-2 uppercase tracking-widest">Ancien mot de passe</label>
                  <input 
                    type="password" required placeholder="••••••••"
                    className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
                    value={passwordData.old}
                    onChange={e => setPasswordData({...passwordData, old: e.target.value})}
                  />
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 ml-2 uppercase tracking-widest">Nouveau mot de passe</label>
                    <input 
                      type="password" required placeholder="6 caractères minimum"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
                      value={passwordData.new}
                      onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <input 
                      type="password" required placeholder="Confirmer le nouveau mot de passe"
                      className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
                      value={passwordData.confirm}
                      onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowPasswordModal(false)} 
                    className="flex-1 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={passwordLoading} 
                    className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
                  >
                    {passwordLoading ? "Mise à jour..." : "Confirmer le changement"}
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
