import React, { useState, useEffect } from 'react';
import { Procedure, User } from '../types';
import { supabase } from '../lib/supabase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface StatisticsProps {
  onUploadClick: () => void;
  onSelectProcedure?: (p: Procedure) => void;
}

const Statistics: React.FC<StatisticsProps> = ({ onUploadClick, onSelectProcedure }) => {
  const [history, setHistory] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [missedOpportunities, setMissedOpportunities] = useState<{ term: string, count: number, trend: string }[]>([]);
  const [topContributors, setTopContributors] = useState<{ name: string, role: string, score: number, initial: string, color: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  
  const [selectedHealthFilter, setSelectedHealthFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: procData, error: procError } = await supabase.from('procedures').select('*').order('views', { ascending: false });
      if (procError) throw procError;

      const { data: suggCounts } = await supabase.from('procedure_suggestions').select('procedure_id');
      const countsMap: Record<string, number> = {};
      if (suggCounts) suggCounts.forEach((s: any) => { if (s.procedure_id) countsMap[s.procedure_id] = (countsMap[s.procedure_id] || 0) + 1; });
      
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

      const { data: logData } = await supabase.from('notes').select('title, created_at').ilike('title', 'LOG_SEARCH_FAIL_%');
      if (logData) {
        const counts: Record<string, number> = {};
        logData.forEach(log => {
          const term = log.title?.replace('LOG_SEARCH_FAIL_', '').trim() || "Inconnu";
          counts[term] = (counts[term] || 0) + 1;
        });
        const sortedGaps = Object.entries(counts)
          .map(([term, count]) => ({ term: term.length > 30 ? term.substring(0, 27) + '...' : term, count, trend: "récent" }))
          .sort((a, b) => b.count - a.count).slice(0, 4);
        setMissedOpportunities(sortedGaps.length > 0 ? sortedGaps : [{ term: "Aucun manque détecté", count: 0, trend: "Stable" }]);
      }

      const { data: suggData } = await supabase.from('procedure_suggestions').select('user_id, user:user_profiles!user_id(first_name, last_name, role)');
      if (suggData) {
        const contributors: Record<string, { count: number, name: string, role: string }> = {};
        suggData.forEach((s: any) => {
          if (!s.user_id) return;
          if (!contributors[s.user_id]) contributors[s.user_id] = { count: 0, name: s.user ? `${s.user.first_name} ${s.user.last_name}` : "Anonyme", role: s.user?.role || "Technicien" };
          contributors[s.user_id].count++;
        });
        const colors = ["bg-indigo-600", "bg-purple-600", "bg-blue-600", "bg-emerald-600", "bg-rose-600"];
        const sortedContribs = Object.values(contributors).sort((a, b) => b.count - a.count).slice(0, 3).map((c, i) => ({
             ...c, score: c.count, initial: c.name.split(' ').map(n => n[0]).join('').toUpperCase() || "?", color: colors[i % colors.length]
        }));
        setTopContributors(sortedContribs.length > 0 ? sortedContribs : [{ name: "Aucune suggestion", role: "Prêt à aider ?", score: 0, initial: "?", color: "bg-slate-200" }]);
      }

      const { data: teamData } = await supabase.from('user_profiles').select('*');
      if (teamData) setTeamMembers(teamData as User[]);

    } catch (e) { console.error("Erreur chargement Cockpit:", e); } finally { setLoading(false); }
  };

  const calculateHealthData = () => {
    if (history.length === 0) return [ { name: 'Fraîches', id: 'fresh', value: 0, color: '#10b981' }, { name: 'À vérifier', id: 'warning', value: 0, color: '#f59e0b' }, { name: 'Obsolètes', id: 'obsolete', value: 0, color: '#ef4444' }];
    const now = new Date();
    let fresh = 0, warning = 0, obsolete = 0;
    history.forEach(p => {
        const diffDays = Math.ceil(Math.abs(now.getTime() - new Date(p.updated_at || p.createdAt).getTime()) / (1000 * 60 * 60 * 24)); 
        if (diffDays < 90) fresh++; else if (diffDays < 180) warning++; else obsolete++;
    });
    return [ { name: 'Fraîches', id: 'fresh', value: fresh, color: '#10b981' }, { name: 'À vérifier', id: 'warning', value: warning, color: '#f59e0b' }, { name: 'Obsolètes', id: 'obsolete', value: obsolete, color: '#ef4444' } ];
  };

  const getFilteredProcedures = () => {
    if (!selectedHealthFilter) return [];
    const now = new Date();
    return history.filter(p => {
        const diffDays = Math.ceil(Math.abs(now.getTime() - new Date(p.updated_at || p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (selectedHealthFilter === 'fresh') return diffDays < 90;
        if (selectedHealthFilter === 'warning') return diffDays >= 90 && diffDays < 180;
        if (selectedHealthFilter === 'obsolete') return diffDays >= 180;
        return false;
    });
  };

  const healthData = calculateHealthData();
  const topConsultations = history.slice(0, 3);
  const toRewrite = history.map(p => {
      const monthsOld = Math.ceil(Math.abs(new Date().getTime() - new Date(p.updated_at || p.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
      const suggestionCount = p.suggestion_count || 0;
      const rewriteScore = (monthsOld / 2) + (suggestionCount * 5) + (p.views / 20);
      let reason = "Ancienneté";
      if (suggestionCount > 0) reason = `${suggestionCount} suggestion${suggestionCount > 1 ? 's' : ''} en attente`;
      else if (p.views > 50) reason = "Très consulté mais ancien";
      return { ...p, rewriteScore, reason };
    }).sort((a, b) => b.rewriteScore - a.rewriteScore).slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* HEADER */}
      <div className="flex justify-between items-end px-2">
        <div>
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Analyse de la Base</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Santé • Opportunités • Équipe</p>
        </div>
      </div>

      {/* ROW 1: HEALTH & OPPORTUNITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* ZONE 1: SANTÉ DE LA BASE (Compact Pie) */}
         <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="w-full h-40 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={healthData}
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                            className="cursor-pointer"
                            onClick={(data) => setSelectedHealthFilter(data.id)}
                        >
                            {healthData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" className="hover:opacity-80 transition-opacity" />
                            ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-2xl font-black text-slate-800">{history.length}</span>
                </div>
             </div>
             
             <div className="flex w-full justify-between gap-2 mt-4 px-2">
                {healthData.map((item, idx) => (
                    <div key={idx} className="text-center cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors flex flex-col items-center" onClick={() => setSelectedHealthFilter(item.id)}>
                        <span className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: item.color }}></span>
                        <span className="text-[10px] font-bold text-slate-700">{Math.round((item.value / (history.length || 1)) * 100)}%</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{item.name.split(' ')[0]}</span>
                    </div>
                ))}
             </div>
         </div>

         {/* ZONE 2: OPPORTUNITÉS MANQUÉES (List) */}
         <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center text-sm animate-pulse-slow">
                    <i className="fa-solid fa-magnifying-glass-location"></i>
                </div>
                <div>
                   <h3 className="font-bold text-slate-900 text-sm tracking-tight">Opportunités Manquées</h3>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Recherches sans résultats (7j)</p>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1">
                {missedOpportunities.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between hover:bg-white hover:shadow-md transition-all group">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-black">{item.count}</span>
                                <h4 className="font-bold text-slate-800 text-xs truncate group-hover:text-rose-600 transition-colors">"{item.term}"</h4>
                            </div>
                            <span className="text-[8px] text-slate-400 uppercase tracking-wider font-medium">{item.trend}</span>
                        </div>
                        <button onClick={onUploadClick} className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm">
                            <i className="fa-solid fa-plus text-[10px]"></i>
                        </button>
                    </div>
                ))}
             </div>
         </div>
      </div>

      {/* ROW 2: PERFORMANCE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TOP CONSULTATIONS */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-arrow-trend-up"></i> Top Consultations
                </h4>
                <div className="space-y-3">
                    {topConsultations.map((doc, i) => (
                        <a key={doc.id} href={`/procedure/${doc.id}`} onClick={(e) => { e.preventDefault(); onSelectProcedure?.(doc); }} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                             <div className="flex items-center gap-3 overflow-hidden">
                                 <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center font-black text-xs shrink-0">#{i+1}</div>
                                 <div className="min-w-0">
                                     <p className="font-bold text-slate-800 text-xs truncate group-hover:text-emerald-600 transition-colors">{doc.title}</p>
                                     <p className="text-[9px] text-slate-400 uppercase tracking-wider bg-slate-50 px-1.5 rounded w-fit mt-0.5">{doc.category}</p>
                                 </div>
                             </div>
                             <span className="text-[10px] font-black text-slate-400">{doc.views} vues</span>
                        </a>
                    ))}
                </div>
          </div>

          {/* A REECRIRE */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-arrow-trend-down"></i> À Réécrire (Prio)
                </h4>
                <div className="space-y-3">
                    {toRewrite.map((doc: any, i) => (
                        <a key={doc.id} href={`/procedure/${doc.id}`} onClick={(e) => { e.preventDefault(); onSelectProcedure?.(doc); }} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group">
                             <div className="min-w-0 flex-1">
                                 <p className="font-bold text-slate-800 text-xs truncate group-hover:text-rose-600 transition-colors">{doc.title}</p>
                                 <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[8px] bg-rose-50 text-rose-500 px-1.5 rounded font-bold uppercase">{doc.reason}</span>
                                    <span className="text-[8px] text-slate-300 font-medium">{new Date(doc.updated_at || doc.createdAt).toLocaleDateString()}</span>
                                 </div>
                             </div>
                             <i className="fa-solid fa-chevron-right text-[10px] text-slate-200 group-hover:text-rose-400 transition-colors"></i>
                        </a>
                    ))}
                </div>
          </div>
      </div>

      {/* ROW 3: TEAM & SKILLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* TOP CONTRIBUTORS */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-lg shadow-sm">
                    <i className="fa-solid fa-trophy"></i>
                 </div>
                 <h3 className="font-black text-slate-900 text-sm tracking-tight">Top Contributeurs</h3>
              </div>
              <div className="space-y-4 flex-1">
                {topContributors.map((contrib, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs text-white shadow-md ${contrib.color}`}>{contrib.initial}</div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800 text-xs">{contrib.name}</span>
                                <span className="text-[10px] font-black text-indigo-600">{contrib.score} pts</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                <div className={`h-full ${contrib.color}`} style={{ width: `${(contrib.score / 20) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                ))}
              </div>
          </div>

          {/* SKILL MAP (Champions) */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
               <div className="flex items-center gap-3 mb-6">
                 <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-lg shadow-sm">
                    <i className="fa-solid fa-crown"></i>
                 </div>
                 <h3 className="font-black text-slate-900 text-sm tracking-tight">Champions par Catégorie</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {(() => {
                  const categories = ['Logiciel', 'Réseau', 'Infrastructure', 'Sécurité'];
                  const champions = categories.map(cat => {
                     const champ = teamMembers.reduce((prev, current) => {
                        const prevScore = (prev?.stats_by_category as any)?.[cat] || 0;
                        const currScore = (current?.stats_by_category as any)?.[cat] || 0;
                        return currScore > prevScore ? current : prev;
                     }, null as any);
                     return { category: cat, user: champ, score: (champ?.stats_by_category as any)?.[cat] || 0 };
                  }).filter(c => c.score > 0).sort((a,b) => b.score - a.score);

                  return champions.length > 0 ? champions.map((champ, idx) => (
                     <div key={idx} className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-100 hover:border-indigo-200 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                           {champ.user?.avatar_url ? <img src={champ.user.avatar_url} className="w-full h-full object-cover"/> : <span className="font-black text-slate-600 text-xs">{champ.user?.first_name?.[0] || "?"}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{champ.category}</p>
                           <p className="font-bold text-slate-900 text-xs truncate">{champ.user?.first_name} {champ.user?.last_name}</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <i className="fa-solid fa-medal text-amber-400 text-sm"></i>
                            <span className="text-[9px] font-black text-slate-300">Lv.{Math.round(champ.score)}</span>
                        </div>
                     </div>
                  )) : <div className="col-span-full text-center text-slate-300 text-xs">Données insuffisantes</div>;
               })()}
              </div>
          </div>
      </div>

       {/* MODAL HEALTH FILTER */}
      {selectedHealthFilter && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedHealthFilter(null)}>
          <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[70vh] flex flex-col shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-slate-900 text-lg">
                    {selectedHealthFilter === 'fresh' ? 'Procédures Fraîches' : selectedHealthFilter === 'warning' ? 'À Vérifier' : 'Obsolètes'}
                </h3>
                <button onClick={() => setSelectedHealthFilter(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-colors"><i className="fa-solid fa-xmark"></i></button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-2">
                 {getFilteredProcedures().length > 0 ? getFilteredProcedures().map(proc => (
                    <div key={proc.id} onClick={(e) => { e.preventDefault(); setSelectedHealthFilter(null); onSelectProcedure?.(proc); }} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center hover:bg-white hover:shadow-md cursor-pointer transition-all border border-transparent hover:border-indigo-100">
                        <div>
                            <p className="font-bold text-slate-800 text-sm">{proc.title}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{proc.category}</p>
                        </div>
                        <i className="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                    </div>
                 )) : <div className="text-center py-8 text-slate-400 text-sm">Aucun résultat</div>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;
