
import React, { useState, useEffect } from 'react';
import { User, UserRole, Procedure } from '../types';
import { supabase } from '../lib/supabase';

interface ProceduresProps {
  user: User;
  onUploadClick: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  initialSearchTerm?: string;
  onSearchClear?: () => void;
}

interface StorageItem {
  name: string;
  id: string | null;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    eTag: string;
    size: number;
    mimetype: string;
    cacheControl: string;
    lastModified: string;
    contentLength: number;
    httpStatusCode: number;
  } | null;
}

const Procedures: React.FC<ProceduresProps> = ({ user, onUploadClick, onSelectProcedure, initialSearchTerm = '', onSearchClear }) => {
  // Recherche
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [isSearching, setIsSearching] = useState(initialSearchTerm !== '');
  const [searchResults, setSearchResults] = useState<Procedure[]>([]);

  // Navigation Storage
  const [currentPath, setCurrentPath] = useState<string>(''); // '' = root
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Charger les résultats initiaux si un terme est passé depuis le dashboard
  useEffect(() => {
    if (initialSearchTerm) {
      handleSearch(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // Charger le contenu du dossier actuel (si pas de recherche en cours)
  useEffect(() => {
    if (!searchTerm) {
      fetchStorageContent(currentPath);
    }
  }, [currentPath, searchTerm]);

  const fetchStorageContent = async (path: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('procedures')
        .list(path, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) throw error;
      
      const filteredData = (data || []).filter(item => item.name !== '.emptyFolderPlaceholder');
      setStorageItems(filteredData as StorageItem[]);
    } catch (e) {
      console.error("Erreur chargement storage:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (termOverride?: string) => {
    const termToSearch = termOverride ?? searchTerm;
    if (!termToSearch.trim()) {
      setIsSearching(false);
      onSearchClear?.();
      return;
    }
    setLoading(true);
    setIsSearching(true);
    setSearchResults([]); 

    try {
      const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/search-procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: termToSearch })
      });

      if (!response.ok) throw new Error('Erreur recherche');

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.results || data.documents || []);

      const mappedResults: Procedure[] = items.map((item: any, index: number) => ({
        id: item.id || `search-${Date.now()}-${index}`,
        title: item.title || item.name || 'Document sans titre',
        category: item.category || item.folder || 'AUTRE',
        createdAt: item.created_at ? new Date(item.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
        views: item.views || 0,
        status: 'validated'
      }));

      setSearchResults(mappedResults);
    } catch (e) {
      console.error("Erreur recherche:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: StorageItem) => {
    const isFolder = !item.metadata;

    if (isFolder) {
      const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
      setCurrentPath(newPath);
    } else {
      const procedure: Procedure = {
        id: item.id || item.name,
        title: item.name,
        category: currentPath || 'BASE DE DONNÉES',
        createdAt: new Date(item.created_at).toLocaleDateString(),
        views: 0,
        status: 'validated'
      };
      onSelectProcedure(procedure);
    }
  };

  const handleBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  return (
    <div className="space-y-8 h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="flex-1 max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Rechercher une documentation technique..."
            className="w-full pl-14 pr-4 py-5 rounded-[2rem] border-none bg-white shadow-xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-lg font-semibold text-slate-700 placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value === '') {
                setIsSearching(false);
                onSearchClear?.();
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 text-xl"></i>
          {searchTerm && (
            <button 
              onClick={() => handleSearch()}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100"
            >
              Rechercher
            </button>
          )}
        </div>

        {user.role === UserRole.MANAGER && (
          <button 
            onClick={onUploadClick}
            className="bg-slate-900 text-white px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95"
          >
            <i className="fa-solid fa-plus text-sm"></i>
            <span>Nouvelle Procédure</span>
          </button>
        )}
      </div>

      <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-[3rem] border border-white p-8 md:p-12 shadow-xl shadow-indigo-500/5 flex flex-col min-h-[500px]">
        {!isSearching && (
          <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-100">
             <button 
                onClick={() => setCurrentPath('')}
                className={`flex items-center gap-3 transition-all ${!currentPath ? 'text-slate-900 scale-105' : 'text-slate-400 hover:text-indigo-600'}`}
             >
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${!currentPath ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                 <i className="fa-solid fa-database text-sm"></i>
               </div>
               <span className="font-black text-sm uppercase tracking-[0.2em]">Base de Connaissances</span>
             </button>
             
             {currentPath && (
               <>
                 <i className="fa-solid fa-chevron-right text-slate-200 text-[10px]"></i>
                 <div className="flex items-center gap-2">
                    <span className="font-black text-indigo-600 text-sm uppercase tracking-[0.15em] bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100/50">
                      {currentPath.replace('/', ' / ')}
                    </span>
                 </div>
                 <button onClick={handleBack} className="ml-auto text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 transition-all active:scale-95">
                    <i className="fa-solid fa-level-up-alt rotate-90"></i> Retour
                 </button>
               </>
             )}
          </div>
        )}

        <div className="flex-1">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center py-20 gap-6">
               <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-xl"></div>
               <span className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 animate-pulse">Indexation des documents...</span>
             </div>
          ) : isSearching ? (
             <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                   <div className="h-px flex-1 bg-slate-100"></div>
                   <h3 className="font-black text-slate-400 text-[9px] uppercase tracking-[0.4em]">Résultats de la requête</h3>
                   <div className="h-px flex-1 bg-slate-100"></div>
                </div>
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {searchResults.map(res => (
                      <div key={res.id} onClick={() => onSelectProcedure(res)} className="p-6 flex items-center gap-6 bg-white border border-slate-100 hover:border-indigo-200 rounded-[1.5rem] cursor-pointer group transition-all hover:shadow-xl hover:shadow-indigo-500/5">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                          <i className="fa-regular fa-file-text text-xl"></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors leading-tight">{res.title}</h4>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 inline-block">{res.category}</span>
                        </div>
                        <i className="fa-solid fa-arrow-right text-slate-200 group-hover:text-indigo-600 group-hover:translate-x-2 transition-all"></i>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-24 text-slate-300 flex flex-col items-center gap-6">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                      <i className="fa-solid fa-search-minus text-4xl"></i>
                    </div>
                    <p className="font-black text-[10px] uppercase tracking-widest">Aucune correspondance trouvée dans la base.</p>
                  </div>
                )}
             </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
               {storageItems.length > 0 ? (
                 storageItems.map((item, idx) => {
                   const isFolder = !item.metadata;
                   return (
                     <div 
                        key={item.id || idx} 
                        onClick={() => handleItemClick(item)}
                        className={`aspect-square rounded-[2rem] p-6 flex flex-col items-center justify-center gap-5 text-center cursor-pointer transition-all hover:-translate-y-2 hover:shadow-2xl border group ${
                          isFolder 
                            ? 'bg-slate-50 border-slate-100 hover:border-indigo-300 hover:bg-white' 
                            : 'bg-white border-slate-100 hover:border-indigo-400'
                        }`}
                     >
                        <div className={`text-4xl transition-all duration-300 ${isFolder ? 'text-indigo-400 group-hover:scale-110 group-hover:text-indigo-600' : 'text-slate-300 group-hover:text-indigo-500'}`}>
                          <i className={`fa-solid ${isFolder ? 'fa-folder-closed' : 'fa-file-pdf'}`}></i>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] font-black text-slate-700 line-clamp-2 break-words w-full leading-tight uppercase tracking-tight">
                            {item.name}
                          </span>
                          {!isFolder && (
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest block opacity-0 group-hover:opacity-100 transition-opacity">
                              Ouvrir le PDF
                            </span>
                          )}
                        </div>
                     </div>
                   );
                 })
               ) : (
                 <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-200 gap-6">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center">
                       <i className="fa-regular fa-folder-open text-5xl"></i>
                    </div>
                    <p className="font-black text-[10px] uppercase tracking-[0.4em]">Ce répertoire est actuellement vide</p>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Procedures;
