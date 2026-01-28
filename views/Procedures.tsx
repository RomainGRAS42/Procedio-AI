
import React, { useState, useEffect, useCallback } from 'react';
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
      
      const uniqueCategories = Array.from(new Set(
        results.map(p => (p.Type ? String(p.Type).toUpperCase() : 'NON CLASSÉ'))
      ));
      
      const defaultCats = ['INFRASTRUCTURE', 'LOGICIEL', 'MATERIEL', 'UTILISATEUR'];
      const finalFolders = Array.from(new Set([...defaultCats, ...uniqueCategories])).sort() as string[];
      setFolders(finalFolders);

      if (currentFolder) {
        const filteredFiles = results
          .filter(p => {
            const cat = p.Type ? String(p.Type).toUpperCase() : 'NON CLASSÉ';
            return cat === currentFolder.toUpperCase();
          })
          .map(f => ({
            id: f.uuid,
            file_id: f.uuid,
            title: f.title || "Sans titre",
            category: f.Type || 'NON CLASSÉ',
            fileUrl: f.file_url, // On récupère l'URL liée
            createdAt: f.created_at,
            views: f.views || 0,
            status: f.status || 'validated'
          }));
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

  const handleSearch = async (termOverride?: string) => {
    const termToSearch = termOverride ?? searchTerm;
    if (!termToSearch.trim()) {
      setIsSearching(false);
      onSearchClear?.();
      fetchStructure();
      return;
    }
    console.log("DEBUG: handleSearch triggered with term:", termToSearch);
    setLoading(true);
    setIsSearching(true);
    
    try {
      console.log("DEBUG: Sending request to n8n RAG webhook...");
      // 1. Recherche sémantique via n8n (RAG / Pinecone)
      const n8nResponse = await fetch('https://n8n.srv901593.hstgr.cloud/webhook-test/search-procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: termToSearch })
      });
      console.log("DEBUG: n8n response status:", n8nResponse.status);

      if (!n8nResponse.ok) throw new Error("Erreur lors de la recherche sémantique");

      const ragResults = await n8nResponse.json();
      
      // On s'attend à recevoir une liste d'objets avec un champ 'uuid'
      const activeUuids = Array.isArray(ragResults) 
        ? ragResults.map((r: any) => r.uuid).filter(Boolean)
        : [];

      if (activeUuids.length > 0) {
        // 2. Récupération des métadonnées complètes depuis Supabase pour ces UUIDs
        const { data, error } = await supabase
          .from('procedures')
          .select('*')
          .in('uuid', activeUuids);

        if (error) throw error;

        // On trie les résultats Supabase pour qu'ils correspondent à l'ordre de pertinence de n8n
        const sortedData = (data || []).sort((a, b) => {
          return activeUuids.indexOf(a.uuid) - activeUuids.indexOf(b.uuid);
        });

        setSearchResults(sortedData.map(f => ({
          id: f.uuid,
          file_id: f.uuid,
          title: f.title || "Sans titre",
          category: f.Type || 'NON CLASSÉ',
          fileUrl: f.file_url,
          createdAt: f.created_at,
          views: f.views || 0,
          status: f.status || 'validated'
        })));
      } else {
        // Si aucun résultat RAG n'est trouvé, on ne fait plus de fallback direct.
        setSearchResults([]);
      }
    } catch (e) {
      console.error("Erreur recherche (RAG):", e);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 h-full flex flex-col pb-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="flex-1 max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Rechercher dans la base de connaissance..."
            className="w-full pl-14 pr-4 py-5 rounded-[2.5rem] border-none bg-white shadow-xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-lg font-semibold text-slate-700 placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 text-xl"></i>
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
              className="bg-slate-900 text-white px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl active:scale-95"
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
