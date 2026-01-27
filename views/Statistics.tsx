import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// --- COMPOSANTS UTILITAIRES ---

// Composant pour l'explication au survol (Demande clé du manager)
const InfoTooltip: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="group relative inline-block ml-2">
    <i className="fa-solid fa-circle-info text-slate-300 hover:text-indigo-500 cursor-help transition-colors"></i>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-slate-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
      <p className="font-bold mb-1 text-indigo-300">{title}</p>
      <p className="text-slate-300 leading-relaxed">{desc}</p>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-900"></div>
    </div>
  </div>
);

// --- DONNÉES SIMULÉES (MOCK DATA) ---

// 1. Opportunités Manquées (Search Gaps)
const searchGaps = [
  { term: "Reset VPN AnyConnect", count: 18, lastSearch: "Hier" },
  { term: "Configuration Outlook 2024", count: 12, lastSearch: "Il y a 2h" },
  { term: "Erreur 504 Gateway", count: 9, lastSearch: "Lun." },
  { term: "Procédure Départ Collaborateur", count: 7, lastSearch: "Semaine dernière" },
];

// 2. Santé de la Base (Obsolescence)
const healthData = [
  { name: "Fraîches (< 3 mois)", value: 65, color: "#10b981" }, // Emerald-500
  { name: "À vérifier (3-6 mois)", value: 25, color: "#f59e0b" }, // Amber-500
  { name: "Obsolètes (> 6 mois)", value: 10, color: "#f43f5e" }, // Rose-500
];

// 3. Top & Flop
const topProcedures = [
  { title: "Onboarding Nouveau Salarié", views: 245, trend: "+12%" },
  { title: "Réinitialisation Mot de Passe", views: 189, trend: "+5%" },
  { title: "Accès Wifi Invité", views: 156, trend: "+8%" },
];

const flopProcedures = [
  { title: "Politique de Sécurité v1", readTime: "8s", bounceRate: "92%" },
  { title: "Archivage Ancien Serveur", readTime: "12s", bounceRate: "85%" },
  { title: "Configuration Imprimante Etage 2", readTime: "15s", bounceRate: "78%" },
];

// 4. Champions (Engagement)
const champions = [
  { name: "Sarah K.", role: "Technicien N2", suggestions: 14, impact: "High" },
  { name: "Julien V.", role: "Admin Sys", suggestions: 8, impact: "Medium" },
  { name: "Marc D.", role: "Support N1", suggestions: 5, impact: "Low" },
];

const Statistics: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cockpit de Pilotage</h2>
        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
          Analyses & Aide à la décision
        </p>
      </div>

      {/* --- SECTION 1: OPPORTUNITÉS MANQUÉES (PRIORITÉ HAUTE) --- */}
      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
        
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-xl shadow-lg shadow-rose-100">
            <i className="fa-solid fa-magnifying-glass-minus"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-xl flex items-center">
              Opportunités Manquées
              <InfoTooltip 
                title="Zone de Demande Non Comblée" 
                desc="Liste des mots-clés recherchés par vos équipes qui n'ont retourné aucun résultat. C'est votre priorité de rédaction immédiate pour combler les manques." 
              />
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ce que vos équipes cherchent sans trouver</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {searchGaps.map((item, idx) => (
            <div key={idx} className="bg-white border-2 border-slate-50 rounded-2xl p-5 hover:border-rose-100 hover:shadow-lg hover:-translate-y-1 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-1 rounded-lg">
                  {item.count} échecs
                </span>
                <span className="text-[9px] font-bold text-slate-300 uppercase">{item.lastSearch}</span>
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-4 leading-tight">"{item.term}"</h4>
              <button 
                onClick={() => navigate('/upload')}
                className="w-full py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 transition-colors flex items-center justify-center gap-2">
                <i className="fa-solid fa-plus"></i>
                Créer la procédure
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* --- SECTION 2: SANTÉ DE LA BASE (DOUGHNUT) --- */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-lg">
              <i className="fa-solid fa-heart-pulse"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg flex items-center">
                Santé de la Base
                <InfoTooltip 
                  title="Indice d'Obsolescence" 
                  desc="Répartition de vos procédures par date de dernière mise à jour. Une base saine doit avoir un maximum de vert. Le rouge indique un risque technique élevé (info périmée)." 
                />
              </h3>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative min-h-[250px]">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={healthData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }} 
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Légende Custom */}
            <div className="w-full space-y-3 mt-4">
              {healthData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="font-bold text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-black text-slate-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- SECTION 3: TOP & FLOP (PERFORMANCE) --- */}
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-lg">
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg flex items-center">
                Performance du Contenu
                <InfoTooltip 
                  title="Qualité & Pertinence" 
                  desc="Identifiez ce qui marche (Top) et ce qui doit être réécrit (Flop). Un temps de lecture très court sur un Flop indique souvent un titre trompeur ou un contenu inutile." 
                />
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* TOP LIST */}
            <div className="bg-slate-50 rounded-3xl p-6">
              <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fa-solid fa-arrow-trend-up"></i> Top Consultations
              </h4>
              <div className="space-y-4">
                {topProcedures.map((proc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="font-black text-slate-200 text-lg">#{idx + 1}</span>
                      <p className="text-xs font-bold text-slate-700 truncate">{proc.title}</p>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg ml-2">
                      {proc.views} vues
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* FLOP LIST */}
            <div className="bg-slate-50 rounded-3xl p-6">
              <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fa-solid fa-arrow-trend-down"></i> À Réécrire (Rebond élevé)
              </h4>
              <div className="space-y-4">
                {flopProcedures.map((proc, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                    <div className="overflow-hidden mr-2">
                      <p className="text-xs font-bold text-slate-700 truncate">{proc.title}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Lu en {proc.readTime} moy.</p>
                    </div>
                    <span className="text-[10px] font-black bg-rose-50 text-rose-500 px-2 py-1 rounded-lg whitespace-nowrap">
                      {proc.bounceRate} Rebond
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* --- SECTION 4: CHAMPIONS (ENGAGEMENT) --- */}
      <section className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-400 text-xl backdrop-blur-sm">
              <i className="fa-solid fa-trophy"></i>
            </div>
            <div>
              <h3 className="font-black text-white text-xl flex items-center">
                Top Contributeurs
                <InfoTooltip 
                  title="Engagement Qualitatif" 
                  desc="Ces techniciens ne font pas que lire : ils améliorent l'outil. Le nombre de suggestions est le meilleur indicateur d'implication dans la vie de l'équipe." 
                />
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ils construisent la base avec vous</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
          {champions.map((champ, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md hover:bg-white/10 transition-colors group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-xs shadow-lg shadow-indigo-900/50">
                    {champ.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{champ.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{champ.role}</p>
                  </div>
                </div>
                {idx === 0 && <i className="fa-solid fa-crown text-amber-400 text-lg animate-bounce"></i>}
              </div>
              
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-white tracking-tighter">{champ.suggestions}</span>
                <span className="text-[10px] font-bold text-indigo-300 uppercase mb-1.5">Suggestions envoyées</span>
              </div>
              
              <div className="mt-4 w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full" 
                  style={{ width: `${(champ.suggestions / 15) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Statistics;
