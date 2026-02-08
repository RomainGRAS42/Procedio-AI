

import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, Procedure } from '../types';
import { supabase } from '../lib/supabase';
// ExpertAIModal moved to App.tsx
import SharePointImportModal from './SharePointImportModal';
import LoadingState from '../components/LoadingState';

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
  // AI Modal moved to App.tsx
  
  const [currentFolder, setCurrentFolder] = useState<string | null>(initialFolder); 
  const [folders, setFolders] = useState<Array<{ name: string; count: number }>>([]);
  const [files, setFiles] = useState<Procedure[]>([]);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [isSharePointModalOpen, setIsSharePointModalOpen] = useState(false);
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');

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
        db_id: f.uuid,
        file_id: f.file_id || f.uuid,
        title: f.title || "Sans titre",
        category: f.Type || 'NON CLASSÉ',
        fileUrl: f.file_url,
        pinecone_document_id: f.file_id || f.uuid,
        createdAt: f.created_at,
        views: f.views || 0,
        status: f.status || 'validated'
      }));
      setAllProcedures(mappedProcs);
      
      console.log("📦 fetchStructure: Chargé", mappedProcs.length, "procédures dans allProcedures");
      
      const countsMap: Record<string, number> = {};
      mappedProcs.forEach(p => {
        const cat = p.category.toUpperCase();
        countsMap[cat] = (countsMap[cat] || 0) + 1;
      });

      const uniqueCategories = Array.from(new Set(
        results.map(p => (p.Type ? String(p.Type).toUpperCase() : 'NON CLASSÉ'))
      ));
      
      const defaultCats = ['INFRASTRUCTURE', 'LOGICIEL', 'MATERIEL', 'UTILISATEUR'];
      const finalFolders = Array.from(new Set([...defaultCats, ...uniqueCategories])).sort() as string[];
      
      // We can wrap finalFolders with count metadata
      const foldersWithCounts = finalFolders.map(folder => ({
        name: folder,
        count: countsMap[folder] || 0
      }));
      
      setFolders(foldersWithCounts as any); // Type assertion to avoid breaking existing state if needed, but better to update state type

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
    <div className="space-y-12 h-full flex flex-col pb-10 px-4 md:px-10 animate-fade-in">
      {/* Expert IA Modal moved to App.tsx */}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        {/* Search bar removed - now in Header */}
        
        <div></div>

        <div className="flex items-center gap-6">
          {/* ZONE 1 : UTILITAIRE (REFRESH) */}
          <div className="group relative">
            <button 
              onClick={() => fetchStructure()}
              className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all hover:shadow-lg active:scale-95"
            >
              <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`}></i>
            </button>
            {/* Tooltip Refresh */}
            <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-48 p-3 bg-slate-800 text-white text-[10px] font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-50 text-center leading-relaxed">
              Actualiser la liste pour voir les dernières procédures ajoutées par l'équipe.
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-2 border-8 border-transparent border-b-slate-800"></div>
            </div>
          </div>

          {/* SÉPARATEUR VISUEL */}
          {user.role === UserRole.MANAGER && (
            <div className="h-8 w-px bg-slate-200"></div>
          )}

          {/* ZONE 1.5 : VIEW TOGGLE (GRID/LIST) */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <button 
              onClick={() => setViewType('grid')}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${viewType === 'grid' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vue Grille"
            >
              <i className="fa-solid fa-table-cells-large"></i>
            </button>
            <button 
              onClick={() => setViewType('list')}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${viewType === 'list' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vue Liste"
            >
              <i className="fa-solid fa-list"></i>
            </button>
          </div>

          {/* ZONE 2 : ACTIONS DE CRÉATION (GROUPÉES) */}
          {user.role === UserRole.MANAGER && (
            <div className="flex items-center gap-3">
              <div className="group relative">
                <button 
                  onClick={onUploadClick}
                  className="bg-indigo-600 text-white px-8 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-slate-900 transition-all shadow-2xl active:scale-95 shadow-indigo-200"
                >
                  <i className="fa-solid fa-plus text-sm"></i>
                  <span>Nouvelle Procédure</span>
                </button>
                {/* Tooltip Nouvelle Procédure */}
                <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[10px] font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-50 text-center leading-relaxed">
                  Ajouter manuellement un PDF ou créer une procédure vierge depuis votre ordinateur.
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-2 border-8 border-transparent border-b-slate-800"></div>
                </div>
              </div>

              <div className="relative group">
                <button 
                  onClick={() => setIsSharePointModalOpen(true)}
                  className="bg-white px-6 py-5 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest flex items-center gap-3 hover:shadow-xl hover:shadow-indigo-100 transition-all active:scale-95 border border-slate-100 text-slate-600 hover:text-[#0078d4]"
                >
                  <i className="fa-brands fa-microsoft text-lg text-[#0078d4]"></i>
                  <span>Importer SharePoint</span>
                </button>
                
                {/* Tooltip Premium */}
                <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-80 p-4 bg-slate-800 text-white text-[10px] font-medium rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-50 text-center leading-relaxed">
                  Connectez votre Cloud pour synchroniser automatiquement vos dossiers SharePoint masifs.
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-2 border-8 border-transparent border-b-slate-800"></div>
                </div>
              </div>
            </div>
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
          {loading && (files.length === 0 && (folders as any[]).length === 0) ? (
            <LoadingState message="Synchronisation cloud..." />
          ) : isSearching ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
              {searchResults.length > 0 ? searchResults.map(res => (
                <div 
                  key={res.id} 
                  onClick={() => onSelectProcedure(res)} 
                  className="group relative flex flex-col bg-white border border-slate-100 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:border-indigo-400 hover:shadow-xl shadow-sm overflow-hidden"
                >
                   <div className="flex items-center gap-3 mb-4">
                     <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center text-lg group-hover:bg-rose-500 group-hover:text-white transition-all shadow-sm shrink-0">
                       <i className="fa-solid fa-file-pdf"></i>
                     </div>
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">
                       {res.category}
                     </span>
                   </div>
                   
                   <div className="flex-1 mb-3">
                     <h3 className="font-bold text-slate-900 text-xs leading-snug group-hover:text-indigo-600 transition-colors uppercase tracking-tight line-clamp-2">
                       {res.title}
                     </h3>
                   </div>

                   <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px]">
                     <div className="flex items-center gap-1.5 font-bold text-slate-400">
                       <i className="fa-solid fa-eye"></i>
                       <span>{res.views || 0}</span>
                     </div>
                     <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"></i>
                   </div>
                </div>
              )) : (
                 <div className="col-span-full py-20 text-center text-slate-300 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
                   <i className="fa-solid fa-magnifying-glass text-3xl mb-4 opacity-20"></i>
                   <p className="text-[10px] font-black uppercase tracking-widest">Aucune procédure ne correspond à votre recherche</p>
                 </div>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              {currentFolder === null && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {(folders as any[]).map((folder: any) => {
                    const folderName = typeof folder === 'string' ? folder : folder.name;
                    const folderCount = typeof folder === 'string' ? 0 : folder.count;
                    
                    return (
                      <div 
                        key={folderName}
                        onClick={() => setCurrentFolder(folderName)}
                        className="group relative flex flex-col items-center justify-center rounded-[2.5rem] p-10 cursor-pointer transition-all hover:shadow-2xl hover:border-indigo-400 bg-white border border-slate-100 animate-slide-up group"
                      >
                        <div className="text-6xl mb-6 text-indigo-50 transition-all group-hover:scale-110 group-hover:text-indigo-600">
                          <i className="fa-solid fa-folder"></i>
                        </div>
                        <div className="flex flex-col items-center gap-2 mt-2">
                          <span className="font-black text-slate-900 text-[12px] uppercase tracking-widest text-center leading-tight">
                            {folderName}
                          </span>
                          <div className="px-3 py-1 bg-slate-100 rounded-full border border-slate-200/50 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                            <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600 whitespace-nowrap">
                              {folderCount || 0} {folderCount > 1 ? 'fichiers' : 'fichier'}
                            </span>
                          </div>
                        </div>
                        <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[9px] font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all scale-0 group-hover:scale-100">
                          <i className="fa-solid fa-arrow-right"></i>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* FICHIERS (GRID OR LIST) */}
              {currentFolder !== null && (
                viewType === 'grid' ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                    {files.map((file) => (
                      <div 
                        key={file.id}
                        onClick={() => onSelectProcedure(file)}
                        className="group relative flex flex-col bg-white border border-slate-100 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:border-emerald-400 hover:shadow-xl shadow-sm overflow-hidden"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center text-lg transition-all group-hover:bg-emerald-500 group-hover:text-white shadow-sm shrink-0">
                            <i className="fa-solid fa-file-pdf"></i>
                          </div>
                          <div className="px-2 py-1 bg-slate-50 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            {file.category}
                          </div>
                        </div>
                        <div className="flex-1 mb-3">
                          <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                            {cleanFileName(file.title)}
                          </h4>
                        </div>
                        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px]">
                           <div className="flex items-center gap-1.5 font-bold text-slate-400">
                             <i className="fa-solid fa-eye"></i>
                             <span>{file.views || 0}</span>
                           </div>
                           <i className="fa-solid fa-arrow-right text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all"></i>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="animate-slide-up">
                    <div className="w-full bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                      <div>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom du fichier</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest md:table-cell">Modifié le</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest lg:table-cell">Catégorie</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-10">Vues</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {files.map((file) => (
                              <tr 
                                key={file.id}
                                onClick={() => onSelectProcedure(file)}
                                className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
                              >
                                <td className="px-8 py-6">
                                  <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center text-sm group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0">
                                      <i className="fa-solid fa-file-pdf"></i>
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm group-hover:text-emerald-600 transition-colors uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                                      {cleanFileName(file.title)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-5 md:table-cell">
                                  <span className="text-[11px] font-medium text-slate-400">
                                    {file.createdAt ? new Date(file.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '--'}
                                  </span>
                                </td>
                                <td className="px-6 py-5 lg:table-cell">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-md">
                                    {file.category}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-right pr-10">
                                  <div className="flex items-center justify-end gap-2 text-slate-400">
                                    <span className="text-[11px] font-bold">{file.views || 0}</span>
                                    <i className="fa-solid fa-eye text-[10px] opacity-30"></i>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )
              )}

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
            )}
        </div>
      </div>

      {isSharePointModalOpen && (
        <SharePointImportModal 
          onClose={() => setIsSharePointModalOpen(false)}
          onImport={(url) => {
            console.log("Import SharePoint requested:", url);
            // Ici, on pourrait déclencher un vrai appel backend
          }}
        />
      )}
    </div>
  );
};

export default Procedures;
