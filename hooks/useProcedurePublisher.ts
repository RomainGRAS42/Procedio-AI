import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ActiveTransfer } from '../types';

interface UseProcedurePublisherProps {
  user: { id: string };
  setActiveTransfer: (transfer: ActiveTransfer | null) => void;
  onSuccess?: (fileId: string) => void;
}

export const useProcedurePublisher = ({ user, setActiveTransfer, onSuccess }: UseProcedurePublisherProps) => {
  const [errorMsg, setErrorMsg] = useState('');

  const publishFile = async (file: File, title: string, category: string) => {
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
      formData.append('category', category);
      formData.append('author_id', user.id);

      console.log('📤 Envoi vers Supabase Edge Function (process-pdf):', {
        file_id: fileId,
        title: title.trim(),
        category: category
      });

      const { data: supabaseData, error: supabaseError } = await supabase.functions.invoke('process-pdf', {
        body: formData,
      });
      
      console.log('✅ Réponse Supabase:', {
        data: supabaseData,
        error: supabaseError
      });

      if (supabaseError) {
        console.error('❌ Erreur Supabase Function:', supabaseError);
        throw new Error(`Le service d'indexation est momentanément indisponible. (${supabaseError.message})`);
      }

      setActiveTransfer({ ...initialTransfer, step: "Fichier envoyé avec succès !", progress: 100, abortController: null });
      
      // Delay clearing transfer to let user see 100%
      setTimeout(() => {
        setActiveTransfer(null);
        if (onSuccess) onSuccess(fileId);
      }, 500);

    } catch (e: any) {
      console.error('❌ Erreur complète:', e);
      if (e.name === 'AbortError') {
        console.log('Publication annulée');
      } else {
        setErrorMsg(e.message || "Une erreur est survenue lors de la publication du document.");
      }
      setActiveTransfer(null);
      throw e; // Re-throw to let caller handle if needed
    }
  };

  return {
    publishFile,
    errorMsg,
    setErrorMsg
  };
};
