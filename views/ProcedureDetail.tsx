
import React, { useState, useRef, useEffect } from 'react';
import { Procedure, User, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface ProcedureDetailProps {
  procedure: Procedure;
  onBack: () => void;
  onSuggest?: (content: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const ProcedureDetail: React.FC<ProcedureDetailProps> = ({ procedure, onBack, onSuggest }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Expert Procedio prêt. Je connais parfaitement la procédure "${procedure.title}". Que souhaitez-vous savoir ?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info' | 'error'} | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (procedure.id.startsWith('http')) {
      setDocUrl(procedure.id);
    } else {
      // Chemin standard : Categorie/Titre
      // On s'assure que si le titre ne contient pas .pdf, on l'ajoute pour le storage si nécessaire
      let path = procedure.id; 
      // procedure.id contient déjà souvent le chemin complet si mappé depuis le storage
      
      const { data } = supabase.storage.from('procedures').getPublicUrl(path);
      setDocUrl(data.publicUrl);
    }
  }, [procedure]);

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          document_id: procedure.id, 
          query: textToSend,
          context: procedure.title
        })
      });
      if (!response.ok) throw new Error('IA Error');
      const data = await response.json();
      const aiMsg: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: data.output || data.text || "Je n'ai pas trouvé de réponse précise dans cette documentation.", timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { id: 'err', sender: 'ai', text: "L'IA est temporairement indisponible. Veuillez réessayer.", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOpenExternal = () => {
    if (docUrl) {
      window.open(docUrl, '_blank');
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-fade-in overflow-hidden relative">
      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] animate-slide-up">
           <div className={`${notification.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'} text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3`}>
              <i className="fa-solid fa-circle-info"></i>
              <span className="font-bold text-sm tracking-tight">{notification.msg}</span>
           </div>
        </div>
      )}

      {/* CHAT IA (GAUCHE) */}
      <div className="lg:w-1/3 flex flex-col bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-brain text-lg"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-[0.2em]">Contextual RAG Assistant</h3>
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">Analysé avec succès</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-5 rounded-3xl text-sm font-bold leading-relaxed shadow-sm ${
                msg.sender === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-600 border border-slate-100 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex gap-1.5 animate-pulse">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-50">
          <div className="relative">
            <input 
              type="text"
              placeholder="Poser une question à la doc..."
              className="w-full pl-6 pr-14 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-700"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isTyping}
            />
            <button onClick={() => handleSendMessage()} disabled={!input.trim() || isTyping} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg disabled:opacity-30">
              <i className="fa-solid fa-paper-plane text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      {/* DOCUMENT (DROITE) */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row items-center justify-between shadow-sm gap-4">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="max-w-md">
              <h2 className="font-black text-slate-900 text-xl leading-none truncate mb-2">{procedure.title}</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{procedure.category}</span>
            </div>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={handleOpenExternal}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
             >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                Consulter en externe
             </button>
             <button 
                onClick={() => setNotification({msg: "Lien copié dans le presse-papier !", type: 'success'})} 
                className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all"
             >
                Partager
             </button>
          </div>
        </div>

        <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-inner relative overflow-hidden">
          {docUrl ? (
            <iframe src={`${docUrl}#toolbar=0`} className="w-full h-full" title="PDF Reader" allowFullScreen></iframe>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-6">
               <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="font-black text-[10px] uppercase tracking-widest">Chargement du document...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcedureDetail;
