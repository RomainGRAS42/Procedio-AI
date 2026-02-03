
import React, { useState } from 'react';
import { ActiveTransfer } from '../App';

interface UploadProcedureProps {
  onBack: () => void;
  activeTransfer: ActiveTransfer | null;
  setActiveTransfer: (transfer: ActiveTransfer | null) => void;
}

const UploadProcedure: React.FC<UploadProcedureProps> = ({ onBack, activeTransfer, setActiveTransfer }) => {
  const [title, setTitle] = useState('');
  const [folders] = useState(['LOGICIEL', 'UTILISATEUR', 'MATERIEL', 'INFRASTRUCTURE']);
  const [selectedFolder, setSelectedFolder] = useState('LOGICIEL');
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const handlePublish = async () => {
    if (!title.trim() || !file) {
      setErrorMsg("Veuillez saisir un titre et sélectionner un fichier PDF.");
      return;
    }

    const controller = new AbortController();
    const uploadDate = new Date().toLocaleString('fr-FR');
    const fileId = crypto.randomUUID(); 
    setErrorMsg('');

    const initialTransfer: ActiveTransfer = {
      fileName: file.name,
      step: "Analyse du document par l'IA...",
      progress: 10,
      abortController: controller
    };
    setActiveTransfer(initialTransfer);
    
    try {
      setActiveTransfer({ ...initialTransfer, step: "Sécurisation du transfert cloud...", progress: 40 });
      await new Promise(resolve => setTimeout(resolve, 600));

      setActiveTransfer({ ...initialTransfer, step: "Finalisation de l'indexation...", progress: 70 });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('file_id', fileId);
      formData.append('upload_date', uploadDate);
      formData.append('category', selectedFolder);

      console.log('📤 Envoi vers n8n (MODE PRODUCTION):', {
        url: 'https://n8n.srv901593.hstgr.cloud/webhook-test/f2d12a7e-05d9-474f-bb17-336eeb2650d5',
        file_id: fileId,
        title: title.trim(),
        category: selectedFolder
      });

      const n8nResponse = await fetch('https://n8n.srv901593.hstgr.cloud/webhook-test/f2d12a7e-05d9-474f-bb17-336eeb2650d5', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      console.log('✅ Réponse n8n:', {
        status: n8nResponse.status,
        statusText: n8nResponse.statusText,
        ok: n8nResponse.ok
      });

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error('❌ Erreur n8n:', errorText);
        throw new Error(`Le service de publication est momentanément indisponible. (${n8nResponse.status})`);
      }

      setActiveTransfer({ ...initialTransfer, step: "Fichier envoyé avec succès !", progress: 100, abortController: null });
      
      setTimeout(() => {
        setActiveTransfer(null);
        setShowSuccessPopup(true);
      }, 500);

    } catch (e: any) {
      console.error('❌ Erreur complète:', e);
      if (e.name === 'AbortError') {
        console.log('Publication annulée');
      } else {
        setErrorMsg(e.message || "Une erreur est survenue lors de la publication du document.");
      }
      setActiveTransfer(null);
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
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter text-balance">Transfert terminé</h3>
              <p className="text-slate-500 font-semibold leading-relaxed px-4">
                Votre document a été envoyé au cloud. <br/>
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

        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8 mt-8">
          {errorMsg && (
            <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-4 border border-rose-100 animate-slide-up">
              <i className="fa-solid fa-circle-exclamation text-base"></i>
              <span className="flex-1 leading-normal">{errorMsg}</span>
            </div>
          )}

            <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Titre de la procédure</label>
            <input 
              type="text" 
              placeholder="Ex: Guide de configuration réseau..."
              className={`w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 outline-none transition-all font-bold text-slate-700 shadow-inner ${
                title && !/^[a-zA-Z0-9\s\-_.]*$/.test(title) 
                ? "border-rose-300 focus:border-rose-500 focus:bg-rose-50/10" 
                : "border-transparent focus:bg-white focus:border-indigo-500"
              }`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!!activeTransfer}
            />
             {title && !/^[a-zA-Z0-9\s\-_.]*$/.test(title) && (
              <p className="ml-2 text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 animate-pulse">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Format invalide : Utilisez uniquement lettres non accentuées, chiffres, espaces, tirets et points.
              </p>
            )}
          </div>

          <div className={`relative border-2 border-dashed rounded-[2.5rem] p-16 transition-all text-center group ${file ? 'bg-indigo-50 border-indigo-400' : 'border-slate-100 hover:border-indigo-400'}`}>
            {!activeTransfer && (
              <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            )}
            <div className="flex flex-col items-center gap-4">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl transition-all ${file ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-200'}`}>
                <i className={`fa-solid ${file ? 'fa-file-pdf' : 'fa-cloud-arrow-up'}`}></i>
              </div>
              <p className="font-black text-slate-800 text-xl tracking-tight uppercase">
                {file ? file.name : 'Sélectionnez le fichier PDF'}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end gap-8 pt-4">
            <div className="flex-1 w-full space-y-3">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Dossier cible</label>
              <select 
                className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 shadow-inner appearance-none cursor-pointer"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                disabled={!!activeTransfer}
              >
                {folders.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <button 
              onClick={handlePublish}
              disabled={!title.trim() || !file || !!activeTransfer || (!!title && !/^[a-zA-Z0-9\s\-_.]*$/.test(title))}
              className="w-full md:w-auto bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 disabled:opacity-30 min-w-[240px]"
            >
              {activeTransfer ? 'TRAITEMENT IA...' : 'METTRE EN LIGNE LA PROCÉDURE'}
            </button>
          </div>
        </div>
        
        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50 flex items-center gap-4 opacity-80">
           <i className="fa-solid fa-robot text-indigo-400 text-xl animate-bounce"></i>
           <div>
             <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Indexation Intelligente</p>
             <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest leading-relaxed mt-1">
               Notre IA Procedio va extraire automatiquement les points clés et les étapes de votre document pour les rendre accessibles via le chat.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default UploadProcedure;
