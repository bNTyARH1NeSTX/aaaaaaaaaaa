export interface Source {
  content: string;
  score: number;
  source: {
    title: string;
    url?: string;
  };
}

export interface ChatMessage {
  content: string;
  sources?: Source[];
}

export interface ChatResponse {
  message: ChatMessage;
  sources?: Source[];
}

class ChatApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
  }

  async sendMessage(params: { message: string }): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return await response.json();
    } catch (error) {
      console.error('Error in sendMessage:', error);
      throw error;
    }
  }
}

export const chatApi = new ChatApi(); 