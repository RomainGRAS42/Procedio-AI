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
  const cachedResults = cacheStore.get(`search_exact_${searchTerm}`);
  const [loading, setLoading] = useState(!cachedResults && searchTerm.trim() !== "");
  const [results, setResults] = useState<Procedure[]>(cachedResults || []);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setLoading(false);
        return;
      }

      console.log("🔍 SearchResults: Recherche par terme exact pour:", searchTerm);
      setLoading(true);
      let successLogged = false;
      let finalProcedures: Procedure[] = [];

      try {
        // 1. RECHERCHE DIRECTE SUPABASE (MATCH EXACT/PARTIEL SUR TITRE OU CONTENU)
        // Note: Utilisation de or() pour chercher dans le titre OU le contenu pour être efficace
        const { data: dbMatches, error: dbError } = await supabase
          .from('procedures')
          .select('*')
          .or(`title.ilike.%${searchTerm}%,Type.ilike.%${searchTerm}%`)
          .limit(20);

        if (dbError) console.error("❌ Database search error:", dbError);

        if (dbMatches && dbMatches.length > 0) {
          console.log("✅ Database matches found:", dbMatches.length);
          finalProcedures = dbMatches.map((f: any) => ({
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
          
          setResults(finalProcedures);
          cacheStore.set(`search_exact_${searchTerm}`, finalProcedures);
          setLoading(false);
          successLogged = true;
          return; 
        }

      } catch (err) {
        console.error("❌ Global Search error:", err);
      } finally {
        // 2. LOG SEARCH OPPORTUNITY (Si aucun résultat exact trouvé)
        if (!successLogged && finalProcedures.length === 0 && searchTerm.length > 2) {
           const normalizedTerm = searchTerm.trim();
           console.log("⚙️ Log de manque détecté pour:", normalizedTerm);
           
           try {
              const { data: existingOp } = await supabase
                .from('search_opportunities')
                .select('id, search_count')
                .ilike('term', normalizedTerm)
                .eq('status', 'pending')
                .maybeSingle();

              if (existingOp) {
                await supabase
                  .from('search_opportunities')
                  .update({ 
                    search_count: (existingOp.search_count || 0) + 1,
                    last_searched_at: new Date().toISOString()
                  })
                  .eq('id', existingOp.id);
              } else {
                await supabase
                  .from('search_opportunities')
                  .insert({
                    term: normalizedTerm,
                    search_count: 1,
                    status: 'pending',
                    last_searched_at: new Date().toISOString()
                  });
              }
           } catch (dbLogErr) {
              console.error("❌ Database logging failed:", dbLogErr);
           }
        }
        setLoading(false);
      }
    };

    performSearch();
  }, [searchTerm]);

  return (
    <div className="space-y-8 animate-slide-up pb-12 px-4 md:px-10 py-8 h-full">
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex items-center gap-6">
        <button 
          onClick={onBack}
          className="bg-slate-50 text-slate-400 w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all shadow-sm order-first group">
          <i className="fa-solid fa-arrow-left text-xl group-hover:-translate-x-1 transition-transform"></i>
        </button>
        <div>
          <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em] mb-2">
            Moteur de Recherche par Terme
          </p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Résultats pour <span className="text-indigo-600">"{searchTerm}"</span>
          </h2>
        </div>
      </section>

      {loading ? (
        <LoadingState message="Recherche des correspondances exactes..." />
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
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm animate-bounce-slow">
                <i className="fa-solid fa-magnifying-glass-minus"></i>
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Aucun résultat exact trouvé</h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8 font-medium">
                Aucune procédure ne contient précisément le terme "{searchTerm}".
                <br />
                <span className="text-indigo-500 font-medium block mt-3 text-sm">
                  <i className="fa-solid fa-clipboard-list mr-2"></i>
                  Besoin enregistré comme opportunité de connaissance.
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
