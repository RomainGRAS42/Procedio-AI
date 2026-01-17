
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface UploadProcedureProps {
  onBack: () => void;
}

const UploadProcedure: React.FC<UploadProcedureProps> = ({ onBack }) => {
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('LOGICIEL');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async () => {
    if (!title || !file) return;
    setStatus('uploading');
    setErrorMsg('');
    
    try {
      // 1. Upload to Supabase Storage
      // The folder corresponds to the bucket/path in Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('procedures') // Assuming a bucket named 'procedures' exists
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Send to N8N Webhook with project details
      const payload = {
        title: title,
        folder: folder,
        fileName: fileName,
        filePath: filePath,
        fullPath: uploadData.path,
        storageBucket: 'procedures',
        timestamp: new Date().toISOString()
      };

      const n8nResponse = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/UploadProcedure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!n8nResponse.ok) throw new Error('Erreur lors de la notification N8N');

      setStatus('success');
      setTimeout(onBack, 1500);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMsg(e.message || 'Une erreur est survenue');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-slate-800">Uploader une procédure</h3>
        <button onClick={onBack} className="px-4 py-2 text-slate-500 hover:text-slate-800 font-bold transition-colors">
          <i className="fa-solid fa-arrow-left mr-2"></i> Retour
        </button>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
        {status === 'error' && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation"></i>
            {errorMsg}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Titre de la procédure</label>
          <input 
            type="text"
            placeholder="Ex: Configuration du VPN nomade..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div 
          className={`relative border-2 border-dashed rounded-3xl p-12 transition-all text-center ${
            file ? 'bg-blue-50 border-blue-400' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          <input 
            type="file" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setStatus('idle');
            }}
          />
          <div className="flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4 ${
              file ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              <i className={`fa-solid ${file ? 'fa-file-circle-check' : 'fa-cloud-arrow-up'}`}></i>
            </div>
            {file ? (
              <p className="font-bold text-blue-600">{file.name}</p>
            ) : (
              <>
                <p className="font-bold text-slate-800 text-lg">Cliquez pour sélectionner un fichier</p>
                <p className="text-slate-500 text-sm mt-1">Le fichier sera stocké sur Supabase</p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 w-full space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Répertoire Supabase :</label>
            <select 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-no-repeat bg-[right_1rem_center]"
              style={{backgroundImage: `url('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>')`, backgroundSize: '1rem'}}
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            >
              <option value="LOGICIEL">LOGICIEL</option>
              <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
              <option value="MATÉRIEL">MATÉRIEL</option>
              <option value="UTILISATEURS">UTILISATEURS</option>
            </select>
          </div>

          <div className="flex gap-4 pt-6 sm:pt-0">
             <button 
              onClick={handleCreate}
              disabled={!title || !file || status === 'uploading'}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 min-w-[140px]"
            >
              {status === 'uploading' ? (
                <span className="flex items-center gap-2"><i className="fa-solid fa-circle-notch animate-spin"></i> Création...</span>
              ) : status === 'success' ? 'Succès !' : 'CRÉER'}
            </button>
            <button onClick={onBack} className="bg-slate-100 text-slate-600 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadProcedure;
