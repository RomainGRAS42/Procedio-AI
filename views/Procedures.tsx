
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, Procedure } from '../types';
import { supabase } from '../lib/supabase';
import ExpertAIModal from './ExpertAIModal';

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
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  
  const [currentFolder, setCurrentFolder] = useState<string | null>(initialFolder); 
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<Procedure[]>([]);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);

  const cleanFileName = (name: string) => {
    if (!name) return "Document sans titre";
    let clean = name.replace(/\.[^/.]+$/, "");
    clean = clean.replace(/^[0-9a-f.-]+-/i, "");
    return clean.replace(/_/g, ' ').trim();
  };

  const fetchStructure = useCallback(async () => {
    setLoading(true);
    try {
      const { data: allProcs, error: dbError } = await supabase
        .from('procedures')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      const results = (allProcs || []) as any[];
      
      // Map to Procedure format and store all
      const mappedProcs = results.map(f => ({
        id: f.file_id || f.uuid,
        file_id: f.file_id || f.uuid,
        title: f.title || "Sans titre",
        category: f.Type || 'NON CLASSÉ',
        fileUrl: f.file_url,
        pinecone_document_id: f.pinecone_document_id,
        createdAt: f.created_at,
        views: f.views || 0,
        status: f.status || 'validated'
      }));
      setAllProcedures(mappedProcs);
      
      console.log("📦 fetchStructure: Chargé", mappedProcs.length, "procédures dans allProcedures");
      
      const uniqueCategories = Array.from(new Set(
        results.map(p => (p.Type ? String(p.Type).toUpperCase() : 'NON CLASSÉ'))
      ));
      
      const defaultCats = ['INFRASTRUCTURE', 'LOGICIEL', 'MATERIEL', 'UTILISATEUR'];
      const finalFolders = Array.from(new Set([...defaultCats, ...uniqueCategories])).sort() as string[];
      setFolders(finalFolders);

      if (currentFolder) {
        const filteredFiles = mappedProcs.filter(p => p.category.toUpperCase() === currentFolder.toUpperCase());
        setFiles(filteredFiles);
      }
    } catch (e) {
      console.error("Erreur de synchronisation Base de données:", e);
    } finally {
      setLoading(false);
    }
  }, [currentFolder]);

  useEffect(() => {
    if (initialSearchTerm) {
      handleSearch(initialSearchTerm);
    } else {
      fetchStructure();
    }
    onFolderChange?.(currentFolder);
  }, [currentFolder, initialSearchTerm, fetchStructure]);

  useEffect(() => {
    const channel = supabase
      .channel('table-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'procedures' },
        () => {
          fetchStructure();
          if (isSearching) handleSearch();
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentFolder, isSearching, searchTerm, fetchStructure]);

  const handleSearch = (termOverride?: string, goToFullResults: boolean = false) => {
    const termToSearch = termOverride ?? searchTerm;
    if (!termToSearch.trim()) {
      setIsSearching(false);
      onSearchClear?.();
      setSearchResults([]);
      return;
    }
    
    console.log("🔍 Recherche:", termToSearch);
    console.log("📦 Nombre total de procédures:", allProcedures.length);
    
    // Local case-insensitive filtering
    const filtered = allProcedures.filter(p => {
      const matchTitle = p.title.toLowerCase().includes(termToSearch.toLowerCase());
      const matchCategory = p.category.toLowerCase().includes(termToSearch.toLowerCase());
      return matchTitle || matchCategory;
    });
    
    console.log("✅ Résultats filtrés:", filtered.length, filtered);
    setSearchResults(filtered);
    
    // Only go to full results page if explicitly requested
    if (goToFullResults) {
      setIsSearching(true);
    }
  };

  return (
    <div className="space-y-12 h-full flex flex-col pb-10 animate-fade-in">
      <ExpertAIModal 
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSelectProcedure={onSelectProcedure}
        user={user}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="flex-1 max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input 
                type="text" 
                placeholder="Rechercher dans la base de connaissance..."
                className={`w-full pl-14 py-5 rounded-[2.5rem] border-none bg-white shadow-xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-lg font-semibold text-slate-700 placeholder:text-slate-300 ${
                  searchTerm.trim() ? 'pr-40' : 'pr-4'
                }`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleSearch(e.target.value, false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    handleSearch(searchTerm, true);
                  }
                }}
              />
              <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 text-xl"></i>
              
              {/* Search button - appears when typing */}
              {searchTerm.trim() && (
                <button
                  onClick={() => handleSearch(searchTerm, true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 active:scale-95 animate-scale-in flex items-center gap-2"
                >
                  <span>Rechercher</span>
                  <i className="fa-solid fa-arrow-right text-[10px]" />
                </button>
              )}
              
              {/* Hint - appears when typing */}
              {searchTerm.trim() && (
                <p className="absolute -bottom-6 left-14 text-[10px] text-slate-400 font-medium animate-fade-in flex items-center gap-1.5">
                  <i className="fa-solid fa-lightbulb text-amber-400" />
                  ou appuyez sur <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-600 font-bold">Enter ↵</kbd>
                </p>
              )}
            </div>
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 whitespace-nowrap"
            >
              <span className="text-lg">🤖</span>
              <span>Expert IA</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchStructure()}
            className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all hover:shadow-lg active:scale-95"
            title="Actualiser la base"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
          </button>
          {user.role === UserRole.MANAGER && (
            <button 
              onClick={onUploadClick}
              className="bg-indigo-600 text-white px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 transition-all shadow-2xl active:scale-95 shadow-indigo-200"
            >
              <i className="fa-solid fa-plus text-sm"></i>
              <span>Nouvelle Procédure</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 px-6">
        <div className="flex items-center gap-2">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRealtimeActive ? 'bg-emerald-400' : 'bg-slate-300'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isRealtimeActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isRealtimeActive ? 'Base synchronisée' : 'Synchro en cours...'}
          </span>
        </div>
        <div className="h-4 w-px bg-slate-200"></div>
        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
          {isSearching ? `${searchResults.length} résultats` : currentFolder ? `${currentFolder} - ${files.length} fichiers` : 'Dossiers'}
        </span>
      </div>

      <div className="flex-1 space-y-10">
        {!isSearching && currentFolder !== null && (
          <button 
            onClick={() => setCurrentFolder(null)} 
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-arrow-left"></i> 
            Retour à l'accueil
          </button>
        )}

        <div className="min-h-[400px]">
          {loading && (files.length === 0 && folders.length === 0) ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synchronisation cloud...</p>
            </div>
          ) : isSearching ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.length > 0 ? searchResults.map(res => (
                <div key={res.id} onClick={() => onSelectProcedure(res)} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] flex items-center gap-6 cursor-pointer hover:shadow-2xl transition-all animate-slide-up group">
                   <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-xl group-hover:bg-rose-500 group-hover:text-white transition-all shadow-sm"><i className="fa-solid fa-file-pdf"></i></div>
                   <div className="flex-1 overflow-hidden">
                     <span className="font-black text-slate-800 block truncate text-lg">{res.title}</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 block">{res.category}</span>
                   </div>
                   <i className="fa-solid fa-chevron-right text-slate-100 group-hover:text-indigo-600 transition-colors"></i>
                </div>
              )) : (
                 <div className="col-span-full py-20 text-center text-slate-300">Aucune procédure ne correspond à votre recherche.</div>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                {currentFolder === null && folders.map((folder) => (
                  <div 
                    key={folder}
                    onClick={() => setCurrentFolder(folder)}
                    className="group relative flex flex-col items-center justify-center aspect-square rounded-[3.5rem] p-10 cursor-pointer transition-all hover:-translate-y-2 bg-white border border-slate-100 hover:border-indigo-400 hover:shadow-2xl shadow-indigo-500/5 animate-slide-up"
                  >
                    <div className="text-7xl mb-6 text-indigo-50 transition-all group-hover:scale-110 group-hover:text-indigo-600">
                      <i className="fa-solid fa-folder"></i>
                    </div>
                    <span className="font-black text-slate-900 text-[11px] uppercase tracking-widest text-center leading-tight">
                      {folder}
                    </span>
                    <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <i className="fa-solid fa-arrow-right"></i>
                    </div>
                  </div>
                ))}

                {currentFolder !== null && files.map((file) => (
                  <div 
                    key={file.id}
                    onClick={() => onSelectProcedure(file)}
                    className="group relative flex flex-col items-center justify-center aspect-square rounded-[3.5rem] p-10 cursor-pointer transition-all hover:-translate-y-2 bg-white border border-slate-100 hover:border-emerald-400 hover:shadow-2xl shadow-indigo-500/5 animate-slide-up"
                  >
                    <div className="text-7xl mb-6 text-slate-50 transition-all group-hover:scale-110 group-hover:text-emerald-500">
                      <i className="fa-solid fa-file-pdf"></i>
                    </div>
                    <span className="font-black text-slate-900 text-[11px] uppercase tracking-widest text-center leading-tight line-clamp-2 px-2">
                      {cleanFileName(file.title)}
                    </span>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      <span className="w-2 h-2 bg-emerald-200 rounded-full"></span>
                    </div>
                  </div>
                ))}

                {currentFolder !== null && files.length === 0 && !loading && (
                  <div className="col-span-full py-20 text-center text-slate-300 flex flex-col items-center gap-6">
                     <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-100 text-4xl">
                       <i className="fa-regular fa-folder-open"></i>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em]">Ce dossier est actuellement vide</p>
                     <button onClick={() => setCurrentFolder(null)} className="text-indigo-600 font-black text-[9px] uppercase tracking-widest hover:underline">Retourner à la racine</button>
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
