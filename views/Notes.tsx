import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Note, User, UserRole } from "../types";
import { supabase } from "../lib/supabase";
import CustomToast from "../components/CustomToast";
import LoadingState from "../components/LoadingState";

interface ProtectedNote extends Note {
  is_protected: boolean;
  user_id?: string;
  author_role?: UserRole; // To track if author was technician/manager
  createdAt?: string;
  is_flash_note?: boolean; 
  folder_id?: string;
  author_name?: string;
}

interface NoteFolder {
  id: string;
  name: string;
  icon: string;
  mode: "personal" | "flash";
  count?: number;
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
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isManagingFolders, setIsManagingFolders] = useState(false);

  // États pour l'édition/création (Mode Plein Écran)
  const [isEditing, setIsEditing] = useState(false);
  const [activeNote, setActiveNote] = useState<{
    id?: string;
    title: string;
    content: string;
    is_protected: boolean;
    folder_id?: string;
  }>({
    title: "",
    content: "",
    is_protected: false,
    folder_id: "",
  });

  const [folderForm, setFolderForm] = useState<{
    id?: string;
    name: string;
    icon: string;
  } | null>(null);

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
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'success' | 'danger';
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const backBtnRef = useRef<HTMLButtonElement | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    fetchNotes();
    fetchFolders();
  }, [mode, user]);

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

  const fetchNotes = async (silent = false) => {
    if (!silent) setLoading(true);

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
        .select(`
          *,
          author:user_profiles!user_id(first_name, last_name)
        `)
        .order("created_at", { ascending: false }); // Changé en created_at pour que la nouvelle reste en haut

      // STRIKINGLY STRICT FILTERING
      if (currentUserId) {
        if (mode === "flash") {
          // FLASH MODE: Everything IS a Flash Note (public or suggestion)
          if (user?.role === UserRole.MANAGER) {
             // Managers see ALL flash notes
             query = query.eq('is_flash_note', true);
          } else {
             // Technicians: Public Flash Notes + My Suggestions
             query = query.eq('is_flash_note', true)
                          .or(`status.eq.public,and(status.eq.suggestion,user_id.eq.${currentUserId})`);
          }
        } else {
          // PERSONAL MODE: Only MY notes that are NOT flash notes
          query = query.eq("user_id", currentUserId).eq('is_flash_note', false);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const userNotes = data
          .filter(
            (n) => n.title && 
                   !n.title.startsWith("LOG_") && 
                   !n.title.startsWith("CONSULTATION_") && 
                   !n.title.startsWith("SUGGESTION_") && 
                   !n.title.startsWith("FLASH_NOTE_") &&
                   !n.title.startsWith("NOUVEAU_") &&
                   n.title !== "expert_synthesis"
          )
          .map((n) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            is_protected: n.is_protected || false,
            is_flash_note: n.is_flash_note || false,  // CRITICAL: needed for read-only protection
            tags: n.tags || [],
            updatedAt: new Date(n.updated_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            createdAt: new Date(n.created_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }),
            user_id: n.user_id,
            author_name: n.author ? `${n.author.first_name} ${n.author.last_name}` : "Inconnu",
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

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from("note_folders")
        .select("*")
        .eq("mode", mode)
        .order("name", { ascending: true });

      if (error) throw error;
      if (data) setFolders(data);
    } catch (err) {
      console.error("Erreur de récupération des dossiers:", err);
    }
  };

  const handleSaveFolder = async () => {
    if (!folderForm || !folderForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: folderForm.name.trim(),
        icon: folderForm.icon || "fa-folder",
        user_id: user?.id,
        mode: mode
      };

      let result;
      if (folderForm.id) {
        result = await supabase.from("note_folders").update(payload).eq("id", folderForm.id);
      } else {
        result = await supabase.from("note_folders").insert([payload]);
      }

      if (result.error) throw result.error;

      setToast({ message: folderForm.id ? "Dossier renommé !" : "Dossier créé !", type: "success" });
      setFolderForm(null);
      fetchFolders();
    } catch (err) {
      console.error("Erreur action dossier:", err);
      setToast({ message: "Échec de l'action sur le dossier", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    setConfirmModal({
      title: "Supprimer le dossier ?",
      message: "Les notes à l'intérieur ne seront pas supprimées mais deviendront 'Sans Dossier'.",
      confirmText: "Supprimer",
      type: "danger",
      onConfirm: async () => {
        try {
          const { error } = await supabase.from("note_folders").delete().eq("id", folderId);
          if (error) throw error;
          
          setToast({ message: "Dossier supprimé", type: "success" });
          setConfirmModal(null);
          setCurrentFolderId(null);
          fetchFolders();
          fetchNotes();
        } catch (err) {
          console.error("Erreur suppression dossier:", err);
          setToast({ message: "Échec de la suppression", type: "error" });
        }
      }
    });
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

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Date inconnue";
    try {
      return new Date(dateString).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
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
    
    // Security: Flash Notes cannot be locked/unlocked
    if (viewingNote.is_flash_note) {
      setToast({ message: "Action non autorisée sur une Flash Note.", type: "error" });
      return;
    }

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
      setToast({ message: "Erreur lors de la mise à jour de la protection.", type: "error" });
      // Rollback
      setViewingNote({ ...viewingNote, is_protected: !newStatus });
      fetchNotes();
    }
  };

  const toggleLockStatus = async () => {
    if (!viewingNote) return;
    
    // Security: Flash Notes cannot be locked/unlocked
    if (viewingNote.is_flash_note) {
      setToast({ message: "Action non autorisée sur une Flash Note.", type: "error" });
      return;
    }

    setPasswordVerify({ id: viewingNote.id, value: "", action: "TOGGLE_LOCK" });
  };

  const handleAddNew = () => {
    setActiveNote({ title: "", content: "", is_protected: false, folder_id: currentFolderId || "" });
    setIsEditing(true);
  };

  const handleEdit = (note: ProtectedNote) => {
    setActiveNote({
      id: note.id,
      title: note.title,
      content: note.content,
      is_protected: note.is_protected,
      folder_id: note.folder_id || "",
    });
    setIsEditing(true);
  };

  const handleDelete = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    
    // Recovery of the note to check its type
    const noteToDelete = notes.find(n => n.id === noteId);
    if (!noteToDelete) return;

    // Security: Technicians cannot delete Flash Notes
    if (noteToDelete.is_flash_note && user?.role === UserRole.TECHNICIAN) {
      setToast({
        message: "Action non autorisée : Les Flash Notes sont en lecture seule pour les techniciens.",
        type: "error"
      });
      return;
    }

    setConfirmModal({
      title: "Supprimer cette note ?",
      message: mode === "flash" 
        ? "Cette Flash Note sera définitivement supprimée de la base de connaissances." 
        : "Votre note personnelle sera définitivement supprimée.",
      confirmText: "Supprimer",
      cancelText: "Conserver",
      type: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from("notes").delete().eq("id", noteId);
          if (error) throw error;
          await fetchNotes();
          if (viewingNote?.id === noteId) handleCloseNote();
          setToast({ message: "Note supprimée avec succès.", type: "success" });
        } catch (err) {
          setToast({ message: "Erreur lors de la suppression.", type: "error" });
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleLock = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setUnlockedNotes((prev) => {
      const next = new Set(prev);
      next.delete(noteId);
      return next;
    });
  };

  const handlePublish = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("notes")
        .update({ status: 'public', updated_at: new Date().toISOString() })
        .eq("id", noteId);

      if (error) throw error;
      setToast({ message: "Flash Note publiée à toute l'équipe !", type: "success" });
      fetchNotes(true);
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la publication.", type: "error" });
    }
  };

  const saveNote = async () => {
    if (!activeNote.title.trim()) return;
    setSaving(true);
    try {
      // SECURITY CHECK: Technicians cannot create or edit Flash Notes directly
      if (mode === "flash" && user?.role === UserRole.TECHNICIAN) {
        setToast({ message: "Seul un manager peut créer ou modifier une Flash Note.", type: "error" });
        setSaving(false);
        return;
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Non autorisé");

      const payload = {
        title: activeNote.title.trim(),
        content: activeNote.content,
        is_protected: activeNote.is_protected,
        user_id: authUser.id,
        folder_id: activeNote.folder_id || null,
        updated_at: new Date().toISOString(),
        status: mode === "flash" ? (user?.role === UserRole.MANAGER ? "public" : "suggestion") : "private", 
        category: "general",
        is_flash_note: mode === "flash" // FIX: Assure que la note reste dans le filtre Flash
      };

      let result;
      if (activeNote.id) {
        result = await supabase.from("notes").update(payload).eq("id", activeNote.id).select(`
          *,
          author:user_profiles!user_id(first_name, last_name)
        `);
      } else {
        result = await supabase.from("notes").insert([payload]).select(`
          *,
          author:user_profiles!user_id(first_name, last_name)
        `);
      }

      if (result.error) throw result.error;

      // MISE À JOUR OPTIMISTE IMMÉDIATE
      if (result.data && result.data[0]) {
        const n = result.data[0];
        const newNoteFormatted: ProtectedNote = {
          id: n.id,
          title: n.title,
          content: n.content,
          is_protected: n.is_protected || false,
          is_flash_note: n.is_flash_note || false,
          tags: n.tags || [],
          updatedAt: new Date(n.updated_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
          createdAt: new Date(n.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
          user_id: n.user_id,
          author_name: n.author ? `${n.author.first_name} ${n.author.last_name}` : (user ? `${user.firstName} ${user.lastName}` : "Moi"),
          status: n.status || "private",
          category: n.category || "general",
          folder_id: n.folder_id
        };

        setNotes(prev => {
          const filtered = prev.filter(item => item.id !== newNoteFormatted.id);
          return [newNoteFormatted, ...filtered];
        });
      }

      setIsEditing(false);
      setSearchTerm("");
      onEditorClose?.();
      setToast({ message: "Note enregistrée avec succès !", type: "success" });
      // On rafraîchit quand même en fond pour être sûr
      fetchNotes(true);
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la synchronisation avec Supabase.", type: "error" });
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

    // SECURITY CHECK: Technicians cannot modify Public Flash Notes
    if (mode === "flash" && user?.role === UserRole.TECHNICIAN && viewingNote.status === 'public') {
      setToast({ message: "Seul un manager peut modifier une Flash Note publique.", type: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: viewDraft.title.trim(),
        content: viewDraft.content,
        is_protected: viewDraft.is_protected,
        updated_at: new Date().toISOString(),
      };
      
      const { data, error } = await supabase.from("notes").update(payload).eq("id", viewingNote.id).select(`
        *,
        author:user_profiles!user_id(first_name, last_name)
      `);

      if (error) throw error;
      
      if (data && data[0]) {
        const n = data[0];
        const updated: ProtectedNote = {
          ...viewingNote,
          ...payload,
          updatedAt: new Date(n.updated_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
          author_name: n.author ? `${n.author.first_name} ${n.author.last_name}` : viewingNote.author_name
        } as any;

        setViewingNote(updated);
        
        // MISE À JOUR OPTIMISTE DE LA LISTE
        setNotes(prev => prev.map(item => item.id === n.id ? updated : item));
      }

      setViewingEdit(false);
      setViewDraft(null);
      setToast({ message: "Modifications enregistrées !", type: "success" });
      fetchNotes(true); // Rafraîchissement silencieux
    } catch {
      setToast({ message: "Erreur lors de la synchronisation avec Supabase.", type: "error" });
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
    <div className="space-y-12 h-full flex flex-col pb-10 px-4 md:px-10 animate-fade-in">
      {/* Header Section matching Procedures.tsx */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0 pt-6">
        <div className="flex-1 w-full max-w-2xl relative">
          <input
            type="text"
            placeholder={mode === "flash" ? "Rechercher une Flash Note..." : "Rechercher une note..."}
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            name="search-notes-procedio"
          />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        </div>

        <div className="flex items-center gap-6">
          {/* ZONE 1 : UTILITAIRE (REFRESH) */}
          <div className="group relative">
            <button 
              onClick={() => fetchNotes()}
              className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all hover:shadow-lg active:scale-95"
            >
              <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
            </button>
          </div>

          <div className="h-8 w-px bg-slate-200"></div>

          {/* CREATE BUTTON */}
          {!(mode === "flash" && user?.role === UserRole.TECHNICIAN) && (
            <button
              onClick={handleAddNew}
              className={`px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all shadow-2xl active:scale-95 ${
                mode === "flash" 
                ? "bg-amber-500 text-white hover:bg-slate-900 shadow-amber-200"
                : "bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-200"
              }`}>
              <i className="fa-solid fa-plus text-sm"></i>
              <span>{mode === "flash" ? "Nouvelle Flash Note" : "Nouvelle Note"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 px-6">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${mode === 'flash' ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${mode === 'flash' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {mode === 'flash' ? 'Canal Flash Actif' : 'Espace Personnel'}
          </span>
        </div>
        <div className="h-4 w-px bg-slate-200"></div>
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
            {currentFolderId ? `${folders.find(f => f.id === currentFolderId)?.name || 'Dossier'} - ${notes.filter(n => n.folder_id === currentFolderId).length} éléments` : 'Dossiers'}
          </span>
      </div>

      <div className="flex-1 space-y-10">
        {!searchTerm && currentFolderId !== null && (
          <button 
            onClick={() => setCurrentFolderId(null)} 
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-arrow-left"></i> 
            Retour aux dossiers
          </button>
        )}

        <div className="min-h-[400px]">
          {loading && notes.length === 0 ? (
            <LoadingState message="Chargement des notes..." />
          ) : searchTerm ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {notes
                .filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(note => (
                  <NoteCard key={note.id} note={note} mode={mode} user={user} onDelete={handleDelete} onOpen={() => setViewingNote(note)} unlockedNotes={unlockedNotes} setPasswordVerify={setPasswordVerify} onPublish={handlePublish} />
                ))
              }
            </div>
          ) : currentFolderId === null ? (
            <div className="space-y-16">
              {/* RECENT NOTES SECTION */}
              {notes.length > 0 && (
                <div className="space-y-6 px-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Activités Récentes</h3>
                    </div>
                    <div className="h-px flex-1 bg-slate-100 mx-8"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {notes.slice(0, 4).map(note => (
                      <NoteCard key={note.id} note={note} mode={mode} user={user} onDelete={handleDelete} onOpen={() => setViewingNote(note)} unlockedNotes={unlockedNotes} setPasswordVerify={setPasswordVerify} onPublish={handlePublish} />
                    ))}
                  </div>
                </div>
              )}

              {/* FOLDERS SECTION */}
              <div className="space-y-8 px-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-6 bg-slate-400 rounded-full"></div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Mes Dossiers</h3>
                  </div>
                  <div className="h-px flex-1 bg-slate-100 mx-8"></div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {/* VIRTUAL FOLDER: UNCLASSIFIED/GENERAL */}
                  <FolderCard 
                    name="Général" 
                    icon="fa-box-archive" 
                    count={notes.filter(n => !n.folder_id).length} 
                    onClick={() => setCurrentFolderId("unclassified")} 
                  />

                  {folders.map(folder => (
                    <FolderCard 
                      key={folder.id}
                      name={folder.name} 
                      icon={folder.icon} 
                      count={notes.filter(n => n.folder_id === folder.id).length} 
                      onClick={() => setCurrentFolderId(folder.id)} 
                      onEdit={() => setFolderForm({ id: folder.id, name: folder.name, icon: folder.icon })}
                      onDelete={user?.role !== UserRole.TECHNICIAN ? () => handleDeleteFolder(folder.id) : undefined}
                    />
                  ))}

                  <div 
                    onClick={() => setFolderForm({ name: "", icon: "fa-folder" })}
                    className="group flex flex-col items-center justify-center rounded-[2.5rem] p-10 cursor-pointer transition-all hover:bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-300 animate-slide-up"
                  >
                    <div className="text-4xl mb-3 text-slate-200 group-hover:text-indigo-400 transition-colors">
                      <i className="fa-solid fa-folder-plus"></i>
                    </div>
                    <span className="font-black text-slate-300 text-[9px] uppercase tracking-widest group-hover:text-indigo-500">Nouveau Dossier</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {notes
                  .filter(n => currentFolderId === "unclassified" ? !n.folder_id : n.folder_id === currentFolderId)
                  .map(note => (
                   <NoteCard key={note.id} note={note} mode={mode} user={user} onDelete={handleDelete} onOpen={() => setViewingNote(note)} unlockedNotes={unlockedNotes} setPasswordVerify={setPasswordVerify} onPublish={handlePublish} />
                ))}
             </div>
          )}
        </div>
      </div>

      {/* MODALE ÉDITEUR DRAWER (1/3 ÉCRAN) */}
      {isEditing && createPortal(
        <>
          {/* Overlay de fond */}
          <div 
            className="fixed inset-0 z-[9980] bg-slate-900/40 backdrop-blur-sm animate-fade-in"
            onClick={() => {
              setIsEditing(false);
              setSearchTerm("");
              onEditorClose?.();
            }}
          />
          
          <div className="fixed inset-y-0 right-0 z-[9990] w-full md:w-[800px] lg:w-[50vw] bg-white flex flex-col shadow-2xl animate-slide-left border-l border-slate-100">
            {/* Notepad Binding Simulation (Gauche du drawer) */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-slate-50 border-r border-slate-100/50 flex flex-col items-center py-10 gap-6 z-20 overflow-hidden">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300/50 shrink-0 shadow-inner"></div>
              ))}
            </div>

            <header className="h-24 border-b border-slate-50 px-8 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 ml-8 z-30">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setSearchTerm("");
                    onEditorClose?.();
                  }}
                  className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                  data-tooltip="Fermer l'éditeur"
                  aria-label="Fermer l'éditeur"
                >
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
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeNote.is_protected ? "bg-amber-100 text-amber-700 border border-amber-200" : "bg-slate-50 text-slate-400 border border-slate-200"}`}
                  data-tooltip={activeNote.is_protected ? "Rendre publique (visible par l'équipe)" : "Rendre privée (visible uniquement par vous)"}
                  aria-label={activeNote.is_protected ? "Rendre publique" : "Rendre privée"}
                >
                  <i
                    className={`fa-solid ${activeNote.is_protected ? "fa-lock" : "fa-lock-open"}`}></i>
                  {activeNote.is_protected ? "Protégée" : "Publique"}
                </button>

                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                   <i className="fa-solid fa-folder text-slate-400 text-[10px]"></i>
                   <select 
                     value={activeNote.folder_id || ""}
                     onChange={(e) => setActiveNote({...activeNote, folder_id: e.target.value})}
                     className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-500 outline-none cursor-pointer"
                   >
                     <option value="">Sans Dossier</option>
                     {folders.map(f => (
                       <option key={f.id} value={f.id}>{f.name}</option>
                     ))}
                   </select>
                </div>

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
                              category: 'general',
                              is_flash_note: true  // Mark as Flash Note
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
                              is_flash_note: false  // This is a notification, not a flash note
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
                     className="bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center gap-2 shadow-xl shadow-amber-100"
                     data-tooltip="Proposer comme Flash Note"
                     aria-label="Proposer comme Flash Note"
                   >
                     <i className="fa-solid fa-lightbulb"></i> Proposer
                   </button>
                )}

                <button
                  onClick={saveNote}
                  disabled={saving || !activeNote.title.trim()}
                  className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-50 shadow-xl shadow-indigo-100"
                  data-tooltip="Enregistrer les modifications"
                  aria-label="Enregistrer la note"
                >
                  {saving ? (
                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                  ) : (
                    <i className="fa-solid fa-floppy-disk"></i>
                  )}
                  Enregistrer
                </button>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-8 md:p-12 ml-8 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] z-10">
              <div className="max-w-xl mx-auto space-y-10">
                <input
                  type="text"
                  placeholder="Titre de la note..."
                  className="w-full text-3xl md:text-4xl font-black text-slate-900 border-none outline-none placeholder:text-slate-200 tracking-tighter bg-transparent leading-tight"
                  value={activeNote.title}
                  onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })}
                  autoFocus
                />
                <textarea
                  placeholder="Commencez à documenter ici..."
                  className="w-full h-[60vh] text-base md:text-lg text-slate-600 border-none outline-none resize-none leading-relaxed placeholder:text-slate-200 font-medium bg-transparent"
                  value={activeNote.content}
                  onChange={(e) => setActiveNote({ ...activeNote, content: e.target.value })}
                />
              </div>
            </main>
          </div>
        </>,
        document.body
      )}
      {/* Fin de l'éditeur */}

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

      {/* DRAWER LECTURE FOCUS (1/3 ÉCRAN) */}
      {viewingNote && createPortal(
          <>
            {/* Overlay de fond */}
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9980] animate-fade-in" 
              onClick={handleCloseNote}
            />

            <div 
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-y-0 right-0 z-[9990] w-full md:w-[800px] lg:w-[50vw] bg-white shadow-2xl flex flex-col border-l border-slate-100 animate-slide-left"
            >
              {/* Notepad Binding Simulation */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-slate-50 border-r border-slate-100/50 flex flex-col items-center py-10 gap-6 z-20 overflow-hidden">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300/50 shrink-0 shadow-inner"></div>
                ))}
              </div>

              <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-5 flex items-center justify-between ml-8">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleCloseNote}
                    className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    data-tooltip="Retour aux notes"
                    aria-label="Retour aux notes"
                  >
                    <i className="fa-solid fa-arrow-left"></i>
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Lecture de Note</span>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-bold text-slate-400 uppercase">{formatDate(viewingNote.createdAt)}</span>
                       {viewingNote.is_protected && <span className="text-[8px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 uppercase font-bold"><i className="fa-solid fa-lock mr-1"></i>Privé</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Approval buttons for Managers on suggestion flash notes */}
                  {user?.role === UserRole.MANAGER && mode === "flash" && viewingNote.status === "suggestion" && (
                    <div className="flex items-center gap-2 mr-2 pr-4 border-r border-slate-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            title: "Valider cette Flash Note ?",
                            message: "Elle sera visible par toute l'équipe immédiatement.",
                            confirmText: "Valider",
                            cancelText: "Annuler",
                            type: 'success',
                            onConfirm: async () => {
                              try {
                                const { error } = await supabase.from('notes').update({ status: 'validated', is_flash_note: true }).eq('id', viewingNote.id);
                                if(error) throw error;
                                fetchNotes();
                                handleCloseNote();
                                setSuccessModal({
                                  title: "Flash Note Validée !",
                                  message: "Elle est maintenant disponible pour toute l'équipe.",
                                  icon: "fa-certificate"
                                });
                              } catch (err) {
                                console.error("Error validating flash note:", err);
                                setSuccessModal({
                                  title: "Erreur",
                                  message: "Impossible de valider la note. Veuillez réessayer.",
                                  icon: "fa-triangle-exclamation"
                                });
                              }
                              setConfirmModal(null);
                            }
                          });
                        }}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                      >
                        <i className="fa-solid fa-check"></i> Valider
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            title: "Refuser cette suggestion ?",
                            message: "La note redeviendra privée pour l'auteur.",
                            confirmText: "Refuser",
                            cancelText: "Annuler",
                            type: 'danger',
                            onConfirm: async () => {
                              try {
                                const { error } = await supabase.from('notes').update({ status: 'private' }).eq('id', viewingNote.id);
                                if(error) throw error;
                                await supabase.from("notes").insert([{
                                  title: `FLASH_NOTE_REJECTED`,
                                  content: `Votre suggestion de Flash Note "${viewingNote.title}" a été refusée par ${user.firstName} ${user.lastName || ""}. Elle reste privée.`,
                                  is_protected: false,
                                  user_id: viewingNote.user_id,
                                  is_flash_note: false
                                }]);
                                setSuccessModal({
                                  title: "Suggestion Refusée",
                                  message: "La note est redevenue privée.",
                                  icon: "fa-times-circle"
                                });
                                handleCloseNote();
                                fetchNotes();
                              } catch (err) {
                                console.error("Error refusing flash note:", err);
                                setSuccessModal({
                                  title: "Erreur",
                                  message: "Impossible de refuser la note. Veuillez réessayer.",
                                  icon: "fa-triangle-exclamation"
                                });
                              }
                              setConfirmModal(null);
                            }
                          });
                        }}
                        className="px-4 py-2 bg-white text-rose-500 border border-rose-100 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all"
                      >
                        Refuser
                      </button>
                    </div>
                  )}

                  {mode === "personal" && !viewingNote.is_flash_note && viewingNote.status !== "suggestion" && (
                    <button
                      onClick={toggleLockStatus}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                        viewingNote.is_protected ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      }`}
                      title={viewingNote.is_protected ? "Retirer la protection" : "Protéger cette note"}>
                      <i className={`fa-solid ${viewingNote.is_protected ? "fa-lock" : "fa-lock-open"}`}></i>
                    </button>
                  )}
                  
                  {user?.role !== UserRole.TECHNICIAN && (
                    <button
                      onClick={(e) => handleDelete(e as any, viewingNote.id)}
                      className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      data-tooltip="Supprimer définitivement"
                      aria-label="Supprimer la note"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  )}

                  {viewingEdit ? (
                    <div className="flex items-center gap-2">
                       <button
                         onClick={saveInlineEdit}
                         disabled={saving || !viewDraft?.title.trim()}
                         className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-slate-900 transition-all font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                         data-tooltip="Enregistrer les modifications"
                         aria-label="Enregistrer les modifications"
                       >
                         <i className="fa-solid fa-cloud-arrow-up"></i>
                         <span className="hidden sm:inline ml-2">Enregistrer</span>
                       </button>
                    </div>
                  ) : (
                    !viewingNote.is_flash_note && (
                      <button
                        onClick={startInlineEdit}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-slate-900 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        data-tooltip="Modifier le contenu"
                        aria-label="Modifier la note"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                        <span className="hidden sm:inline ml-2">Modifier</span>
                      </button>
                    )
                  )}
                </div>
              </header>

              <main className="flex-1 overflow-y-auto px-8 md:px-16 py-10 w-full ml-8 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px]">
                <div className="max-w-3xl mx-auto w-full space-y-8">
                  {viewingEdit ? (
                    <>
                      <input
                        type="text"
                        value={viewDraft?.title || ""}
                        onChange={(e) => setViewDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                        className="w-full text-3xl md:text-5xl font-black text-slate-900 border-none outline-none bg-transparent placeholder-slate-200"
                        aria-label="Titre de la note"
                        placeholder="Titre..."
                      />
                      <div className="flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-sm sticky top-0 z-40 p-2 rounded-2xl border border-slate-100 shadow-xl shadow-indigo-500/5">
                        <button className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center" onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }} title="Gras">
                          <i className="fa-solid fa-bold text-xs"></i>
                        </button>
                        <button className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center" onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }} title="Italique">
                          <i className="fa-solid fa-italic text-xs"></i>
                        </button>
                        <div className="w-px h-5 bg-slate-100 mx-1"></div>
                        <button className="w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center" onMouseDown={(e) => { e.preventDefault(); applyFormat("insertUnorderedList"); }} title="Liste à puces">
                          <i className="fa-solid fa-list-ul text-xs"></i>
                        </button>
                        <div className="w-px h-5 bg-slate-100 mx-1"></div>
                        <div className="flex items-center gap-1">
                          {["#fff59d", "#bbdefb", "#c8e6c9", "#ffe0b2"].map((c) => (
                            <button
                              key={c}
                              className="w-5 h-5 rounded-md border border-slate-200 hover:scale-110 transition-transform shadow-sm"
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
                        className="min-h-[40vh] text-base md:text-xl text-slate-800 leading-relaxed outline-none"
                        onInput={() => setViewDraft((prev) => prev ? { ...prev, content: editorRef.current?.innerHTML || "" } : prev)}
                        onPaste={handlePasteSanitized}
                        aria-label="Contenu de la note"
                      />
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-8">
                        {viewingNote.title}
                      </h1>
                      <div
                        className="prose prose-slate max-w-none text-slate-800 font-medium leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: viewingNote.content }}
                      />
                    </>
                  )}
                </div>
              </main>
            </div>
          </>,
          document.body
        )}

      {/* CONFIRMATION MODAL (PREMIUM) */}
      {confirmModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scaleIn border border-slate-700">
            <h2 className="text-2xl font-black text-white mb-3">
              {confirmModal.title}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-8">
              {confirmModal.message}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg"
              >
                {confirmModal.cancelText || "Annuler"}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all shadow-lg ${
                  confirmModal.type === 'danger'
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                }`}
              >
                {confirmModal.confirmText || "Confirmer"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <CustomToast
          message={toast.message}
          type={toast.type}
          visible={!!toast}
          onClose={() => setToast(null)}
        />
      )}

      {/* MODAL FOLDER FORM */}
      {folderForm && createPortal(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-10 animate-scale-up border border-slate-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                <i className={`fa-solid ${folderForm.id ? 'fa-pen-to-square' : 'fa-folder-plus'}`}></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                  {folderForm.id ? 'Renommer le dossier' : 'Nouveau Dossier'}
                </h3>
              </div>
            </div>

            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Nom du dossier</label>
                <input 
                  type="text"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({...folderForm, name: e.target.value})}
                  placeholder="Ex: Factures, Important..."
                  autoFocus
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Icone</label>
                <div className="grid grid-cols-5 gap-3">
                   {['fa-folder', 'fa-star', 'fa-heart', 'fa-briefcase', 'fa-book', 'fa-shield-halved', 'fa-bolt', 'fa-cloud', 'fa-lock', 'fa-tag'].map(icon => (
                     <button
                       key={icon}
                       onClick={() => setFolderForm({...folderForm, icon})}
                       className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${folderForm.icon === icon ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}
                     >
                       <i className={`fa-solid ${icon} text-sm`}></i>
                     </button>
                   ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setFolderForm(null)}
                className="flex-1 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveFolder}
                disabled={saving || !folderForm.name.trim()}
                className="flex-1 px-6 py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
              >
                {saving ? <i className="fa-solid fa-circle-notch fa-spin"></i> : folderForm.id ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const FolderCard: React.FC<{ 
  name: string; 
  icon: string; 
  count: number; 
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ name, icon, count, onClick, onEdit, onDelete }) => (
  <div 
    onClick={onClick}
    className="group relative flex flex-col items-center justify-center rounded-[2.5rem] p-10 cursor-pointer transition-all hover:shadow-2xl hover:border-indigo-400 bg-white border border-slate-100 animate-slide-up h-full min-h-[220px]"
  >
    {/* Folder Actions - Only show if handlers are provided */}
    {(onEdit || onDelete) && (
      <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        {onEdit && (
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white flex items-center justify-center border border-slate-100 shadow-sm"
          >
            <i className="fa-solid fa-pen text-[10px]"></i>
          </button>
        )}
        {onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-white flex items-center justify-center border border-slate-100 shadow-sm"
          >
            <i className="fa-solid fa-trash-can text-[10px]"></i>
          </button>
        )}
      </div>
    )}

    <div className="text-6xl mb-6 text-indigo-50 transition-all group-hover:scale-110 group-hover:text-indigo-600">
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <div className="flex flex-col items-center gap-2 mt-2">
      <span className="font-black text-slate-900 text-[12px] uppercase tracking-widest text-center leading-tight">
        {name}
      </span>
      <div className="px-3 py-1 bg-slate-100 rounded-full border border-slate-200/50 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
        <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600 whitespace-nowrap">
          {count} {count > 1 ? 'éléments' : 'élément'}
        </span>
      </div>
    </div>
    <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all scale-0 group-hover:scale-100">
      <i className="fa-solid fa-arrow-right"></i>
    </div>
  </div>
);

const NoteCard: React.FC<{ 
  note: ProtectedNote; 
  mode: string; 
  user: User | null | undefined; 
  onDelete: (e: React.MouseEvent, id: string) => void; 
  onOpen: () => void;
  unlockedNotes: Set<string>;
  setPasswordVerify: (pv: any) => void;
  onPublish?: (id: string) => void;
}> = ({ note, mode, user, onDelete, onOpen, unlockedNotes, setPasswordVerify, onPublish }) => {
  const isProtected = note.is_protected && !unlockedNotes.has(note.id);
  const colors = ["bg-sky-100", "bg-emerald-100", "bg-violet-100", "bg-amber-100", "bg-rose-100"];
  const colorIndex = note.id.charCodeAt(0) % colors.length;
  const cardColor = mode === "flash" ? colors[colorIndex] : "bg-white";
  const borderClass = mode === "flash" ? "border-transparent" : "border-slate-100";

  return (
    <div
      onClick={() => {
        if (note.is_protected && !unlockedNotes.has(note.id)) {
          setPasswordVerify({ id: note.id, value: "", action: "UNLOCK" });
        } else {
          onOpen();
        }
      }}
      className={`group hover:translate-y-[-4px] active:scale-95 transition-all duration-300 rounded-[2rem] p-6 relative cursor-pointer flex flex-col h-64 shadow-sm hover:shadow-xl ${cardColor} border ${borderClass}`}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className={`font-black text-lg line-clamp-2 ${mode === "flash" ? "text-slate-800" : "text-slate-900"} uppercase tracking-tight leading-tight`} style={{ wordBreak: 'break-word' }}>
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
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-all ${mode === "flash" ? "bg-white/50 text-slate-500" : "bg-slate-50 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white"}`}>
            <i className={`fa-solid ${mode === 'flash' ? 'fa-bolt' : 'fa-eye'} text-xs`}></i>
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-hidden text-sm leading-relaxed mb-4 relative ${mode === "flash" ? "text-slate-600 font-medium" : "text-slate-500"}`}>
        <div dangerouslySetInnerHTML={{ __html: isProtected ? "🔒 Contenu protégé..." : note.content }} />
        <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${mode === "flash" ? "from-" + cardColor.replace("bg-", "") : "from-white"} to-transparent pointer-events-none`}></div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100/50 pt-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {mode === 'personal' ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[7px] font-black uppercase tracking-widest border border-slate-200">
                <i className="fa-solid fa-file-lines text-[6px]"></i>
                Note
              </span>
            ) : (
              note.status === 'suggestion' ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[7px] font-black uppercase tracking-widest border border-amber-200">
                  <i className="fa-solid fa-lightbulb text-[6px]"></i>
                  Proposition
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[7px] font-black uppercase tracking-widest shadow-sm">
                  <i className="fa-solid fa-bolt text-[6px]"></i>
                  Flash Note
                </span>
              )
            )}
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">
              {note.updatedAt || note.createdAt}
            </span>
          </div>
          {note.author_name && (
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
              <i className="fa-solid fa-user text-[6px]"></i>
              {note.author_name}
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {/* Publish Button for Managers on Suggestions */}
          {mode === "flash" && user?.role === UserRole.MANAGER && note.status === 'suggestion' && onPublish && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPublish(note.id);
              }}
              className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
              title="Publier pour toute l'équipe"
            >
              <i className="fa-solid fa-share-nodes text-xs"></i>
            </button>
          )}

          {user?.role !== UserRole.TECHNICIAN && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e, note.id);
              }}
              className="w-8 h-8 rounded-full hover:bg-rose-50 hover:text-rose-500 text-slate-300 transition-colors flex items-center justify-center z-10"
              title="Supprimer">
              <i className="fa-solid fa-trash-can text-xs"></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notes;
