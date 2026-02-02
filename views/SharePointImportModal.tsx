import React, { useState } from 'react';

interface SharePointImportModalProps {
  onClose: () => void;
  onImport: (url: string) => void;
}

const SharePointImportModal: React.FC<SharePointImportModalProps> = ({ onClose, onImport }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'url' | 'success'>('url');

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    
    // Simulation d'un appel API vers n8n ou le backend
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    onImport(url);
    setIsLoading(false);
    setStep('success');
    
    // Auto close after success
    setTimeout(() => {
        onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-scale-up relative overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Background decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-50 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 opacity-50 pointer-events-none"></div>

        {step === 'url' ? (
            <>
                <div className="flex items-center gap-5 mb-8 relative z-10">
                  <div className="w-16 h-16 rounded-[1.2rem] bg-[#0078d4] flex items-center justify-center text-white text-3xl shadow-lg shadow-blue-200">
                    <i className="fa-brands fa-microsoft"></i>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-2xl tracking-tight">Import SharePoint</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Connectez vos documents</p>
                  </div>
                </div>

                <div className="space-y-6 relative z-10">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">
                       Lien du dossier ou fichier SharePoint
                    </label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <i className="fa-solid fa-link text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
                        </div>
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://company.sharepoint.com/sites/..."
                          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300 shadow-inner"
                          autoFocus
                          disabled={isLoading}
                        />
                    </div>
                  </div>

                  <div className="bg-amber-50 rounded-2xl p-4 flex gap-3 border border-amber-100">
                    <i className="fa-solid fa-circle-info text-amber-500 mt-0.5"></i>
                    <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        L'ingestion peut prendre quelques minutes selon la taille des fichiers. Vous recevrez une notification une fois l'indexation terminée.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button
                      onClick={onClose}
                      disabled={isLoading}
                      className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!url.trim() || isLoading}
                      className="flex-[2] py-4 rounded-2xl bg-[#0078d4] text-white font-black text-xs uppercase tracking-widest hover:bg-[#006cbd] transition-all shadow-xl shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                    >
                      {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Connexion...</span>
                        </>
                      ) : (
                        <>
                            <span>Démarrer l'import</span>
                            <i className="fa-solid fa-arrow-right"></i>
                        </>
                      )}
                    </button>
                  </div>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center py-10 relative z-10 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center text-4xl animate-bounce-subtle">
                    <i className="fa-solid fa-check"></i>
                </div>
                <h3 className="font-black text-slate-800 text-2xl">Import Lancé !</h3>
                <p className="text-sm text-slate-500 font-medium max-w-xs">
                    Le processus d'ingestion a démarré en arrière-plan. Vos documents seront bientôt disponibles.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SharePointImportModal;
