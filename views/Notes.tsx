import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Note, User, UserRole } from "../types";
import { supabase } from "../lib/supabase";

interface ProtectedNote extends Note {
  is_protected: boolean;
  user_id?: string;
  author_role?: UserRole; // To track if author was technician/manager
  author_name?: string;
}

interface NotesProps {
  initialIsAdding?: boolean;
  onEditorClose?: () => void;
  mode?: "personal" | "flash";
  user?: User | null; // Passed from App.tsx
}

const Notes: React.FC<NotesProps> = ({ initialIsAdding = false, onEditorClose, mode = "personal", user }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [notes, setNotes] = useState<ProtectedNote[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour l'édition/création (Mode Plein Écran)
  const [isEditing, setIsEditing] = useState(false);
  const [activeNote, setActiveNote] = useState<{
    id?: string;
    title: string;
    content: string;
    is_protected: boolean;
  }>({
    title: "",
    content: "",
    is_protected: false,
  });

  // États pour la visualisation (Mode Plein Écran Focus)
  const [viewingNote, setViewingNote] = useState<ProtectedNote | null>(null);
  const [viewingEdit, setViewingEdit] = useState<boolean>(false);
  const [viewDraft, setViewDraft] = useState<{
    title: string;
    content: string;
    is_protected: boolean;
  } | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const activeEditorRef = useRef<HTMLDivElement | null>(null);

  // Sécurité & Synchro
  const [unlockedNotes, setUnlockedNotes] = useState<Set<string>>(new Set());
  const [passwordVerify, setPasswordVerify] = useState<{
    id: string;
    value: string;
    action: "UNLOCK" | "TOGGLE_LOCK";
  } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string; icon: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const backBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    if (initialIsAdding) {
      handleAddNew();
    }
  }, [initialIsAdding]);

  // Initialisation du contenu de l'éditeur lors de l'ouverture
  useEffect(() => {
    if (viewingEdit && editorRef.current && viewDraft) {
      editorRef.current.innerHTML = viewDraft.content;
    }
  }, [viewingEdit]);

  useEffect(() => {
    if (isEditing && activeEditorRef.current) {
      activeEditorRef.current.innerHTML = activeNote.content;
    }
  }, [isEditing]);

  const fetchNotes = async () => {
    setLoading(true);

    // Timeout pour éviter le chargement infini
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    try {
      // Use the passed user object if available, otherwise fetch minimal auth user
      // But for role-based logic, we REALLY need the passed User object.
      // Fallback to fetching auth user if not passed (though App.tsx should pass it)
      let currentUserId = user?.id;
      if (!currentUserId) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        currentUserId = authUser?.id;
      }

      let query = supabase
        .from("notes")
        .select("*") // Utilisation de * pour éviter les erreurs de noms de colonnes
        .order("updated_at", { ascending: false });

      // Si un utilisateur est connecté, on filtre explicitement par son ID
      if (currentUserId) {
        if (mode === "flash") {
          // FLASH MODE: fetch PUBLIC notes OR suggestions
          // Managers see ALL suggestions. Technicians see public + their own suggestions.
          // Note: "status.eq.public" is for approved flash notes.
          // "status.eq.suggestion" is for pending ones.
          
          if (user?.role === UserRole.MANAGER) {
             query = query.or(`status.eq.public,status.eq.suggestion`);
          } else {
             // Technicians: See Public + My Suggestions
             query = query.or(`status.eq.public,and(status.eq.suggestion,user_id.eq.${currentUserId})`);
          }
        } else {
          // PERSONAL MODE: fetch ONLY my notes (default)
          query = query.eq("user_id", currentUserId);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const userNotes = data
          .filter(
            (n) => n.title && !n.title.startsWith("LOG_") && !n.title.startsWith("CONSULTATION_") && !n.title.startsWith("SUGGESTION_")
          )
          .map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            is_protected: n.is_protected || false,
            tags: n.tags || [],
            updatedAt: new Date(n.updated_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            user_id: n.user_id,
            status: n.status || "private",
            category: n.category || "general",
          }));

        // Client-side filtering as double security & Organization
        setNotes(userNotes);
      }
    } catch (err: any) {
      console.error("Erreur de récupération des notes:", err);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };
  const handleCloseNote = () => {
    if (viewingNote?.is_protected) {
      setUnlockedNotes((prev) => {
        const next = new Set(prev);
        next.delete(viewingNote.id);
        return next;
      });
    }
    setViewingEdit(false);
    setViewDraft(null);
    setViewingNote(null);
    setSearchTerm("");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseNote();
    };
    if (viewingNote) {
      backBtnRef.current?.focus();
      window.addEventListener("keydown", handler);
    }
    return () => window.removeEventListener("keydown", handler);
  }, [viewingNote]);

  const executeToggleLock = async () => {
    if (!viewingNote) return;
    const newStatus = !viewingNote.is_protected;

    // Optimistic UI update
    const updatedNote = { ...viewingNote, is_protected: newStatus };
    setViewingNote(updatedNote);
    setNotes((prev) =>
      prev.map((n) => (n.id === viewingNote.id ? { ...n, is_protected: newStatus } : n))
    );

    try {
      const { error } = await supabase
        .from("notes")
        .update({ is_protected: newStatus, updated_at: new Date().toISOString() })
        .eq("id", viewingNote.id);

      if (error) throw error;

      if (newStatus) {
        setUnlockedNotes((prev) => new Set(prev).add(viewingNote.id));
      } else {
        setUnlockedNotes((prev) => {
          const next = new Set(prev);
          next.delete(viewingNote.id);
          return next;
        });
      }
    } catch (err) {
      alert("Erreur lors de la mise à jour de la protection.");
      // Rollback
      setViewingNote({ ...viewingNote, is_protected: !newStatus });
      fetchNotes();
    }
  };

  const toggleLockStatus = async () => {
    if (!viewingNote) return;
    setPasswordVerify({ id: viewingNote.id, value: "", action: "TOGGLE_LOCK" });
  };

  const handleAddNew = () => {
    setActiveNote({ title: "", content: "", is_protected: false });
    setIsEditing(true);
  };

  const handleEdit = (note: ProtectedNote) => {
    setActiveNote({
      id: note.id,
      title: note.title,
      content: note.content,
      is_protected: note.is_protected,
    });
    setIsEditing(true);
  };

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (
      !window.confirm("Voulez-vous vraiment supprimer cette note ? Cette action est irréversible.")
    )
      return;

    try {
      const { error } = await supabase.from("notes").delete().eq("id", noteId);
      if (error) throw error;
      await fetchNotes();
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const handleLock = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setUnlockedNotes((prev) => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  };

  const saveNote = async () => {
    if (!activeNote.title.trim()) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autorisé");

      const payload = {
        title: activeNote.title.trim(),
        content: activeNote.content,
        is_protected: activeNote.is_protected,
        user_id: user.id,
        updated_at: new Date().toISOString(),
        status: mode === "flash" ? "suggestion" : "private", // Default status logic
        category: "general"
      };

      let result;
      if (activeNote.id) {
        result = await supabase.from("notes").update(payload).eq("id", activeNote.id);
      } else {
        result = await supabase.from("notes").insert([payload]);
      }

      if (result.error) throw result.error;

      setIsEditing(false);
      setSearchTerm(""); // Réinitialiser la recherche pour voir la nouvelle note
      onEditorClose?.();
      await fetchNotes();
    } catch (err) {
      alert("Erreur lors de la synchronisation avec Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const verifyPassword = async () => {
    if (!passwordVerify?.value) return;
    const { id, value, action } = passwordVerify;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: value,
      });

      if (!error) {
        if (action === "TOGGLE_LOCK") {
          await executeToggleLock();
        } else {
          setUnlockedNotes((prev) => new Set(prev).add(id));
          const note = notes.find((n) => n.id === id) || null;
          if (note) setViewingNote(note);
        }
        setPasswordVerify(null);
      } else {
        setAuthError("Mot de passe de session incorrect");
      }
    } catch {
      setAuthError("Erreur technique");
    }
  };

  const startInlineEdit = () => {
    if (!viewingNote) return;
    setViewingEdit(true);
    setViewDraft({
      title: viewingNote.title,
      content: viewingNote.content,
      is_protected: viewingNote.is_protected,
    });
    setTimeout(() => {
      editorRef.current?.focus();
      const el = editorRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 0);
  };

  const cancelInlineEdit = () => {
    setViewingEdit(false);
    setViewDraft(null);
  };

  const sanitizeFragment = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const allowed = new Set(["P", "H1", "H2", "H3", "STRONG", "EM", "U", "SPAN", "BR", "DIV"]);
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    const toRemove: Element[] = [];
    while (walker.nextNode()) {
      const el = walker.currentNode as Element;
      if (!allowed.has(el.tagName)) toRemove.push(el);
      // Remove event handlers and javascript: hrefs
      [...el.attributes].forEach((attr) => {
        const n = attr.name.toLowerCase();
        const v = attr.value;
        if (n.startsWith("on")) el.removeAttribute(attr.name);
        if (n === "href" && v.trim().toLowerCase().startsWith("javascript"))
          el.removeAttribute(attr.name);
        if (n === "style") {
          // allow only color, background-color, font-weight, font-style, text-decoration
          const safe = v
            .split(";")
            .map((d) => d.trim())
            .filter(
              (d) =>
                d.startsWith("color") ||
                d.startsWith("background-color") ||
                d.startsWith("font-weight") ||
                d.startsWith("font-style") ||
                d.startsWith("text-decoration")
            )
            .join(";");
          el.setAttribute("style", safe);
        }
      });
    }
    toRemove.forEach((el) => el.replaceWith(...Array.from(el.childNodes)));
    return doc.body.innerHTML;
  };

  const handlePasteSanitized = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html") || e.clipboardData.getData("text/plain");
    const safe = sanitizeFragment(html);
    document.execCommand("insertHTML", false, safe);
  };

  const applyFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value || "");
    if (viewingEdit && editorRef.current) {
      setViewDraft((prev) => (prev ? { ...prev, content: editorRef.current!.innerHTML } : prev));
    } else if (isEditing && activeEditorRef.current) {
      setActiveNote((prev) => ({ ...prev, content: activeEditorRef.current!.innerHTML }));
    }
  };
  const applyBgColor = (color: string) => {
    const ok = document.execCommand("hiliteColor", false, color);
    if (!ok) document.execCommand("backColor", false, color);
    if (viewingEdit && editorRef.current) {
      setViewDraft((prev) => (prev ? { ...prev, content: editorRef.current!.innerHTML } : prev));
    } else if (isEditing && activeEditorRef.current) {
      setActiveNote((prev) => ({ ...prev, content: activeEditorRef.current!.innerHTML }));
    }
  };

  const saveInlineEdit = async () => {
    if (!viewingNote || !viewDraft) return;
    setSaving(true);
    try {
      const payload = {
        title: viewDraft.title.trim(),
        content: viewDraft.content,
        is_protected: viewDraft.is_protected,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("notes").update(payload).eq("id", viewingNote.id);
      if (error) throw error;
      const updated: ProtectedNote = {
        ...viewingNote,
        ...payload,
        updatedAt: new Date().toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
      } as any;
      setViewingNote(updated);
      setViewingEdit(false);
      setViewDraft(null);
      await fetchNotes();
    } catch {
      alert("Erreur lors de la synchronisation avec Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const getModalContent = () => {
    if (!passwordVerify)
      return {
        title: "Note Verrouillée",
        msg: "Saisissez votre mot de passe de session pour débloquer le contenu.",
        btn: "Déverrouiller",
        icon: "fa-lock",
      };

    const targetNote =
      viewingNote?.id === passwordVerify.id
        ? viewingNote
        : notes.find((n) => n.id === passwordVerify.id);
    const isProtected = targetNote?.is_protected;

    if (passwordVerify.action === "TOGGLE_LOCK") {
      if (isProtected) {
        return {
          title: "Déverrouillage",
          msg: "Saisissez votre mot de passe pour retirer la protection de cette note.",
          btn: "Déverrouiller",
          icon: "fa-lock-open",
        };
      } else {
        return {
          title: "Verrouillage",
          msg: "Par sécurité, saisissez votre mot de passe pour verrouiller cette note.",
          btn: "Verrouiller",
          icon: "fa-lock",
        };
      }
    }

    return {
      title: "Contenu Protégé",
      msg: "Cette note est verrouillée. Saisissez votre mot de passe pour y accéder.",
      btn: "Accéder",
      icon: "fa-shield-halved",
    };
  };

  const modalContent = getModalContent();

  return (
    <div className="space-y-8 animate-slide-up relative">
      {/* Barre de recherche et Action globale */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full max-w-2xl">
          <input
            type="text"
            placeholder={mode === "flash" ? "Rechercher une Flash Note..." : "Rechercher une note..."}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-none shadow-inner focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            name="search-notes-procedio"
          />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        </div>
        
         {/* FLASH MODE HEADER EXTRA */}
         {mode === "flash" && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 animate-pulse">
               <i className="fa-solid fa-bolt"></i>
               <span className="font-bold text-xs uppercase tracking-wider">Mode Flash</span>
            </div>
         )}

        {/* CREATE BUTTON: Hidden for Technicians in Flash Mode */}
        {!(mode === "flash" && user?.role === UserRole.TECHNICIAN) && (
          <button
            onClick={handleAddNew}
            className={`w-full lg:w-auto px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 ${
              mode === "flash" 
              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200"
              : "bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-100"
            }`}>
            <i className="fa-solid fa-plus-circle text-lg"></i> {mode === "flash" ? "Créer une flash note" : "Créer une note"}
          </button>
        )}
      </div>

      {mode === "flash" && user?.role === UserRole.MANAGER && (
         <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                  <i className="fa-solid fa-lightbulb"></i>
               </div>
               <div>
                  <h4 className="font-bold text-amber-800 text-sm uppercase tracking-wide">Suggestions en attente</h4>
                  <p className="text-xs text-amber-600">Validez les propositions de votre équipe.</p>
               </div>
            </div>
         </div>
      )}

      {/* LISTE DES NOTES - MODE FLASH (GRID) vs PERSONAL (LIST) */}
      <div className={mode === "flash" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
        {notes
          .filter(
            (note) =>
              note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              note.content.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((note) => {
             // Generate dynamic pastel color for Flash Cards based on index/id
             const colors = ["bg-sky-100", "bg-emerald-100", "bg-violet-100", "bg-amber-100", "bg-rose-100"];
             const colorIndex = note.id.charCodeAt(0) % colors.length;
             const cardColor = mode === "flash" ? colors[colorIndex] : "bg-white";
             const borderClass = mode === "flash" ? "border-transparent" : "border-slate-200";

             return (
             <div
              key={note.id}
              onClick={() => {
                if (note.is_protected && !unlockedNotes.has(note.id)) {
                  setPasswordVerify({ id: note.id, value: "", action: "UNLOCK" });
                } else {
                  setViewingNote(note);
                }
              }}
              className={mode === "flash" 
                ? `group hover:scale-[1.02] active:scale-95 transition-all duration-300 rounded-3xl p-6 relative cursor-pointer flex flex-col h-64 shadow-md hover:shadow-xl ${cardColor} border ${borderClass}`
                : `group hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 rounded-2xl p-5 relative cursor-pointer flex flex-row items-center gap-6 shadow-sm hover:shadow-lg ${cardColor} border ${borderClass}`
              }>
              
              {mode === "flash" ? (
                // FLASH MODE: Vertical Card
                <>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-black text-xl line-clamp-2 text-slate-800" style={{ wordBreak: 'break-word' }}>
                      {note.title}
                    </h3>
                    {note.is_protected ? (
                      unlockedNotes.has(note.id) ? (
                        <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                          <i className="fa-solid fa-lock-open text-xs"></i>
                        </span>
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm">
                          <i className="fa-solid fa-lock text-xs"></i>
                        </span>
                      )
                    ) : (
                      <span className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 text-slate-500">
                        <i className="fa-solid fa-eye text-xs"></i>
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-hidden text-sm leading-relaxed mb-4 relative text-slate-600 font-medium">
                    <div dangerouslySetInnerHTML={{ __html: note.is_protected && !unlockedNotes.has(note.id) ? "🔒 Contenu protégé..." : note.content }} />
                    <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-${cardColor.replace("bg-", "")} to-transparent pointer-events-none`}></div>
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {note.updatedAt}
                    </span>
                    
                    <div className="flex gap-2">
                      {!note.is_protected && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(note.content.replace(/<[^>]*>?/gm, ''));
                            alert("Copié !"); 
                          }}
                          className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-600 shadow-sm flex items-center justify-center transition-all"
                          title="Copier le texte">
                          <i className="fa-regular fa-copy"></i>
                        </button>
                      )}

                      <button
                        onClick={(e) => handleDelete(e, note.id)}
                        className="w-8 h-8 rounded-full hover:bg-rose-50 hover:text-rose-500 text-slate-300 transition-colors flex items-center justify-center z-10"
                        title="Supprimer">
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                // PERSONAL MODE: Horizontal List Item
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-bold text-lg text-slate-900 line-clamp-1" style={{ wordBreak: 'break-word' }}>
                        {note.title}
                      </h3>
                      {note.is_protected && (
                        <span className="shrink-0 w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                          <i className="fa-solid fa-lock text-[10px]"></i>
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 line-clamp-2 mb-3" dangerouslySetInnerHTML={{ __html: note.is_protected && !unlockedNotes.has(note.id) ? "🔒 Contenu protégé..." : note.content }} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {note.updatedAt}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, note.id)}
                      className="w-9 h-9 rounded-xl hover:bg-rose-50 hover:text-rose-500 text-slate-300 transition-colors flex items-center justify-center"
                      title="Supprimer">
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                  </div>
                </>
              )}
            </div>
            );
          })}
      </div>

      {/* MODALE ÉDITEUR PLEIN ÉCRAN */}
      {isEditing &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slide-up">
            <header className="h-20 border-b border-slate-100 px-6 md:px-12 flex items-center justify-between bg-white sticky top-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setSearchTerm("");
                    onEditorClose?.();
                  }}
                  className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
                <h3 className="font-bold text-slate-400 uppercase tracking-[0.2em] text-[10px]">
                  {activeNote.id ? "Mode Édition" : "Nouveau Brouillon"}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    setActiveNote({ ...activeNote, is_protected: !activeNote.is_protected })
                  }
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeNote.is_protected ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
                  <i
                    className={`fa-solid ${activeNote.is_protected ? "fa-lock" : "fa-lock-open"}`}></i>
                  {activeNote.is_protected ? "Protégée" : "Publique"}
                </button>

                {/* PROPOSE AS FLASH NOTE BUTTON (Technician + Personal Mode) */}
                {mode === "personal" && user?.role === UserRole.TECHNICIAN && (
                   <button
                     onClick={async () => {
                        // Logic similar to save but setting status='suggestion'
                        if (!activeNote.title.trim()) return;
                        setSaving(true);
                        try {
                           const payload = {
                              title: activeNote.title.trim(),
                              content: activeNote.content,
                              is_protected: activeNote.is_protected,
                              user_id: user.id,
                              updated_at: new Date().toISOString(),
                              status: 'suggestion',
                              category: 'general'
                           };
                           let result;
                           if (activeNote.id) {
                              result = await supabase.from("notes").update(payload).eq("id", activeNote.id);
                           } else {
                              result = await supabase.from("notes").insert([payload]);
                           }
                           if (result.error) throw result.error;
                           
                           // Create notification for Manager
                           await supabase.from("notes").insert([{
                              title: `FLASH_NOTE_SUGGESTION`,
                              content: `${user.firstName} ${user.lastName || ""} a proposé une Flash Note: "${activeNote.title.trim()}"`,
                              is_protected: false,
                              user_id: user.id,
                              tags: ["FLASH_NOTE", "SUGGESTION"],
                           }]);

                           setSuccessModal({
                              title: "Flash Note Proposée !",
                              message: "Votre suggestion a été envoyée au manager. Vous serez notifié de sa décision.",
                              icon: "fa-lightbulb"
                           });
                           setIsEditing(false);
                           setSearchTerm("");
                           onEditorClose?.();
                           await fetchNotes();
                        } catch (err) {
                           setSuccessModal({
                              title: "Erreur",
                              message: "Impossible de proposer la note. Veuillez réessayer.",
                              icon: "fa-triangle-exclamation"
                           });
                        } finally {
                           setSaving(false);
                        }
                     }}
                     className="bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2 shadow-xl shadow-amber-100">
                     <i className="fa-solid fa-lightbulb"></i> Proposer
                   </button>
                )}

                <button
                  onClick={saveNote}
                  disabled={saving || !activeNote.title.trim()}
                  className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-indigo-100">
                  {saving ? (
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                  ) : (
                    <i className="fa-solid fa-floppy-disk"></i> // Changed icon for clarity
                  )}
                  Enregistrer
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 md:p-20 max-w-5xl mx-auto w-full space-y-12">
              <input
                type="text"
                placeholder="Titre de la note..."
                className="w-full text-4xl md:text-6xl font-black text-slate-900 border-none outline-none placeholder:text-slate-200 tracking-tighter bg-transparent"
                value={activeNote.title}
                onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                autoFocus
              />
              <textarea
                placeholder="Commencez à documenter ici..."
                className="w-full h-[60vh] text-lg md:text-2xl text-slate-600 border-none outline-none resize-none leading-relaxed placeholder:text-slate-200 font-medium bg-transparent"
                value={activeNote.content}
                onChange={(e) => setActiveNote({ ...activeNote, content: e.target.value })}
              />
            </main>
          </div>,
          document.body
        )}

      {/* POPUP DÉVERROUILLAGE (MODALE CENTRÉE) */}
      {passwordVerify &&
        createPortal(
          <div
            className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => {
              setPasswordVerify(null);
              setAuthError(null);
            }}>
            <div
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6 transform scale-100 animate-slide-up"
              onClick={(e) => e.stopPropagation()}>
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg shadow-amber-100">
                  <i className={`fa-solid ${modalContent.icon}`}></i>
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {modalContent.title}
                </h3>
                <p className="text-xs font-medium text-slate-400">{modalContent.msg}</p>
              </div>

              <div className="space-y-4">
                <input
                  type="password"
                  placeholder="Mot de passe de session..."
                  autoFocus
                  autoComplete="off"
                  name="unlock-password"
                  inputMode="none"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-amber-500 outline-none transition-all font-bold text-slate-700 text-center placeholder:font-medium"
                  value={passwordVerify.value}
                  onChange={(e) => {
                    setPasswordVerify({ ...passwordVerify, value: e.target.value });
                    setAuthError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
                />

                {authError && (
                  <div className="bg-rose-50 text-rose-500 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-rose-100">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    {authError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setPasswordVerify(null);
                      setAuthError(null);
                    }}
                    className="py-4 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">
                    Annuler
                  </button>
                  <button
                    onClick={() => verifyPassword()}
                    className="py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-colors shadow-lg shadow-indigo-100">
                    {modalContent.btn}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* SUCCESS/ERROR MODAL */}
      {successModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[3000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSuccessModal(null)}>
            <div
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6 transform scale-100 animate-slide-up"
              onClick={(e) => e.stopPropagation()}>
              <div className="text-center space-y-4">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-3xl shadow-2xl ${
                  successModal.icon === "fa-lightbulb" 
                    ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" 
                    : "bg-gradient-to-br from-rose-400 to-rose-600 text-white"
                }`}>
                  <i className={`fa-solid ${successModal.icon}`}></i>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {successModal.title}
                </h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  {successModal.message}
                </p>
              </div>

              <button
                onClick={() => setSuccessModal(null)}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:scale-105 transition-all shadow-lg shadow-indigo-200">
                Compris !
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* MODALE LECTURE FOCUS PLEIN ÉCRAN */}
      {viewingNote &&
        createPortal(
          <div
            className="fixed inset-0 z-[2000] bg-white flex flex-col animate-slide-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-title">
            <header className="h-20 border-b border-slate-100 px-6 md:px-12 flex items-center justify-between bg-white sticky top-0 shrink-0">
              <div className="flex items-center gap-4">
                <button
                  ref={backBtnRef}
                  onClick={handleCloseNote}
                  className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Fermer la lecture et revenir à la liste">
                  <i className="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest max-w-[200px] truncate">
                    {viewingNote.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      {viewingNote.updatedAt}
                    </span>
                    {viewingNote.is_protected && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                        <i className="fa-solid fa-lock mr-1"></i>Privé
                      </span>
                    )}
                    {viewingNote.status === "suggestion" && (
                       <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md animate-pulse">
                        Suggestion
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* MANAGER VALIDATION BUTTONS */}
                {viewingNote.status === "suggestion" && user?.role === UserRole.MANAGER && (
                   <div className="flex items-center gap-2 mr-4 border-r border-slate-100 pr-4">
                      <button
                         onClick={async (e) => {
                            e.stopPropagation();
                            if(!confirm("Valider cette Flash Note pour toute l'équipe ?")) return;
                            try {
                               const { error } = await supabase.from('notes').update({ status: 'public' }).eq('id', viewingNote.id);
                               if(error) throw error;
                               
                               // Create notification for Technician
                               await supabase.from("flash_note_responses").insert([{
                                  note_id: viewingNote.id,
                                  user_id: viewingNote.user_id,
                                  manager_id: user?.id,
                                  status: 'approved',
                                  manager_response: "Votre Flash Note a été validée et est maintenant visible par toute l'équipe !",
                                  note_title: viewingNote.title,
                                  note_content: viewingNote.content,
                                  read: false
                               }]);

                               alert("Flash Note validée !");
                               handleCloseNote();
                               fetchNotes();
                            } catch (err) {
                               console.error("Error validating flash note:", err);
                               alert("Erreur lors de la validation.");
                            }
                         }}
                         className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                      >
                         <i className="fa-solid fa-check"></i> Valider
                      </button>
                      <button
                         onClick={async (e) => {
                            e.stopPropagation();
                            if(!confirm("Refuser cette suggestion ? Elle redeviendra privée pour l'auteur.")) return;
                            try {
                               const { error } = await supabase.from('notes').update({ status: 'private' }).eq('id', viewingNote.id);
                               if(error) throw error;
                               
                               // Create notification for Technician
                               await supabase.from("flash_note_responses").insert([{
                                  note_id: viewingNote.id,
                                  user_id: viewingNote.user_id,
                                  manager_id: user?.id,
                                  status: 'rejected',
                                  manager_response: "Votre suggestion de Flash Note a été refusée. Elle reste privée.",
                                  note_title: viewingNote.title,
                                  note_content: viewingNote.content,
                                  read: false
                               }]);

                               alert("Suggestion refusée.");
                               handleCloseNote();
                               fetchNotes();
                            } catch (err) {
                               console.error("Error refusing flash note:", err);
                               alert("Erreur lors du refus.");
                            }
                         }}
                         className="px-4 py-2 bg-white text-rose-500 border border-rose-100 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all"
                      >
                         Refuser
                      </button>
                   </div>
                )}

                <button
                  onClick={toggleLockStatus}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    viewingNote.is_protected
                      ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  }`}
                  title={
                    viewingNote.is_protected ? "Retirer la protection" : "Protéger cette note"
                  }>
                  <i
                    className={`fa-solid ${
                      viewingNote.is_protected ? "fa-lock" : "fa-lock-open"
                    }`}></i>
                </button>
                <button
                  onClick={(e) => handleDelete(e as any, viewingNote.id)}
                  className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  title="Supprimer">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
                {viewingEdit ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveInlineEdit}
                      disabled={saving || !viewDraft?.title.trim()}
                      className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-slate-900 transition-all font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                      title="Enregistrer">
                      <i className="fa-solid fa-cloud-arrow-up"></i> Enregistrer
                    </button>
                    <button
                      onClick={cancelInlineEdit}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-bold text-[10px] uppercase tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      title="Annuler l'édition">
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startInlineEdit}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-slate-900 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    title="Modifier">
                    <i className="fa-solid fa-pen-to-square"></i> Modifier
                  </button>
                )}
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 md:p-20 w-full">
              <div className="max-w-5xl mx-auto w-full space-y-6">
                {viewingEdit ? (
                  <>
                    <input
                      type="text"
                      value={viewDraft?.title || ""}
                      onChange={(e) =>
                        setViewDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))
                      }
                      className="w-full text-4xl md:text-6xl font-black text-slate-900 border-none outline-none bg-transparent"
                      aria-label="Titre de la note"
                    />
                    <div className="flex flex-wrap items-center gap-2 bg-white sticky top-20 z-10 p-2 rounded-xl border border-slate-100 shadow-sm">
                      <button
                        className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center"
                        onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }}
                        title="Gras">
                        <i className="fa-solid fa-bold"></i>
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center"
                        onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }}
                        title="Italique">
                        <i className="fa-solid fa-italic"></i>
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center"
                        onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }}
                        title="Souligné">
                        <i className="fa-solid fa-underline"></i>
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1"></div>
                      <button
                        className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center"
                        onMouseDown={(e) => { e.preventDefault(); applyFormat("insertUnorderedList"); }}
                        title="Liste à puces">
                        <i className="fa-solid fa-list-ul"></i>
                      </button>
                      <button
                        className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition-colors flex items-center justify-center"
                        onMouseDown={(e) => { e.preventDefault(); applyFormat("insertOrderedList"); }}
                        title="Liste numérotée">
                        <i className="fa-solid fa-list-ol"></i>
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1"></div>
                      <button
                        className="px-3 py-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 font-bold text-xs transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); applyFormat("formatBlock", "H1"); }}
                        title="Grand titre">
                        H1
                      </button>
                      <button
                        className="px-3 py-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 font-bold text-xs transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); applyFormat("formatBlock", "H2"); }}
                        title="Sous-titre">
                        H2
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1"></div>
                      <div className="flex items-center gap-1">
                        {["#fff59d", "#bbdefb", "#c8e6c9", "#ffe0b2"].map((c) => (
                          <button
                            key={c}
                            className="w-6 h-6 rounded-md border border-slate-200 hover:scale-110 transition-transform shadow-sm"
                            style={{ backgroundColor: c }}
                            aria-label={`Surlignage ${c}`}
                            onMouseDown={(e) => { e.preventDefault(); applyBgColor(c); }}
                          />
                        ))}
                      </div>
                    </div>
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="min-h-[50vh] text-lg md:text-2xl text-slate-800 leading-loose outline-none"
                      onInput={() =>
                        setViewDraft((prev) =>
                          prev ? { ...prev, content: editorRef.current?.innerHTML || "" } : prev
                        )
                      }
                      onPaste={handlePasteSanitized}
                      aria-label="Contenu de la note"
                    />
                  </>
                ) : (
                  <>
                    <h1
                      id="note-title"
                      className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
                      {viewingNote.title}
                    </h1>
                    <div
                      className="prose prose-xl prose-slate max-w-none text-slate-800 font-medium leading-loose"
                      dangerouslySetInnerHTML={{ __html: viewingNote.content }}
                    />
                  </>
                )}
              </div>
            </main>
          </div>,
          document.body
        )}


    </div>
  );
};

export default Notes;
