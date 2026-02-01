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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

      if (!response.ok) throw new Error('Erreur webhook');

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.procedures && data.procedures.length > 0
          ? `✅ J'ai trouvé **${data.procedures.length} procédure${data.procedures.length > 1 ? 's' : ''}** qui peuvent vous aider :`
          : "❌ Désolé, je n'ai pas trouvé de procédure correspondant à votre demande. Essayez de reformuler ou de préciser davantage.",
        procedures: data.procedures || [],
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Erreur chatbot:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "⚠️ Désolé, une erreur s'est produite. Veuillez réessayer dans quelques instants.",
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
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-full shadow-2xl shadow-purple-500/30 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 z-50 group"
          aria-label="Ouvrir l'assistant"
        >
          <i className="fa-solid fa-sparkles text-2xl animate-pulse group-hover:animate-none" />
          
          {/* Badge notification (optionnel) */}
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white">
            IA
          </span>
        </button>
      )}

      {/* Panel Chat */}
      {isOpen && (
        <div 
          ref={chatPanelRef}
          className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-50 animate-slide-up md:w-96 max-md:inset-4 max-md:w-auto max-md:h-auto max-md:max-h-[90vh]"
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
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-white/50 text-slate-500 hover:text-slate-700 transition-all flex items-center justify-center"
              aria-label="Fermer"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'} px-4 py-3 rounded-2xl`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  
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
