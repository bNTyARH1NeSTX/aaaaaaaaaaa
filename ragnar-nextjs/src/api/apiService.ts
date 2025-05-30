import axios, { AxiosResponse } from 'axios';

// API Configurationa
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://n97f0c99o4ucau-8000.proxy.runpod.net';

// Axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Interfaces basadas en los modelos del backend
export interface Document {
  external_id: string;
  filename?: string; // Made optional to align with backend
  content_type: string;
  owner: { [key: string]: string };
  metadata: { [key: string]: any };
  storage_info: { [key: string]: any }; // For potential size or other info
  storage_files: Array<{
    bucket: string;
    key: string;
    version: number;
    filename?: string;
    content_type?: string;
    timestamp: string; // from StorageFileInfo.timestamp
  }>;
  system_metadata: {
    created_at: string; // from Document.system_metadata.created_at
    updated_at: string; // from Document.system_metadata.updated_at
    version: number;
    folder_name?: string;
    end_user_id?: string; // Added
    status: 'processing' | 'completed' | 'error' | 'failed'; // Added from Document.system_metadata.status
  };
  rules?: any[]; // Added back if it was used by other parts of the application
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Define interfaces for Node and Edge data as returned by the API
export interface ApiNode {
  id: string;
  label?: string;
  data?: { [key: string]: any }; // Flexible data structure for additional properties
  // Backend might provide position or other layout-specific attributes in 'data'
}

export interface ApiEdge {
  id: string;
  source: string; // ID of the source node
  target: string; // ID of the target node
  label?: string;
  data?: { [key: string]: any }; // Flexible data structure for additional properties
}

export interface Graph {
  id: string;
  name: string;
  description?: string;
  type?: string;
  created_at: string;
  updated_at: string;
  nodes_count?: number;
  edges_count?: number;
  nodes?: ApiNode[]; // Array of nodes
  edges?: ApiEdge[]; // Array of edges
}

export interface ChunkResult {
  content: string;
  score: number;
  document_id: string;
  chunk_number: number;
  metadata: {
    filename?: string;
    page?: number;
    is_image?: boolean;
    [key: string]: any;
  };
  content_type: string;
  filename?: string;
  download_url?: string;
}

export interface UsageStats {
  total_documents: number;
  total_chat_sessions: number;
  searches_today: number;
  manuals_generated: number;
}

export interface BatchIngestResponse {
  documents: Document[]; // Changed to match backend
  errors: Array<{ [key: string]: string }>; // Changed to match backend
  // total_files: number;
  // successful_ingestions: number;
  // failed_ingestions: number;
  // successful_files: string[];
  // failed_files: Record<string, string>;
  // folder_id?: string;
  // folder_name?: string;
}

export interface RecentActivity {
  operation_type: string;
  metadata: {
    [key: string]: any;
  };
  timestamp: string;
  status: string;
}

// Nueva interfaz para plantillas de reglas
export interface ApiRuleTemplate {
  id: string;
  name: string;
  description?: string;
  rules_json: string; // El JSON string de las reglas
  created_at: string;
  updated_at: string;
  // owner_entity_id: string; // Si se implementa ownership en backend
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
  use_colpali?: boolean;
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
    if (axios.isAxiosError(error)) {
      console.error('Error de API (Axios):', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
        config: error.config,
      });
    } else {
      console.error('Error de API (General):', error);
    }
    return Promise.reject(error);
  }
);

// === API DE DOCUMENTOS ===
export const getDocuments = async (skip: number = 0, limit: number = 100): Promise<Document[]> => {
  try {
    // Se cambia a POST debido a error 405 con GET y comentario en código original.
    // console.log(`Intentando obtener documentos con POST /documents, skip: ${skip}, limit: ${limit}`);
    const response: AxiosResponse<Document[]> = await api.post('/documents', {
      skip: skip,
      limit: limit
    });
    // console.log('Documentos obtenidos con POST exitosamente.');
    return response.data;
  } catch (error) {
    // console.error('Error obteniendo documentos (usando POST):', error);
    // Propagar el error para que el hook/componente lo maneje.
    throw error;
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

export const uploadDocument = async (file: File, metadata?: { [key: string]: any }, rules?: any[], use_colpali?: boolean): Promise<Document | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata || {}));
    formData.append('rules', JSON.stringify(rules || [])); // Añadir rules
    if (use_colpali !== undefined) {
      formData.append('use_colpali', String(use_colpali));
    }

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
    const response = await api.delete(`/documents/${documentId}`);
    // El backend devuelve un mensaje de éxito con status 200 si la eliminación es correcta.
    // Si devuelve 404, el interceptor de errores ya lo habrá capturado.
    return response.status === 200; 
  } catch (error) {
    // El error ya fue logueado por el interceptor.
    // Aquí decidimos si queremos propagar el error o devolver un valor que indique fallo.
    // Propagar el error permite un manejo más específico en el hook/componente.
    console.error(`Fallo específico en deleteDocument para ID ${documentId}:`, error);
    throw error; // Propagar para que useDocuments pueda manejarlo y establecer su propio estado de error.
  }
};

export const uploadMultipleDocuments = async (
  files: File[], 
  metadata?: { [key: string]: any }, 
  rules?: any[], 
  use_colpali?: boolean, 
  parallel?: boolean, 
  folder_name?: string
): Promise<BatchIngestResponse | null> => {
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    // Para batch, el backend espera objetos, no strings JSON en el form data directamente.
    // Sin embargo, si el backend espera 'metadata' y 'rules' como strings JSON via Form(),
    // entonces debemos mantener JSON.stringify.
    // Revisando api.py: /ingest/files (batch) espera metadata y rules como objetos parseados desde JSON strings.
    // Por lo tanto, el envío como JSON string en FormData es correcto.
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    if (rules) {
      formData.append('rules', JSON.stringify(rules)); // Añadir rules
    }
    if (use_colpali !== undefined) {
      formData.append('use_colpali', String(use_colpali));
    }
    if (parallel !== undefined) {
      formData.append('parallel', String(parallel));
    }
    if (folder_name) {
      formData.append('folder_name', folder_name);
    }

    const response: AxiosResponse<BatchIngestResponse> = await api.post('/ingest/files', formData, {
      headers: {
        // Content-Type will be set to multipart/form-data by the browser/axios
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error subiendo múltiples documentos:', error);
    // Consider returning a more specific error object if needed
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || 'Error en la subida de múltiples archivos');
    }
    throw new Error('Error desconocido en la subida de múltiples archivos');
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

export const getGraphDetails = async (graphName: string): Promise<Graph | null> => {
  try {
    const response: AxiosResponse<Graph> = await api.get(`/graph/${graphName}`);
    return response.data;
  } catch (error) {
    console.error(`Error obteniendo detalles del grafo ${graphName}:`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // It's often better to let the caller handle not found specifically
      // or throw a custom error that can be caught and identified.
      // For now, returning null as per previous patterns.
      return null;
    }
    throw error; // Propagate other errors to be handled by the caller
  }
};

export const createGraph = async (graphData: any): Promise<Graph | null> => {
  try {
    // The graphData already comes in the correct CreateGraphRequest format from the frontend
    const response: AxiosResponse<Graph> = await api.post('/graph/create', graphData);
    return response.data;
  } catch (error) {
    console.error('Error creando grafo:', error);
    // Propagate the error so the hook or component can handle it
    throw error;
  }
};

export const deleteGraph = async (graphName: string): Promise<boolean> => {
  try {
    const response = await api.delete(`/graph/${graphName}`);
    // Assuming 200 or 204 No Content for successful deletion
    return response.status === 200 || response.status === 204;
  } catch (error) {
    console.error(`Error eliminando grafo ${graphName}:`, error);
    // Propagate the error so the hook or component can handle it
    throw error;
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

// === API DE PLANTILLAS DE REGLAS ===

export const getRuleTemplates = async (): Promise<ApiRuleTemplate[]> => {
  try {
    const response: AxiosResponse<ApiRuleTemplate[]> = await api.get('/rule-templates');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo plantillas de reglas:', error);
    // Devuelve un array vacío en caso de error para que la UI no se rompa
    // Idealmente, el hook que use esto manejaría el estado de error.
    return []; 
  }
};

export const createRuleTemplate = async (name: string, description: string | null, rulesJson: string): Promise<ApiRuleTemplate | null> => {
  try {
    const payload: { name: string; description?: string; rules_json: string } = { name, rules_json: rulesJson };
    if (description) {
      payload.description = description;
    }
    const response: AxiosResponse<ApiRuleTemplate> = await api.post('/rule-templates', payload);
    return response.data;
  } catch (error) {
    console.error('Error creando plantilla de regla:', error);
    // Lanza el error para que el componente que llama pueda manejarlo (ej. mostrar un toast)
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || 'Error creando plantilla de regla');
    }
    throw new Error('Error desconocido creando plantilla de regla');
  }
};

export const deleteRuleTemplate = async (templateId: string): Promise<boolean> => {
  try {
    const response = await api.delete(`/rule-templates/${templateId}`);
    return response.status === 200 || response.status === 204; // 204 No Content también es éxito
  } catch (error) {
    console.error('Error eliminando plantilla de regla:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.detail || 'Error eliminando plantilla de regla');
    }
    throw new Error('Error desconocido eliminando plantilla de regla');
  }
};


export default api;
