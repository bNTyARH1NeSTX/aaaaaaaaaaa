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

  const uploadDocument = async (file: File, metadata?: { [key: string]: any }) => {
    try {
      const newDoc = await api.uploadDocument(file, metadata);
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
      }
      return success;
    } catch (err) {
      setError('Error eliminando documento');
      throw err;
    }
  };

  return {
    documents,
    loading,
    error,
    uploadDocument,
    deleteDocument,
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

  return {
    graphs,
    loading,
    error,
    refresh: loadGraphs,
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
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    try {
      const healthy = await api.checkHealth();
      setIsHealthy(healthy);
      setLastChecked(new Date());
      return healthy;
    } catch (err) {
      setIsHealthy(false);
      setLastChecked(new Date());
      return false;
    }
  };

  useEffect(() => {
    checkHealth();
    // Verificar cada 30 segundos
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    isHealthy,
    lastChecked,
    checkHealth,
  };
};
