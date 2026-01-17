
import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { supabase } from '../lib/supabase';

interface ProtectedNote extends Note {
  is_protected: boolean;
}

const Notes: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState<ProtectedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', is_protected: false });
  const [unlockedNotes, setUnlockedNotes] = useState<Set<string>>(new Set());
  const [passwordVerify, setPasswordVerify] = useState<{id: string, value: string} | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setNotes(data.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          is_protected: n.is_protected || false,
          tags: n.tags || [],
          updatedAt: new Date(n.updated_at).toLocaleDateString()
        })));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.title.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const { error } = await supabase.from('notes').insert([{ 
        title: newNote.title.trim(), 
        content: newNote.content, 
        user_id: user.id,
        is_protected: newNote.is_protected,
        updated_at: new Date().toISOString()
      }]);

      if (error) throw error;
      setNewNote({ title: '', content: '', is_protected: false });
      setIsAdding(false);
      await fetchNotes();
    } catch (err: any) {
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const verifyPassword = async (noteId: string) => {
    if (!passwordVerify?.value) return;
    setVerifying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: passwordVerify.value,
      });

      if (!error) {
        setUnlockedNotes(prev => new Set(prev).add(noteId));
        setPasswordVerify(null);
      } else {
        setAuthError("Authentification échouée");
      }
    } catch {
      setAuthError("Erreur technique");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-12 animate-slide-up">
      {/* Search & Actions */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-center bg-white/50 p-3 rounded-[3rem] border border-white shadow-2xl backdrop-blur-xl">
        <div className="relative flex-1 w-full">
          <input 
            type="text" 
            placeholder="Rechercher dans votre coffre-fort..."
            className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-white border-0 shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <i className="fa-solid fa-magnifying-glass-sparkles absolute left-6 top-1/2 -translate-y-1/2 text-blue-500 text-lg"></i>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 glossy-button"
        >
          <i className="fa-solid fa-plus-circle text-lg"></i> Créer une note
        </button>
      </div>

      {/* Modern Note Composer */}
      {isAdding && (
        <div className="bg-white/90 p-10 rounded-[4rem] border-2 border-blue-500 shadow-3xl space-y-10 animate-slide-up relative overflow-hidden backdrop-blur-2xl">
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-100/50 rounded-full blur-[100px] pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative">
            <input 
              className="flex-1 text-5xl font-black outline-none text-slate-900 bg-transparent placeholder:text-slate-100 w-full tracking-tight" 
              placeholder="Titre de la note"
              autoFocus
              value={newNote.title}
              onChange={e => setNewNote({...newNote, title: e.target.value})}
            />
            
            <button
              type="button"
              onClick={() => setNewNote({...newNote, is_protected: !newNote.is_protected})}
              className={`flex items-center gap-4 px-10 py-5 rounded-[2.5rem] font-black text-xs transition-all shadow-2xl active:scale-95 ${
                newNote.is_protected 
                  ? 'bg-amber-500 text-white ring-8 ring-amber-100' 
                  : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-blue-50 hover:text-blue-500'
              }`}
            >
              <i className={`fa-solid ${newNote.is_protected ? 'fa-lock-keyhole text-xl' : 'fa-lock-open text-xl'}`}></i>
              <span className="uppercase tracking-[0.2em]">
                {newNote.is_protected ? 'Protection Active' : 'Public'}
              </span>
            </button>
          </div>

          <textarea 
            className="w-full h-80 outline-none resize-none text-slate-700 text-2xl font-medium bg-white/40 p-10 rounded-[3rem] border border-slate-100 focus:border-blue-200 transition-all placeholder:text-slate-200 leading-relaxed" 
            placeholder="Écrivez votre contenu ici... (Supporte le Markdown)"
            value={newNote.content}
            onChange={e => setNewNote({...newNote, content: e.target.value})}
          />

          <div className="flex justify-end items-center gap-10">
            <button 
              type="button"
              onClick={() => setIsAdding(false)} 
              className="text-slate-400 font-black hover:text-slate-900 transition-colors uppercase text-xs tracking-widest"
            >
              Annuler
            </button>
            <button 
              onClick={handleAddNote}
              disabled={saving || !newNote.title.trim()}
              className="bg-blue-600 text-white px-16 py-6 rounded-[2.5rem] font-black hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all flex items-center gap-4 disabled:opacity-50 active:scale-95 text-sm uppercase tracking-widest glossy-button"
            >
              {saving ? <i className="fa-solid fa-spinner-third animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Note Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
        {loading ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-8">
            <div className="w-20 h-20 border-8 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black tracking-[0.3em] uppercase text-xs animate-pulse">Chargement sécurisé...</p>
          </div>
        ) : (
          notes.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase())).map((note) => {
            const isLocked = note.is_protected && !unlockedNotes.has(note.id);
            const isVerifying = passwordVerify?.id === note.id;

            return (
              <div key={note.id} className={`group glass-card p-10 transition-all duration-700 relative flex flex-col min-h-[400px] hover:-translate-y-4 hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] ${isLocked ? 'overflow-hidden' : ''}`}>
                <div className="flex justify-between items-start mb-8">
                  <h4 className="font-black text-slate-900 text-2xl group-hover:text-blue-600 transition-colors line-clamp-2 pr-12 tracking-tight leading-tight">{note.title}</h4>
                  {note.is_protected && (
                    <div className={`${isLocked ? 'bg-amber-500 text-white scale-110 rotate-6 shadow-2xl shadow-amber-200' : 'bg-emerald-500 text-white shadow-emerald-200'} w-14 h-14 rounded-3xl flex items-center justify-center text-xl transition-all absolute top-10 right-10`}>
                      <i className={`fa-solid ${isLocked ? 'fa-user-shield' : 'fa-shield-check'}`}></i>
                    </div>
                  )}
                </div>

                <div className="relative flex-1">
                  <p className={`text-slate-500 text-lg leading-relaxed mb-12 ${isLocked ? 'blur-3xl select-none opacity-5' : ''}`}>
                    {note.content || "Aucun contenu saisi."}
                  </p>
                  
                  {isLocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-white/40 backdrop-blur-xl rounded-[3rem]">
                      {!isVerifying ? (
                        <div className="animate-slide-up flex flex-col items-center space-y-8 p-6">
                          <div className="w-24 h-24 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-3xl border-4 border-white/30 rotate-3">
                            <i className="fa-solid fa-fingerprint text-4xl"></i>
                          </div>
                          <button 
                            onClick={() => setPasswordVerify({id: note.id, value: ''})}
                            className="bg-slate-900 text-white text-[10px] px-10 py-5 rounded-2xl font-black uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-2xl active:scale-95"
                          >
                            Accès sécurisé
                          </button>
                        </div>
                      ) : (
                        <div className="w-full max-w-[320px] space-y-8 bg-white p-10 rounded-[3rem] shadow-3xl border border-slate-50 animate-slide-up">
                          <div className="text-center space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Code requis</p>
                            <input 
                              type="password"
                              autoFocus
                              placeholder="Mot de passe Procedio"
                              className={`w-full px-6 py-5 rounded-2xl border-2 text-sm text-center focus:ring-4 focus:ring-blue-500/10 outline-none transition-all ${authError ? 'border-rose-400 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}
                              value={passwordVerify.value}
                              onChange={(e) => {
                                  setPasswordVerify({...passwordVerify, value: e.target.value});
                                  setAuthError(null);
                              }}
                              onKeyDown={(e) => e.key === 'Enter' && verifyPassword(note.id)}
                            />
                          </div>
                          {authError && <p className="text-[11px] text-rose-500 font-black animate-bounce uppercase text-center">{authError}</p>}
                          <div className="flex gap-4">
                            <button 
                                onClick={() => verifyPassword(note.id)}
                                className="flex-1 bg-blue-600 text-white py-5 rounded-2xl text-[10px] font-black uppercase active:scale-95 transition-all shadow-2xl shadow-blue-200"
                            >
                                Vérifier
                            </button>
                            <button 
                                onClick={() => {setPasswordVerify(null); setAuthError(null);}}
                                className="px-6 py-5 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-10 border-t border-white/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
                       <i className="fa-regular fa-calendar-star"></i>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{note.updatedAt}</span>
                  </div>
                  {!isLocked && note.is_protected && (
                    <span className="text-emerald-600 flex items-center gap-2 bg-emerald-50 px-5 py-2.5 rounded-2xl text-[10px] font-black border border-emerald-100 uppercase tracking-[0.1em] shadow-sm">
                      <i className="fa-solid fa-circle-check"></i> Déverrouillé
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Notes;
