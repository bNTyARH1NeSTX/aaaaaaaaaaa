import apiClient from '../utils/apiClient';

// Types
export interface QueryCompletionRequest {
  query: string;
  system_prompt?: string;
  stream?: boolean;
  filter_metadata?: Record<string, any>;
  include_sources?: boolean;
  top_k?: number;
  max_tokens?: number;
  temperature?: number;
  model?: string;
}

export interface CompletionResponse {
  answer: string;
  sources?: Array<{
    id: string;
    text: string;
    metadata: Record<string, any>;
    score: number;
    document_id: string;
  }>;
}

export interface AgentQueryRequest {
  query: string;
  stream?: boolean;
  filter_metadata?: Record<string, any>;
  include_sources?: boolean;
  top_k?: number;
  max_tokens?: number;
  temperature?: number;
  model?: string;
}

// API functions
export const queryCompletion = async (request: QueryCompletionRequest) => {
  const response = await apiClient.post<CompletionResponse>('/query', request);
  return response.data;
};

export const agentQuery = async (request: AgentQueryRequest) => {
  const response = await apiClient.post<CompletionResponse>('/agent', request);
  return response.data;
};
