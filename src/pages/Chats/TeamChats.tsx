// src/pages/TeamChats.tsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import searchIcon from "@/assets/chats/searchIcon.svg";
import sendIcon from "@/assets/chats/sendIcon.svg";
import { useWalkthroughStore } from "@/store/walkthroughStore";
import { settingsTrainingSteps } from "@/walkthrough/steps";
import { useNavigate } from "react-router-dom";

import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/redux/store";
import {
  fetchConversations,
  fetchChatDetails,
  clearActiveChat,
  appendOptimisticMessage,
  confirmMessage,
} from "@/redux/slice/chatSlice";
import type { ApiConversation, ApiMessage } from "@/api/chatApi";
import { useChatSocket } from "@/hooks/useChatSocket";

// --- Types ---
interface User {
  id: string;
  name: string;
  role: string;
  avatar: string;
  lastSeen: string;
  type: "individual";
  mobile?: string;
}

interface Group {
  id: string;
  name: string;
  avatar: string;
  memberIds: string[];
  type: "group";
  lastMessage: {
    text: string;
    time: string;
    senderId: string;
    senderName: string;
    unread: boolean;
    unreadCount: number;
  };
}

type Chat = User | Group;

const roles = ["All", "Waiters", "Chefs", "Managers"];

const mapApiToChat = (apiChat: ApiConversation, myUserIds: string[]): Chat => {
  const rawLastMsg = apiChat.last_message as any;
  
  // CRITICAL FIX: Safely extract text. It might be an object or missing entirely.
  const safeText = typeof rawLastMsg?.message === "string" 
    ? rawLastMsg.message 
    : "";

  const mappedLastMessage = rawLastMsg
    ? {
        text: safeText,
        time: new Date(rawLastMsg.sent_at || rawLastMsg.createdAt || Date.now()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        senderId: String(rawLastMsg.sender_id || rawLastMsg.senderId || ""),
        senderName: typeof rawLastMsg.sender_name === "string" ? rawLastMsg.sender_name : "",
        unread: apiChat.unread_count > 0,
        unreadCount: apiChat.unread_count || 0,
      }
    : {
        text: "",
        time: "",
        senderId: "",
        senderName: "",
        unread: false,
        unreadCount: 0,
      };

  const numericId = String(apiChat.chat_conversation_id);

  if (apiChat.type === "group") {
    return {
      id: numericId,
      name: apiChat.title || "Group Chat",
      avatar: "",
      memberIds: apiChat.participants?.map((p) => String(p.participant_id)) || [],
      type: "group",
      lastMessage: mappedLastMessage,
    };
  }

  const other =
    apiChat.participants?.find((p) => !myUserIds.includes(String(p.participant_id))) ||
    apiChat.participants?.[0];

  return {
    id: numericId,
    name: other?.name || apiChat.title || "Member",
    role: other?.role || "Member",
    avatar: "",
    lastSeen: "last seen recently",
    type: "individual",
  };
};

const DoubleCheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline-block ml-1 text-white/80"
  >
    <path d="M18 6L7 17l-5-5"></path>
    <path d="M22 10l-7.5 7.5L13 16"></path>
  </svg>
);

const ChatTile = ({
  chat,
  selected,
  onClick,
}: {
  chat: Chat;
  selected: boolean;
  onClick: () => void;
}) => {
  const unreadCount = chat.type === "group" ? chat.lastMessage.unreadCount : 0;

  return (
    <div
      className={`flex items-center gap-3 px-2 py-3 cursor-pointer rounded-lg transition-all ${
        selected ? "bg-[#F8EAEE]" : "hover:bg-[#F8EAEE]"
      }`}
      onClick={onClick}
    >
      <img
        src={chat.avatar || "/default-avatar.png"}
        alt="avatar"
        className="w-12 h-12 rounded-full object-cover bg-yellow-200"
      />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-base truncate text-[#2C2C2E]">{chat.name}</div>
        <div className="truncate text-sm font-normal text-[#666668]">
          {chat.type === "group"
            ? chat.lastMessage.senderName
              ? `${chat.lastMessage.senderName.split("@")[0]}: ${chat.lastMessage.text}`
              : chat.lastMessage.text
            : "Manager online payment..."}
        </div>
      </div>
      <div className="flex flex-col items-end min-w-[40px]">
        {unreadCount > 0 && (
          <div className="mt-1 bg-gradient-to-b from-[#6A1B9A] to-[#D32F2F] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
        <div className="text-xs text-[#BDBDBD] font-semibold mt-1">
          {chat.type === "group" ? chat.lastMessage.time : "14:00"}
        </div>
      </div>
    </div>
  );
};

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

interface ChatWindowProps {
  chat: Chat;
  messages: ApiMessage[];
  isMobile: boolean;
  onBack: () => void;
  loading: boolean;
  onSend: (text: string) => Promise<void>;
  socketConnected: boolean;
  myUserIds: string[];
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  chat,
  messages,
  isMobile,
  onBack,
  loading,
  onSend,
  socketConnected,
  myUserIds,
}) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">Loading chat history...</div>;
  }

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setMessage("");
    try {
      await onSend(text);
    } catch (e) {
      console.error("send failed", e);
      setMessage(text);
    } finally {
      setSending(false);
    }
  };

  let lastDate = "";

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden flex-1 min-h-0">
      <div className="flex items-center px-4 md:px-8 py-4 border-b border-[#E5E5EA] bg-white relative">
        {isMobile && onBack && (
          <button className="mr-3 flex-shrink-0 md:hidden" onClick={onBack}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path
                d="M15 18l-6-6 6-6"
                stroke="#6A1B9A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <div className="relative">
          <img
            src={chat.avatar || "/default-avatar.png"}
            alt="avatar"
            className="w-10 h-10 rounded-full object-cover bg-yellow-200"
          />
          {chat.type === "group" && (
            <div className="absolute -right-2 top-0 flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-purple-400 border-2 border-white"></div>
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center min-w-0 ml-3">
          <span className="font-bold text-lg text-[#2C2C2E] truncate flex items-center gap-1">
            {chat.type === "group" && <span className="text-pink-600">👥</span>}
            {chat.name}
          </span>
          <span className="text-xs text-gray-400">
            {chat.type === "individual" ? chat.lastSeen : "last seen 45 minutes ago"}
          </span>
          {!socketConnected && <span className="text-xs text-red-500">Reconnecting…</span>}
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 12a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-4 bg-white min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-[#222] mt-20">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg) => {
            const mine =
              msg.isOwnMessage === true || myUserIds.includes(String(msg.senderId));
            const msgDate = new Date(msg.createdAt || Date.now()).toLocaleDateString();
            const showDateSeparator = msgDate !== lastDate;
            if (showDateSeparator) lastDate = msgDate;

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                      {msgDate}
                    </span>
                  </div>
                )}

                <div className={`flex flex-col mb-3 ${mine ? "items-end" : "items-start"}`}>
                  {!mine && (
                    <div className="flex items-center gap-2 mb-1 ml-1">
                      <img
                        src="/default-avatar.png"
                        alt="sender"
                        className="w-5 h-5 rounded-full bg-gray-300"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        {msg.senderName || "Team Member"}
                      </span>
                    </div>
                  )}

                  <div
                    className={`px-4 py-2 rounded-xl max-w-[75%] break-words flex flex-col ${
                      mine
                        ? "bg-gradient-to-r from-[#7B1FA2] to-[#D32F2F] text-white rounded-tr-sm"
                        : "bg-[#F8EAEE] text-black rounded-tl-sm"
                    }`}
                  >
                    <span className="text-[15px]">{msg.text}</span>
                    <div
                      className={`flex items-center text-[10px] mt-1 ${
                        mine ? "text-white/80 justify-end" : "text-gray-500 justify-start"
                      }`}
                    >
                      <span>
                        {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {mine && <DoubleCheckIcon />}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      <div className="border-t border-[#E5E5EA] px-4 py-3 flex items-center gap-3 bg-white">
        <input
          type="text"
          className="flex-1 border-none outline-none text-base text-[#666668] placeholder-gray-400 bg-transparent"
          placeholder="Start typing..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          disabled={!socketConnected}
        />
        <button className="text-gray-400 hover:text-gray-600 p-1">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </button>
        <button
          className="text-[#6A1B9A] flex items-center justify-center w-8 h-8 disabled:opacity-40"
          type="button"
          onClick={handleSend}
          disabled={sending || !message.trim() || !socketConnected}
        >
          {message.trim() ? (
            <img src={sendIcon} alt="send" className="w-6 h-6" />
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transform rotate-45"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

const TeamChats: React.FC = () => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);

  const isMobile = useIsMobile();
  const leftPanelRef = useRef<HTMLDivElement>(null!);
  const navigate = useNavigate();

  const { joinChat, sendChatMessage, connected } = useChatSocket();

  const dispatch = useDispatch<AppDispatch>();
  const { conversations, messages, loadingList, loadingChat, error } = useSelector(
    (state: RootState) => state.chat
  );

  const token = localStorage.getItem("token");

  const authUser = useSelector((state: RootState) => state.auth.user);
  const myUserIds = useMemo(
    () =>
      [
        authUser?.id,
        authUser?._id,
        authUser?.user_id,
        authUser?.employee_id,
        authUser?.Employee_id,
        authUser?.employeeId,
      ]
        .filter((id): id is string | number => typeof id === "string" || typeof id === "number")
        .map(String),
    [authUser],
  );
  const myUserId = myUserIds[0] ?? null;

  const {
    isActive,
    steps,
    currentStep,
    next,
    completed,
    activeTraining,
    completedTrainings,
    startTraining,
  } = useWalkthroughStore();

  useEffect(() => {
    if (!token) return;
    const typeParam = activeTab === "All" ? undefined : activeTab.toLowerCase().slice(0, -1);
    dispatch(fetchConversations({ search: search || undefined, type: typeParam }));
  }, [dispatch, activeTab, search, token]);

  const handleSelectChat = useCallback(
    (chat: Chat) => {
      if (!token) return;
      setSelectedChat(chat);

      joinChat(chat.id);
      dispatch(fetchChatDetails(chat.id));

      const step = steps[currentStep];
      if (isActive && step && step.selector === ".team-chat-left-panel") next();
    },
    [dispatch, token, steps, currentStep, isActive, next, joinChat]
  );

  const handleBack = () => {
    setSelectedChat(null);
    dispatch(clearActiveChat());
  };

  const handleSend = useCallback(
    async (text: string) => {
      if (!selectedChat) return;

      const optimisticId = `tmp-${crypto.randomUUID()}`;

      dispatch(
        appendOptimisticMessage({
          id: optimisticId,
          text,
          senderId: myUserId ?? "me",
          createdAt: new Date().toISOString(),
          isOwnMessage: true,
        })
      );

      try {
        const ack = await sendChatMessage(selectedChat.id, text);
        const confirmed = ack?.message ?? ack?.data ?? null;

        if (confirmed?.id) {
          dispatch(
            confirmMessage({
              clientId: optimisticId,
              message: {
                id: String(confirmed.id),
                text: confirmed.message ?? confirmed.text ?? text,
                senderId: String(confirmed.senderId ?? confirmed.sender_id ?? myUserId ?? "me"),
                createdAt: confirmed.createdAt ?? new Date().toISOString(),
                isOwnMessage: true,
              },
            })
          );
        }
      } catch (e) {
        console.error("send failed", e);
      }
    },
    [selectedChat, myUserId, dispatch, sendChatMessage]
  );

  useEffect(() => {
    if (completed && activeTraining === "teamchat" && !completedTrainings.settings) {
      startTraining("settings", settingsTrainingSteps);
      navigate("/");
    }
  }, [completed, activeTraining, completedTrainings, startTraining, navigate]);

  const chatList = useMemo(
    () => conversations.map((c) => mapApiToChat(c, myUserIds)),
    [conversations, myUserIds]
  );

  return (
    <div className="p-0 md:p-6 flex flex-col h-screen overflow-hidden bg-gray-50">
      <div className="bg-white lg:shadow-2xl sm:shadow px-0 md:px-6 flex flex-1 min-h-0 rounded-2xl overflow-hidden relative team-chat-full-panel">
        <div
          ref={leftPanelRef}
          className={`w-full md:w-[380px] border-r-0 md:border-r border-[#E5E5EA] pr-0 md:pr-4 flex flex-col min-h-0 relative team-chat-left-panel bg-white z-10 ${
            isMobile && selectedChat ? "hidden" : ""
          }`}
        >
          <div className="my-4 px-4 md:px-0">
            <div className="relative">
              <input
                type="text"
                className="w-full rounded-lg bg-[#FAFAFA] pl-10 pr-6 py-3 text-sm text-[#666668] focus:outline-none border border-gray-100"
                placeholder="Search Team"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <img
                src={searchIcon}
                alt="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BDBDBD] w-4 h-4 opacity-50"
              />
            </div>
          </div>

          <div className="flex gap-2 mb-4 px-4 md:px-0 overflow-x-auto no-scrollbar">
            {roles.map((role) => (
              <button
                key={role}
                className={`px-4 py-1.5 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                  activeTab === role
                    ? "bg-gradient-to-r from-[#7B1FA2] to-[#D32F2F] text-white"
                    : "bg-[#F8EAEE] text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => {
                  setActiveTab(role);
                  handleBack();
                }}
              >
                {role}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 h-full flex flex-col px-2 md:px-0">
            {!token ? (
              <div className="text-center py-10 text-red-500">
                Your session has expired. Please log in again.
              </div>
            ) : loadingList ? (
              <div className="text-center py-10 text-gray-500">Loading conversations...</div>
            ) : error ? (
              <div className="text-center py-10 text-red-500">
                {error.toLowerCase().includes("token") || error.toLowerCase().includes("access denied")
                  ? "Your session has expired. Please log in again."
                  : error}
              </div>
            ) : chatList.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No conversations found.</div>
            ) : (
              chatList.map((chat) => (
                <ChatTile
                  key={chat.id}
                  chat={chat}
                  selected={!!selectedChat && selectedChat.id === chat.id}
                  onClick={() => handleSelectChat(chat)}
                />
              ))
            )}
          </div>
        </div>

        <div
          className={`flex-1 flex flex-col min-h-0 w-full bg-white ${
            isMobile && !selectedChat ? "hidden" : ""
          }`}
        >
          {!selectedChat ? (
            <div className="flex items-center justify-center h-full text-center text-lg text-[#2C2C2E]">
              <div className="text-gray-400">
                Send and Receive message without any interruption
                <br />
                Message your team for any assistance or help required
              </div>
            </div>
          ) : (
            <ChatWindow
              chat={selectedChat}
              messages={messages}
              isMobile={isMobile}
              onBack={handleBack}
              loading={loadingChat}
              onSend={handleSend}
              socketConnected={connected}
              myUserIds={myUserIds}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamChats;