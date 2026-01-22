
import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { supabase } from '../lib/supabase';

interface ProtectedNote extends Note {
  is_protected: boolean;
  user_id?: string;
}

interface NotesProps {
  initialIsAdding?: boolean;
  onEditorClose?: () => void;
}

const Notes: React.FC<NotesProps> = ({ initialIsAdding = false, onEditorClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState<ProtectedNote[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États pour l'édition/création (Mode Plein Écran)
  const [isEditing, setIsEditing] = useState(false);
  const [activeNote, setActiveNote] = useState<{ id?: string, title: string, content: string, is_protected: boolean }>({
    title: '', content: '', is_protected: false
  });
  
  // États pour la visualisation (Mode Plein Écran Focus)
  const [viewingNote, setViewingNote] = useState<ProtectedNote | null>(null);
  
  // Sécurité & Synchro
  const [unlockedNotes, setUnlockedNotes] = useState<Set<string>>(new Set());
  const [passwordVerify, setPasswordVerify] = useState<{id: string, value: string} | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (initialIsAdding) {
      handleAddNew();
    }
  }, [initialIsAdding]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (data) {
        // FILTRAGE : On ignore les notes qui sont des logs techniques
        const userNotes = data
          .filter(n => n.title && !n.title.startsWith('LOG_VIEW_') && !n.title.startsWith('LOG_READ_'))
          .map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            is_protected: n.is_protected || false,
            tags: n.tags || [],
            updatedAt: new Date(n.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            user_id: n.user_id
          }));
        setNotes(userNotes);
      }
    } catch (err) {
      console.error("Erreur de récupération des notes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setActiveNote({ title: '', content: '', is_protected: false });
    setIsEditing(true);
  };

  const handleEdit = (note: ProtectedNote) => {
    setActiveNote({ id: note.id, title: note.title, content: note.content, is_protected: note.is_protected });
    setIsEditing(true);
  };

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cette note ? Cette action est irréversible.")) return;
    
    try {
      const { error } = await supabase.from('notes').delete().eq('id', noteId);
      if (error) throw error;
      await fetchNotes();
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const handleLock = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setUnlockedNotes(prev => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  };

  const saveNote = async () => {
    if (!activeNote.title.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autorisé");

      const payload = {
        title: activeNote.title.trim(),
        content: activeNote.content,
        is_protected: activeNote.is_protected,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      let result;
      if (activeNote.id) {
        result = await supabase.from('notes').update(payload).eq('id', activeNote.id);
      } else {
        result = await supabase.from('notes').insert([payload]);
      }

      if (result.error) throw result.error;
      
      setIsEditing(false);
      onEditorClose?.();
      await fetchNotes();
    } catch (err) {
      alert("Erreur lors de la synchronisation avec Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const verifyPassword = async (noteId: string) => {
    if (!passwordVerify?.value) return;
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
        setAuthError("Mot de passe de session incorrect");
      }
    } catch {
      setAuthError("Erreur technique");
    }
  };

  return (
    <div className="space-y-8 animate-slide-up relative">
      
      {/* Barre de recherche et Action globale */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full max-w-2xl">
          <input 
            type="text" 
            placeholder="Rechercher une note ou un mémo..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none shadow-inner focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        </div>
        <button 
          onClick={handleAddNew}
          className="w-full lg:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
        >
          <i className="fa-solid fa-plus-circle text-lg"></i> Créer une note
        </button>
      </div>

      {/* MODALE ÉDITEUR PLEIN ÉCRAN */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slide-up">
          <header className="h-20 border-b border-slate-100 px-6 md:px-12 flex items-center justify-between bg-white sticky top-0">
             <div className="flex items-center gap-4">
               <button onClick={() => { setIsEditing(false); onEditorClose?.(); }} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500">
                 <i className="fa-solid fa-xmark text-xl"></i>
               </button>
               <h3 className="font-bold text-slate-400 uppercase tracking-[0.2em] text-[10px]">
                 {activeNote.id ? 'Mode Édition' : 'Nouveau Brouillon'}
               </h3>
             </div>
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => setActiveNote({...activeNote, is_protected: !activeNote.is_protected})}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeNote.is_protected ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}
                >
                  <i className={`fa-solid ${activeNote.is_protected ? 'fa-lock' : 'fa-lock-open'}`}></i>
                  {activeNote.is_protected ? 'Protégée' : 'Publique'}
                </button>
                <button 
                  onClick={saveNote}
                  disabled={saving || !activeNote.title.trim()}
                  className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl"
                >
                  {saving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-cloud-arrow-up"></i>}
                  Synchroniser
                </button>
             </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6 md:p-20 max-w-5xl mx-auto w-full space-y-12">
             <input 
               type="text"
               placeholder="Titre de la note..."
               className="w-full text-4xl md:text-6xl font-black text-slate-900 border-none outline-none placeholder:text-slate-100 tracking-tighter"
               value={activeNote.title}
               onChange={e => setActiveNote({...activeNote, title: e.target.value})}
               autoFocus
             />
             <textarea 
               placeholder="Commencez à documenter ici..."
               className="w-full h-[60vh] text-lg md:text-2xl text-slate-600 border-none outline-none resize-none leading-relaxed placeholder:text-slate-100 font-medium"
               value={activeNote.content}
               onChange={e => setActiveNote({...activeNote, content: e.target.value})}
             />
          </main>
        </div>
      )}

      {/* MODALE LECTURE FOCUS PLEIN ÉCRAN */}
      {viewingNote && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 animate-slide-up" onClick={() => setViewingNote(null)}>
          <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <header className="p-8 md:p-12 border-b border-slate-50 flex justify-between items-center shrink-0">
               <div className="flex-1">
                 <div className="flex items-center gap-3 mb-2">
                   <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] bg-blue-50 px-3 py-1 rounded-full">{viewingNote.updatedAt}</span>
                   {viewingNote.is_protected && <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em] bg-amber-50 px-3 py-1 rounded-full">Sécurisé</span>}
                 </div>
                 <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">{viewingNote.title}</h2>
               </div>
               <div className="flex gap-3">
                 <button onClick={(e) => handleDelete(e as any, viewingNote.id)} className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                   <i className="fa-solid fa-trash-can text-lg"></i>
                 </button>
                 <button onClick={() => { handleEdit(viewingNote); setViewingNote(null); }} className="w-14 h-14 rounded-2xl bg-slate-900 text-white hover:bg-blue-600 transition-all flex items-center justify-center shadow-xl">
                   <i className="fa-solid fa-pen-to-square text-lg"></i>
                 </button>
                 <button onClick={() => setViewingNote(null)} className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 hover:text-rose-600 transition-all flex items-center justify-center">
                   <i className="fa-solid fa-xmark text-xl"></i>
                 </button>
               </div>
            </header>
            <main className="flex-1 overflow-y-auto p-8 md:p-16 text-slate-700 text-xl md:text-2xl leading-relaxed whitespace-pre-wrap font-medium">
               {viewingNote.content}
            </main>
          </div>
        </div>
      )}

      {/* Grille des notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
        {loading ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest animate-pulse">Accès au coffre-fort...</p>
          </div>
        ) : (
          notes
            .filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((note) => {
              const isLocked = note.is_protected && !unlockedNotes.has(note.id);
              const isProtectedAndUnlocked = note.is_protected && unlockedNotes.has(note.id);
              
              return (
                <div 
                  key={note.id} 
                  className={`group glass-card p-8 flex flex-col min-h-[350px] transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl relative overflow-hidden border-none ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                  onClick={() => !isLocked && setViewingNote(note)}
                >
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="bg-white/50 backdrop-blur-md rounded-xl px-4 py-2 border border-white shadow-sm flex items-center gap-3">
                       <i className="fa-solid fa-calendar-day text-blue-500 text-[11px]"></i>
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{note.updatedAt}</span>
                    </div>
                    {!isLocked && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isProtectedAndUnlocked && (
                          <button 
                            onClick={(e) => handleLock(e, note.id)}
                            className="w-10 h-10 bg-amber-50 rounded-xl shadow-lg border border-amber-100 text-amber-500 hover:text-amber-700 hover:border-amber-300 transition-all flex items-center justify-center"
                            title="Re-verrouiller la note"
                          >
                            <i className="fa-solid fa-lock text-sm"></i>
                          </button>
                        )}
                        <button 
                          onClick={(e) => handleDelete(e, note.id)}
                          className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-50 text-rose-400 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center"
                          title="Supprimer la note"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(note); }}
                          className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-50 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center"
                          title="Modifier la note"
                        >
                          <i className="fa-solid fa-pencil text-sm"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <h4 className="font-black text-slate-900 text-2xl group-hover:text-blue-600 transition-colors line-clamp-2 mb-6 leading-tight tracking-tight relative z-10">{note.title}</h4>
                  
                  <div className="relative flex-1 z-10">
                    <p className={`text-slate-500 text-base leading-relaxed line-clamp-5 font-medium ${isLocked ? 'blur-2xl select-none opacity-10' : ''}`}>
                      {note.content || "Aucune description."}
                    </p>
                    
                    {isLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                        {passwordVerify?.id === note.id ? (
                          <div className="w-full space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
                            <input 
                              type="password"
                              placeholder="Mot de passe session"
                              autoFocus
                              className="w-full p-4 rounded-2xl border-2 border-slate-100 text-xs text-center outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                              value={passwordVerify.value}
                              onChange={e => { setPasswordVerify({...passwordVerify, value: e.target.value}); setAuthError(null); }}
                              onKeyDown={e => e.key === 'Enter' && verifyPassword(note.id)}
                            />
                            {authError && <p className="text-[9px] text-rose-500 font-black uppercase animate-bounce">{authError}</p>}
                            <div className="flex gap-2">
                              <button onClick={() => verifyPassword(note.id)} className="flex-1 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest">Valider</button>
                              <button onClick={() => setPasswordVerify(null)} className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200"><i className="fa-solid fa-xmark"></i></button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setPasswordVerify({id: note.id, value: ''}); }}
                            className="w-20 h-20 bg-white shadow-2xl rounded-3xl flex items-center justify-center text-amber-500 border-4 border-white hover:scale-110 transition-transform active:scale-95 group/lock"
                          >
                            <i className="fa-solid fa-lock text-3xl group-hover/lock:fa-unlock-keyhole"></i>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {!isLocked && (
                    <div className="mt-8 pt-6 border-t border-slate-100/50 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lire en plein écran <i className="fa-solid fa-arrow-right ml-1"></i></span>
                       {note.is_protected && (
                         <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                           <i className="fa-solid fa-shield-check"></i> SÉCURISÉ
                         </div>
                       )}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default Notes;
