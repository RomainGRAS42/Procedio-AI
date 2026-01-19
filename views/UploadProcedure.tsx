
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
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
    if (!title.trim() || !file || !selectedFolder) {
      setErrorMsg("Veuillez remplir tous les champs.");
      return;
    }

    const controller = new AbortController();
    setErrorMsg('');

    const initialTransfer: ActiveTransfer = {
      fileName: file.name,
      step: "Préparation de l'envoi sécurisé...",
      progress: 5,
      abortController: controller
    };
    setActiveTransfer(initialTransfer);
    
    try {
      // 1. Upload vers Supabase Storage
      setActiveTransfer({ ...initialTransfer, step: `Upload vers le coffre-fort [${selectedFolder}]...`, progress: 20 });
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${title.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.${fileExt}`;
      const filePath = `${selectedFolder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('procedures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. Enregistrement en Base de Données
      setActiveTransfer({ ...initialTransfer, step: "Indexation de la procédure...", progress: 50 });

      const { error: dbError } = await supabase
        .from('procedures')
        .insert([
          { 
            title: title.trim(), 
            category: selectedFolder, 
            status: 'validated',
            views: 0,
            id: filePath 
          }
        ]);

      if (dbError) {
        console.warn("Erreur indexation DB (optionnel):", dbError);
      }

      // 3. Appel Webhook N8N
      setActiveTransfer({ ...initialTransfer, step: "Analyse IA par N8N (Envoi binaire)...", progress: 75 });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('category', selectedFolder);
      formData.append('file_path', filePath);
      formData.append('created_at', new Date().toISOString());

      try {
        await fetch('https://n8n.srv901593.hstgr.cloud/webhook/UploadProcedure', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
      } catch (webhookErr) {
        console.error("Erreur Webhook N8N:", webhookErr);
      }

      setActiveTransfer({ ...initialTransfer, step: "Finalisation...", progress: 100, abortController: null });
      
      setTimeout(() => {
        setActiveTransfer(null);
        setShowSuccessPopup(true);
      }, 500);

    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Upload annulé par l\'utilisateur');
      } else {
        console.error(e);
        setErrorMsg(e.message || "Erreur lors de l'upload.");
      }
      setActiveTransfer(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-20 relative">
      
      {/* POPUP DE SUCCÈS - SANS LE CARRÉ DERRIÈRE, JUSTE FLOU */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-50/10 backdrop-blur-[30px] animate-fade-in">
          <div className="bg-white rounded-[4rem] p-12 max-w-lg w-full shadow-[0_50px_100px_-20px_rgba(79,70,229,0.3)] border border-white text-center space-y-10 animate-slide-up relative z-[110]">
            <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-[2.8rem] flex items-center justify-center text-4xl mx-auto shadow-2xl border-4 border-white">
              <i className="fa-solid fa-check"></i>
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">Procédure En ligne</h3>
              <p className="text-slate-500 font-semibold leading-relaxed px-4">
                Le document a été sécurisé sur Supabase et envoyé à l'IA pour analyse.
              </p>
            </div>
            <button 
              onClick={onBack} 
              className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-2xl active:scale-95"
            >
              RETOUR AUX PROCÉDURES
            </button>
          </div>
        </div>
      )}

      {/* CONTENU DU FORMULAIRE - CACHÉ QUAND LE SUCCÈS EST AFFICHÉ */}
      <div className={showSuccessPopup ? 'opacity-0 pointer-events-none' : 'opacity-100 transition-opacity'}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Nouvelle Publication</h3>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-2 italic">Transfert Binaire & Indexation IA</p>
          </div>
          <button onClick={onBack} className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 font-black text-[10px] uppercase tracking-widest transition-all">
            <i className="fa-solid fa-arrow-left text-[8px]"></i> Annuler
          </button>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-indigo-500/5 space-y-8 mt-8">
          {errorMsg && (
            <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-4 border border-rose-100 animate-slide-up">
              <i className="fa-solid fa-circle-exclamation text-base"></i>
              <span className="flex-1 leading-normal">{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Titre de la documentation technique</label>
            <input 
              type="text"
              placeholder="Ex: Configuration Pare-feu Fortinet..."
              className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 shadow-inner"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!!activeTransfer}
            />
          </div>

          <div className={`relative border-2 border-dashed rounded-[2.5rem] p-16 transition-all text-center group ${file ? 'bg-indigo-50 border-indigo-400 shadow-inner' : 'border-slate-100 hover:border-indigo-400 hover:bg-slate-50'}`}>
            {!activeTransfer && (
              <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            )}
            <div className="flex flex-col items-center gap-4 relative z-0">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl transition-all duration-300 ${file ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white text-slate-200 border border-slate-100 group-hover:text-indigo-500'}`}>
                <i className={`fa-solid ${file ? 'fa-file-pdf' : 'fa-upload'}`}></i>
              </div>
              {file ? (
                <p className="font-black text-indigo-600 text-lg tracking-tight uppercase px-4 truncate max-w-xs">{file.name}</p>
              ) : (
                <p className="font-black text-slate-800 text-xl tracking-tight leading-none uppercase">Sélectionner le PDF</p>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-end gap-8 pt-4">
            <div className="flex-1 w-full space-y-3">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-widest">Dossier Supabase Cible</label>
              <div className="relative">
                <select 
                  className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 shadow-inner cursor-pointer appearance-none"
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  disabled={!!activeTransfer}
                >
                  {folders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"></i>
              </div>
            </div>
            <button 
              onClick={handlePublish}
              disabled={!title.trim() || !file || !!activeTransfer}
              className="w-full md:w-auto bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-30 min-w-[260px] active:scale-95"
            >
              {activeTransfer ? 'ENVOI BINAIRE...' : 'ENREGISTRER'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadProcedure;
