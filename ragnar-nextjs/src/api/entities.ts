import axios from 'axios';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://op10na1qhzsc5m-8000.proxy.runpod.net';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') || 'dummy-token-for-development';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface EntityExtractionRequest {
  content: string;
  doc_id?: string;
  chunk_number?: number;
}

export interface Entity {
  label: string;
  type: string;
  properties?: Record<string, any>;
}

export interface Relationship {
  source: string;
  target: string;
  relationship: string;
  properties?: Record<string, any>;
}

export interface EntityExtractionResponse {
  entities: Entity[];
  relationships: Relationship[];
  adaptive_entity_types: string[];
}

export const entityExtractionApi = {
  async extractEntities(request: EntityExtractionRequest): Promise<EntityExtractionResponse> {
    const response = await apiClient.post('/graphs/extract-entities', request);
    return response.data;
  },
};
