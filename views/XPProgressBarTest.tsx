import React, { useState } from 'react';
import XPProgressBar from '../components/XPProgressBar';

const XPProgressBarTest: React.FC = () => {
  const [currentXP, setCurrentXP] = useState(160);
  const [currentLevel, setCurrentLevel] = useState(2);

  const addXP = (amount: number) => {
    const newXP = currentXP + amount;
    setCurrentXP(newXP);
    
    // Calculate new level
    const newLevel = Math.floor(newXP / 100) + 1;
    setCurrentLevel(newLevel);
  };

  const resetProgress = () => {
    setCurrentXP(0);
    setCurrentLevel(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-black text-slate-900 mb-2">
            Test XP Progress Bar
          </h1>
          <p className="text-slate-500 font-medium">
            Testez le composant de progression XP avec différentes valeurs
          </p>
        </div>

        {/* XP Progress Bar Component */}
        <XPProgressBar currentXP={currentXP} currentLevel={currentLevel} />

        {/* Controls */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h2 className="font-black text-slate-900 text-xl mb-6">Contrôles de Test</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => addXP(10)}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
            >
              +10 XP
            </button>
            <button
              onClick={() => addXP(25)}
              className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all active:scale-95 shadow-lg shadow-purple-200"
            >
              +25 XP
            </button>
            <button
              onClick={() => addXP(50)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200"
            >
              +50 XP
            </button>
            <button
              onClick={() => addXP(100)}
              className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-all active:scale-95 shadow-lg shadow-amber-200"
            >
              +100 XP
            </button>
          </div>

          <button
            onClick={resetProgress}
            className="w-full bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all active:scale-95"
          >
            Réinitialiser (0 XP, Niveau 1)
          </button>
        </div>

        {/* Stats Display */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <h2 className="font-black text-slate-900 text-xl mb-6">Statistiques Actuelles</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">
                XP Total
              </p>
              <p className="text-4xl font-black text-indigo-600">
                {currentXP}
              </p>
            </div>
            
            <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
              <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">
                Niveau Actuel
              </p>
              <p className="text-4xl font-black text-purple-600">
                {currentLevel}
              </p>
            </div>
            
            <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">
                XP pour Niveau Suivant
              </p>
              <p className="text-4xl font-black text-emerald-600">
                {currentLevel * 100}
              </p>
            </div>
            
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">
                XP Restants
              </p>
              <p className="text-4xl font-black text-amber-600">
                {(currentLevel * 100) - currentXP}
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-8 border border-indigo-100">
          <h3 className="font-black text-slate-900 text-lg mb-4 flex items-center gap-3">
            <i className="fa-solid fa-lightbulb text-amber-500"></i>
            Comment tester
          </h3>
          <ul className="space-y-2 text-slate-700 font-medium">
            <li className="flex items-start gap-3">
              <span className="text-indigo-600 font-black">1.</span>
              <span>Cliquez sur les boutons pour ajouter de l'XP</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-indigo-600 font-black">2.</span>
              <span>Observez l'animation de la barre de progression</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-indigo-600 font-black">3.</span>
              <span>Regardez le changement de niveau quand vous atteignez 100, 200, 300 XP, etc.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-indigo-600 font-black">4.</span>
              <span>Notez les titres qui changent : Débutant → Apprenti → Pilote → Expert → Maître → Légende</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default XPProgressBarTest;
