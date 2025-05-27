import { useState, useEffect } from 'react';
import * as api from '../api/apiService';

// Hook para documentos
export const useDocuments = () => {
  const [documents, setDocuments] = useState<api.Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await api.getDocuments();
      setDocuments(docs);
      setError(null);
    } catch (err) {
      setError('Error cargando documentos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const uploadDocument = async (file: File, metadata?: { [key: string]: any }, rules?: any[], use_colpali?: boolean) => {
    try {
      const newDoc = await api.uploadDocument(file, metadata, rules, use_colpali);
      if (newDoc) {
        setDocuments(prev => [...prev, newDoc]);
        return newDoc;
      }
    } catch (err) {
      setError('Error subiendo documento');
      throw err;
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const success = await api.deleteDocument(documentId);
      if (success) {
        setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        setError(null);
      }
      return success;
    } catch (err) {
      setError('Error eliminando documento');
      throw err;
    }
  };

  const uploadMultiple = async (
    files: File[],
    metadata?: { [key: string]: any },
    rules?: any[],
    use_colpali?: boolean,
    parallel?: boolean,
    folder_name?: string
  ): Promise<api.BatchIngestResponse | null> => {
    try {
      setError(null); // Clear previous hook errors
      const response = await api.uploadMultipleDocuments(files, metadata, rules, use_colpali, parallel, folder_name);
      if (response && response.successful_ingestions > 0) {
        await loadDocuments(); // Refresh the document list
      }
      // If response is null or successful_ingestions is 0, an error might have occurred or no files were processed.
      // The api.uploadMultipleDocuments itself throws an error which will be caught below.
      return response;
    } catch (err: any) {
      setError(err.message || 'Error subiendo múltiples documentos');
      throw err; // Re-throw for the page component to catch
    }
  };

  return {
    documents,
    loading,
    error,
    uploadDocument,
    deleteDocument,
    uploadMultiple, // Add the new function here
    refresh: loadDocuments,
  };
};

// Hook para carpetas
export const useFolders = () => {
  const [folders, setFolders] = useState<api.Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFolders = async () => {
    try {
      setLoading(true);
      const folderList = await api.getFolders();
      setFolders(folderList);
      setError(null);
    } catch (err) {
      setError('Error cargando carpetas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const createFolder = async (name: string, description?: string) => {
    try {
      const newFolder = await api.createFolder(name, description);
      if (newFolder) {
        setFolders(prev => [...prev, newFolder]);
        return newFolder;
      }
    } catch (err) {
      setError('Error creando carpeta');
      throw err;
    }
  };

  return {
    folders,
    loading,
    error,
    createFolder,
    refresh: loadFolders,
  };
};

// Hook para grafos
export const useGraphs = () => {
  const [graphs, setGraphs] = useState<api.Graph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGraphs = async () => {
    try {
      setLoading(true);
      const graphList = await api.getGraphs();
      setGraphs(graphList);
      setError(null);
    } catch (err) {
      setError('Error cargando grafos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraphs();
  }, []);

  const createGraph = async (graphData: Partial<Omit<api.Graph, 'id' | 'created_at' | 'updated_at' | 'nodes_count' | 'edges_count'>>) => {
    try {
      setLoading(true); // Optional: set loading state for creation
      const newGraph = await api.createGraph(graphData);
      if (newGraph) {
        setGraphs(prev => [...prev, newGraph]);
        setError(null);
        return newGraph;
      } else {
        throw new Error('La creación del grafo no devolvió un resultado.');
      }
    } catch (err: any) {
      setError(err.message || 'Error creando grafo');
      console.error(err);
      throw err; // Re-throw for the component to handle
    } finally {
      setLoading(false); // Optional: clear loading state
    }
  };

  const deleteGraph = async (graphId: string) => {
    try {
      setLoading(true); // Optional: set loading state for deletion
      const success = await api.deleteGraph(graphId);
      if (success) {
        setGraphs(prev => prev.filter(g => g.id !== graphId));
        setError(null);
      } else {
        // If deleteGraph returns false without throwing an error
        throw new Error('No se pudo eliminar el grafo.');
      }
      return success;
    } catch (err: any) {
      setError(err.message || 'Error eliminando grafo');
      console.error(err);
      throw err; // Re-throw for the component to handle
    } finally {
      setLoading(false); // Optional: clear loading state
    }
  };

  return {
    graphs,
    loading,
    error,
    refresh: loadGraphs,
    createGraph, // Add createGraph to returned object
    deleteGraph, // Add deleteGraph to returned object
  };
};

// Hook para estadísticas
export const useStats = () => {
  const [stats, setStats] = useState<api.UsageStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<api.RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [statsData, activityData] = await Promise.all([
        api.getUsageStats(),
        api.getRecentUsage(),
      ]);
      setStats(statsData);
      setRecentActivity(activityData);
      setError(null);
    } catch (err) {
      setError('Error cargando estadísticas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return {
    stats,
    recentActivity,
    loading,
    error,
    refresh: loadStats,
  };
};

// Hook para búsqueda
export const useSearch = () => {
  const [results, setResults] = useState<api.ChunkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string, k = 10) => {
    try {
      setLoading(true);
      setError(null);
      const searchResults = await api.searchChunks({ query, k });
      setResults(searchResults);
      return searchResults;
    } catch (err) {
      setError('Error en la búsqueda');
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    results,
    loading,
    error,
    search,
    clearResults: () => setResults([]),
  };
};

// Hook para chat
export const useChat = () => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (query: string, conversationId?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Agregar mensaje del usuario
      const userMessage = { role: 'user' as const, content: query };
      setMessages(prev => [...prev, userMessage]);

      const response = await api.sendChatMessage({
        query,
        conversation_id: conversationId,
      });

      // Agregar respuesta del asistente
      const assistantMessage = { 
        role: 'assistant' as const, 
        content: response.completion || response.message || 'Sin respuesta'
      };
      setMessages(prev => [...prev, assistantMessage]);

      return response;
    } catch (err) {
      setError('Error enviando mensaje');
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearChat,
  };
};

// Hook para estado de salud del servidor
export const useHealth = () => {
  const [isHealthyInternal, setIsHealthyInternal] = useState<boolean | null>(null);
  const [lastCheckedInternal, setLastCheckedInternal] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Tracks loading of the initial health check
  const [hasMounted, setHasMounted] = useState(false);

  const performCheck = async () => {
    try {
      const healthyStatus = await api.checkHealth();
      if (hasMounted) { // Ensure updates only happen client-side post-mount
        setIsHealthyInternal(healthyStatus);
        setLastCheckedInternal(new Date());
      }
      return healthyStatus;
    } catch (err) {
      if (hasMounted) {
        setIsHealthyInternal(false);
        setLastCheckedInternal(new Date());
      }
      return false;
    }
  };

  useEffect(() => {
    setHasMounted(true);

    const initialLoad = async () => {
      setIsLoading(true);
      await performCheck();
      setIsLoading(false);
    };

    initialLoad();

    const interval = setInterval(performCheck, 30000); // Subsequent checks
    return () => clearInterval(interval);
  }, []); // Effect runs once on client mount

  return {
    isHealthy: hasMounted && !isLoading ? isHealthyInternal : null,
    lastChecked: hasMounted && !isLoading ? lastCheckedInternal : null,
    isLoading: !hasMounted || isLoading, // True if not mounted yet or if initial check is running
    checkHealth: performCheck, // Allow manual refresh
  };
};
