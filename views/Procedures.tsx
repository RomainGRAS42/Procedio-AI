
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
  id?: string;
  metadata?: any;
}

const Procedures: React.FC<ProceduresProps> = ({ user, onUploadClick, onSelectProcedure, initialSearchTerm = '', onSearchClear }) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [isSearching, setIsSearching] = useState(initialSearchTerm !== '');
  const [searchResults, setSearchResults] = useState<Procedure[]>([]);
  
  // Navigation Storage
  const [currentFolder, setCurrentFolder] = useState<string | null>(null); // null = Racine
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Catégories racines statiques (simule les dossiers si le bucket est vide ou pour forcer la structure)
  const rootCategories = ['INFRASTRUCTURE', 'LOGICIEL', 'MATERIEL', 'UTILISATEUR'];

  useEffect(() => {
    if (initialSearchTerm) {
      handleSearch(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  useEffect(() => {
    if (!searchTerm) {
      fetchStorageContent();
    }
  }, [currentFolder, searchTerm]);

  const fetchStorageContent = async () => {
    setLoading(true);
    try {
      if (currentFolder === null) {
        // À la racine, on affiche nos catégories principales
        setItems(rootCategories.map(c => ({ name: c })));
      } else {
        // Dans un dossier, on liste le contenu réel du bucket Supabase
        const { data, error } = await supabase.storage.from('procedures').list(currentFolder, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

        if (error) throw error;
        
        // On ne garde que les fichiers (pas les placeholders .emptyFolder s'il y en a)
        const filtered = data ? data.filter(i => i.name !== '.emptyFolder') : [];
        setItems(filtered);
      }
    } catch (e) {
      console.error("Erreur Storage:", e);
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
    
    try {
      // Recherche dans la table DB 'procedures' pour avoir les résultats sémantiques
      const { data, error } = await supabase
        .from('procedures')
        .select('*')
        .ilike('title', `%${termToSearch}%`);
        
      if (error) throw error;
      setSearchResults(data || []);
    } catch (e) {
      console.error("Erreur recherche:", e);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: StorageItem) => {
    if (currentFolder === null) {
      // C'est un dossier (catégorie)
      setCurrentFolder(item.name);
    } else {
      // C'est un fichier PDF
      // On construit l'objet Procedure
      const fullPath = `${currentFolder}/${item.name}`;
      onSelectProcedure({
        id: fullPath, // On utilise le path comme ID pour ProcedureDetail
        title: item.name,
        category: currentFolder,
        createdAt: item.metadata?.created_at ? new Date(item.metadata.created_at).toLocaleDateString() : 'N/A',
        views: 0,
        status: 'validated'
      });
    }
  };

  return (
    <div className="space-y-12 h-full flex flex-col pb-10 animate-fade-in">
      {/* HEADER DE RECHERCHE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="flex-1 max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Rechercher une documentation technique..."
            className="w-full pl-14 pr-4 py-5 rounded-[2rem] border-none bg-white shadow-xl shadow-indigo-500/5 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-lg font-semibold text-slate-700 placeholder:text-slate-300"
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

      {/* ZONE PRINCIPALE */}
      <div className="flex-1 space-y-10">
        {!isSearching && (
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-database text-sm"></i>
            </div>
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-[0.2em]">Base de Connaissances</h3>
            
            {currentFolder !== null && (
              <button 
                onClick={() => setCurrentFolder(null)} 
                className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-arrow-left"></i> Retour Racine
              </button>
            )}
          </div>
        )}

        <div className="min-h-[400px]">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chargement Supabase...</p>
            </div>
          ) : isSearching ? (
            <div className="grid grid-cols-1 gap-4">
              {searchResults.length > 0 ? searchResults.map(res => (
                <div key={res.id} onClick={() => onSelectProcedure(res)} className="p-6 bg-white border border-slate-100 rounded-[2rem] flex items-center gap-6 cursor-pointer hover:shadow-xl transition-all">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i className="fa-solid fa-file-pdf"></i></div>
                   <div className="flex-1">
                     <span className="font-bold text-slate-700 block">{res.title}</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{res.category}</span>
                   </div>
                </div>
              )) : (
                 <div className="py-20 text-center text-slate-300">Aucun résultat trouvé dans la base.</div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
              {/* Affichage des items (Dossiers ou Fichiers) */}
              {items.map((item) => {
                 const isFolder = currentFolder === null;
                 return (
                  <div 
                    key={item.id || item.name}
                    onClick={() => handleItemClick(item)}
                    className={`group relative flex flex-col items-center justify-center aspect-square rounded-[2.5rem] p-8 cursor-pointer transition-all hover:-translate-y-2 hover:shadow-[0_30px_60px_-15px_rgba(79,70,229,0.15)] ${
                      isFolder ? 'bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-indigo-200' : 'bg-white border border-slate-100 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`text-5xl mb-6 transition-all group-hover:scale-110 ${isFolder ? 'text-indigo-400 group-hover:text-indigo-600' : 'text-slate-200 group-hover:text-indigo-500'}`}>
                      <i className={`fa-solid ${isFolder ? 'fa-folder' : 'fa-file-pdf'}`}></i>
                    </div>
                    <span className="font-black text-slate-800 text-[11px] uppercase tracking-widest text-center leading-tight line-clamp-2">
                      {item.name}
                    </span>
                    
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-[2.5rem] border-2 border-indigo-500/0 group-hover:border-indigo-500/30 pointer-events-none transition-all"></div>
                  </div>
                 );
              })}

              {!loading && items.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-300">
                   <i className="fa-regular fa-folder-open text-4xl mb-4 block"></i>
                   <p className="text-[10px] font-black uppercase tracking-widest">Dossier vide</p>
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
