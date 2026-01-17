
import React, { useState } from 'react';
import { User, UserRole, Procedure } from '../types';

interface ProceduresProps {
  user: User;
  onUploadClick: () => void;
}

const Procedures: React.FC<ProceduresProps> = ({ user, onUploadClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Procedure[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setResults([]); // Réinitialise les résultats avant la nouvelle recherche

    try {
      // Appel réel au webhook N8N
      const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/search-procedures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm })
      });

      if (!response.ok) throw new Error('Erreur lors de la communication avec le serveur de recherche');

      const data = await response.json();
      
      // Adaptation robuste aux différents formats possibles renvoyés par N8N (Array direct ou objet { results: [...] })
      // On suppose que N8N renvoie des champs comme 'title', 'category' (ou 'folder'), etc.
      const items = Array.isArray(data) ? data : (data.results || data.documents || []);

      const mappedResults: Procedure[] = items.map((item: any, index: number) => ({
        id: item.id || `search-${Date.now()}-${index}`,
        title: item.title || item.name || 'Document sans titre',
        category: item.category || item.folder || 'AUTRE',
        createdAt: item.created_at ? new Date(item.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
        views: item.views || 0,
        status: 'validated'
      }));

      setResults(mappedResults);
    } catch (e) {
      console.error("Erreur recherche:", e);
      // En cas d'erreur, on laisse la liste vide pour afficher le message "Aucune procédure trouvée" ou on pourrait afficher une notif d'erreur.
    } finally {
      setLoading(false);
    }
  };

  const categories = ['LOGICIELS', 'INFRASTRUCTURE', 'MATÉRIEL', 'UTILISATEURS'];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Rechercher une procédure par titre ou tag..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl"></i>
          <button 
            onClick={handleSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Rechercher'}
          </button>
        </div>

        {user.role === UserRole.MANAGER && (
          <button 
            onClick={onUploadClick}
            className="bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
          >
            <i className="fa-solid fa-plus"></i>
            Nouvelle procédure
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Dossiers</h3>
          <button className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
            Affichage <i className="fa-solid fa-list-ul"></i>
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <button key={cat} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 hover:border-blue-500 hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <i className="fa-solid fa-folder text-2xl"></i>
              </div>
              <span className="font-bold text-slate-700 text-sm">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
        {loading ? (
           <div className="flex flex-col items-center gap-4">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
             <p className="font-bold text-slate-500">Recherche intelligente en cours...</p>
           </div>
        ) : results.length > 0 ? (
           <div className="w-full divide-y divide-slate-100 self-stretch">
             {results.map(res => (
                <div key={res.id} className="py-5 flex justify-between items-center hover:bg-slate-50 px-6 rounded-xl transition-colors cursor-pointer group">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <i className="fa-solid fa-file-lines"></i>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{res.title}</span>
                            <span className="text-xs font-medium text-slate-400 flex items-center gap-2">
                                <i className="fa-regular fa-clock"></i> {res.createdAt}
                            </span>
                        </div>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100">{res.category}</span>
                </div>
             ))}
           </div>
        ) : (
          <>
            <i className={`fa-regular ${hasSearched ? 'fa-face-frown-open' : 'fa-folder-open'} text-6xl mb-4 opacity-20`}></i>
            <p className="text-lg font-bold text-slate-600">
                {hasSearched ? 'Aucun résultat trouvé' : 'Vos procédures apparaîtront ici'}
            </p>
            <p className="text-sm mt-2">
                {hasSearched ? 'Essayez avec d\'autres mots-clés.' : 'Effectuez une recherche ou explorez les dossiers ci-dessus.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Procedures;
