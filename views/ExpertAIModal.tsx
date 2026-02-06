import React, { useState } from 'react';
import { Procedure, User } from '../types';
import { supabase } from '../lib/supabase';

interface ExpertAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProcedure: (procedure: Procedure) => void;
  user: User;
}

const ExpertAIModal: React.FC<ExpertAIModalProps> = ({ isOpen, onClose, onSelectProcedure, user }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Procedure[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const exampleQueries = [
    "Mon téléphone Android ne reçoit plus les emails",
    "Comment configurer Outlook sur un nouveau PC ?",
    "Problème de connexion au VPN"
  ];

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    
    try {
      console.log("🤖 Expert IA: Recherche pour:", query);
      
      const { data, error: supabaseError } = await supabase.functions.invoke('copilot-assistant', {
        body: { 
          question: query,
          userName: `${user.firstName} ${user.lastName}`,
          userId: user.id
        }
      });

      if (supabaseError) throw supabaseError;

      // New unified format handling
      let foundProcedures: Procedure[] = [];

      // Case 1: Expert Synthesis (we fetch the main source)
      if (data.type === 'expert' && data.source) {
        const { data: proc } = await supabase
          .from('procedures')
          .select('*')
          .ilike('title', `%${data.source}%`)
          .maybeSingle();
        
        if (proc) {
          foundProcedures.push({
            id: proc.file_id || proc.uuid,
            file_id: proc.file_id || proc.uuid,
            title: proc.title,
            category: proc.Type,
            fileUrl: proc.file_url,
            createdAt: proc.created_at,
            views: proc.views || 0,
            status: proc.status
          } as Procedure);
        }
      }

      // Case 2/3: Explorer or Uncertain (fetch all matching titles)
      if (data.suggestions && data.suggestions.length > 0) {
        const titles = data.suggestions.map((s: any) => s.title);
        const { data: procs } = await supabase
          .from('procedures')
          .select('*')
          .in('title', titles);
        
        if (procs) {
          procs.forEach(p => {
             if (!foundProcedures.find(fp => fp.id === (p.file_id || p.uuid))) {
               foundProcedures.push({
                 id: p.file_id || p.uuid,
                 file_id: p.file_id || p.uuid,
                 title: p.title,
                 category: p.Type,
                 fileUrl: p.file_url,
                 createdAt: p.created_at,
                 views: p.views || 0,
                 status: p.status
               } as Procedure);
             }
          });
        }
      }

      setResults(foundProcedures);

      // Log failure if nothing found
      if (foundProcedures.length === 0) {
        await supabase.from('notes').insert({
          title: `🚨 LOG_EXPERT_FAIL`,
          content: `Recherche IA sans résultat par ${user.firstName}: "${query}"`,
          user_id: user.id
        });
      }

    } catch (err) {
      console.error("❌ Erreur recherche IA:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProcedure = (procedure: Procedure) => {
    onSelectProcedure(procedure);
    onClose();
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[3rem] shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-all z-10"
          >
            <i className="fa-solid fa-times text-lg" />
          </button>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl">
              🤖
            </div>
            <div>
              <h2 className="text-3xl font-black text-white mb-1">Expert IA Procedio</h2>
              <p className="text-indigo-100 text-sm font-medium">Recherche sémantique intelligente</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {!hasSearched ? (
            <>
              {/* Intro */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                <p className="text-indigo-900 font-semibold mb-2">
                  👋 Bonjour ! Je suis l'Expert IA de Procedio.
                </p>
                <p className="text-indigo-700 text-sm">
                  Décrivez-moi votre problème en langage naturel, et je vais chercher dans toutes les procédures pour trouver la solution adaptée.
                </p>
              </div>

              {/* Query Input */}
              <div>
                <label className="block text-slate-700 font-bold text-sm mb-3 uppercase tracking-wider">
                  Votre problème
                </label>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: Mon téléphone Android ne reçoit plus mes emails professionnels..."
                  className="w-full h-32 px-6 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none text-slate-700 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      handleSearch();
                    }
                  }}
                />
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  <i className="fa-solid fa-lightbulb mr-1" />
                  Astuce : Utilisez Ctrl+Entrée pour lancer la recherche
                </p>
              </div>

              {/* Examples */}
              <div>
                <p className="text-slate-700 font-bold text-xs mb-3 uppercase tracking-wider">
                  💡 Exemples de questions
                </p>
                <div className="space-y-2">
                  {exampleQueries.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQuery(example)}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-sm text-slate-600 hover:text-indigo-600 transition-all font-medium"
                    >
                      → {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                disabled={!query.trim() || loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-300 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none active:scale-95 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Recherche en cours...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-sparkles" />
                    <span>Lancer la recherche IA</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Results */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-800">
                    {results.length} {results.length > 1 ? 'procédures trouvées' : 'procédure trouvée'}
                  </h3>
                  <button
                    onClick={() => {
                      setHasSearched(false);
                      setResults([]);
                      setQuery('');
                    }}
                    className="text-indigo-600 hover:text-indigo-700 font-bold text-sm flex items-center gap-2"
                  >
                    <i className="fa-solid fa-arrow-left" />
                    Nouvelle recherche
                  </button>
                </div>

                {results.length > 0 ? (
                  <div className="space-y-3">
                    {results.map((procedure) => (
                      <button
                        key={procedure.id}
                        onClick={() => handleSelectProcedure(procedure)}
                        className="w-full bg-white border-2 border-slate-200 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 rounded-2xl p-6 text-left transition-all group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                            <i className="fa-solid fa-file-pdf" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-indigo-600 transition-colors">
                              {procedure.title}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                              <span className="bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-wider">
                                {procedure.category}
                              </span>
                              <span className="flex items-center gap-1">
                                <i className="fa-solid fa-eye" />
                                {procedure.views} vues
                              </span>
                            </div>
                          </div>
                          <div className="w-8 h-8 bg-slate-100 group-hover:bg-indigo-600 rounded-full flex items-center justify-center text-slate-400 group-hover:text-white transition-all flex-shrink-0">
                            <i className="fa-solid fa-arrow-right text-xs" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                      <i className="fa-solid fa-triangle-exclamation" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Aucun résultat</h4>
                    <p className="text-slate-500 max-w-md mx-auto">
                      L'IA n'a trouvé aucune procédure correspondant à votre recherche. 
                      Cette information nous aidera à améliorer notre base de connaissances.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpertAIModal;
