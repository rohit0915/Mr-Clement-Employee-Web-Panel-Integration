// src/api/chatApi.ts
import api from "./axios";

export interface ApiMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  senderName?: string;
  isOwnMessage?: boolean;
}

export interface ApiConversation {
  _id: string;
  chat_conversation_id: number;
  title: string;
  type: "individual" | "group";
  unread_count: number;
  last_message?: {
    chat_message_id: number;
    message: string;
    sender_id: number;
    sender_name: string;
    sent_at: string;
  };
  participants?: Array<{
    participant_id: number;
    name: string;
    role: string;
  }>;
}

export interface ConversationParams {
  search?: string;
  type?: string;
}

export const getConversations = async (params?: ConversationParams): Promise<ApiConversation[]> => {
  const { data } = await api.get<{ data: ApiConversation[] } | ApiConversation[]>(
    "/api/v1/restaurant/chat/conversations/getall",
    { params }
  );
  return Array.isArray(data) ? data : data.data;
};

export const getConversationById = async (id: string): Promise<ApiConversation> => {
  const { data } = await api.get<{ data: ApiConversation } | ApiConversation>(
    `/api/v1/restaurant/chat/conversations/getbyid/${id}`
  );
  return "data" in (data as object) && !Array.isArray(data)
    ? (data as { data: ApiConversation }).data
    : (data as ApiConversation);
};

export const getMessages = async (conversationId: string, page = 1, limit = 30): Promise<ApiMessage[]> => {
  const { data } = await api.get<{ data: any } | any>(
    `/api/v1/restaurant/chat/conversations/${conversationId}/messages`,
    { params: { page, limit } }
  );

  const payload = "data" in (data as object) && !Array.isArray(data)
    ? (data as { data: any }).data
    : data;

  const list: any[] = Array.isArray(payload) ? payload : payload?.messages ?? payload?.rows ?? [];

  return list.map((m: any) => {
    const rawText = m.message ?? m.text ?? "";
    return {
      id: String(m.id ?? m.chat_message_id ?? m._id),
      text: typeof rawText === "string" ? rawText : (rawText?.text || ""), // Safely extract string
      senderId: String(m.senderId ?? m.sender_id ?? m.user_id ?? ""),
      createdAt: m.createdAt ?? m.created_at ?? m.sent_at ?? new Date().toISOString(),
    };
  });
};

export const sendMessage = async (conversationId: string, text: string): Promise<ApiMessage> => {
  const { data } = await api.post<{ data: ApiMessage } | ApiMessage>(
    `/api/v1/restaurant/chat/conversations/${conversationId}/messages`,
    { text }
  );
  return "data" in (data as object) && !Array.isArray(data)
    ? (data as { data: ApiMessage }).data
    : (data as ApiMessage);
};