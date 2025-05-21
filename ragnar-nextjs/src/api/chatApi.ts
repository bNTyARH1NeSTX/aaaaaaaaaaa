import api from './morphikApi';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Source {
  id: string;
  title: string;
  content: string;
  url?: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  useCache?: boolean;
  cacheStrategy?: 'exact' | 'semantic' | 'hybrid';
  maxSources?: number;
}

export interface ChatResponse {
  message: ChatMessage;
  sources: Source[];
  cacheMetrics?: {
    cacheHit: boolean;
    retrievalTime: number;
    cacheScore?: number;
    savedTokens?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export const chatApi = {
  // Send a message to get a response
  sendMessage: async (params: ChatRequest): Promise<ChatResponse> => {
    return api.post<ChatResponse>('/chat/message', params);
  },

  // Get conversation history
  getConversationHistory: async (conversationId: string): Promise<ChatMessage[]> => {
    const data = await api.get<{ messages: ChatMessage[] }>(`/chat/conversations/${conversationId}`);
    return data.messages;
  },

  // List all conversations
  listConversations: async (): Promise<Conversation[]> => {
    const data = await api.get<{ conversations: Conversation[] }>('/chat/conversations');
    return data.conversations;
  },

  // Create a new conversation
  createConversation: async (title?: string): Promise<Conversation> => {
    const data = await api.post<{ conversation: Conversation }>('/chat/conversations', { title });
    return data.conversation;
  },

  // Delete a conversation
  deleteConversation: async (conversationId: string): Promise<void> => {
    await api.delete<void>(`/chat/conversations/${conversationId}`);
  },

  // Get cache stats
  getCacheStats: async (): Promise<{
    hitRate: number;
    totalQueries: number;
    averageSavingsPerQuery: number;
    totalTokensSaved: number;
  }> => {
    return api.get<{
      hitRate: number;
      totalQueries: number;
      averageSavingsPerQuery: number;
      totalTokensSaved: number;
    }>('/chat/cache/stats');
  }
};

export default chatApi;
