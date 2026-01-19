
import React, { useState, useEffect } from 'react';
import { User, UserRole, Procedure } from '../types';
import { supabase } from '../lib/supabase';

interface ProceduresProps {
  user: User;
  onUploadClick: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  initialSearchTerm?: string;
  onSearchClear?: () => void;
  initialFolder?: string | null;
  onFolderChange?: (folder: string | null) => void;
}

const Procedures: React.FC<ProceduresProps> = ({ 
  user, 
  onUploadClick, 
  onSelectProcedure, 
  initialSearchTerm = '', 
  onSearchClear,
  initialFolder = null,
  onFolderChange
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [isSearching, setIsSearching] = useState(initialSearchTerm !== '');
  const [searchResults, setSearchResults] = useState<Procedure[]>([]);
  
  const [currentFolder, setCurrentFolder] = useState<string | null>(initialFolder); 
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialSearchTerm) {
      handleSearch(initialSearchTerm);
    } else {
      fetchStructure();
    }
    onFolderChange?.(currentFolder);
  }, [currentFolder, initialSearchTerm]);

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'procedures' },
        () => {
          fetchStructure();
          if (isSearching) handleSearch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentFolder, isSearching, searchTerm]);

  const cleanFileName = (name: string) => {
    let clean = name.replace(/\.[^/.]+$/, "");
    clean = clean.replace(/^[0-9a-f.-]+-/i, "");
    return clean.replace(/_/g, ' ').trim();
  };

  const fetchStructure = async () => {
    setLoading(true);
    try {
      if (currentFolder === null) {
        // 1. Lister le storage
        const { data: storageItems, error: storageError } = await supabase
          .storage
          .from('procedures')
          .list('', { sortBy: { column: 'name', order: 'asc' } });

        if (storageError) throw storageError;

        // 2. Définir les catégories de base (Singulier pour la norme)
        const defaultCats = ['INFRASTRUCTURE', 'LOGICIEL', 'MATERIEL', 'UTILISATEUR'];
        
        // 3. Extraire les dossiers du storage
        const storageFolders = storageItems
          ?.filter(item => !item.name.includes('.'))
          .map(item => item.name.toUpperCase()) || [];

        /**
         * LOGIQUE DE FUSION ANTI-DOUBLON (UTILISATEUR vs UTILISATEURS)
         * On normalise en enlevant le "S" final et les espaces pour comparer
         */
        const normalizedSet = new Set<string>();
        const finalFolders: string[] = [];

        [...defaultCats, ...storageFolders].forEach(folder => {
          const normal = folder.trim().replace(/S$/, ""); // Normalise "UTILISATEURS" -> "UTILISATEUR"
          if (!normalizedSet.has(normal)) {
            normalizedSet.add(normal);
            finalFolders.push(folder); // On garde le premier nom rencontré (souvent la constante)
          }
        });

        setFolders(finalFolders.sort());
      } else {
        const { data: dbFiles } = await supabase
          .from('procedures')
          .select('*')
          .eq('category', currentFolder);

        if (dbFiles && dbFiles.length > 0) {
          setFiles(dbFiles.map(f => ({ ...f, title: cleanFileName(f.title) })));
        } else {
          const { data: storageFiles } = await supabase
            .storage
            .from('procedures')
            .list(currentFolder, { sortBy: { column: 'name', order: 'asc' } });

          const mappedFiles: Procedure[] = (storageFiles || [])
            .filter(f => f.name.toLowerCase().endsWith('.pdf'))
            .map(f => ({
              id: `${currentFolder}/${f.name}`,
              title: cleanFileName(f.name),
              category: currentFolder,
              createdAt: f.created_at,
              views: 0,
              status: 'validated'
            }));
          setFiles(mappedFiles);
        }
      }
    } catch (e) {
      console.error("Erreur de synchronisation Drive:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (termOverride?: string) => {
    const termToSearch = termOverride ?? searchTerm;
    if (!termToSearch.trim()) {
      setIsSearching(false);
      onSearchClear?.();
      fetchStructure();
      return;
    }
    setLoading(true);
    setIsSearching(true);
    
    try {
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .ilike('title', `%${termToSearch}%`);
        
      if (error) throw error;
      setSearchResults((data || []).map(f => ({ ...f, title: cleanFileName(f.title) })));
    } catch (e) {
      console.error("Erreur recherche:", e);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 h-full flex flex-col pb-10 animate-fade-in">
      {/* RECHERCHE & ACTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="flex-1 max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Rechercher une documentation technique..."
            className="w-full pl-14 pr-4 py-5 rounded-[2.5rem] border-none bg-white shadow-xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-lg font-semibold text-slate-700 placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 text-xl"></i>
        </div>

        {user.role === UserRole.MANAGER && (
          <button 
            onClick={onUploadClick}
            className="bg-slate-900 text-white px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl active:scale-95"
          >
            <i className="fa-solid fa-plus text-sm"></i>
            <span>Nouvelle Procédure</span>
          </button>
        )}
      </div>

      <div className="flex-1 space-y-10">
        {!isSearching && (
          <div className="flex flex-col items-start gap-6">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0 relative">
                <i className="fa-solid fa-hard-drive text-lg"></i>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-[0.2em]">Procedio Cloud Drive</h3>
                <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                  <i className="fa-solid fa-sync text-indigo-400 animate-spin-slow"></i>
                  {currentFolder ? `Navigation dans : ${currentFolder}` : 'Sélectionnez un dossier technique pour commencer.'}
                </p>
              </div>
            </div>
            
            {currentFolder !== null && (
              <button 
                onClick={() => setCurrentFolder(null)} 
                className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
              >
                <i className="fa-solid fa-arrow-left"></i> 
                Retour aux catégories
              </button>
            )}
          </div>
        )}

        <div className="min-h-[400px]">
          {loading && (files.length === 0 && folders.length === 0) ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analyse du stockage...</p>
            </div>
          ) : isSearching ? (
            <div className="grid grid-cols-1 gap-4">
              {searchResults.length > 0 ? searchResults.map(res => (
                <div key={res.id} onClick={() => onSelectProcedure(res)} className="p-6 bg-white border border-slate-100 rounded-[2rem] flex items-center gap-6 cursor-pointer hover:shadow-xl transition-all animate-slide-up">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-file-pdf"></i></div>
                   <div className="flex-1">
                     <span className="font-bold text-slate-700 block">{res.title}</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{res.category}</span>
                   </div>
                </div>
              )) : (
                 <div className="py-20 text-center text-slate-300">Aucun résultat pour cette recherche.</div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* TITRE DU DOSSIER COURANT AVEC DESIGN ÉPURÉ */}
              {currentFolder && (
                <div className="flex items-center gap-6 mb-4 animate-fade-in">
                  <div className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                    {currentFolder}
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent"></div>
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    {files.length} document{files.length > 1 ? 's' : ''} trouvé{files.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                {/* AFFICHAGE DES DOSSIERS (RACINE) */}
                {currentFolder === null && folders.map((folder) => (
                  <div 
                    key={folder}
                    onClick={() => setCurrentFolder(folder)}
                    className="group relative flex flex-col items-center justify-center aspect-square rounded-[3rem] p-8 cursor-pointer transition-all hover:-translate-y-2 bg-white border border-slate-100 hover:border-indigo-300 hover:shadow-2xl shadow-indigo-500/5 animate-slide-up"
                  >
                    <div className="text-6xl mb-6 text-indigo-100 transition-all group-hover:scale-110 group-hover:text-indigo-500">
                      <i className="fa-solid fa-folder"></i>
                    </div>
                    <span className="font-black text-slate-800 text-[11px] uppercase tracking-widest text-center leading-tight">
                      {folder}
                    </span>
                  </div>
                ))}

                {/* AFFICHAGE DES FICHIERS (DANS UN DOSSIER) */}
                {currentFolder !== null && files.map((file) => (
                  <div 
                    key={file.id}
                    onClick={() => onSelectProcedure(file)}
                    className="group relative flex flex-col items-center justify-center aspect-square rounded-[3rem] p-8 cursor-pointer transition-all hover:-translate-y-2 bg-white border border-slate-100 hover:border-indigo-400 hover:shadow-2xl shadow-indigo-500/5 animate-slide-up"
                  >
                    <div className="text-6xl mb-6 text-slate-50 transition-all group-hover:scale-110 group-hover:text-rose-500">
                      <i className="fa-solid fa-file-pdf"></i>
                    </div>
                    <span className="font-black text-slate-800 text-[11px] uppercase tracking-widest text-center leading-tight line-clamp-2 px-2">
                      {file.title}
                    </span>
                    <div className="mt-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-100 rounded-full"></span>
                    </div>
                  </div>
                ))}

                {/* ETAT VIDE */}
                {currentFolder !== null && files.length === 0 && !loading && (
                  <div className="col-span-full py-20 text-center text-slate-300 flex flex-col items-center gap-4">
                     <i className="fa-regular fa-folder-open text-5xl mb-2 opacity-20"></i>
                     <p className="text-[10px] font-black uppercase tracking-widest">Aucune procédure disponible ici</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Procedures;
