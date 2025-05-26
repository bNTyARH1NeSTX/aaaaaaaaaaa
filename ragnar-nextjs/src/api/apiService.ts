import axios, { AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ag61pyffws3ral-8000.proxy.runpod.net';

// Axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interfaces basadas en los modelos del backend
export interface Document {
  id: string;
  filename: string;
  size: number;
  status: 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Graph {
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  nodes?: number;
  edges?: number;
}

export interface ChunkResult {
  content: string;
  metadata: {
    filename: string;
    page?: number;
    [key: string]: any;
  };
  score: number;
}

export interface UsageStats {
  total_documents: number;
  total_chat_sessions: number;
  searches_today: number;
  manuals_generated: number;
}

export interface RecentActivity {
  operation_type: string;
  metadata: {
    [key: string]: any;
  };
  timestamp: string;
  status: string;
}

// Request interfaces
export interface IngestTextRequest {
  content: string;
  filename?: string;
  metadata?: { [key: string]: any };
  folder_name?: string;
  end_user_id?: string;
}

export interface RetrieveRequest {
  query: string;
  k?: number;
  folder_name?: string;
  end_user_id?: string;
}

export interface CompletionQueryRequest {
  query: string;
  k?: number;
  temperature?: number;
  max_tokens?: number;
  folder_name?: string;
  end_user_id?: string;
}

export interface AgentQueryRequest {
  query: string;
  conversation_id?: string;
  k?: number;
  temperature?: number;
  folder_name?: string;
  end_user_id?: string;
}

export interface ManualGenerationRequest {
  query: string;
  image_path?: string;
  image_prompt?: string;
  k_images?: number;
}

export interface ManualGenerationResponse {
  generated_text: string;
  relevant_images_used: Array<{
    image_path?: string;
    prompt?: string;
    respuesta?: string;
    [key: string]: any;
  }>;
  query: string;
}

// Interceptor para manejo de errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Error de API:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Interceptor para agregar token de autenticación si existe
api.interceptors.request.use(
  (config) => {
    // Por ahora, usamos un token dummy para desarrollo
    // En producción, esto debería venir del sistema de auth
    const token = localStorage.getItem('auth_token') || 'dummy-token-for-development';
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// === API DE DOCUMENTOS ===
export const getDocuments = async (skip = 0, limit = 10000): Promise<Document[]> => {
  try {
    const response: AxiosResponse<Document[]> = await api.post('/documents', {
      skip,
      limit,
    });
    return response.data;
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    return [];
  }
};

export const getDocument = async (documentId: string): Promise<Document | null> => {
  try {
    const response: AxiosResponse<Document> = await api.get(`/documents/${documentId}`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo documento:', error);
    return null;
  }
};

export const uploadDocument = async (file: File, metadata?: { [key: string]: any }): Promise<Document | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata || {}));

    const response: AxiosResponse<Document> = await api.post('/ingest/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error subiendo documento:', error);
    return null;
  }
};

export const deleteDocument = async (documentId: string): Promise<boolean> => {
  try {
    await api.delete(`/documents/${documentId}`);
    return true;
  } catch (error) {
    console.error('Error eliminando documento:', error);
    return false;
  }
};

// === API DE CARPETAS ===
export const getFolders = async (): Promise<Folder[]> => {
  try {
    const response: AxiosResponse<Folder[]> = await api.get('/folders');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo carpetas:', error);
    return [];
  }
};

export const createFolder = async (name: string, description?: string): Promise<Folder | null> => {
  try {
    const response: AxiosResponse<Folder> = await api.post('/folders', {
      name,
      description,
    });
    return response.data;
  } catch (error) {
    console.error('Error creando carpeta:', error);
    return null;
  }
};

// === API DE GRAFOS ===
export const getGraphs = async (): Promise<Graph[]> => {
  try {
    const response: AxiosResponse<Graph[]> = await api.get('/graphs');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo grafos:', error);
    return [];
  }
};

// === API DE BÚSQUEDA ===
export const searchChunks = async (request: RetrieveRequest): Promise<ChunkResult[]> => {
  try {
    const response: AxiosResponse<ChunkResult[]> = await api.post('/retrieve/chunks', request);
    return response.data;
  } catch (error) {
    console.error('Error buscando chunks:', error);
    return [];
  }
};

export const searchDocuments = async (request: RetrieveRequest): Promise<Document[]> => {
  try {
    const response: AxiosResponse<Document[]> = await api.post('/retrieve/docs', request);
    return response.data;
  } catch (error) {
    console.error('Error buscando documentos:', error);
    return [];
  }
};

// === API DE CHAT/AGENTE ===
export const sendChatMessage = async (request: AgentQueryRequest): Promise<any> => {
  try {
    const response: AxiosResponse<any> = await api.post('/agent', request);
    return response.data;
  } catch (error) {
    console.error('Error enviando mensaje de chat:', error);
    throw error;
  }
};

export const sendQuery = async (request: CompletionQueryRequest): Promise<any> => {
  try {
    const response: AxiosResponse<any> = await api.post('/query', request);
    return response.data;
  } catch (error) {
    console.error('Error enviando consulta:', error);
    throw error;
  }
};

// === API DE GENERACIÓN DE MANUALES ===
export const generateManual = async (request: ManualGenerationRequest): Promise<ManualGenerationResponse | null> => {
  try {
    const response: AxiosResponse<ManualGenerationResponse> = await api.post('/manuals/generate_manual', request);
    return response.data;
  } catch (error) {
    console.error('Error generando manual:', error);
    return null;
  }
};

// === API DE ESTADÍSTICAS ===
export const getUsageStats = async (): Promise<UsageStats | null> => {
  try {
    const response: AxiosResponse<UsageStats> = await api.get('/usage/stats');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return null;
  }
};

export const getRecentUsage = async (): Promise<RecentActivity[]> => {
  try {
    const response: AxiosResponse<RecentActivity[]> = await api.get('/usage/recent');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo actividad reciente:', error);
    return [];
  }
};

// === API DE SALUD ===
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await api.get('/ping');
    return response.status === 200;
  } catch (error) {
    console.error('Error verificando salud del servidor:', error);
    return false;
  }
};

export default api;
