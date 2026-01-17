
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
        category: currentPath || 'RACINE',
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
    <div className="space-y-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div className="flex-1 max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Rechercher une procédure..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg"
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
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl"></i>
          {searchTerm && (
            <button 
              onClick={() => handleSearch()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Go
            </button>
          )}
        </div>

        {user.role === UserRole.MANAGER && (
          <button 
            onClick={onUploadClick}
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <i className="fa-solid fa-plus"></i>
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        )}
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col min-h-[400px]">
        {!isSearching && (
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
             <button 
                onClick={() => setCurrentPath('')}
                className={`flex items-center gap-2 font-bold text-sm ${!currentPath ? 'text-slate-900' : 'text-slate-400 hover:text-blue-600'}`}
             >
               <i className="fa-solid fa-server"></i> Racine
             </button>
             {currentPath && (
               <>
                 <i className="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                 <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm uppercase tracking-wider">{currentPath.replace('/', ' > ')}</span>
                 </div>
                 <button onClick={handleBack} className="ml-auto text-slate-400 hover:text-slate-800 text-sm font-bold flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <i className="fa-solid fa-arrow-turn-up"></i> Remonter
                 </button>
               </>
             )}
          </div>
        )}

        <div className="flex-1">
          {loading ? (
             <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
               <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
               <span className="font-bold text-sm animate-pulse">Chargement...</span>
             </div>
          ) : isSearching ? (
             <div className="space-y-2">
                <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest mb-4">Résultats de recherche</h3>
                {searchResults.length > 0 ? (
                  searchResults.map(res => (
                    <div key={res.id} onClick={() => onSelectProcedure(res)} className="p-4 flex items-center gap-4 hover:bg-slate-50 rounded-xl cursor-pointer group transition-all border border-transparent hover:border-slate-100">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <i className="fa-solid fa-file-invoice"></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{res.title}</h4>
                        <span className="text-xs text-slate-400">{res.category}</span>
                      </div>
                      <i className="fa-solid fa-chevron-right text-slate-300 group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
                    <i className="fa-solid fa-face-frown text-4xl"></i>
                    <p className="font-bold">Aucune procédure ne correspond à votre recherche.</p>
                  </div>
                )}
             </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {storageItems.length > 0 ? (
                 storageItems.map((item, idx) => {
                   const isFolder = !item.metadata;
                   return (
                     <div 
                        key={item.id || idx} 
                        onClick={() => handleItemClick(item)}
                        className={`aspect-square rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg border group ${
                          isFolder 
                            ? 'bg-slate-50 border-slate-100 hover:border-blue-300 hover:bg-blue-50/50' 
                            : 'bg-white border-slate-200 hover:border-blue-400'
                        }`}
                     >
                        <div className={`text-3xl md:text-4xl transition-colors ${isFolder ? 'text-blue-400 group-hover:text-blue-600' : 'text-slate-400 group-hover:text-red-500'}`}>
                          <i className={`fa-solid ${isFolder ? 'fa-folder' : 'fa-file-pdf'}`}></i>
                        </div>
                        <span className="text-[11px] md:text-xs font-bold text-slate-700 line-clamp-2 break-words w-full">
                          {item.name}
                        </span>
                        {!isFolder && (
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">
                            Fichier
                          </span>
                        )}
                     </div>
                   );
                 })
               ) : (
                 <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 opacity-50">
                    <i className="fa-regular fa-folder-open text-5xl mb-4"></i>
                    <p className="font-bold">Ce dossier est vide</p>
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
