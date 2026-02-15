import React from "react";
import { User, Mission } from "../types";

export interface MissionMessage {
  id: string;
  mission_id: string;
  user_id: string;
  content: string;
  created_at: string;
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
}

export const MissionChat: React.FC<MissionChatProps> = ({
  messages,
  userId,
  loadingMessages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  chatContainerRef
}) => {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-8 space-y-6" ref={chatContainerRef}>
        {messages.length === 0 && !loadingMessages ? (
          <div className="text-center py-20 text-slate-300">
            <i className="fa-regular fa-comments text-4xl mb-4"></i>
            <p>Aucun message. Commencez la discussion !</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === userId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] ${isMe ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"} p-4 rounded-2xl rounded-tr-sm shadow-sm`}>
                  <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                  <div className="mt-2 flex items-center justify-between gap-4 opacity-70">
                    <span className="text-[10px] uppercase font-bold tracking-wider">
                      {msg.user?.first_name || "Utilisateur"}
                    </span>
                    <span className="text-[10px]">
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
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
        <div className="flex gap-4 p-2 bg-slate-50 rounded-2xl border border-slate-100 focus-within:bg-white focus-within:border-indigo-500 transition-all shadow-inner">
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none px-4 font-bold text-slate-700 text-sm"
            placeholder="Écrivez un message..."
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSendMessage();
            }}
          />
          <button
            onClick={onSendMessage}
            className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-slate-900 transition-all shadow-lg active:scale-95">
            <i className="fa-solid fa-paper-plane text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionChat;
