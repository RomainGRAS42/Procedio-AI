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
  else if (totalSuggestions < 1) { nextObjective = { title: "Proposez 1 idée", subtitle: "Trophée Innovateur", description: "Participez à l'innovation continue en proposant votre première idée d'amélioration.", current: totalSuggestions, target: 1, unit: "Suggestion", icon: "fa-lightbulb", color: "emerald" }; }
  else if (totalMissions < 1) { nextObjective = { title: "Réussissez 1 mission", subtitle: "Trophée Stratège", description: "Passez à l'action ! Complétez votre première mission assignée par votre manager.", current: totalMissions, target: 1, unit: "Mission", icon: "fa-chess-knight", color: "indigo" }; }
  
  else if (totalConsultations < 50) { nextObjective = { title: "Débloquez 50 lectures", subtitle: "Trophée Lecteur Confirmé", description: "Approfondissez vos connaissances en consultant 50 fiches techniques.", current: totalConsultations, target: 50, unit: "Lectures", icon: "fa-glasses", color: "amber" }; }
  else if (totalSuggestions < 5) { nextObjective = { title: "Proposez 5 idées", subtitle: "Trophée Esprit Critique", description: "Continuez à innover ! Proposez 5 suggestions pertinentes pour l'équipe.", current: totalSuggestions, target: 5, unit: "Suggestions", icon: "fa-magnifying-glass-plus", color: "emerald" }; }
  else if (totalMissions < 5) { nextObjective = { title: "Réussissez 5 missions", subtitle: "Trophée Agent de Terrain", description: "Gagnez en expérience terrain en menant à bien 5 missions opérationnelles.", current: totalMissions, target: 5, unit: "Missions", icon: "fa-user-shield", color: "indigo" }; }
  
  else if (totalConsultations < 100) { nextObjective = { title: "Débloquez 100 lectures", subtitle: "Trophée Expert Visionnaire", description: "Devenez une référence technique en atteignant 100 consultations de procédures.", current: totalConsultations, target: 100, unit: "Lectures", icon: "fa-eye", color: "amber" }; }
  else if (totalSuggestions < 20) { nextObjective = { title: "Proposez 20 idées", subtitle: "Trophée Architecte du Futur", description: "Votre esprit critique est un atout. Atteignez 20 suggestions pour ce grade.", current: totalSuggestions, target: 20, unit: "Suggestions", icon: "fa-drafting-compass", color: "emerald" }; }
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
        bg: "bg-slate-50",
        border: "border-slate-200",
        icon: "text-slate-600",
        shadow: "shadow-slate-500/10",
        ring: "ring-slate-100",
      }; // Silver
    return {
      bg: "bg-orange-50",
      border: "border-orange-100",
      icon: "text-orange-600",
      shadow: "shadow-orange-500/10",
      ring: "ring-orange-100",
    }; // Bronze/Standard
  };

  return (
    <div className="lg:col-span-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col gap-6 hover:border-orange-100 transition-all h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg border border-orange-100">
            <i className="fa-solid fa-trophy"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">
                Mes Trophées
              </h3>
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
            </div>
            <div className="inline-flex mt-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest">
              {virtualBadges.length} Obtenus
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
            Collection active
          </p>
          <div className="flex flex-wrap gap-3">
            {virtualBadges.length > 0 ? (
              virtualBadges.map((ub) => {
                const style = getBadgeStyle(ub.badges.criteria_value || 0);
                return (
                  <div key={ub.id} className="group relative">
                    <div
                      className={`w-14 h-14 rounded-2xl ${style.bg} border ${style.border} flex flex-col items-center justify-center gap-1 hover:bg-white hover:scale-110 transition-all cursor-help transform shadow-sm ${style.shadow}`}>
                      <i className={`fa-solid ${ub.badges.icon} text-lg ${style.icon}`}></i>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate w-10 text-center leading-none">
                        {ub.badges.name}
                      </span>
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-3 bg-slate-900 text-white rounded-xl text-[10px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                      <p
                        className={`font-black uppercase tracking-widest mb-1 ${style.icon.replace("text-", "text-")}`}>
                        {ub.badges.name}
                      </p>
                      <p className="text-slate-300 leading-relaxed">{ub.badges.description}</p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="w-full py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Votre parcours trophées
                </p>
                <p className="text-[11px] text-slate-400 mb-3">
                  Complétez des actions pour débloquer vos premiers badges !
                </p>
                <div className="flex justify-center gap-2 mt-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex flex-col items-center justify-center gap-0.5 opacity-50">
                    <i className="fa-solid fa-book text-xs"></i>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      Novice
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex flex-col items-center justify-center gap-0.5 opacity-50">
                    <i className="fa-solid fa-check-circle text-xs"></i>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      Engagé
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex flex-col items-center justify-center gap-0.5 opacity-50">
                    <i className="fa-solid fa-trophy text-xs"></i>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      Expert
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">
            Prochain Trophée
          </p>
          <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between group/challenge hover:bg-white hover:border-amber-200 transition-all relative">
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-[#121826] text-white rounded-2xl shadow-xl opacity-0 invisible group-hover/challenge:opacity-100 group-hover/challenge:visible transition-all z-50 pointer-events-none">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                    nextObjective.color === "emerald"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : nextObjective.color === "indigo"
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}>
                  <i className={`fa-solid ${nextObjective.icon}`}></i>
                </div>
                <p className="font-black text-xs uppercase tracking-wider text-white">
                  {nextObjective.subtitle}
                </p>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {nextObjective.description}
              </p>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-[#121826]"></div>
            </div>
            <div className="flex items-center gap-3">
              {/* Dynamic color class handling */}
              <div className={`w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center text-sm transition-colors ${
                nextObjective.color === 'emerald' ? 'group-hover/challenge:bg-emerald-50 group-hover/challenge:text-emerald-500' :
                nextObjective.color === 'indigo' ? 'group-hover/challenge:bg-indigo-50 group-hover/challenge:text-indigo-500' :
                'group-hover/challenge:bg-amber-50 group-hover/challenge:text-amber-500'
              }`}>
                <i className={`fa-solid ${nextObjective.icon}`}></i>
              </div>
              <div>
                <p className="text-xs font-black text-slate-700 uppercase leading-none mb-1">
                  {nextObjective.title}
                </p>
                <p className="text-[10px] text-slate-400 font-medium leading-tight mb-1.5">
                  {nextObjective.subtitle}
                </p>
                <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full animate-pulse transition-all duration-1000 ${
                      nextObjective.color === 'emerald' ? 'bg-emerald-400' :
                      nextObjective.color === 'indigo' ? 'bg-indigo-400' :
                      'bg-amber-400'
                    }`}
                    style={{
                      width: `${progressPercent}%`,
                    }}></div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                {nextObjective.current} / {nextObjective.target}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                {nextObjective.unit}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgesWidget;
