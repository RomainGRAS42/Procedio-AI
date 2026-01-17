
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
      text: `Bonjour ! Je suis l'assistant dédié à la procédure "${procedure.title}". Une question spécifique ou un point à éclaircir ?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  
  // États pour les modales
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  
  // Feedback notification
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'info'} | null>(null);

  // Simulation d'une liste de techniciens
  const mockTechnicians = [
    { id: 'tech-1', name: 'Julien Vernet', initial: 'JV' },
    { id: 'tech-2', name: 'Sarah Koné', initial: 'SK' },
    { id: 'tech-3', name: 'Marc Dupont', initial: 'MD' }
  ];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (procedure) {
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
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: currentQuestion, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: procedure.id, question: currentQuestion })
      });
      if (!response.ok) throw new Error('IA Error');
      const data = await response.json();
      const aiMsg: Message = { id: (Date.now() + 1).toString(), sender: 'ai', text: data.output || data.text || "Réponse non disponible.", timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      setMessages(prev => [...prev, { id: 'err', sender: 'ai', text: "Erreur de connexion IA.", timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOpenExternal = () => {
    if (docUrl) {
      window.open(docUrl, '_blank');
    }
  };

  const handleShareWithTech = async (tech: any) => {
    setSharing(true);
    // Simulation d'envoi d'une notification de partage
    setTimeout(() => {
      setSharing(false);
      setIsShareModalOpen(false);
      setNotification({ msg: `Procédure partagée avec ${tech.name}`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    }, 800);
  };

  const handleShareByEmail = () => {
    if (!shareEmail.includes('@')) return;
    setSharing(true);
    setTimeout(() => {
      setSharing(false);
      setShareEmail('');
      setIsShareModalOpen(false);
      setNotification({ msg: `Lien envoyé à ${shareEmail}`, type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    }, 1000);
  };

  const submitSuggestion = () => {
    if (suggestionText.trim() && onSuggest) {
      onSuggest(suggestionText);
      setIsSuggestModalOpen(false);
      setSuggestionText('');
      setNotification({ msg: "Suggestion transmise au manager", type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 animate-fade-in overflow-hidden relative">
      
      {/* Notifications Toast */}
      {notification && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] animate-slide-up">
           <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3">
              <i className={`fa-solid ${notification.type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-info text-blue-400'}`}></i>
              <span className="font-bold text-sm tracking-tight">{notification.msg}</span>
           </div>
        </div>
      )}

      {/* MODAL SUGGESTION */}
      {isSuggestModalOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-slide-up border border-slate-200">
             <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-2xl text-slate-800 tracking-tight">Modification</h3>
                <button onClick={() => setIsSuggestModalOpen(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"><i className="fa-solid fa-xmark"></i></button>
             </div>
             <textarea 
               className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:bg-white focus:border-indigo-500 outline-none resize-none font-semibold text-slate-700 placeholder:text-slate-300 text-lg transition-all"
               placeholder="Que devrions-nous améliorer ?"
               value={suggestionText}
               onChange={(e) => setSuggestionText(e.target.value)}
             ></textarea>
             <button onClick={submitSuggestion} disabled={!suggestionText.trim()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest mt-6 hover:bg-indigo-600 transition-all disabled:opacity-30">Transmettre au manager</button>
          </div>
        </div>
      )}

      {/* MODAL PARTAGER */}
      {isShareModalOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-slide-up border border-slate-200 flex flex-col gap-8">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-2xl text-slate-800 tracking-tight">Partager</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Envoyer à un collègue</p>
                </div>
                <button onClick={() => setIsShareModalOpen(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"><i className="fa-solid fa-xmark"></i></button>
             </div>

             <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Techniciens disponibles</span>
                <div className="grid grid-cols-1 gap-2">
                   {mockTechnicians.map(tech => (
                     <button 
                        key={tech.id} 
                        disabled={sharing}
                        onClick={() => handleShareWithTech(tech)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition-all group"
                     >
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all text-xs">
                             {tech.initial}
                           </div>
                           <span className="font-bold text-slate-700 group-hover:text-indigo-600">{tech.name}</span>
                        </div>
                        <i className="fa-solid fa-paper-plane text-slate-200 group-hover:text-indigo-600"></i>
                     </button>
                   ))}
                </div>
             </div>

             <div className="pt-4 border-t border-slate-100 space-y-4">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Partage par Email</span>
                <div className="relative">
                  <input 
                    type="email" 
                    placeholder="exemple@entreprise.fr"
                    className="w-full pl-5 pr-14 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 outline-none font-bold text-slate-700 transition-all"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                  />
                  <button 
                    onClick={handleShareByEmail}
                    disabled={sharing || !shareEmail.includes('@')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-indigo-600 transition-all disabled:opacity-20 shadow-lg shadow-slate-200"
                  >
                    <i className={`fa-solid ${sharing ? 'fa-spinner animate-spin' : 'fa-check'}`}></i>
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* COLONNE GAUCHE : ASSISTANT IA */}
      <div className="lg:w-1/3 flex flex-col bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
            <i className="fa-solid fa-robot text-lg"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-xs uppercase tracking-[0.2em]">Assistant IA Procedio</h3>
            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5 animate-pulse">Prêt à répondre</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/20">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-5 rounded-3xl text-sm font-bold leading-relaxed shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-white text-slate-600 border border-slate-100 rounded-tl-none'
              }`}>
                {msg.text}
                <div className={`text-[9px] font-black mt-3 opacity-30 ${msg.sender === 'user' ? 'text-white' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-5 rounded-3xl rounded-tl-none border border-slate-100 shadow-sm flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-50">
          <div className="relative">
            <input 
              type="text"
              placeholder="Question sur la procédure..."
              className="w-full pl-6 pr-14 py-4 rounded-2xl bg-slate-50 border-none focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-sm font-bold text-slate-700"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isTyping}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100 disabled:opacity-30"
            >
              <i className="fa-solid fa-paper-plane text-sm"></i>
            </button>
          </div>
        </div>
      </div>

      {/* COLONNE DROITE : DOCUMENT */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Toolbar Pro */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="w-12 h-12 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="max-w-[300px]">
              <h2 className="font-black text-slate-900 text-xl leading-none truncate mb-2">{procedure.title}</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{procedure.category}</span>
                <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Version validée</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <button 
              onClick={() => setIsSuggestModalOpen(true)}
              className="px-6 py-3 bg-white border border-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center gap-3"
            >
              <i className="fa-regular fa-pen-to-square text-sm"></i> Modifier
            </button>

            <button 
              onClick={handleOpenExternal}
              className="px-6 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-3 shadow-sm"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-sm"></i> Ouvrir externe
            </button>

            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="px-8 py-3 bg-slate-900 border border-slate-900 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center gap-3 shadow-xl shadow-slate-200"
            >
              <i className="fa-solid fa-share-nodes text-sm"></i> PARTAGER
            </button>
          </div>
        </div>

        {/* Iframe View */}
        <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-inner relative overflow-hidden">
          {docUrl ? (
            <iframe 
              src={`${docUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full"
              title="Documentation IT"
              allowFullScreen
            ></iframe>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-6 bg-slate-50">
               <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Accès au serveur de fichiers...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcedureDetail;
