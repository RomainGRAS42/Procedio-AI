import React, { useState, useRef, useEffect } from 'react';
import { User, Procedure } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  procedures?: Procedure[];
  timestamp: Date;
}

interface ChatAssistantProps {
  user: User;
  onSelectProcedure: (procedure: Procedure) => void;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ user, onSelectProcedure }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when opening or new messages
  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100); // Small delay for animation
    } else {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && chatPanelRef.current && !chatPanelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Message d'accueil
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "👋 Bonjour ! Je suis votre **Copilote Procedio**.\n\nDécrivez-moi votre problème ou votre besoin, et je vais chercher les meilleures procédures pour vous aider.",
        timestamp: new Date()
      }]);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('https://n8n.srv901593.hstgr.cloud/webhook-test/search-procedures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          user_email: user.email
        })
      });

      if (!response.ok) {
        console.error('Webhook Error:', response.status, response.statusText);
        throw new Error(`Erreur webhook: ${response.status}`);
      }

      const data = await response.json();
      console.log('🤖 Chatbot Response:', data); // DEBUG
      
      // Handle response from n8n (Array or Object)
      let responseText = '';
      let procedures: Procedure[] = [];

      // Case 1: Array with output [{ "output": "...", "procedures": [...] }]
      if (Array.isArray(data) && data.length > 0) {
        if (data[0].output) responseText = data[0].output;
        if (data[0].procedures) procedures = data[0].procedures;
      } 
      // Case 2: Direct Object { "output": "...", "procedures": [...] }
      else if (typeof data === 'object') {
        if (data.output && typeof data.output === 'string') responseText = data.output;
        if (data.procedures) procedures = data.procedures;
      }
      
      // Fallback strategies if main parsing failed
      if (!responseText && !procedures.length) {
         if (typeof data === 'string') responseText = data;
         else {
           console.warn('⚠️ Unknown response format:', data);
           responseText = "Désolé, je n'ai pas compris la réponse du serveur (Format inconnu).";
         }
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        procedures: procedures,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Erreur chatbot:', error);
      
      let errorMessageContent = "⚠️ Désolé, une erreur s'est produite.";
      
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        errorMessageContent = "⚠️ Erreur de connexion (CORS). Le serveur n8n ne permet pas l'accès direct depuis ce domaine. Veuillez vérifier la configuration CORS du webhook ou utiliser un proxy.";
      } else if (error.message.includes('Erreur webhook')) {
        errorMessageContent = `⚠️ Erreur serveur: ${error.message}`;
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessageContent,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Bouton sticky - toujours visible */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[60] animate-bounce-in">
          {/* Nouveau Bouton Premium "Holographique" */}
          <button
            onClick={() => setIsOpen(true)}
            className="group relative w-16 h-16 rounded-[2rem] bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 shadow-2xl shadow-indigo-500/40 hover:scale-105 hover:shadow-indigo-500/60 transition-all duration-300 flex items-center justify-center overflow-hidden border border-white/20"
          >
            {/* Effet Brillance (Glassmorphism) */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            {/* Effet de lueur interne */}
            <div className="absolute inset-0 rounded-[2rem] shadow-[inset_0_0_20px_rgba(255,255,255,0.3)] opacity-50"></div>

            {/* Icône animée */}
            <i className="fa-solid fa-sparkles text-2xl text-white drop-shadow-md group-hover:animate-pulse"></i>

            {/* Badge "Connecté" (pulsing dot) */}
            <span className="absolute top-3 right-3 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white/50"></span>
            </span>
          </button>
        </div>
      )}

      {/* Panel Chat */}
      {isOpen && (
        <div 
          ref={chatPanelRef}
          className={`fixed bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-50 animate-slide-up transition-all duration-300 ease-in-out
            ${isExpanded 
              ? 'bottom-6 right-6 w-[800px] h-[80vh] max-w-[calc(100vw-3rem)]' 
              : 'bottom-6 right-6 w-96 h-[600px] max-w-[calc(100vw-3rem)]'
            }
            max-md:inset-4 max-md:w-auto max-md:h-auto max-md:max-h-[90vh]`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fa-solid fa-sparkles" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm">Copilote Procedio</h3>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Assistant IA</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-8 h-8 rounded-lg hover:bg-white/50 text-slate-500 hover:text-indigo-600 transition-all flex items-center justify-center max-md:hidden"
                aria-label={isExpanded ? "Réduire" : "Agrandir"}
                title={isExpanded ? "Réduire (Mode Widget)" : "Agrandir (Mode Lecture)"}
              >
                <i className={`fa-solid ${isExpanded ? 'fa-compress' : 'fa-expand'}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/50 text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center"
                aria-label="Fermer"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'} px-4 py-3 rounded-2xl`}>
                  <p 
                    className="text-sm leading-relaxed whitespace-pre-wrap font-medium" 
                    dangerouslySetInnerHTML={{ 
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline font-bold hover:text-indigo-800 break-all">$1</a>')
                    }} 
                  />
                  
                  {/* Procédures trouvées */}
                  {msg.procedures && msg.procedures.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.procedures.map((proc) => (
                        <button
                          key={proc.id}
                          onClick={() => {
                            onSelectProcedure(proc);
                            setIsOpen(false);
                          }}
                          className="w-full text-left p-3 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all group shadow-sm"
                        >
                          <div className="flex items-start gap-2">
                            <i className="fa-solid fa-file-lines text-indigo-600 text-xs mt-1" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                                {proc.title}
                              </p>
                              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                {proc.category}
                              </p>
                            </div>
                            <i className="fa-solid fa-chevron-right text-[8px] text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <span className={`text-[9px] font-medium mt-2 block ${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Loading */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-slate-600 font-semibold">Recherche en cours...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Décrivez votre problème..."
                rows={2}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all text-sm text-slate-800 font-medium placeholder:text-slate-500 resize-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:shadow-none disabled:cursor-not-allowed"
                aria-label="Envoyer"
              >
                <i className="fa-solid fa-paper-plane" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold mt-2 text-center flex items-center justify-center gap-1">
              <i className="fa-solid fa-circle-info text-indigo-500" />
              Appuyez sur <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-bold mx-1">Enter</kbd> pour envoyer
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
