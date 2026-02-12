export const XP_THRESHOLDS = [
  0,      // Level 1
  200,    // Level 2
  800,    // Level 3
  2400,   // Level 4
  6000,   // Level 5
  15000,  // Level 6 (The Wall)
  30000,  // Level 7
  60000,  // Level 8
  120000, // Level 9
  250000  // Level 10
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
    case 1: return "Vagabond";
    case 2: return "Explorateur";
    case 3: return "Initié";
    case 4: return "Adepte";
    case 5: return "Praticien";
    case 6: return "Expert";
    case 7: return "Virtuose";
    case 8: return "Maître";
    case 9: return "Grand Maître";
    case 10: return "Légende Vivante";
    default: return level > 10 ? "Dieu de la Machine" : "Vagabond";
  }
};

export const getNextLevelXP = (level: number): number => {
  if (level >= XP_THRESHOLDS.length) {
      return XP_THRESHOLDS[XP_THRESHOLDS.length - 1] * 1.5; // Cap behavior
  }
  return XP_THRESHOLDS[level];
};
