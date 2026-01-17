
import React, { useState, useRef, useEffect } from 'react';
import { Procedure } from '../types';
import { supabase } from '../lib/supabase';

interface ProcedureDetailProps {
  procedure: Procedure;
  onBack: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const ProcedureDetail: React.FC<ProcedureDetailProps> = ({ procedure, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Bonjour ! Je suis l'assistant dédié à la procédure "${procedure.title}". Une question spécifique ou un point à éclaircir ?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Génération de l'URL du document Supabase
  useEffect(() => {
    if (procedure) {
      // Construction du chemin : Si catégorie est 'RACINE' (cas racine), on utilise juste le titre, sinon dossier/titre
      // Note: procedure.title contient le nom du fichier avec l'extension (ex: document.pdf)
      const path = procedure.category === 'RACINE' 
        ? procedure.title 
        : `${procedure.category}/${procedure.title}`;

      const { data } = supabase.storage
        .from('procedures')
        .getPublicUrl(path);

      setDocUrl(data.publicUrl);
    }
  }, [procedure]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const currentQuestion = input;
    
    // 1. Ajouter le message utilisateur immédiatement
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: currentQuestion,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // 2. Appel au Webhook N8N
      const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: procedure.id,
          question: currentQuestion
        })
      });

      if (!response.ok) {
        throw new Error('Erreur de communication avec le serveur IA');
      }

      // 3. Traitement de la réponse
      const data = await response.json();
      
      // On essaie de récupérer le texte de la réponse (ajustez selon le format exact renvoyé par N8N: output, text, answer, etc.)
      const aiResponseText = data.output || data.text || data.answer || data.message || "Réponse reçue, mais format inconnu.";

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: typeof aiResponseText === 'string' ? aiResponseText : JSON.stringify(aiResponseText),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "Désolé, je n'ai pas pu joindre le cerveau de l'IA. Veuillez réessayer plus tard.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleDownload = () => {
    if (docUrl) {
      const link = document.createElement('a');
      link.href = docUrl;
      link.download = procedure.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-fade-in overflow-hidden">
      
      {/* COLONNE GAUCHE : CHATBOX */}
      <div className="lg:w-1/3 flex flex-col bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-xl overflow-hidden">
        {/* Header Chat */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <i className="fa-solid fa-robot"></i>
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Assistant IA</h3>
              <p className="text-[10px] font-bold text-slate-400">Toujours actif</p>
            </div>
          </div>
        </div>

        {/* Zone de messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-white text-slate-600 border border-slate-100 rounded-tl-none'
              }`}>
                {msg.text}
                <div className={`text-[9px] font-bold mt-2 opacity-50 ${msg.sender === 'user' ? 'text-slate-300' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex gap-2 items-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Zone */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="relative">
            <input 
              type="text"
              placeholder="Posez une question sur le document..."
              className="w-full pl-5 pr-14 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-medium"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isTyping}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md shadow-blue-200"
            >
              <i className="fa-solid fa-paper-plane-top"></i>
            </button>
          </div>
        </div>
      </div>

      {/* COLONNE DROITE : DOCUMENT */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Barre d'outils Document */}
        <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all flex items-center justify-center">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="overflow-hidden">
              <h2 className="font-black text-slate-900 text-lg leading-none truncate max-w-md" title={procedure.title}>{procedure.title}</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 inline-block">
                {procedure.category} • Version validée
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleDownload}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
            >
              <i className="fa-solid fa-download"></i> <span className="hidden sm:inline">Télécharger</span>
            </button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <i className="fa-solid fa-share-nodes"></i>
            </button>
          </div>
        </div>

        {/* Visualiseur de Document */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
          {docUrl ? (
            <iframe 
              src={`${docUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full rounded-3xl"
              title="Visualiseur de document"
              allowFullScreen
            ></iframe>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-4 bg-slate-50">
               <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="font-bold text-sm uppercase tracking-widest animate-pulse">Chargement du document...</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProcedureDetail;
