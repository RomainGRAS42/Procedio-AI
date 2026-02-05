import React, { useState, useEffect } from 'react';
import { Procedure } from '../types';
import { supabase } from '../lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface StatisticsProps {
  onUploadClick: () => void;
}

const Statistics: React.FC<StatisticsProps> = ({ onUploadClick }) => {
  const [history, setHistory] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [missedOpportunities, setMissedOpportunities] = useState<{ term: string, count: number, trend: string }[]>([]);
  const [topContributors, setTopContributors] = useState<{ name: string, role: string, score: number, initial: string, color: string }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch History & Performance
      const { data: procData, error: procError } = await supabase
        .from('procedures')
        .select('*')
        .order('views', { ascending: false });

      if (procError) throw procError;

      // 1.1 Récupérer les nombres de suggestions par procédure
      const { data: suggCounts } = await supabase
        .from('procedure_suggestions')
        .select('procedure_id');
      
      const countsMap: Record<string, number> = {};
      if (suggCounts) {
        suggCounts.forEach((s: any) => {
          if (s.procedure_id) {
            countsMap[s.procedure_id] = (countsMap[s.procedure_id] || 0) + 1;
          }
        });
      }
      
      const procs = (procData || []).map(p => ({
        id: p.uuid,
        file_id: p.uuid,
        title: p.title || "Sans titre",
        category: p.Type || "GÉNÉRAL",
        fileUrl: p.file_url,
        pinecone_document_id: p.pinecone_document_id,
        createdAt: p.created_at,
        updated_at: p.updated_at,
        views: p.views || 0,
        status: p.status || 'validated',
        suggestion_count: countsMap[p.uuid] || countsMap[p.id] || 0
      }));
      setHistory(procs);

      // 2. Fetch Missed Opportunities (Search Logs)
      const { data: logData } = await supabase
        .from('notes')
        .select('title, created_at')
        .ilike('title', 'LOG_SEARCH_FAIL_%');

      if (logData) {
        const counts: Record<string, number> = {};
        logData.forEach(log => {
          const term = log.title?.replace('LOG_SEARCH_FAIL_', '').trim() || "Inconnu";
          counts[term] = (counts[term] || 0) + 1;
        });
        
        const sortedGaps = Object.entries(counts)
          .map(([term, count]) => ({ 
            term: term.length > 30 ? term.substring(0, 27) + '...' : term, 
            count, 
            trend: "récent" 
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 4);
        
        setMissedOpportunities(sortedGaps.length > 0 ? sortedGaps : [
          { term: "Aucun manque détecté", count: 0, trend: "Stable" }
        ]);
      }

      // 3. Fetch Top Contributors (Suggestions)
      const { data: suggData } = await supabase
        .from('procedure_suggestions')
        .select(`
          user_id,
          user:user_profiles!user_id(first_name, last_name, role)
        `);

      if (suggData) {
        const contributors: Record<string, { count: number, name: string, role: string }> = {};
        suggData.forEach((s: any) => {
          if (!s.user_id) return;
          if (!contributors[s.user_id]) {
            contributors[s.user_id] = {
              count: 0,
              name: s.user ? `${s.user.first_name} ${s.user.last_name}` : "Anonyme",
              role: s.user?.role || "Technicien"
            };
          }
          contributors[s.user_id].count++;
        });

        const colors = ["bg-indigo-600", "bg-purple-600", "bg-blue-600", "bg-emerald-600", "bg-rose-600"];
        const sortedContribs = Object.values(contributors)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((c, i) => ({
            name: c.name,
            role: c.role,
            score: c.count,
            initial: c.name.split(' ').map(n => n[0]).join('').toUpperCase() || "?",
            color: colors[i % colors.length]
          }));
        
        setTopContributors(sortedContribs.length > 0 ? sortedContribs : [
          { name: "Aucune suggestion", role: "Prêt à aider ?", score: 0, initial: "?", color: "bg-slate-200" }
        ]);
      }

    } catch (e) {
      console.error("Erreur chargement Cockpit:", e);
    } finally {
      setLoading(false);
    }
  };

  // CALCULATE HEALTH DATA (Freshness)
  const calculateHealthData = () => {
    if (history.length === 0) return [
      { name: 'Aucune donnée', value: 1, color: '#f1f5f9' }
    ];
    
    const now = new Date();
    let fresh = 0;
    let warning = 0;
    let obsolete = 0;

    history.forEach(p => {
        // On utilise updated_at si disponible, sinon createdAt
        const dateStr = p.updated_at || p.createdAt;
        const date = new Date(dateStr);
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays < 90) fresh++;
        else if (diffDays < 180) warning++;
        else obsolete++;
    });

    return [
        { name: 'Fraîches (< 3 mois)', value: fresh, color: '#10b981' }, 
        { name: 'À vérifier (3-6 mois)', value: warning, color: '#f59e0b' }, 
        { name: 'Obsolètes (> 6 mois)', value: obsolete, color: '#ef4444' } 
    ];
  };

  const healthData = calculateHealthData();
  const topConsultations = history.slice(0, 3);
  
  // 🚀 INTELLIGENCE : Calcul de la priorité de réécriture
  const toRewrite = history
    .map(p => {
      // Calcul du score : (Age en mois / 2) + (Nombre de suggestions * 5) + (Vues / 10)
      const monthsOld = Math.ceil(Math.abs(new Date().getTime() - new Date(p.updated_at || p.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
      const suggestionCount = p.suggestion_count || 0;
      const rewriteScore = (monthsOld / 2) + (suggestionCount * 5) + (p.views / 20);
      
      let reason = "Ancienneté";
      if (suggestionCount > 0) reason = `${suggestionCount} suggestion${suggestionCount > 1 ? 's' : ''} en attente`;
      else if (p.views > 50) reason = "Très consulté mais ancien";
      
      return { ...p, rewriteScore, reason };
    })
    .sort((a, b) => b.rewriteScore - a.rewriteScore)
    .slice(0, 3);


  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* HEADER */}
      <div className="flex justify-between items-end mb-4">
        <div>
           <h2 className="text-4xl font-black text-slate-900 tracking-tight">Cockpit de Pilotage</h2>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Analyses & Aide à la décision</p>
        </div>
      </div>

      {/* SECTION 1: OPPORTUNITÉS MANQUÉES (Alertes) */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
         <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center text-lg animate-pulse-slow">
                <i className="fa-solid fa-magnifying-glass-location"></i>
            </div>
            <div>
                <h3 className="font-bold text-slate-900 text-lg">Opportunités Manquées</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ce que vos équipes cherchent sans trouver</p>
            </div>
            <i className="fa-solid fa-circle-info text-slate-300 ml-2" title="Basé sur les recherches 'Sans Résultat' des 7 derniers jours"></i>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {missedOpportunities.map((item, idx) => (
                <div key={idx} className="bg-white border border-slate-100 rounded-3xl p-6 hover:shadow-xl hover:shadow-rose-50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                    
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{item.count} échecs</span>
                        <span className="text-[9px] text-slate-300 font-bold uppercase">{item.trend}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm mb-6 relative z-10 leading-relaxed">"{item.term}"</h4>
                    <button 
                        onClick={onUploadClick}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all relative z-10 flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-plus"></i> Créer
                    </button>
                </div>
            ))}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SECTION 2: SANTÉ DE LA BASE (Chart) */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-emerald-50 text-emerald-500 rounded-lg flex items-center justify-center text-sm">
                    <i className="fa-solid fa-heart-pulse"></i>
                </div>
                <h3 className="font-bold text-slate-900">Santé de la Base</h3>
             </div>
             
             <div className="flex-1 flex items-center justify-center min-h-[250px] relative">
                {loading ? (
                    <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full"></div>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={healthData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {healthData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#334155' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
                {/* Center Text */}
                {!loading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <span className="block text-3xl font-black text-slate-800">{history.length}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Docs</span>
                        </div>
                    </div>
                )}
             </div>

             <div className="space-y-3 mt-6">
                {healthData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-700">{Math.round((item.value / history.length) * 100) || 0}%</span>
                    </div>
                ))}
             </div>
          </div>

          {/* SECTION 3: PERFORMANCE DU CONTENU */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
             <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center text-sm">
                    <i className="fa-solid fa-chart-line"></i>
                </div>
                <h3 className="font-bold text-slate-900">Performance du Contenu</h3>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* TOP CONSULTATIONS */}
                <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-arrow-trend-up"></i> Top Consultations
                    </h4>
                    {topConsultations.map((doc, i) => (
                        <div key={doc.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between hover:bg-white hover:shadow-lg transition-all group border border-transparent hover:border-indigo-100">
                            <div className="flex items-center gap-4">
                                <span className="text-2xl font-black text-slate-200 group-hover:text-indigo-200 transition-colors">#{i+1}</span>
                                <div>
                                    <p className="font-bold text-slate-800 text-sm line-clamp-1">{doc.title}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">{doc.category}</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">{doc.views} vues</span>
                        </div>
                    ))}
                </div>

                {/* A REECRIRE */}
                <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-arrow-trend-down"></i> À Réécrire (Vieux Docs)
                    </h4>
                    {toRewrite.map((doc: any, i) => (
                        <div 
                          key={doc.id} 
                          className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:border-rose-200 hover:shadow-lg transition-all group relative cursor-help"
                          title={`Priorité : ${Math.round(doc.rewriteScore)} - Raison : ${doc.reason}`}
                        >
                             <div>
                                <p className="font-medium text-slate-600 text-sm line-clamp-1 group-hover:text-rose-600 transition-colors">{doc.title}</p>
                                <p className="text-[9px] text-slate-300 uppercase tracking-wider mt-0.5">
                                  {doc.reason} • {new Date(doc.updated_at || doc.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <span className="text-[10px] font-bold text-rose-400">Prio {Math.round(doc.rewriteScore)}</span>
                        </div>
                    ))}
                </div>
             </div>
          </div>
      </div>

      {/* SECTION 4: TOP CONTRIBUTEURS (LIGHT & SOFT) - Updated */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl border border-indigo-100">
                <i className="fa-solid fa-trophy"></i>
            </div>
            <div>
                <h3 className="font-black text-slate-900 text-2xl tracking-tight">Top Contributeurs</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ils construisent la base avec vous</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topContributors.map((contrib, i) => (
                <div key={i} className="bg-slate-50 rounded-3xl p-6 flex flex-col gap-6 hover:bg-white hover:shadow-xl hover:shadow-indigo-50 transition-all group border border-transparent hover:border-indigo-100">
                    <div className="flex items-center justify-between">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-sm shadow-sm text-white ${contrib.color}`}>
                            {contrib.initial}
                        </div>
                        {i === 0 && <i className="fa-solid fa-crown text-amber-500 text-xl animate-bounce-subtle"></i>}
                    </div>
                    
                    <div>
                        <h4 className="font-bold text-slate-800 text-lg">{contrib.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{contrib.role}</p>
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                             <span className="text-[9px] font-bold text-slate-400 uppercase">Impact</span>
                             <span className="text-2xl font-black text-slate-800">{contrib.score}</span>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium">Suggestions envoyées</p>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-3 overflow-hidden">
                            <div 
                                className={`h-full ${contrib.color}`} 
                                style={{ width: `${(contrib.score / 20) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            ))}
          </div>
      </div>

    </div>
  );
};

export default Statistics;
