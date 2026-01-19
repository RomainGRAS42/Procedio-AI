
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { supabase } from '../lib/supabase';

const Administration: React.FC = () => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole | null>(null);
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // UTILISATION DE LA TABLE user_profiles
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('email', { ascending: true });

      if (error) {
        console.error("Erreur de récupération :", error.message);
        setUsersList([]);
        return;
      }
      
      setUsersList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail.includes('@') || !inviteRole) return;
    setInviting(true);
    try {
      const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: tempPassword,
        options: { 
          data: { 
            role: inviteRole, 
            firstName: inviteEmail.split('@')[0] 
          } 
        }
      });
      
      if (signUpError) throw signUpError;

      if (data.user) {
        const { error: profileError } = await supabase.from('user_profiles').insert([{
          id: data.user.id,
          email: inviteEmail,
          role: inviteRole,
          first_name: inviteEmail.split('@')[0]
        }]);
        if (profileError) console.warn("Le profil existe déjà.");
      }

      await supabase.auth.resetPasswordForEmail(inviteEmail, { redirectTo: window.location.origin });
      
      setMessage({ type: 'success', text: `Invitation envoyée à ${inviteEmail}.` });
      setInviteEmail('');
      setInviteRole(null);
      setShowInvitePopup(false);
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setInviting(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleChangeUserRole = async (targetUserId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', targetUserId);

      if (error) throw error;

      setUsersList(prev => prev.map(u => u.id === targetUserId ? { ...u, role: newRole } : u));
      setMessage({ type: 'success', text: "Rôle mis à jour avec succès." });
    } catch (err: any) {
      setMessage({ type: 'error', text: "Erreur : " + err.message });
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-slide-up pb-20">
      <div className="text-center space-y-3">
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Administration</h2>
        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.4em]">Comptes réels (user_profiles)</p>
      </div>

      {message && (
        <div className={`p-5 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center gap-4 animate-slide-up shadow-sm border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
        }`}>
          <i className={`fa-solid ${message.type === 'success' ? 'fa-circle-check text-base' : 'fa-circle-exclamation text-base'}`}></i>
          {message.text}
        </div>
      )}

      <section className="bg-white rounded-[3rem] border border-slate-200 p-10 shadow-xl shadow-indigo-500/5 space-y-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-10 border-b border-slate-100">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 shadow-inner border border-indigo-100">
              <i className="fa-solid fa-users-gear text-2xl"></i>
            </div>
            <div>
              <h4 className="font-black text-2xl text-slate-900 tracking-tight">Utilisateurs</h4>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Table user_profiles synchronisée</p>
            </div>
          </div>
          <button 
            onClick={() => setShowInvitePopup(true)}
            className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-200 active:scale-95 flex items-center gap-3"
          >
            <i className="fa-solid fa-plus-circle text-lg"></i>
            Inviter
          </button>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center text-slate-400 font-black text-xs uppercase animate-pulse">Chargement...</div>
          ) : usersList.length > 0 ? (
            usersList.map((u) => (
              <div key={u.id} className="group p-6 rounded-[2rem] bg-slate-50 border border-transparent hover:bg-white hover:border-slate-200 transition-all flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm hover:shadow-md">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-300 text-xl shadow-sm transition-transform group-hover:scale-105 group-hover:text-indigo-400">
                    {u.first_name?.[0] || u.email?.[0].toUpperCase() || '?'}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-lg">{u.first_name || u.email.split('@')[0]}</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{u.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border ${
                    u.role === UserRole.MANAGER 
                      ? 'bg-amber-50 text-amber-600 border-amber-200' 
                      : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                  }`}>
                    {u.role || 'TECHNICIAN'}
                  </div>
                  <button 
                    onClick={() => handleChangeUserRole(u.id, u.role === UserRole.MANAGER ? UserRole.TECHNICIAN : UserRole.MANAGER)}
                    className="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-center shadow-sm"
                    title="Changer le rôle"
                  >
                    <i className="fa-solid fa-arrows-rotate"></i>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                 <i className="fa-solid fa-user-slash text-2xl"></i>
               </div>
               <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Aucun profil trouvé dans 'user_profiles'.</p>
            </div>
          )}
        </div>
      </section>

      {showInvitePopup && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl space-y-10 animate-slide-up border border-white">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                  <i className="fa-solid fa-user-plus text-2xl"></i>
                </div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Nouvel Accès</h3>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-300 ml-2 uppercase tracking-widest">Email professionnel</label>
                  <input 
                    type="email" 
                    placeholder="nom@procedio.fr"
                    className="w-full px-6 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-300 ml-2 uppercase tracking-widest">Rôle</label>
                  <div className="grid grid-cols-2 gap-4">
                     <button 
                      onClick={() => setInviteRole(UserRole.TECHNICIAN)}
                      className={`py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${inviteRole === UserRole.TECHNICIAN ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-indigo-200'}`}
                     >
                       Technicien
                     </button>
                     <button 
                      onClick={() => setInviteRole(UserRole.MANAGER)}
                      className={`py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${inviteRole === UserRole.MANAGER ? 'bg-amber-500 text-white border-amber-500 shadow-xl' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-amber-200'}`}
                     >
                       Manager
                     </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <button 
                    onClick={handleInviteUser}
                    disabled={inviting || !inviteEmail || !inviteRole}
                    className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                  >
                    {inviting ? "Envoi..." : "Inviter l'utilisateur"}
                  </button>
                  <button 
                    onClick={() => {setShowInvitePopup(false); setInviteRole(null);}}
                    className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Administration;
