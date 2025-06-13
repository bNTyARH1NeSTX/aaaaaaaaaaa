import axios, { AxiosResponse } from 'axios';

// API Configurationa
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://op10na1qhzsc5m-8000.proxy.runpod.net';

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
  nodes_count: number;
  edges_count: number;
  nodes: ApiNode[]; // Array of nodes
  edges: ApiEdge[]; // Array of edges
  metadata?: { [key: string]: any };
  document_ids?: string[];
  system_metadata?: {
    workflow_id?: string;
    status?: string;
    [key: string]: any;
  };
}

export interface GraphVisualizationData {
  nodes: VisualizationNode[];
  links: VisualizationLink[];
}

export interface VisualizationNode {
  id: string;
  label: string;
  type: string;
  color: string;
  properties?: Record<string, any>;
}

export interface VisualizationLink {
  source: string;
  target: string;
  type: string;
}

export interface WorkflowStatusResponse {
  status: 'running' | 'completed' | 'failed' | 'not_supported';
  progress?: number;
  result?: any;
  error?: string;
  message?: string;
}

export interface ChunkResult {
  content: string;
  metadata: { [key: string]: any };
  score?: number;
  document_id?: string;
}

export interface UsageStats {
  total_documents: number;
  total_queries: number;
  total_graphs: number;
  total_storage_size?: number;
  [key: string]: any;
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
  images_base64?: { [key: string]: string };
}

// Additional interfaces for missing API functions
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  query: string;
  graph_name?: string;
  conversation_id?: string;
  k?: number;
  temperature?: number;
  max_tokens?: number;
  folder_name?: string;
  end_user_id?: string;
  model_type?: 'manual_generation' | 'openai';
  use_images?: boolean;
}

export interface ChatResponse {
  response: string;
  completion?: string; // Alternative response field
  message?: string; // Alternative response field
  conversation_id?: string;
  response_id?: string; // For linking feedback
  metadata?: { [key: string]: any };
}

// Chat Feedback interfaces
export interface ChatFeedbackRequest {
  conversation_id: string;
  response_id?: string;
  query: string;
  response: string;
  rating: 'up' | 'down';
  comment?: string;
  model_used?: string;
  relevant_images?: number;
}

export interface ChatFeedbackResponse {
  success: boolean;
  message: string;
  feedback_id?: string;
}

export interface ChatFeedbackEntry {
  id: string;
  conversation_id: string;
  query: string;
  response: string;
  rating: 'up' | 'down';
  comment?: string;
  user_id?: string;
  model_used?: string;
  relevant_images?: number;
  timestamp: string;
}

export interface ChatFeedbackStats {
  total_feedback: number;
  thumbs_up: number;
  thumbs_down: number;
  satisfaction_rate: number;
  model_stats: { [model: string]: { up: number; down: number } };
}

// Interceptor para manejo de errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const method = error.config?.method?.toUpperCase();
      const url = error.config?.url;
      
      // Only log unexpected errors (not client errors like 404, 401, 403)
      // Client errors are expected and should be handled by the calling code
      if (status && status >= 500) {
        console.error('Server Error:', {
          message: error.message,
          status,
          method,
          url,
          data: error.response?.data,
        });
      } else if (status && status >= 400 && status < 500) {
        // Client errors - log only in development or for debugging
        console.debug('Client Error:', {
          message: error.message,
          status,
          method,
          url,
          data: error.response?.data,
        });
      } else {
        // Network errors or other unexpected issues
        console.error('Network/Unknown Error:', {
          message: error.message,
          status,
          method,
          url,
        });
      }
    } else {
      console.error('Non-Axios Error:', error);
    }
    return Promise.reject(error);
  }
);

// === API DE SALUD ===
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response: AxiosResponse<{ status: string; message: string }> = await api.get('/ping');
    return response.status === 200 && response.data.status === 'ok';
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};

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
    const url = `/graph/${graphName}`;
    console.log('Making request to:', url, 'with graphName:', graphName);
    const response: AxiosResponse<Graph> = await api.get(url);
    console.log('Full response:', response);
    console.log('Response data:', response.data);
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        url: error.config?.url,
        method: error.config?.method
      });
      if (error.response?.status === 404) {
        console.warn(`Graph not found: ${graphName}`);
        return null;
      }
    }
    console.error('Error obteniendo detalles del grafo:', error);
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

/**
 * Verificar el estado de un flujo de trabajo de grafo.
 * 
 * @param workflowId ID del flujo de trabajo a verificar
 * @param runId ID opcional de la ejecución específica del flujo de trabajo
 * @returns Estado y resultado del flujo de trabajo
 */
export const checkWorkflowStatus = async (
  workflowId: string, 
  runId?: string
): Promise<WorkflowStatusResponse> => {
  try {
    let url = `/graph/workflow/${workflowId}/status`;
    if (runId) {
      url += `?run_id=${runId}`;
    }
    
    const response: AxiosResponse<WorkflowStatusResponse> = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error verificando estado del flujo de trabajo:', error);
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        status: 'failed',
        error: 'Flujo de trabajo no encontrado'
      };
    }
    return {
      status: 'failed',
      error: 'Error al verificar el estado del flujo de trabajo'
    };
  }
};

/**
 * Obtiene datos de visualización para un grafo específico.
 * 
 * @param graphName Nombre del grafo a visualizar
 * @returns Datos de visualización con nodos y enlaces
 */
export const getGraphVisualization = async (
  graphName: string
): Promise<GraphVisualizationData | null> => {
  try {
    const url = `/graph/${graphName}/visualization`;
    const response: AxiosResponse<GraphVisualizationData> = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo datos de visualización del grafo:', error);
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(`Grafo no encontrado: ${graphName}`);
      return null;
    }
    throw error; // Propagate other errors to be handled by the caller
  }
};

/**
 * Espera a que un flujo de trabajo de grafo se complete, haciendo polling periódico.
 * 
 * @param workflowId ID del flujo de trabajo a monitorear
 * @param onStatusUpdate Callback opcional que se llama en cada actualización de estado
 * @param maxAttempts Número máximo de intentos (por defecto 60)
 * @param intervalMs Intervalo entre intentos en milisegundos (por defecto 5000ms)
 * @returns Resultado final del flujo de trabajo
 */
export const waitForWorkflowCompletion = async (
  workflowId: string,
  onStatusUpdate?: (status: WorkflowStatusResponse) => void,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<WorkflowStatusResponse> => {
  let attempts = 0;
  
  const poll = async (): Promise<WorkflowStatusResponse> => {
    if (attempts >= maxAttempts) {
      return {
        status: 'failed',
        error: `Tiempo de espera agotado después de ${maxAttempts} intentos`
      };
    }
    
    attempts++;
    const status = await checkWorkflowStatus(workflowId);
    
    if (onStatusUpdate) {
      onStatusUpdate(status);
    }
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    // Esperar y volver a intentar
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    return poll();
  };
  
  return poll();
};

/**
 * Enviar una consulta de chat y obtener una respuesta.
 * 
 * @param request Datos de la consulta, incluyendo el gráfico y parámetros de generación
 * @returns Respuesta del modelo y metadatos adicionales
 */
export const sendChatQuery = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    const response: AxiosResponse<ChatResponse> = await api.post('/chat/query', request);
    return response.data;
  } catch (error) {
    console.error('Error en consulta de chat:', error);
    throw error;
  }
};

/**
 * Obtener el historial de una conversación específica.
 * 
 * @param conversationId ID de la conversación a recuperar
 * @returns Mensajes de la conversación
 */
export const getConversationHistory = async (conversationId: string): Promise<ChatMessage[]> => {
  try {
    const response: AxiosResponse<ChatMessage[]> = await api.get(`/chat/conversation/${conversationId}`);
    return response.data;
  } catch (error) {
    console.error('Error obteniendo historial de conversación:', error);
    return [];
  }
};

// === API DE GRAFOS - FUNCIONES ADICIONALES ===
export const deleteGraph = async (graphName: string): Promise<boolean> => {
  try {
    const response = await api.delete(`/graph/${graphName}`);
    // Backend returns { status: "ok", message: "..." } on success
    return response.status === 200 && response.data?.status === 'ok';
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) {
        // Graph doesn't exist - this might be expected in some cases
        throw new Error(`Graph '${graphName}' not found`);
      } else if (status === 403) {
        throw new Error(`Access denied: You don't have permission to delete graph '${graphName}'`);
      } else if (status && status >= 500) {
        throw new Error(`Server error while deleting graph '${graphName}'. Please try again later.`);
      }
    }
    console.error('Error eliminando grafo:', error);
    throw error;
  }
};

// === API DE ESTADÍSTICAS ===
export const getUsageStats = async (): Promise<UsageStats> => {
  try {
    const response: AxiosResponse<UsageStats> = await api.get('/usage/stats');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo estadísticas de uso:', error);
    throw error;
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

// === API DE BÚSQUEDA ===
export const searchChunks = async (request: RetrieveRequest): Promise<ChunkResult[]> => {
  try {
    const response: AxiosResponse<ChunkResult[]> = await api.post('/retrieve/chunks', request);
    return response.data;
  } catch (error) {
    console.error('Error buscando chunks:', error);
    throw error;
  }
};

// === API DE CHAT ===
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    // Use the new dedicated chat endpoint
    const chatRequest = {
      query: request.query,
      conversation_id: request.conversation_id,
      k_images: request.k || 3,
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000,
      model_type: request.model_type || 'manual_generation', // Default to manual generation
      use_images: request.use_images !== undefined ? request.use_images : true, // Enable ColPali by default
    };

    const response: AxiosResponse<any> = await api.post('/chat/query', chatRequest);
    
    // Transform response to ChatResponse format
    const chatResponse: ChatResponse = {
      response: response.data.response,
      completion: response.data.response,
      message: response.data.response,
      conversation_id: response.data.conversation_id || request.conversation_id,
      response_id: response.data.response_id, // ADD THIS LINE
      metadata: {
        ...response.data.metadata,
        sources: response.data.relevant_images || [],
      },
    };

    return chatResponse;
  } catch (error) {
    console.error('Error enviando mensaje de chat:', error);
    throw error;
  }
};

// === API DE PLANTILLAS DE REGLAS ===
export const getRuleTemplates = async (): Promise<ApiRuleTemplate[]> => {
  try {
    const response: AxiosResponse<ApiRuleTemplate[]> = await api.get('/rule-templates');
    return response.data;
  } catch (error) {
    console.error('Error obteniendo plantillas de reglas:', error);
    return [];
  }
};

export const createRuleTemplate = async (
  name: string, 
  description: string | undefined, 
  rulesJson: string
): Promise<ApiRuleTemplate> => {
  try {
    const response: AxiosResponse<ApiRuleTemplate> = await api.post('/rule-templates', {
      name,
      description,
      rules_json: rulesJson
    });
    return response.data;
  } catch (error) {
    console.error('Error creando plantilla de regla:', error);
    throw error;
  }
};

export const deleteRuleTemplate = async (templateId: string): Promise<boolean> => {
  try {
    const response = await api.delete(`/rule-templates/${templateId}`);
    return response.status === 200;
  } catch (error) {
    console.error('Error eliminando plantilla de regla:', error);
    throw error;
  }
};

// === API DE GENERACIÓN DE MANUALES ===
export const generateManual = async (request: ManualGenerationRequest): Promise<ManualGenerationResponse> => {
  try {
    const response: AxiosResponse<ManualGenerationResponse> = await api.post('/manuals/generate_manual', request);
    return response.data;
  } catch (error) {
    console.error('Error generando manual:', error);
    throw error;
  }
};

// === API DE GENERACIÓN DE POWERPOINT ===
export const generatePowerPoint = async (request: PowerPointGenerationRequest): Promise<Blob> => {
  try {
    const response: AxiosResponse<Blob> = await api.post('/manuals/generate_powerpoint', request, {
      responseType: 'blob', // Important for file downloads
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error generando PowerPoint:', error);
    throw error;
  }
};

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

// Graph-related interfaces
export interface GraphPromptTemplate {
  prompt_template: string;
  examples?: Array<{ label: string; type: string }>;
}

export interface GraphPromptOverrides {
  entity_extraction?: GraphPromptTemplate;
  relationship_extraction?: GraphPromptTemplate;
}

export interface CreateGraphRequest {
  name: string;
  description?: string;
  filters?: { [key: string]: any };
  documents?: string[];
  prompt_overrides?: GraphPromptOverrides;
  folder_name?: string | string[];
  end_user_id?: string;
}

// Additional interfaces for manual generation
export interface PowerPointGenerationRequest {
  query: string;
  image_path?: string;
  image_prompt?: string;
  k_images?: number;
}

// === CHAT FEEDBACK API ===
export const submitChatFeedback = async (feedback: ChatFeedbackRequest): Promise<ChatFeedbackResponse> => {
  try {
    const response: AxiosResponse<ChatFeedbackResponse> = await api.post('/chat/feedback', feedback);
    return response.data;
  } catch (error) {
    console.error('Error submitting chat feedback:', error);
    throw error;
  }
};

export const getChatFeedback = async (
  skip: number = 0,
  limit: number = 100,
  ratingFilter?: 'up' | 'down',
  modelFilter?: string
): Promise<ChatFeedbackEntry[]> => {
  try {
    const params: any = { skip, limit };
    if (ratingFilter) params.rating_filter = ratingFilter;
    if (modelFilter) params.model_filter = modelFilter;
    
    const response: AxiosResponse<ChatFeedbackEntry[]> = await api.get('/chat/feedback', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching chat feedback:', error);
    return [];
  }
};

export const getChatFeedbackStats = async (): Promise<ChatFeedbackStats> => {
  try {
    const response: AxiosResponse<ChatFeedbackStats> = await api.get('/chat/feedback/stats');
    return response.data;
  } catch (error) {
    console.error('Error getting chat feedback stats:', error);
    throw error;
  }
};

export const deleteChatFeedback = async (feedbackId: string): Promise<void> => {
  try {
    await api.delete(`/chat/feedback/${feedbackId}`);
  } catch (error) {
    console.error('Error deleting chat feedback:', error);
    throw error;
  }
};

// Model Selection Interfaces
export interface RegisteredModel {
  model_name: string;
  provider?: string;
  api_base?: string;
  api_version?: string;
  deployment_id?: string;
  vision?: boolean;
}

export interface RegisteredModelWithKey extends RegisteredModel {
  key: string;
}

export interface ModelConfiguration {
  completion_model: string;
  graph_model: string;
  embedding_model: string;
  agent_model: string;
  registered_models: { [key: string]: RegisteredModel };
}

export interface ModelSelectionRequest {
  model_type: 'completion' | 'graph' | 'embedding' | 'agent';
  model_key: string;
}

// Model Selection API Functions
export const getAvailableModels = async (): Promise<ModelConfiguration> => {
  try {
    const response: AxiosResponse<ModelConfiguration> = await api.get('/models/configuration');
    return response.data;
  } catch (error) {
    console.error('Error fetching available models:', error);
    throw error;
  }
};

export const updateModelSelection = async (request: ModelSelectionRequest): Promise<void> => {
  try {
    await api.post('/models/update', request);
  } catch (error) {
    console.error('Error updating model selection:', error);
    throw error;
  }
};

export const getCurrentModelConfiguration = async (): Promise<ModelConfiguration> => {
  try {
    const response: AxiosResponse<ModelConfiguration> = await api.get('/models/current');
    return response.data;
  } catch (error) {
    console.error('Error fetching current model configuration:', error);
    throw error;
  }
};
