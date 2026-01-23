
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Procedure, User } from '../types';
import { supabase } from '../lib/supabase';

interface ProcedureDetailProps {
  procedure: Procedure;
  user: User;
  onBack: () => void;
  onSuggest?: (content: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const ProcedureDetail: React.FC<ProcedureDetailProps> = ({ procedure, user, onBack, onSuggest }) => {
  // Nettoyage du titre pour l'IA et l'affichage
  const cleanTitle = useMemo(() => {
    if (!procedure?.title) return "Procédure sans titre";
    return procedure.title
      .replace(/\.[^/.]+$/, "") // Enlever .pdf
      .replace(/^[0-9a-f.-]+-/i, "") // Enlever les préfixes UUID
      .replace(/_/g, ' ') // Remplacer underscores par espaces
      .trim();
  }, [procedure.title]);
  
  const chatSessionId = useMemo(() => crypto.randomUUID(), [procedure.id, user.id]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Expert Procedio prêt. Je connais parfaitement le document "${cleanTitle}". En quoi puis-je vous aider, ${user.firstName} ?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info' | 'error'} | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Questions pré-établies
  const quickActions = [
    { label: 'Résumé', icon: 'fa-align-left', prompt: 'Peux-tu me faire un résumé concis de cette procédure ?' },
    { label: 'Étapes (tirets)', icon: 'fa-list-ul', prompt: 'Extrais les étapes à suivre sous forme de liste à puces (tirets).' },
    { label: 'Pré-requis', icon: 'fa-tools', prompt: 'Quels sont les pré-requis et outils nécessaires pour cette intervention ?' },
    { label: 'Points de vigilance', icon: 'fa-triangle-exclamation', prompt: 'Quels sont les points de vigilance ou erreurs classiques à éviter ?' },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!procedure) return;

    // Priorité à l'URL présente dans la base de données
    if (procedure.fileUrl) {
      setDocUrl(procedure.fileUrl);
    } else {
      // Fallback vers Supabase Storage si fileUrl est manquant
      const { data } = supabase.storage.from('procedures').getPublicUrl(procedure.id);
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
      const fullUserName = `${user.firstName} ${user.lastName || ''}`.trim();

      const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: textToSend,
          title: cleanTitle,
          file_id: procedure.file_id || procedure.id,
          userName: fullUserName,
          sessionid: chatSessionId
        })
      });

      const responseText = await response.text();
      let data: any = {};
      
      if (responseText) {
        try { 
          data = JSON.parse(responseText); 
        } catch (e) { 
          data = { output: responseText }; 
        }
      } else {
        data = { output: "Le serveur n'a pas renvoyé de réponse." };
      }
      
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        sender: 'ai', 
        text: data.output || data.text || (typeof data === 'string' ? data : "Analyse terminée."), 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: 'err', 
        sender: 'ai', 
        text: "Désolé, je rencontre une difficulté technique avec le moteur IA.", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-fade-in overflow-hidden">
      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
           <div className="bg-slate-900 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4">
              <i className="fa-solid fa-circle-check text-emerald-400"></i>
              <span className="font-black text-xs uppercase tracking-widest">{notification.msg}</span>
           </div>
        </div>
      )}

      {/* CHAT IA */}
      <div className="lg:w-1/3 flex flex-col bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl">
            <i className="fa-solid fa-brain"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest">Expert Procedio</h3>
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">IA Connectée</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/10 scrollbar-hide">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-5 rounded-3xl text-sm font-bold shadow-sm ${
                msg.sender === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-600 border border-slate-100 rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-50 space-y-4">
          {/* QUESTIONS PRÉ-ÉTABLIES (QUICK ACTIONS) */}
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(action.prompt)}
                disabled={isTyping}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <i className={`fa-solid ${action.icon}`}></i>
                {action.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input 
              type="text"
              placeholder="Posez votre question sur ce document..."
              className="w-full pl-6 pr-14 py-6 rounded-3xl bg-slate-50 border-none outline-none font-bold text-slate-700 text-sm shadow-inner"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isTyping}
            />
            <button 
              onClick={() => handleSendMessage()} 
              disabled={!input.trim() || isTyping} 
              className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600/20 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-2xl flex items-center justify-center transition-all"
            >
              <i className="fa-solid fa-paper-plane text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      {/* VISIONNEUSE PDF */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-6 overflow-hidden">
            <button onClick={onBack} className="w-12 h-12 rounded-2xl border border-slate-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="min-w-0">
              <h2 className="font-black text-slate-900 text-xl truncate mb-1">{cleanTitle}</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-lg">{procedure?.category}</span>
            </div>
          </div>
          <button 
            onClick={() => window.open(docUrl || '', '_blank')} 
            className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shrink-0"
          >
            Plein écran
          </button>
        </div>

        <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-inner relative overflow-hidden">
          {docUrl ? (
            <iframe src={`${docUrl}#toolbar=0`} className="w-full h-full" title="PDF Viewer" allowFullScreen></iframe>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-6">
               <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="font-black text-[10px] uppercase tracking-widest">Récupération du PDF...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcedureDetail;
