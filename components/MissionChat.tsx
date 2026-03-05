import React from "react";
import { User, Mission } from "../types";

export interface MissionMessage {
  id: string;
  mission_id: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'text' | 'system';
  tempId?: string;
  user?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface MissionChatProps {
  messages: MissionMessage[];
  userId: string;
  loadingMessages: boolean;
  newMessage: string;
  onNewMessageChange: (val: string) => void;
  onSendMessage: () => void;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  missionStatus: string;
}

export const MissionChat: React.FC<MissionChatProps> = ({
  messages,
  userId,
  loadingMessages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  chatContainerRef,
  missionStatus
}) => {
  const isMissionCompleted = missionStatus === 'completed';

  return (
    <div className="h-full bg-slate-50 p-4 lg:p-8 flex flex-col">
      <div className="flex flex-col w-full h-full bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 space-y-6" ref={chatContainerRef}>
          {messages.length === 0 && !loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-300">
              <i className="fa-regular fa-comments text-4xl mb-4"></i>
              <p className="font-medium text-sm">Aucun message. Commencez la discussion !</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.user_id === userId;
              const isSystem = msg.type === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-4">
                    <div className="bg-slate-50 px-4 py-1.5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 border border-slate-100">
                      <i className="fa-solid fa-info-circle text-slate-300"></i>
                      {msg.content}
                      <span className="text-[9px] font-normal text-slate-300 border-l border-slate-200 pl-2 ml-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] ${isMe ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"} p-4 rounded-2xl shadow-sm`}>
                    <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                    <div className={`mt-2 flex items-center justify-between gap-4 text-[9px] ${isMe ? "text-indigo-200" : "text-slate-400"}`}>
                      <span className="uppercase font-bold tracking-wider">
                        {msg.user?.first_name || "Utilisateur"}
                      </span>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {isMissionCompleted && (
             <div className="flex justify-center my-8">
                <div className="bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100 text-emerald-600 flex flex-col items-center gap-2 text-center shadow-sm">
                  <i className="fa-solid fa-check-circle text-xl"></i>
                  <div>
                      <p className="text-xs font-black uppercase tracking-widest">Mission Terminée</p>
                      <p className="text-[10px] opacity-75 mt-1">La discussion est close.</p>
                  </div>
                </div>
             </div>
          )}
        </div>

        <div className="p-6 bg-white border-t border-slate-50">
          <div className={`flex gap-4 p-2 bg-slate-50 rounded-2xl border border-slate-100 transition-all shadow-inner ${isMissionCompleted ? 'opacity-50 pointer-events-none grayscale' : 'focus-within:bg-white focus-within:border-indigo-500'}`}>
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none px-4 font-bold text-slate-700 text-sm placeholder:font-medium placeholder:text-slate-400"
              placeholder={isMissionCompleted ? "Discussion fermée" : "Écrivez un message..."}
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isMissionCompleted) onSendMessage();
              }}
              disabled={isMissionCompleted}
            />
            <button
              onClick={onSendMessage}
              disabled={isMissionCompleted}
              className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-slate-900 transition-all shadow-lg active:scale-95 disabled:bg-slate-400 disabled:shadow-none">
              <i className={`fa-solid ${isMissionCompleted ? 'fa-lock' : 'fa-paper-plane'} text-xs`}></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MissionChat;
