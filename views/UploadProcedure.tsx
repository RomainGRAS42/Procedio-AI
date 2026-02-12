import React, { useState } from 'react';
import { ActiveTransfer } from '../types';
import { useProcedurePublisher } from '../hooks/useProcedurePublisher';

interface UploadProcedureProps {
  onBack: () => void;
  user: { id: string };
  activeTransfer: ActiveTransfer | null;
  setActiveTransfer: (transfer: ActiveTransfer | null) => void;
}

const UploadProcedure: React.FC<UploadProcedureProps> = ({ onBack, user, activeTransfer, setActiveTransfer }) => {
  const [uploadMode, setUploadMode] = useState<'file' | 'folder'>('file');
  const [useCustomTitle, setUseCustomTitle] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customFolder, setCustomFolder] = useState('');
  const [folders] = useState(['LOGICIEL', 'UTILISATEUR', 'MATERIEL', 'INFRASTRUCTURE']);
  const [selectedFolder, setSelectedFolder] = useState('LOGICIEL');
  const [file, setFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const { publishFile, publishFolder, errorMsg } = useProcedurePublisher({
    user,
    setActiveTransfer,
    onSuccess: () => {
      if (uploadMode === 'file') setShowSuccessPopup(true);
    }
  });

  const cleanFileName = (name: string) => {
    return name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ').trim();
  };

  const currentTitle = useCustomTitle ? customTitle : (file ? cleanFileName(file.name) : '');
  const finalCategory = customFolder.trim() || selectedFolder;

  const handlePublish = async () => {
    if (uploadMode === 'file') {
      if (!currentTitle.trim() || !file) return;
      await publishFile(file, currentTitle, finalCategory);
    } else {
      if (folderFiles.length === 0 || !finalCategory.trim()) return;
      await publishFolder(folderFiles, finalCategory);
      setShowSuccessPopup(true);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'jpg', 'jpeg', 'png'].includes(ext || '');
    });
    setFolderFiles(validFiles);
    
    // Auto-fill folder name from the first file's path if available
    if (validFiles.length > 0 && (validFiles[0] as any).webkitRelativePath) {
      const path = (validFiles[0] as any).webkitRelativePath;
      const folderName = path.split('/')[0];
      if (folderName) setCustomFolder(folderName.toUpperCase());
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-20 relative">
      {showSuccessPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-xl">
          <div className="bg-white rounded-[4rem] p-12 max-w-lg w-full shadow-2xl border border-white text-center space-y-10 animate-slide-up">
            <div className="w-28 h-28 bg-emerald-500 text-white rounded-[2.8rem] flex items-center justify-center text-4xl mx-auto shadow-xl">
              <i className="fa-solid fa-check"></i>
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter text-balance">
                {uploadMode === 'folder' ? 'Synchronisation lancée' : 'Transfert terminé'}
              </h3>
              <p className="text-slate-500 font-semibold leading-relaxed px-4">
                {uploadMode === 'folder' 
                  ? `${folderFiles.length} fichiers sont en cours d'indexation dans le dossier ${finalCategory}.`
                  : "Votre document a été envoyé au cloud."
                } <br/>
                <span className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">L'IA Procedio indexe actuellement le contenu.</span> <br/>
                Il apparaîtra dans votre liste d'ici quelques instants.
              </p>
            </div>
            <button onClick={onBack} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-900 transition-all shadow-xl active:scale-95 shadow-indigo-100">
              RETOUR AU DRIVE
            </button>
          </div>
        </div>
      )}

      <div className={showSuccessPopup ? 'opacity-0 scale-95 transition-all' : 'opacity-100 transition-all'}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Publication</h3>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-2">Dépôt sécurisé et indexation automatique</p>
          </div>
          <button onClick={onBack} className="px-5 py-2.5 bg-white text-slate-400 hover:text-rose-500 rounded-xl border border-slate-100 font-black text-[10px] uppercase tracking-widest transition-colors">
            <i className="fa-solid fa-xmark mr-2"></i> Annuler
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-100 p-1.5 rounded-[2rem] border border-slate-200 mt-8 w-fit mx-auto shadow-inner">
          <button 
            onClick={() => setUploadMode('file')}
            className={`px-8 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${uploadMode === 'file' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fa-solid fa-file"></i> Fichier unique
          </button>
          <button 
            onClick={() => setUploadMode('folder')}
            className={`px-8 py-3 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${uploadMode === 'folder' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fa-solid fa-folder-tree"></i> Dossier complet
          </button>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8 mt-8">
          {errorMsg && (
            <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-4 border border-rose-100 animate-slide-up">
              <i className="fa-solid fa-circle-exclamation text-base"></i>
              <span className="flex-1 leading-normal">{errorMsg}</span>
            </div>
          )}

          <div className={`relative border-2 border-dashed rounded-[2.5rem] p-16 transition-all text-center group ${
            (uploadMode === 'file' ? file : folderFiles.length > 0) ? 'bg-indigo-50 border-indigo-400' : 'border-slate-100 hover:border-indigo-400'
          }`}>
            {!activeTransfer && (
              uploadMode === 'file' ? (
                <input 
                  type="file" 
                  accept=".pdf,.docx,.jpg,.jpeg,.png" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                />
              ) : (
                <input 
                  type="file" 
                  {...({ 
                    webkitdirectory: "", 
                    directory: "" 
                  } as any)}
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  onChange={handleFolderChange} 
                />
              )
            )}
            <div className="flex flex-col items-center gap-4">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl transition-all ${
                (uploadMode === 'file' ? file : folderFiles.length > 0) ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-200'
              }`}>
                <i className={`fa-solid ${
                  uploadMode === 'folder' ? 'fa-folder-open' :
                  !file ? 'fa-cloud-arrow-up' : 
                  file.name.toLowerCase().endsWith('.pdf') ? 'fa-file-pdf' :
                  file.name.toLowerCase().endsWith('.docx') ? 'fa-file-word' :
                  'fa-file-image'
                }`}></i>
              </div>
              <p className="font-black text-slate-800 text-xl tracking-tight uppercase">
                {uploadMode === 'file' 
                  ? (file ? file.name : 'Sélectionnez un fichier')
                  : (folderFiles.length > 0 ? `${folderFiles.length} fichiers sélectionnés` : 'Sélectionnez un dossier')
                }
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {uploadMode === 'file' && (
              <div className="flex items-center gap-3 ml-2">
                <input 
                  type="checkbox" 
                  id="useCustomTitle"
                  className="w-5 h-5 rounded border-2 border-slate-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  checked={useCustomTitle}
                  onChange={(e) => setUseCustomTitle(e.target.checked)}
                  disabled={!!activeTransfer}
                />
                <label htmlFor="useCustomTitle" className="text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                  Personnaliser le titre de la procédure
                </label>
              </div>
            )}

            {uploadMode === 'file' && useCustomTitle && (
              <div className="space-y-3 animate-slide-up">
                <input 
                  type="text" 
                  placeholder="Saisissez un titre personnalisé..."
                  className={`w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 outline-none transition-all font-bold text-slate-700 shadow-inner ${
                    customTitle && !/^[a-zA-Z0-9\s\-_.]*$/.test(customTitle) 
                    ? "border-rose-300 focus:border-rose-500 focus:bg-rose-50/10" 
                    : "border-transparent focus:bg-white focus:border-indigo-500"
                  }`}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  disabled={!!activeTransfer}
                />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-8 pt-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Dossier de destination existant</label>
                <select 
                  className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 shadow-inner appearance-none cursor-pointer"
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  disabled={!!activeTransfer || !!customFolder.trim()}
                >
                  {folders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Ou créer une nouvelle catégorie</label>
                <input 
                  type="text"
                  placeholder="NOM DU NOUVEAU DOSSIER..."
                  className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 shadow-inner focus:placeholder-transparent"
                  value={customFolder}
                  onChange={(e) => setCustomFolder(e.target.value)}
                  disabled={!!activeTransfer}
                />
              </div>
            </div>

            <button 
              onClick={handlePublish}
              disabled={
                activeTransfer !== null ||
                (uploadMode === 'file' && (!file || !currentTitle.trim())) ||
                (uploadMode === 'folder' && folderFiles.length === 0) ||
                !finalCategory.trim()
              }
              className="w-full bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 disabled:opacity-30 mt-4"
            >
              {activeTransfer ? 'INDEXATION IA EN COURS...' : 'LANCER LA SYNCHRONISATION'}
            </button>
          </div>
        </div>
        
        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50 flex items-center gap-4 opacity-80 mt-8">
           <i className="fa-solid fa-robot text-indigo-400 text-xl animate-bounce"></i>
           <div>
             <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Mode Pilotage Automatique</p>
             <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest leading-relaxed mt-1">
                L'IA Procedio va mapper l'ensemble de vos documents et créer les vecteurs RAG nécessaires pour répondre à vos questions complexes.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default UploadProcedure;
