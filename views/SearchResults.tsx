import React, { useEffect, useState } from "react";
import { Procedure, User } from "../types";
import { supabase } from "../lib/supabase";
import LoadingState from "../components/LoadingState";
import { cacheStore } from "../lib/CacheStore";

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
  const cachedResults = cacheStore.get(`search_${searchTerm}`);
  const [loading, setLoading] = useState(!cachedResults && searchTerm.trim() !== "");
  const [results, setResults] = useState<Procedure[]>(cachedResults || []);
  const [aiAnalysis, setAiAnalysis] = useState<string>("");

  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setLoading(false);
        return;
      }

      console.log("🔍 SearchResults: Recherche Hybride pour:", searchTerm);
      setLoading(true);
      
      try {
        // 1. RECHERCHE DIRECTE SUPABASE (MATCH EXACT/PARTIEL)
        const { data: dbMatches, error: dbError } = await supabase
          .from('procedures')
          .select('*')
          .ilike('title', `%${searchTerm}%`)
          .limit(10);

        if (dbError) console.error("❌ Database search error:", dbError);

        if (dbMatches && dbMatches.length > 0) {
          console.log("✅ Database matches found:", dbMatches.length);
          const procedures: Procedure[] = dbMatches.map((f: any) => ({
            id: f.uuid || f.file_id || f.id,
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
          setResults(procedures);
          setLoading(false);
          return;
        }

        // 2. FALLBACK SÉMANTIQUE (WEBHOOK n8n)
        console.log("🤖 Fallback: Recherche via Webhook pour:", searchTerm);
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
        const resultData = Array.isArray(data) ? data[0] : data;
        let webhookProcedures: any[] = [];
        
        if (resultData && resultData.results) {
            webhookProcedures = resultData.results;
        }

        const foundProcedures: Procedure[] = webhookProcedures.map((f: any, index: number) => ({
          id: f.id || f.uuid || `webhook-${index}`,
          db_id: f.id || f.uuid,
          file_id: f.id || f.uuid || `webhook-${index}`,
          title: f.title || "Sans titre",
          category: f.category || 'NON CLASSÉ',
          fileUrl: f.file_url,
          pinecone_document_id: f.pinecone_document_id,
          createdAt: new Date().toISOString(),
          views: 0,
          status: 'validated'
        }));

        setResults(foundProcedures);
        cacheStore.set(`search_${searchTerm}`, foundProcedures);

        // Log si aucun résultat global
        if (foundProcedures.length === 0) {
          console.log("⚠️ Aucune procédure trouvée au total pour:", searchTerm);
          if (searchTerm.length > 2) {
            await supabase.from('notes').insert({
              user_id: user.id,
              title: `LOG_SEARCH_FAIL_${searchTerm.toUpperCase()}`,
              content: `Recherche hybride sans résultat pour l'utilisateur ${user.firstName}.`,
              tags: ['system_log', 'search_fail'],
              status: 'private',
              category: 'general'
            });
          }
        }
      } catch (err) {
        console.error("❌ Search error:", err);
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
    <div className="space-y-8 animate-slide-up pb-12 px-4 md:px-10 py-8 h-full">
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
        <LoadingState message="L'IA décode votre intention..." />
      ) : (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
          {results.length > 0 ? (
            results.map((proc) => (
              <article
                key={proc.id}
                onClick={() => onSelectProcedure(proc)}
                className="group relative flex flex-col bg-white border border-slate-100 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1 hover:border-indigo-400 hover:shadow-xl shadow-sm overflow-hidden"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-lg transition-all group-hover:bg-indigo-600 group-hover:text-white shadow-sm shrink-0">
                    <i className="fa-solid fa-file-pdf"></i>
                  </div>
                  <div className="px-2 py-1 bg-slate-50 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    {proc.category}
                  </div>
                </div>
                
                <div className="flex-1 mb-3">
                  <h3 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                    {proc.title}
                  </h3>
                </div>
                
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px]">
                   <div className="flex items-center gap-1.5 font-bold text-slate-400">
                     <i className="fa-solid fa-eye"></i>
                     <span>{proc.views || 0}</span>
                   </div>
                   <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all"></i>
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
