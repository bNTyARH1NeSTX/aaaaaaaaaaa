import apiClient from '../utils/apiClient';

// Types
export interface GraphCreateRequest {
  name: string;
  description?: string;
  documents?: string[];
  document_ids?: string[];
  extract_entities?: boolean;
  resolve_entities?: boolean;
  extract_relationships?: boolean;
  prompt_overrides?: {
    entity_extraction?: {
      prompt_template?: string;
      examples?: {
        text: string;
        entities: Array<{
          name: string;
          type: string;
        }>;
      }[];
    };
    entity_resolution?: {
      prompt_template?: string;
      examples?: {
        text: string;
        entities: Array<{
          name: string;
          resolved_name: string;
        }>;
      }[];
    };
  };
}

export interface Graph {
  name: string;
  created_at: string;
  updated_at: string;
  nodes: Array<{
    id: string;
    name: string;
    entity_type: string;
    properties?: Record<string, any>;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    properties?: Record<string, any>;
  }>;
}

export interface UpdateGraphRequest {
  documents?: string[];
  document_ids?: string[];
  chunk_size?: number;
  chunk_overlap?: number;
  prompt_overrides?: {
    entity_extraction?: {
      prompt_template?: string;
      examples?: {
        text: string;
        entities: Array<{
          name: string;
          type: string;
        }>;
      }[];
    };
    entity_resolution?: {
      prompt_template?: string;
      examples?: {
        text: string;
        entities: Array<{
          name: string;
          resolved_name: string;
        }>;
      }[];
    };
  };
}

// API functions
export const createGraph = async (request: GraphCreateRequest) => {
  const response = await apiClient.post<Graph>('/graph/create', request);
  return response.data;
};

export const getGraph = async (name: string) => {
  const response = await apiClient.get<Graph>(`/graph/${name}`);
  return response.data;
};

export const listGraphs = async () => {
  const response = await apiClient.get<string[]>('/graphs');
  return response.data;
};

export const updateGraph = async (name: string, request: UpdateGraphRequest) => {
  const response = await apiClient.post<Graph>(`/graph/${name}/update`, request);
  return response.data;
};
