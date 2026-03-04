export const XP_THRESHOLDS = [
  0,       // Level 1: Recrue
  300,     // Level 2: Apprenti
  1000,    // Level 3: Intervenant
  2200,    // Level 4: Confirmé
  4600,    // Level 5: Référent
  8200,    // Level 6: Expert
  12600,   // Level 7: Spécialiste
  18600,   // Level 8: Maître d'Armes
  26600,   // Level 9: Consultant Élite
  36600    // Level 10: Légende Industrielle
];

export const getMinXPForLevel = (level: number): number => {
  if (level <= 1) return 0;
  if (level > XP_THRESHOLDS.length) return XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
  return XP_THRESHOLDS[level - 1];
};

export const calculateLevelFromXP = (xp: number): number => {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
};

export const getLevelTitle = (level: number): string => {
  switch(level) {
    case 1: return "Recrue";
    case 2: return "Apprenti";
    case 3: return "Intervenant";
    case 4: return "Confirmé";
    case 5: return "Expert";
    case 6: return "Spécialiste";
    case 7: return "Maître";
    case 8: return "Grand Maître";
    case 9: return "Légende";
    case 10: return "Référent Suprême";
    default: return level > 10 ? "Oracle" : "Recrue";
  }
};

export const getNextLevelXP = (level: number): number => {
  if (level >= XP_THRESHOLDS.length) {
      return XP_THRESHOLDS[XP_THRESHOLDS.length - 1] * 1.5; // Cap behavior
  }
  return XP_THRESHOLDS[level];
};
