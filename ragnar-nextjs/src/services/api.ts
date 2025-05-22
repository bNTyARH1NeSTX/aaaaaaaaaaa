// Definición de la URL base de la API del backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://jzz72astclwap7-8000.proxy.runpod.net/';

// Tipos de datos para las solicitudes y respuestas

export interface PingResponse {
  status: string;
  message: string;
}

export interface IngestTextRequest {
  content: string;
  filename?: string;
  metadata?: Record<string, any>;
  rules?: Array<any>;
  use_colpali?: boolean;
  folder_name?: string;
  end_user_id?: string;
}

export interface Document {
  external_id: string;
  content_type: string;
  filename?: string;
  metadata: Record<string, any>;
  system_metadata: Record<string, any>;
  storage_info?: Record<string, any>;
  storage_files?: Array<any>;
  owner: {
    type: string;
    id: string;
  };
  access_control: {
    readers: string[];
    writers: string[];
    admins: string[];
    user_id: string[];
    app_access: string[];
  };
}

export interface IngestFileResponse {
  external_id: string; // Document ID
  filename?: string;
  content_type: string;
  system_metadata: {
    status: string;
    [key: string]: any;
  };
  message?: string; // Optional message
}

export interface DocumentMetadata {
  id: string;
  name: string;
  content_type: string;
  created_at: string;
  updated_at: string;
  status: string;
  [key: string]: any;
}

export interface ChunkSource {
  document_id: string;
  chunk_number: number;
}

export interface ChunkResult {
  document_id: string;
  chunk_number: number;
  content: string;
  metadata: Record<string, any>;
  score?: number;
}

export interface DocumentResult {
  document_id: string;
  filename: string;
  content_type: string;
  metadata: Record<string, any>;
  score?: number;
  chunks?: ChunkResult[];
}

export interface QueryRequest {
  query: string;
  filters?: Record<string, any>;
  k?: number;
  min_score?: number;
  max_tokens?: number;
  temperature?: number;
  use_reranking?: boolean;
  use_colpali?: boolean;
  graph_name?: string;
  hop_depth?: number;
  include_paths?: boolean;
  folder_name?: string;
  end_user_id?: string;
  schema?: Record<string, any>;
}

export interface QueryResponse {
  response: string;
  sources?: ChunkSource[]; 
  model?: string;
  token_usage?: {
    completion: number;
    prompt: number;
    total: number;
  };
  paths?: any[];
}

export interface ListDocumentsResponse {
  documents: Document[];
  total: number;
}

export interface AgentQueryRequest {
  query: string;
  files?: File[];
  folder_name?: string;
  end_user_id?: string;
}

export interface AgentQueryResponse {
  response: string;
  thoughts?: string;
  sources?: ChunkSource[];
}

export interface BatchIngestResponse {
  documents: Document[];
  errors: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  fileInfo?: { // Optional file information
    name: string;
    type: string;
    size: number;
  };
  sources?: ChunkSource[]; // Sources from the backend
}


// Funciones de servicio para interactuar con la API

/**
 * Verifica el estado del backend.
 */
export const ping = async (): Promise<PingResponse> => {
  const response = await fetch(`${API_BASE_URL}/ping`);
  if (!response.ok) {
    throw new Error('Error al hacer ping al backend');
  }
  return response.json();
};

/**
 * Ingiere texto en el backend.
 * @param data - Datos para la ingesta de texto.
 */
export const ingestText = async (data: IngestTextRequest): Promise<Document> => {
  const response = await fetch(`${API_BASE_URL}/ingest/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al ingerir texto' }));
    throw new Error(errorData.detail || errorData.message || 'Error al ingerir texto');
  }
  return response.json();
};

/**
 * Ingiere un archivo en el backend.
 * @param file - El archivo a ingerir.
 * @param metadata - Metadata adicional (opcional).
 * @param rules - Reglas para el procesamiento (opcional).
 * @param useColPali - Usar ColPali para embeddings (opcional).
 * @param folderName - Nombre de la carpeta (opcional).
 */
export const ingestFile = async (
  file: File, 
  metadata?: Record<string, any>,
  rules?: Array<any>,
  useColPali?: boolean,
  folderName?: string
): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', file);
  
  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }
  
  if (rules && rules.length > 0) {
    formData.append('rules', JSON.stringify(rules));
  }
  
  if (useColPali !== undefined) {
    formData.append('use_colpali', useColPali.toString());
  }
  
  if (folderName) {
    formData.append('folder_name', folderName);
  }

  const response = await fetch(`${API_BASE_URL}/ingest/file`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al procesar el archivo' }));
    throw new Error(errorData.detail || errorData.message || `Error del servidor: ${response.status}`);
  }
  
  return response.json();
};

/**
 * Envía una consulta al backend (endpoint /query).
 * @param data - Datos para la consulta.
 */
export const queryCompletion = async (data: QueryRequest): Promise<QueryResponse> => {
  const response = await fetch(`${API_BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al realizar la consulta' }));
    throw new Error(errorData.detail || errorData.message || 'Error al realizar la consulta');
  }
  return response.json();
};

/**
 * Envía una consulta al agente IA.
 * @param data - Datos para la consulta al agente.
 */
export const queryAgent = async (data: AgentQueryRequest): Promise<AgentQueryResponse> => {
  // Si hay archivos adjuntos, usar FormData
  if (data.files && data.files.length > 0) {
    const formData = new FormData();
    formData.append('query', data.query);
    
    data.files.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });
    
    if (data.folder_name) {
      formData.append('folder_name', data.folder_name);
    }
    
    if (data.end_user_id) {
      formData.append('end_user_id', data.end_user_id);
    }
    
    const response = await fetch(`${API_BASE_URL}/agent`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Error al consultar al agente' }));
      throw new Error(errorData.detail || errorData.message || 'Error al consultar al agente');
    }
    
    return response.json();
  } else {
    // Sin archivos, usar JSON
    const response = await fetch(`${API_BASE_URL}/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Error al consultar al agente' }));
      throw new Error(errorData.detail || errorData.message || 'Error al consultar al agente');
    }
    
    return response.json();
  }
};

/**
 * Lista los documentos del backend.
 * @param limit - Límite de documentos a retornar.
 * @param offset - Offset para paginación.
 * @param filters - Filtros adicionales para los documentos.
 * @param folderName - Nombre de la carpeta a filtrar.
 */
export const listDocuments = async (
  limit: number = 20, 
  offset: number = 0, 
  filters?: Record<string, any>,
  folderName?: string
): Promise<Document[]> => {
  const queryParams = new URLSearchParams();
  queryParams.append('skip', offset.toString());
  queryParams.append('limit', limit.toString());
  
  if (folderName) {
    queryParams.append('folder_name', folderName);
  }
  
  // Para filtros más complejos, usamos POST
  const response = await fetch(`${API_BASE_URL}/documents?${queryParams.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: filters ? JSON.stringify(filters) : undefined,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al listar documentos' }));
    throw new Error(errorData.detail || errorData.message || 'Error al listar documentos');
  }
  
  return response.json();
};

/**
 * Obtiene un documento específico por su ID.
 * @param documentId - El ID del documento.
 */
export const getDocumentById = async (documentId: string): Promise<Document> => {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Error al obtener el documento ${documentId}` }));
    throw new Error(errorData.detail || errorData.message || `Error al obtener el documento ${documentId}`);
  }
  return response.json();
};

/**
 * Verifica el estado de procesamiento de un documento.
 * @param documentId - El ID del documento.
 */
export const getDocumentStatus = async (documentId: string): Promise<{
  document_id: string;
  status: string;
  filename?: string;
  created_at?: string;
  updated_at?: string;
  error?: string;
}> => {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/status`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Error al obtener el estado del documento ${documentId}` }));
    throw new Error(errorData.detail || errorData.message || `Error al obtener el estado del documento ${documentId}`);
  }
  return response.json();
};

/**
 * Elimina un documento específico por su ID.
 * @param documentId - El ID del documento.
 */
export const deleteDocumentById = async (documentId: string): Promise<{status: string; message: string}> => {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
     const errorData = await response.json().catch(() => ({ message: `Error al eliminar el documento ${documentId}` }));
    throw new Error(errorData.detail || errorData.message || `Error al eliminar el documento ${documentId}`);
  }
  return response.json();
};

/**
 * Obtiene documentos por nombre de archivo.
 * @param filename - El nombre del archivo.
 * @param folderName - Nombre de la carpeta opcional.
 */
export const getDocumentByFilename = async (filename: string, folderName?: string): Promise<Document> => {
  const queryParams = new URLSearchParams();
  
  if (folderName) {
    queryParams.append('folder_name', folderName);
  }
  
  const response = await fetch(`${API_BASE_URL}/documents/filename/${filename}?${queryParams.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Error al obtener documento por nombre ${filename}` }));
    throw new Error(errorData.detail || errorData.message || `Error al obtener documento por nombre ${filename}`);
  }
  return response.json();
};

/**
 * Recupera chunks relevantes basados en una consulta.
 * @param query - La consulta para buscar chunks relevantes.
 * @param filters - Filtros adicionales.
 * @param k - Número de resultados a retornar.
 * @param useReranking - Usar reranking.
 * @param useColPali - Usar ColPali para embeddings.
 */
export const retrieveChunks = async (
  query: string,
  filters?: Record<string, any>,
  k: number = 4,
  minScore: number = 0.0,
  useReranking: boolean = false,
  useColPali: boolean = false,
  folderName?: string
): Promise<ChunkResult[]> => {
  const response = await fetch(`${API_BASE_URL}/retrieve/chunks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      filters,
      k,
      min_score: minScore,
      use_reranking: useReranking,
      use_colpali: useColPali,
      folder_name: folderName
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error al recuperar chunks' }));
    throw new Error(errorData.detail || errorData.message || 'Error al recuperar chunks');
  }
  
  return response.json();
};

/**
 * Actualiza un documento existente con nuevo texto.
 * @param documentId - ID del documento a actualizar.
 * @param content - Nuevo contenido textual.
 * @param updateStrategy - Estrategia de actualización ('add', 'replace', etc.).
 */
export const updateDocumentText = async (
  documentId: string,
  content: string,
  metadata?: Record<string, any>,
  updateStrategy: string = 'add'
): Promise<Document> => {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/update_text?update_strategy=${updateStrategy}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      metadata
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Error al actualizar el documento ${documentId}` }));
    throw new Error(errorData.detail || errorData.message || `Error al actualizar el documento ${documentId}`);
  }
  
  return response.json();
};
