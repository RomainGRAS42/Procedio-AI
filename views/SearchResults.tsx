import React, { useEffect, useState } from "react";
import { Procedure, User } from "../types";
import { supabase } from "../lib/supabase";

interface SearchResultsProps {
  user: User;
  searchTerm: string;
  onSelectProcedure: (procedure: Procedure) => void;
  onBack: () => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  user,
  searchTerm,
  onSelectProcedure,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Procedure[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");

  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setLoading(false);
        return;
      }

      console.log("🔍 SearchResults: Recherche via Webhook pour:", searchTerm);
      setLoading(true);
      try {
        // Appel au Webhook n8n
        const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/search-procedures', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchTerm,
            user_email: user.email || 'unknown'
          })
        });

        if (!response.ok) {
          throw new Error(`Erreur webhook: ${response.status}`);
        }

        const data = await response.json();
        console.log("🤖 Webhook Response:", data);

        let procedures: any[] = [];
        
        // Parse response (Array or Object)
        // Format attendu: [ { success: true, results: [...] } ] ou { results: [...] }
        const resultData = Array.isArray(data) ? data[0] : data;
        
        if (resultData && resultData.results) {
            procedures = resultData.results;
        }

        console.log(`✅ ${procedures.length} procédures trouvées`);

        const foundProcedures: Procedure[] = procedures.map((f: any, index: number) => ({
          id: f.id || `webhook-${index}`, // Fallback ID if missing
          file_id: f.id || `webhook-${index}`,
          title: f.title || "Sans titre",
          category: f.category || 'NON CLASSÉ',
          fileUrl: f.file_url,
          pinecone_document_id: f.pinecone_document_id,
          createdAt: new Date().toISOString(), // Webhook doesn't return date usually
          views: 0,
          status: 'validated'
        }));

        console.log("✨ Résultats formatés:", foundProcedures);
        setResults(foundProcedures);

        // Log si aucun résultat
        if (foundProcedures.length === 0) {
          console.log("⚠️ Aucune procédure trouvée pour:", searchTerm);
        }

      } catch (err) {
        console.error("❌ Semantic search error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [searchTerm, user.id, user.firstName]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      {/* Header Resultats */}
      {/* Header Resultats */}
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex items-center gap-6">
        <button 
          onClick={onBack}
          className="bg-slate-50 text-slate-400 w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all shadow-sm order-first group">
          <i className="fa-solid fa-arrow-left text-xl group-hover:-translate-x-1 transition-transform"></i>
        </button>
        <div>
          <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-2">
            Moteur de Recherche IA
          </p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Résultats pour <span className="text-indigo-600">"{searchTerm}"</span>
          </h2>
        </div>
      </section>

      {/* Loading State */}
      {loading ? (
        <section className="flex flex-col items-center justify-center py-20 gap-8">
           <div className="relative">
             <div className="w-24 h-24 rounded-full border-4 border-indigo-100"></div>
             <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center text-indigo-600 text-2xl">
               <i className="fa-solid fa-brain animate-pulse"></i>
             </div>
           </div>
           <div className="text-center">
             <h3 className="text-lg font-black text-slate-800 mb-2">Analyse Sémantique en cours...</h3>
             <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">L'IA décode votre intention</p>
           </div>
        </section>
      ) : (
        /* Results Grid */
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.length > 0 ? (
            results.map((proc) => (
              <article
                key={proc.id}
                onClick={() => onSelectProcedure(proc)}
                className="bg-white p-8 rounded-[2rem] border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between h-56"
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl border border-indigo-100 group-hover:scale-110 transition-transform duration-300">
                      <i className="fa-solid fa-file-pdf"></i>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 bg-slate-50 px-3 py-1 rounded-lg">
                      {proc.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {proc.title}
                  </h3>
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                     <i className="fa-solid fa-eye text-indigo-300"></i> {proc.views} vues
                   </div>
                   <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                     <i className="fa-solid fa-arrow-right text-xs"></i>
                   </div>
                </div>
              </article>
            ))
          ) : (
            /* Empty State */
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm animate-bounce-slow">
                <i className="fa-solid fa-magnifying-glass-minus"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Aucun résultat trouvé</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8 font-medium">
                Notre IA n'a trouvé aucune procédure correspondant à "{searchTerm}".
                <br />
                <span className="text-indigo-500 font-medium block mt-3 text-sm">
                  <i className="fa-solid fa-lightbulb mr-2"></i>
                  Grâce à cette recherche, nous pourrons identifier et créer les procédures manquantes.
                </span>
              </p>
              <button 
                onClick={onBack}
                className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-lg active:scale-95">
                Retour aux procédures
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default SearchResults;
