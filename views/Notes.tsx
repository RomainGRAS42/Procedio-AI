import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Note } from "../types";
import { supabase } from "../lib/supabase";

interface ProtectedNote extends Note {
  is_protected: boolean;
  user_id?: string;
}

interface NotesProps {
  initialIsAdding?: boolean;
  onEditorClose?: () => void;
}

const Notes: React.FC<NotesProps> = ({ initialIsAdding = false, onEditorClose }) => {
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

  // Sécurité & Synchro
  const [unlockedNotes, setUnlockedNotes] = useState<Set<string>>(new Set());
  const [passwordVerify, setPasswordVerify] = useState<{ id: string; value: string } | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
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

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (data) {
        // FILTRAGE : On ignore les notes qui sont des logs techniques
        const userNotes = data
          .filter(
            (n) => n.title && !n.title.startsWith("LOG_VIEW_") && !n.title.startsWith("LOG_READ_")
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
          }));
        setNotes(userNotes);
      }
    } catch (err) {
      console.error("Erreur de récupération des notes:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewingNote(null);
    };
    if (viewingNote) {
      backBtnRef.current?.focus();
      window.addEventListener("keydown", handler);
    }
    return () => window.removeEventListener("keydown", handler);
  }, [viewingNote]);

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
      };

      let result;
      if (activeNote.id) {
        result = await supabase.from("notes").update(payload).eq("id", activeNote.id);
      } else {
        result = await supabase.from("notes").insert([payload]);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: passwordVerify.value,
      });

      if (!error) {
        setUnlockedNotes((prev) => new Set(prev).add(noteId));
        const note = notes.find((n) => n.id === noteId) || null;
        if (note) setViewingNote(note);
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
    if (editorRef.current) {
      setViewDraft((prev) => (prev ? { ...prev, content: editorRef.current!.innerHTML } : prev));
    }
  };
  const applyBgColor = (color: string) => {
    const ok = document.execCommand("hiliteColor", false, color);
    if (!ok) document.execCommand("backColor", false, color);
    if (editorRef.current) {
      setViewDraft((prev) => (prev ? { ...prev, content: editorRef.current!.innerHTML } : prev));
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
          className="w-full lg:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95">
          <i className="fa-solid fa-plus-circle text-lg"></i> Créer une note
        </button>
      </div>

      {/* MODALE ÉDITEUR PLEIN ÉCRAN */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slide-up">
          <header className="h-20 border-b border-slate-100 px-6 md:px-12 flex items-center justify-between bg-white sticky top-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setIsEditing(false);
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
              <button
                onClick={saveNote}
                disabled={saving || !activeNote.title.trim()}
                className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl">
                {saving ? (
                  <i className="fa-solid fa-circle-notch animate-spin"></i>
                ) : (
                  <i className="fa-solid fa-cloud-arrow-up"></i>
                )}
                Synchroniser
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
        </div>
      )}

      {/* POPUP DÉVERROUILLAGE (MODALE CENTRÉE) */}
      {passwordVerify &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => {
              setPasswordVerify(null);
              setAuthError(null);
            }}>
            <div
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6 transform scale-100 animate-slide-up"
              onClick={(e) => e.stopPropagation()}>
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg shadow-amber-100">
                  <i className="fa-solid fa-lock"></i>
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Note Verrouillée
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Saisissez votre mot de passe de session pour débloquer le contenu.
                </p>
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
                  onKeyDown={(e) => e.key === "Enter" && verifyPassword(passwordVerify.id)}
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
                    onClick={() => verifyPassword(passwordVerify.id)}
                    className="py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 transition-colors shadow-lg hover:shadow-amber-200">
                    Déverrouiller
                  </button>
                </div>
              </div>
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
                  onClick={() => {
                    setViewingEdit(false);
                    setViewDraft(null);
                    setViewingNote(null);
                  }}
                  className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Fermer la lecture et revenir à la liste">
                  <i className="fa-solid fa-arrow-left text-lg"></i>
                </button>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                    Lecture Zen
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
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
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
                      className="px-6 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-blue-700 transition-all font-bold text-xs uppercase tracking-widest shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
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
                    className="px-6 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-blue-700 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase"
                        onClick={() => applyFormat("bold")}>
                        Gras
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase"
                        onClick={() => applyFormat("italic")}>
                        Italique
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase"
                        onClick={() => applyFormat("underline")}>
                        Souligné
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase"
                        onClick={() => applyFormat("insertUnorderedList")}>
                        Puces
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase"
                        onClick={() => applyFormat("insertOrderedList")}>
                        Numérotation
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase"
                        onClick={() => applyFormat("formatBlock", "H1")}>
                        H1
                      </button>
                      <button
                        className="px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold text-xs uppercase"
                        onClick={() => applyFormat("formatBlock", "H2")}>
                        H2
                      </button>
                      <div className="flex items-center gap-1 ml-2">
                        {["#fff59d", "#bbdefb", "#c8e6c9", "#ffe0b2"].map((c) => (
                          <button
                            key={c}
                            className="w-6 h-6 rounded-md border border-slate-200"
                            style={{ backgroundColor: c }}
                            aria-label={`Surlignage ${c}`}
                            onClick={() => applyBgColor(c)}
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

      {/* Grille des notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
        {loading ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest animate-pulse">
              Accès au coffre-fort...
            </p>
          </div>
        ) : (
          notes
            .filter(
              (n) =>
                n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                n.content.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((note) => {
              const isLocked = note.is_protected && !unlockedNotes.has(note.id);
              const isProtectedAndUnlocked = note.is_protected && unlockedNotes.has(note.id);

              return (
                <div
                  key={note.id}
                  className={`group glass-card p-8 flex flex-col min-h-[350px] transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl relative overflow-hidden border-none ${isLocked ? "cursor-default" : "cursor-pointer"}`}
                  onClick={() => !isLocked && setViewingNote(note)}>
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="bg-white/50 backdrop-blur-md rounded-xl px-4 py-2 border border-white shadow-sm flex items-center gap-3">
                      <i className="fa-solid fa-calendar-day text-blue-500 text-[11px]"></i>
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {note.updatedAt}
                      </span>
                    </div>
                    {!isLocked && (
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isProtectedAndUnlocked && (
                          <button
                            onClick={(e) => handleLock(e, note.id)}
                            className="w-10 h-10 bg-amber-50 rounded-xl shadow-lg border border-amber-100 text-amber-500 hover:text-amber-700 hover:border-amber-300 transition-all flex items-center justify-center"
                            title="Re-verrouiller la note">
                            <i className="fa-solid fa-lock text-sm"></i>
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(e, note.id)}
                          className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-50 text-rose-400 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center"
                          title="Supprimer la note">
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(note);
                          }}
                          className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-50 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all flex items-center justify-center"
                          title="Modifier la note">
                          <i className="fa-solid fa-pencil text-sm"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  <h4 className="font-black text-slate-900 text-2xl group-hover:text-blue-600 transition-colors line-clamp-2 mb-6 leading-tight tracking-tight relative z-10">
                    {note.title}
                  </h4>

                  <div className="relative flex-1 z-10">
                    <p
                      className={`text-slate-500 text-base leading-relaxed line-clamp-5 font-medium ${isLocked ? "blur-2xl select-none opacity-10" : ""}`}>
                      {note.content || "Aucune description."}
                    </p>

                    {isLocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                        {passwordVerify?.id === note.id ? (
                          <div
                            className="w-full space-y-4 animate-slide-up"
                            onClick={(e) => e.stopPropagation()}>
                            <input
                              type="password"
                              placeholder="Mot de passe session"
                              autoFocus
                              autoComplete="off"
                              name="unlock-password-inline"
                              inputMode="none"
                              autoCapitalize="none"
                              spellCheck={false}
                              className="w-full p-4 rounded-2xl border-2 border-slate-100 text-xs text-center outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                              value={passwordVerify.value}
                              onChange={(e) => {
                                setPasswordVerify({ ...passwordVerify, value: e.target.value });
                                setAuthError(null);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && verifyPassword(note.id)}
                            />
                            {authError && (
                              <p className="text-[9px] text-rose-500 font-black uppercase animate-bounce">
                                {authError}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => verifyPassword(note.id)}
                                className="flex-1 py-3 bg-slate-900 text-white text-[10px] font-black rounded-xl uppercase tracking-widest">
                                Valider
                              </button>
                              <button
                                onClick={() => setPasswordVerify(null)}
                                className="px-4 py-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200">
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPasswordVerify({ id: note.id, value: "" });
                            }}
                            className="w-20 h-20 bg-white shadow-2xl rounded-3xl flex items-center justify-center text-amber-500 border-4 border-white hover:scale-110 transition-transform active:scale-95 group/lock">
                            <i className="fa-solid fa-lock text-3xl group-hover/lock:fa-unlock-keyhole"></i>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!isLocked && (
                    <div className="mt-8 pt-6 border-t border-slate-100/50 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Lire en plein écran <i className="fa-solid fa-arrow-right ml-1"></i>
                      </span>
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
