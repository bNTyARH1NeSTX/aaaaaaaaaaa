// Definición de interfaces para los documentos
export interface Document {
  external_id: string;
  content_type: string;
  filename?: string;
  metadata?: Record<string, any>;
  system_metadata?: Record<string, any>;
  storage_info?: Record<string, any>;
  storage_files?: Array<any>;
  owner?: {
    type: string;
    id: string;
  };
  access_control?: {
    readers: string[];
    writers: string[];
    admins: string[];
    user_id: string[];
    app_access: string[];
  };
}

// Función para listar documentos con paginación
export async function listDocuments(limit: number = 10, offset: number = 0): Promise<Document[]> {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/documents?limit=${limit}&offset=${offset}`);
    
    if (!response.ok) {
      throw new Error(`Error al obtener documentos: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error('Error al listar documentos:', error);
    throw error;
  }
}
