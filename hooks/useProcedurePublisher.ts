import { useState } from 'react';
export const BUILD_MARKER_FIX_SOURCE_ID = "v2.1.2-b9e4d1a2";
import { supabase } from '../lib/supabase';
import { ActiveTransfer } from '../types';

interface UseProcedurePublisherProps {
  user: { id: string };
  setActiveTransfer: (transfer: ActiveTransfer | null) => void;
  onSuccess?: (fileId: string) => void;
}

export const useProcedurePublisher = ({ user, setActiveTransfer, onSuccess }: UseProcedurePublisherProps) => {
  const [errorMsg, setErrorMsg] = useState('');

  const publishFile = async (file: File, title: string, category: string, sourceId?: string, batchInfo?: { current: number, total: number }) => {
    if (!title.trim() || !file) {
      setErrorMsg("Données manquantes pour la publication.");
      return;
    }

    const controller = new AbortController();
    const uploadDate = new Date().toLocaleString('fr-FR');
    const fileId = crypto.randomUUID(); 
    setErrorMsg('');

    const initialTransfer: ActiveTransfer = {
      fileName: file.name,
      step: batchInfo ? `Traitement du fichier ${batchInfo.current}/${batchInfo.total}...` : "Analyse du document par l'IA...",
      progress: 10,
      abortController: controller,
      currentFile: batchInfo?.current,
      totalFiles: batchInfo?.total
    };
    setActiveTransfer(initialTransfer);
    
    try {
      setActiveTransfer({ ...initialTransfer, step: "Sécurisation du transfert cloud...", progress: 40 });
      await new Promise(resolve => setTimeout(resolve, 300)); // Reduced for speed in batch

      setActiveTransfer({ ...initialTransfer, step: "Finalisation de l'indexation...", progress: 70 });
      
      const { error: insertError } = await supabase
        .from("procedures")
        .insert({
          uuid: fileId,
          file_id: fileId,
          title: title.trim(),
          file_url: "",
          "Type": category || "Missions / Transferts",
          created_at: uploadDate,
          updated_at: new Date().toISOString(),
          views: 0,
          is_trend: false,
          source_id: sourceId || null
        });

      if (insertError) {
        throw new Error(`Erreur lors de la création de la procédure : ${insertError.message}`);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('file_id', fileId);
      formData.append('upload_date', uploadDate);
      formData.append('category', category);
      formData.append('author_id', user.id);
      if (sourceId) {
        formData.append('source_id', sourceId);
      }

      const { data: supabaseData, error: supabaseError } = await supabase.functions.invoke('process-pdf-v2', {
        body: formData,
      });
      
      if (supabaseError) {
        throw new Error(`Le service d'indexation est momentanément indisponible. (${supabaseError.message})`);
      }

      // Only finish if not part of a batch or if it's the last one
      if (!batchInfo || batchInfo.current === batchInfo.total) {
        setActiveTransfer({ ...initialTransfer, step: "Transfert terminé !", progress: 100, abortController: null });
        setTimeout(() => setActiveTransfer(null), 1000);
      }
      
      if (onSuccess) onSuccess(fileId);
      return fileId;

    } catch (e: any) {
      console.error('❌ Erreur publication:', e);
      if (e.name !== 'AbortError') {
        setErrorMsg(e.message || "Une erreur est survenue.");
      }
      setActiveTransfer(null);
      throw e;
    }
  };

  const publishFolder = async (files: File[], category: string) => {
    if (files.length === 0) return;
    
    setErrorMsg('');
    const total = files.length;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Automatic title based on filename
        const title = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ').trim();
        await publishFile(file, title, category, undefined, { current: i+1, total });
      }
    } catch (e) {
      console.error("Batch upload failed:", e);
      // publishFile already sets errorMsg
    }
  };

  return {
    publishFile,
    publishFolder,
    errorMsg,
    setErrorMsg
  };
};
