import React from "react";
import InfoTooltip from "../InfoTooltip";

interface BadgesWidgetProps {
  earnedBadges: any[];
  totalConsultations?: number;
  totalSuggestions?: number;
  totalMissions?: number;
  onNavigate?: (view: string) => void;
}

const BadgesWidget: React.FC<BadgesWidgetProps> = ({
  earnedBadges,
  totalConsultations = 0,
  totalSuggestions = 0,
  totalMissions = 0,
  onNavigate,
}) => {
  // Compute virtual badges based on real stats if DB badges are missing
  const virtualBadges = [...earnedBadges];

  // --- DEFINITIONS DES BADGES VIRTUELS PROGRESSIFS ---
  
  // 1. LECTURE
  if (totalConsultations >= 10 && !virtualBadges.some(b => b.badges.name === "Lecteur Assidu")) virtualBadges.push({ id: "v-l1", badges: { name: "Lecteur Assidu", icon: "fa-book-open", description: "10 procédures consultées.", criteria_value: 10 } });
  if (totalConsultations >= 50 && !virtualBadges.some(b => b.badges.name === "Lecteur Confirmé")) virtualBadges.push({ id: "v-l2", badges: { name: "Lecteur Confirmé", icon: "fa-glasses", description: "50 procédures consultées.", criteria_value: 50 } });
  if (totalConsultations >= 100 && !virtualBadges.some(b => b.badges.name === "Expert Visionnaire")) virtualBadges.push({ id: "v-l3", badges: { name: "Expert Visionnaire", icon: "fa-eye", description: "100 procédures consultées.", criteria_value: 100 } });
  if (totalConsultations >= 250 && !virtualBadges.some(b => b.badges.name === "Rat de Bibliothèque")) virtualBadges.push({ id: "v-l4", badges: { name: "Rat de Bibliothèque", icon: "fa-book-atlas", description: "250 procédures consultées.", criteria_value: 250 } });
  if (totalConsultations >= 500 && !virtualBadges.some(b => b.badges.name === "Archiviste Suprême")) virtualBadges.push({ id: "v-l5", badges: { name: "Archiviste Suprême", icon: "fa-landmark", description: "500 procédures consultées.", criteria_value: 500 } });

  // 2. SUGGESTIONS
  if (totalSuggestions >= 1 && !virtualBadges.some(b => b.badges.name === "Innovateur")) virtualBadges.push({ id: "v-s1", badges: { name: "Innovateur", icon: "fa-lightbulb", description: "1 suggestion proposée.", criteria_value: 100 } });
  if (totalSuggestions >= 5 && !virtualBadges.some(b => b.badges.name === "Esprit Critique")) virtualBadges.push({ id: "v-s2", badges: { name: "Esprit Critique", icon: "fa-magnifying-glass-plus", description: "5 suggestions proposées.", criteria_value: 150 } });
  if (totalSuggestions >= 20 && !virtualBadges.some(b => b.badges.name === "Architecte du Futur")) virtualBadges.push({ id: "v-s3", badges: { name: "Architecte du Futur", icon: "fa-drafting-compass", description: "20 suggestions proposées.", criteria_value: 200 } });
  if (totalSuggestions >= 50 && !virtualBadges.some(b => b.badges.name === "Visionnaire")) virtualBadges.push({ id: "v-s4", badges: { name: "Visionnaire", icon: "fa-eye", description: "50 suggestions proposées.", criteria_value: 300 } });

  // 3. MISSIONS
  if (totalMissions >= 1 && !virtualBadges.some(b => b.badges.name === "Stratège")) virtualBadges.push({ id: "v-m1", badges: { name: "Stratège", icon: "fa-chess-knight", description: "1 mission accomplie.", criteria_value: 200 } });
  if (totalMissions >= 5 && !virtualBadges.some(b => b.badges.name === "Agent de Terrain")) virtualBadges.push({ id: "v-m2", badges: { name: "Agent de Terrain", icon: "fa-user-shield", description: "5 missions accomplies.", criteria_value: 300 } });
  if (totalMissions >= 20 && !virtualBadges.some(b => b.badges.name === "Commandant")) virtualBadges.push({ id: "v-m3", badges: { name: "Commandant", icon: "fa-medal", description: "20 missions accomplies.", criteria_value: 500 } });
  if (totalMissions >= 50 && !virtualBadges.some(b => b.badges.name === "Légende Opérationnelle")) virtualBadges.push({ id: "v-m4", badges: { name: "Légende Opérationnelle", icon: "fa-crown", description: "50 missions accomplies.", criteria_value: 1000 } });

  // Determine Next Objective (Priority Logic - Gamification Loop)
  let nextObjective = {
    title: "Débloquez 10 lectures",
    subtitle: "Pour obtenir le trophée Lecteur Assidu",
    description: "Naviguez dans la base de connaissances et consultez 10 procédures pour initier votre parcours d'expert.",
    current: totalConsultations,
    target: 10,
    unit: "Lectures",
    icon: "fa-book-open",
    color: "amber"
  };

  // Logic Loop: Find the nearest achievable goal across all categories
  // ORDER: Suggestion 1 -> Mission 1 -> Reading 50 -> Suggestion 5 -> Mission 5 -> Reading 100...
  
  if (totalConsultations < 10) { /* Default */ }
  else if (totalSuggestions < 1) { nextObjective = { title: "Proposez 1 amélioration", subtitle: "Trophée Innovateur", description: "Consultez une procédure et cliquez sur 'Améliorer la procédure' pour proposer votre première contribution.", current: totalSuggestions, target: 1, unit: "Amélioration", icon: "fa-lightbulb", color: "emerald" }; }
  else if (totalMissions < 1) { nextObjective = { title: "Réussissez 1 mission", subtitle: "Trophée Stratège", description: "Passez à l'action ! Complétez votre première mission assignée par votre manager.", current: totalMissions, target: 1, unit: "Mission", icon: "fa-chess-knight", color: "indigo" }; }
  
  else if (totalConsultations < 50) { nextObjective = { title: "Débloquez 50 lectures", subtitle: "Trophée Lecteur Confirmé", description: "Approfondissez vos connaissances en consultant 50 fiches techniques.", current: totalConsultations, target: 50, unit: "Lectures", icon: "fa-glasses", color: "amber" }; }
  else if (totalSuggestions < 5) { nextObjective = { title: "Proposez 5 améliorations", subtitle: "Trophée Esprit Critique", description: "Identifiez des erreurs ou des optimisations sur 5 procédures différentes pour aider l'équipe.", current: totalSuggestions, target: 5, unit: "Améliorations", icon: "fa-magnifying-glass-plus", color: "emerald" }; }
  else if (totalMissions < 5) { nextObjective = { title: "Réussissez 5 missions", subtitle: "Trophée Agent de Terrain", description: "Gagnez en expérience terrain en menant à bien 5 missions opérationnelles.", current: totalMissions, target: 5, unit: "Missions", icon: "fa-user-shield", color: "indigo" }; }
  
  else if (totalConsultations < 100) { nextObjective = { title: "Débloquez 100 lectures", subtitle: "Trophée Expert Visionnaire", description: "Devenez une référence technique en atteignant 100 consultations de procédures.", current: totalConsultations, target: 100, unit: "Lectures", icon: "fa-eye", color: "amber" }; }
  else if (totalSuggestions < 20) { nextObjective = { title: "Proposez 20 améliorations", subtitle: "Trophée Architecte du Futur", description: "Votre expertise est précieuse. Continuez à perfectionner les procédures via le bouton 'Améliorer'.", current: totalSuggestions, target: 20, unit: "Améliorations", icon: "fa-drafting-compass", color: "emerald" }; }
  else if (totalMissions < 20) { nextObjective = { title: "Réussissez 20 missions", subtitle: "Trophée Commandant", description: "Prenez le commandement. 20 missions réussies pour ce trophée prestigieux.", current: totalMissions, target: 20, unit: "Missions", icon: "fa-medal", color: "indigo" }; }
  
  else if (totalConsultations < 250) { nextObjective = { title: "Débloquez 250 lectures", subtitle: "Trophée Rat de Bibliothèque", description: "Votre curiosité est sans limite. Atteignez 250 lectures pour ce badge d'élite.", current: totalConsultations, target: 250, unit: "Lectures", icon: "fa-book-atlas", color: "amber" }; }
  else {
     // End Game Loop
     nextObjective = { title: "Légende vivante", subtitle: "Vous avez atteint le sommet !", description: "Vous avez débloqué tous les trophées disponibles. Félicitations !", current: 100, target: 100, unit: "Héros", icon: "fa-crown", color: "rose" };
  }
  
  // Cap progress at 100%
  const progressPercent = Math.min((nextObjective.current / nextObjective.target) * 100, 100);

  // Helper to determine badge tier styling
  const getBadgeStyle = (criteriaValue: number) => {
    if (criteriaValue >= 2000)
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        icon: "text-amber-600",
        shadow: "shadow-amber-500/10",
        ring: "ring-amber-100",
      }; // Gold
    if (criteriaValue >= 500)
      return {
        bg: "bg-indigo-50",
        border: "border-indigo-100",
        icon: "text-indigo-600",
        shadow: "shadow-indigo-500/10",
        ring: "ring-indigo-100",
      }; // Silver (Elite)
    return {
      bg: "bg-orange-50",
      border: "border-orange-100",
      icon: "text-orange-600",
      shadow: "shadow-orange-500/10",
      ring: "ring-orange-100",
    }; // Bronze/Standard
  };

  return (
    <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 hover:border-orange-100 transition-all h-full overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-lg shadow-sm">
            <i className="fa-solid fa-trophy"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
                <span className="uppercase">Mes Trophées</span>
                <InfoTooltip isHtml={true} text={`
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center text-sm">
                    <i class="fa-solid fa-trophy"></i>
                  </div>
                  <h4 class="font-black text-white text-sm uppercase tracking-tight">
                    Comment obtenir des trophées
                  </h4>
                </div>

                <p class="text-xs text-slate-300 mb-5 leading-relaxed text-left">
                  Chaque action te rapporte de l'XP. Cumule l'XP pour débloquer automatiquement
                  tes badges de spécialité.
                </p>

                <div class="space-y-3 w-full">
                  <div class="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <div class="flex items-center gap-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                      <span class="text-[11px] font-bold text-slate-200">
                        Lecture procédure
                      </span>
                    </div>
                    <span class="text-[10px] font-black text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full uppercase border border-emerald-500/20">
                      Rat de Bibliothèque
                    </span>
                  </div>
                  <div class="flex items-center justify-between py-2 border-b border-slate-700/50">
                    <div class="flex items-center gap-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                      <span class="text-[11px] font-bold text-slate-200">
                        Missions terminées
                      </span>
                    </div>
                    <span class="text-[10px] font-black text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full uppercase border border-indigo-500/20">
                      Stratège
                    </span>
                  </div>
                  <div class="flex items-center justify-between py-2">
                    <div class="flex items-center gap-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      <span class="text-[11px] font-bold text-slate-200">
                        Suggestions validées
                      </span>
                    </div>
                    <span class="text-[10px] font-black text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full uppercase border border-amber-500/20">
                      Innovateur
                    </span>
                  </div>
                </div>

                <div class="mt-5 pt-4 border-t border-slate-700/50 w-full">
                  <div class="flex items-start gap-2 text-left">
                    <i class="fa-solid fa-circle-check text-emerald-500 mt-0.5 text-xs"></i>
                    <p class="text-[10px] text-slate-400 leading-tight italic">
                      L'XP est créditée instantanément. Tes trophées s'affichent dès le palier
                      atteint.
                    </p>
                  </div>
                </div>
              `} align="center" className="ml-1" />
              </h3>
            </div>
            <div className="inline-flex mt-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest">
              {virtualBadges.length} Obtenus
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
        {/* PROCHAIN TROPHÉE (En haut - Focus) */}
        <div className="bg-slate-50/80 rounded-3xl p-5 border border-slate-200 relative overflow-hidden group/challenge hover:bg-white hover:border-amber-200 hover:shadow-md transition-all shrink-0">
            {/* Background pattern decoration */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-400/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                        Prochain objectif
                    </p>
                    <div className="text-right">
                        <span className="text-sm font-black text-slate-900 block leading-none">
                            {nextObjective.current} <span className="text-slate-400 text-[10px] font-bold">/ {nextObjective.target}</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm border bg-white ${
                        nextObjective.color === 'emerald' ? 'text-emerald-500 border-emerald-100' :
                        nextObjective.color === 'indigo' ? 'text-indigo-500 border-indigo-100' :
                        'text-amber-500 border-amber-100'
                      }`}>
                        <i className={`fa-solid ${nextObjective.icon}`}></i>
                      </div>
                      <div className="flex-1">
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-tight mb-1">
                              {nextObjective.subtitle.replace("Trophée ", "")}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-2">
                              {nextObjective.description}
                          </p>
                      </div>
                </div>

                {/* Large Progress Bar */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                  <div
                    className={`h-full relative transition-all duration-1000 ${
                      nextObjective.color === 'emerald' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                      nextObjective.color === 'indigo' ? 'bg-gradient-to-r from-indigo-400 to-indigo-500' :
                      'bg-gradient-to-r from-amber-400 to-amber-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  >
                      {/* Shimmer effect */}
                      <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between">
                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                        Progression : {Math.round(progressPercent)}%
                     </span>
                     {/* Call to Action based on type */}
                     {nextObjective.unit === "Lectures" && (
                         <button 
                            onClick={() => onNavigate && onNavigate('/procedures')}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline decoration-2 underline-offset-2 uppercase tracking-wide transition-all"
                         >
                            Explorer <i className="fa-solid fa-arrow-right ml-1"></i>
                         </button>
                     )}
                     {nextObjective.unit === "Missions" && (
                         <button 
                            onClick={() => onNavigate && onNavigate('/missions')}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline decoration-2 underline-offset-2 uppercase tracking-wide transition-all"
                         >
                            Voir Missions <i className="fa-solid fa-arrow-right ml-1"></i>
                         </button>
                     )}
                </div>
            </div>
        </div>

        {/* COLLECTION (En bas - Liste Verticale) */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Collection ({virtualBadges.length})
             </p>
          </div>
          
          <div className="flex flex-col gap-3">
            {virtualBadges.length > 0 ? (
              virtualBadges.map((ub) => {
                const style = getBadgeStyle(ub.badges.criteria_value || 0);
                return (
                  <div key={ub.id} className="group flex items-center gap-3 p-3 rounded-2xl border border-slate-50 hover:bg-slate-50 hover:border-slate-100 transition-all cursor-default shrink-0">
                    <div
                      className={`w-10 h-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center shrink-0 shadow-sm ${style.shadow}`}>
                      <i className={`fa-solid ${ub.badges.icon} text-sm ${style.icon}`}></i>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-black text-slate-700 uppercase tracking-tight truncate">
                            {ub.badges.name}
                        </h5>
                        <div className="flex items-center gap-2 mt-0.5">
                             <span className={`text-[9px] font-bold uppercase tracking-wider ${style.icon.replace('text-', 'text-opacity-80 text-')}`}>
                                {ub.badges.criteria_value >= 1000 ? 'Légendaire' : ub.badges.criteria_value >= 500 ? 'Élite' : 'Initié'}
                             </span>
                             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                             <span className="text-[9px] text-slate-400 truncate">
                                {ub.badges.description}
                             </span>
                        </div>
                    </div>

                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${style.border} bg-white opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <i className="fa-solid fa-check text-[10px] text-emerald-500"></i>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-3 text-slate-300">
                     <i className="fa-solid fa-trophy text-xl"></i>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Aucun trophée
                </p>
                <p className="text-[10px] text-slate-400 max-w-[180px] mx-auto leading-relaxed">
                  Complétez l'objectif ci-dessus pour débloquer votre premier badge !
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgesWidget;
