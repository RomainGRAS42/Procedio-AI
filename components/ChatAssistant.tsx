import React, { useState, useRef, useEffect } from 'react';
import { User, Procedure } from '../types';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'expert' | 'explorer' | 'uncertain';
  procedures?: Procedure[];
  suggestions?: any[];
  groupedSuggestions?: Array<{
    title: string;
    path?: string;
    chunks: Array<{
      label: string;
      content: string;
      score: number;
    }>;
  }>;
  timestamp: Date;
  source?: string;
  sourcePath?: string;
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
      const { data, error: supabaseError } = await supabase.functions.invoke('copilot-assistant', {
        body: {
          question: input,
          userName: `${user.firstName} ${user.lastName}`,
          userId: user.id
        }
      });

      if (supabaseError) throw supabaseError;
      
      console.log("🤖 Copilote Response Type:", data.type);
      if (data.groupedSuggestions) console.table(data.groupedSuggestions);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.output || "Désolé, je ne parviens pas à répondre.",
        type: data.type,
        suggestions: data.suggestions,
        groupedSuggestions: data.groupedSuggestions || [],
        source: data.source,
        sourcePath: data.sourcePath,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('Erreur chatbot:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "⚠️ Désolé, une erreur s'est produite lors de la communication avec le Copilote.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlertManager = async (question: string) => {
    try {
      await supabase.from("notes").insert([{
        user_id: user.id,
        title: `🚨 ALERTE_COPILOTE`,
        content: `L'utilisateur ${user.firstName} ${user.lastName} a posé une question restée sans réponse : "${question}"`,
      }]);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "✅ Votre demande d'assistance a été transmise aux managers. On s'en occupe ! 🚀",
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error("Failed to alert manager", err);
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
          {/* Bouton "Indigo Search Sparkle" (Brand Color) */}
          <button
            onClick={() => setIsOpen(true)}
            className="group relative w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-900/20 hover:shadow-indigo-900/40 hover:-translate-y-1 transition-all duration-300 flex items-center justify-center overflow-hidden border border-white/10"
          >
            {/* Conteneur d'icônes avec rotation */}
            <div className="relative w-full h-full flex items-center justify-center transition-transform duration-500">
              
              {/* État FERMÉ : Loupe + Sparkles */}
              <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 transform scale-100 opacity-100 group-hover:scale-110">
                <i className="fa-solid fa-magnifying-glass text-2xl text-white"></i>
                <i className="fa-solid fa-sparkles text-sm text-yellow-300 absolute top-3 right-3 animate-pulse"></i>
                <i className="fa-solid fa-sparkles text-[10px] text-white absolute bottom-4 left-3 opacity-70 animate-ping" style={{ animationDuration: '3s' }}></i>
              </div>

            </div>
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
          <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 ${isExpanded ? 'scale-110' : ''} transition-transform`}>
              <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Copilote Procedio
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Assistant connecté
              </p>
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
                <div className={`max-w-[90%] sm:max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'} px-4 py-3 rounded-2xl`}>
                  
                  {/* Badge Élite pour l'Expert AI */}
                  {msg.type === 'expert' && (
                    <div className="flex items-center gap-1.5 mb-2 py-0.5 px-2 bg-indigo-100 border border-indigo-200 rounded-full w-fit">
                      <i className="fa-solid fa-wand-magic-sparkles text-[10px] text-indigo-600"></i>
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Expert AI</span>
                    </div>
                  )}

                  <div 
                    onClick={async (e) => {
                      // Interception des clics sur les liens générés
                      const target = e.target as HTMLElement;
                      const link = target.closest('a');
                      
                      if (link) {
                        const href = link.getAttribute('href');
                        if (href) {
                          e.preventDefault();
                          const decodedHref = decodeURIComponent(href);
                          
                          // 1. Chercher par Titre d'abord (plus fiable dans ce contexte)
                          const linkText = link.innerText.trim();
                          const { data: procData } = await supabase
                            .from('procedures')
                            .select('*')
                            .or(`title.ilike.%${linkText}%,file_url.eq.${href},file_url.eq.${decodedHref}`)
                            .maybeSingle();

                          if (procData) {
                             const procedure = {
                                id: procData.file_id || procData.uuid, 
                                file_id: procData.file_id || procData.uuid,
                                title: procData.title,
                                category: procData.Type || 'NON CLASSÉ',
                                fileUrl: procData.file_url,
                                createdAt: procData.created_at,
                                views: procData.views || 0,
                                status: procData.status
                             } as Procedure;
                             onSelectProcedure(procedure);
                             setIsOpen(false);
                          } else {
                            window.open(href, '_blank', 'noopener,noreferrer');
                          }
                        }
                      }
                    }}
                  >
                    <p 
                      className="text-sm leading-relaxed whitespace-pre-wrap font-medium" 
                      dangerouslySetInnerHTML={{ 
                        __html: (() => {
                          let html = msg.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                          
                          const linkPlaceholders: string[] = [];
                          // 1. Markdown Links [label](url)
                          html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
                            linkPlaceholders.push(`<a href="${url}" class="text-indigo-600 underline font-bold hover:text-indigo-800 break-all cursor-pointer">${label}</a>`);
                            return `__LINK_TOKEN_${linkPlaceholders.length - 1}__`;
                          });

                          // 2. Raw URLs
                          html = html.replace(/(https?:\/\/[^\s<)]+)/g, (url) => {
                            return `<a href="${url}" class="text-indigo-600 underline font-bold hover:text-indigo-800 break-all cursor-pointer">${url}</a>`;
                          });

                          // 3. Restore
                          html = html.replace(/__LINK_TOKEN_(\d+)__/g, (_, index) => linkPlaceholders[parseInt(index)]);
                          
                          return html;
                        })()
                      }} 
                    />
                  </div>

                  {/* UI EXPLORER (RÉSULTATS GROUPÉS) */}
                  {msg.type === 'explorer' && (
                    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                      {msg.groupedSuggestions && msg.groupedSuggestions.length > 0 ? (
                        msg.groupedSuggestions.map((group, gIdx) => (
                        <div key={gIdx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <button
                            onClick={async () => {
                              const { data } = await supabase.from('procedures').select('*').ilike('title', `%${group.title}%`).maybeSingle();
                              if (data) {
                                onSelectProcedure({
                                  id: data.file_id || data.uuid,
                                  title: data.title,
                                  category: data.Type,
                                  fileUrl: data.file_url
                                } as any);
                                setIsOpen(false);
                              } else if (group.path) {
                                const fullUrl = `https://pczlikyvfmrdauufgxai.supabase.co/storage/v1/object/public/procedures/${group.path}`;
                                window.open(fullUrl, '_blank');
                              }
                            }}
                            className="w-full text-left p-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors flex items-center justify-between group"
                          >
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                              <i className="fa-solid fa-file-lines text-indigo-500"></i>
                              {group.title}
                            </span>
                            <i className="fa-solid fa-chevron-right text-[10px] text-slate-400 group-hover:translate-x-1 transition-transform"></i>
                          </button>
                          
                          <div className="p-2 space-y-2">
                            {group.chunks.map((c, cIdx) => (
                              <div key={cIdx} className="p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 group/chunk">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold rounded uppercase tracking-wider">
                                    {c.label}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-medium">Matches {Math.round(c.score * 100)}%</span>
                                </div>
                                <p className="text-[10px] text-slate-600 line-clamp-3 leading-relaxed italic">
                                  "...{c.content.substring(0, 150)}..."
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Recherche approfondie en cours...
                        </p>
                      </div>
                    )}
                    </div>
                  )}

                  {/* UI EXPLORER LEGACY (BACKWARD COMPATIBILITY) */}
                  {msg.type === 'explorer' && !msg.groupedSuggestions && msg.suggestions && (
                    <div className="mt-4 space-y-2">
                       {msg.suggestions.map((s, idx) => (
                         <button
                           key={idx}
                           onClick={async () => {
                             const { data } = await supabase.from('procedures').select('*').ilike('title', `%${s.title}%`).maybeSingle();
                             if (data) {
                               onSelectProcedure({
                                 id: data.file_id || data.uuid,
                                 title: data.title,
                                 category: data.Type,
                                 fileUrl: data.file_url
                               } as any);
                               setIsOpen(false);
                             } else if (s.path) {
                               const fullUrl = `https://pczlikyvfmrdauufgxai.supabase.co/storage/v1/object/public/procedures/${s.path}`;
                               window.open(fullUrl, '_blank');
                             }
                           }}
                           className="w-full text-left p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm"
                         >
                           <p className="text-xs font-bold text-slate-800 line-clamp-1">{s.title}</p>
                           <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 italic">"...{s.content.substring(0, 100)}..."</p>
                         </button>
                       ))}
                    </div>
                  )}

                  {/* UI UNCERTAIN (ALERTE MANAGER) */}
                  {msg.type === 'uncertain' && (
                    <div className="mt-4 flex flex-col gap-2">
                       <button
                         onClick={() => {
                           const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                           if (lastUserMsg) handleAlertManager(lastUserMsg.content);
                         }}
                         className="w-full py-2.5 px-4 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                       >
                         <i className="fa-solid fa-bell"></i>
                         Alerter un manager
                       </button>
                    </div>
                  )}

                  {/* SOURCE UNIQUE (EXPERT) */}
                  {msg.type === 'expert' && msg.source && (
                    <button
                      onClick={async () => {
                        const { data } = await supabase.from('procedures').select('*').ilike('title', `%${msg.source}%`).maybeSingle();
                        if (data) {
                           onSelectProcedure({
                             id: data.file_id || data.uuid,
                             title: data.title,
                             category: data.Type,
                             fileUrl: data.file_url
                           } as any);
                           setIsOpen(false);
                        }
                      }}
                      className="mt-4 flex items-center gap-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md group"
                    >
                      <i className="fa-solid fa-file-pdf text-xs ml-1"></i>
                      <span className="text-[10px] font-bold truncate max-w-[200px]">Lire : {msg.source}</span>
                      <i className="fa-solid fa-chevron-right text-[8px] opacity-70 group-hover:translate-x-1 transition-transform"></i>
                    </button>
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
