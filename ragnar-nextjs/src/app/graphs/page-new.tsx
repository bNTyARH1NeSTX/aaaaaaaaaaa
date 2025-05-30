"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, Network, Settings as SettingsIcon, Loader2, AlertCircle, Plus, Eye, Trash2, FileText, Filter, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import ReactFlow, {
  Controls,
  Background,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useGraphs } from '../../hooks/useApi';
import * as api from '../../api/apiService'; // Import api service

// Helper to transform API graph data to ReactFlow format
const transformApiGraphToFlow = (apiGraph: api.Graph): { nodes: Node[], edges: Edge[] } => {
  const nodes: Node[] = (apiGraph.nodes || []).map((node, index) => ({
    id: node.id,
    data: { label: node.label || node.id, ...node.data },
    position: node.data?.position || { x: Math.random() * 400, y: Math.random() * 400 }, // Use provided position or randomize
    type: node.data?.type || 'default',
  }));

  const edges: Edge[] = (apiGraph.edges || []).map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: edge.data,
    type: edge.data?.type || 'default',
  }));

  return { nodes, edges };
};

export default function GraphsPage() {
  const { graphs, loading: loadingGraphs, error: graphsError, refresh: refreshGraphsList, createGraph, deleteGraph } = useGraphs();
  const [isCreating, setIsCreating] = useState(false);
  const [newGraphName, setNewGraphName] = useState('');
  const [newGraphDescription, setNewGraphDescription] = useState('');
  const [selectedGraphType, setSelectedGraphType] = useState<'entity' | 'topic' | 'custom'>('entity');

  // Document selection states
  const [documents, setDocuments] = useState<api.Document[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [documentSearchTerm, setDocumentSearchTerm] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  // Filter states
  const [folderFilter, setFolderFilter] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [metadataFilters, setMetadataFilters] = useState<Record<string, string>>({});
  
  // Advanced configuration states
  const [customPrompts, setCustomPrompts] = useState({
    entityExtraction: '',
    relationshipExtraction: ''
  });

  const [selectedGraph, setSelectedGraph] = useState<api.Graph | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loadingGraphDetails, setLoadingGraphDetails] = useState(false);
  const [graphDetailsError, setGraphDetailsError] = useState<string | null>(null);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const docs = await api.getDocuments(0, 1000); // Load more documents for selection
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Filter documents based on search and filters
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = documentSearchTerm === '' || 
      doc.filename?.toLowerCase().includes(documentSearchTerm.toLowerCase()) ||
      doc.external_id.toLowerCase().includes(documentSearchTerm.toLowerCase());
    
    const matchesFolder = folderFilter === '' || 
      doc.system_metadata.folder_name === folderFilter;
    
    const matchesContentType = contentTypeFilter === '' || 
      doc.content_type === contentTypeFilter;
    
    return matchesSearch && matchesFolder && matchesContentType;
  });

  // Get unique folders and content types for filters
  const uniqueFolders = [...new Set(documents.map(doc => doc.system_metadata.folder_name).filter(Boolean))];
  const uniqueContentTypes = [...new Set(documents.map(doc => doc.content_type))];

  const toggleDocumentSelection = (documentId: string) => {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(documentId)) {
      newSelection.delete(documentId);
    } else {
      newSelection.add(documentId);
    }
    setSelectedDocuments(newSelection);
  };

  const selectAllFilteredDocuments = () => {
    const allFilteredIds = new Set(filteredDocuments.map(doc => doc.external_id));
    setSelectedDocuments(allFilteredIds);
  };

  const clearDocumentSelection = () => {
    setSelectedDocuments(new Set());
  };

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreateGraph = async () => {
    if (!newGraphName.trim()) return;
    
    // Validate that at least some documents are selected or filters are applied
    if (selectedDocuments.size === 0 && !folderFilter && !contentTypeFilter && Object.keys(metadataFilters).length === 0) {
      alert('Por favor seleccione al menos un documento o configure filtros para crear el grafo.');
      return;
    }
    
    setIsCreating(true);
    try {
      // Prepare the request data according to CreateGraphRequest model
      const requestData: any = {
        name: newGraphName,
      };

      // Add documents if any are selected
      if (selectedDocuments.size > 0) {
        requestData.documents = Array.from(selectedDocuments);
      }

      // Add filters if any are configured
      const filters: Record<string, any> = {};
      if (contentTypeFilter) {
        filters.content_type = contentTypeFilter;
      }
      
      // Add custom metadata filters
      Object.entries(metadataFilters).forEach(([key, value]) => {
        if (value.trim()) {
          filters[key] = value;
        }
      });

      if (Object.keys(filters).length > 0) {
        requestData.filters = filters;
      }

      // Add folder filter if set
      if (folderFilter) {
        requestData.folder_name = folderFilter;
      }

      // Add custom prompts if configured
      if (customPrompts.entityExtraction || customPrompts.relationshipExtraction) {
        const promptOverrides: any = {};
        if (customPrompts.entityExtraction) {
          promptOverrides.entity_extraction = {
            prompt_template: customPrompts.entityExtraction
          };
        }
        if (customPrompts.relationshipExtraction) {
          promptOverrides.relationship_extraction = {
            prompt_template: customPrompts.relationshipExtraction
          };
        }
        requestData.prompt_overrides = promptOverrides;
      }

      console.log('Creating graph with data:', requestData);
      const created = await createGraph(requestData);
      
      if (created) {
        alert(`Grafo "${created.name}" creado con éxito. El procesamiento comenzará en segundo plano.`);
        setNewGraphName('');
        setNewGraphDescription('');
        setSelectedDocuments(new Set());
        setFolderFilter('');
        setContentTypeFilter('');
        setMetadataFilters({});
        setCustomPrompts({
          entityExtraction: '',
          relationshipExtraction: ''
        });
        await refreshGraphsList();
      } else {
        alert('No se pudo crear el grafo.');
      }
    } catch (error: any) {
      console.error('Error creando grafo:', error);
      alert(`Error creando grafo: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewGraph = async (graphId: string) => {
    setLoadingGraphDetails(true);
    setGraphDetailsError(null);
    setSelectedGraph(null);
    setNodes([]);
    setEdges([]);
    try {
      const graphDetails = await api.getGraphDetails(graphId);
      if (graphDetails) {
        setSelectedGraph(graphDetails);
        const { nodes: flowNodes, edges: flowEdges } = transformApiGraphToFlow(graphDetails);
        setNodes(flowNodes);
        setEdges(flowEdges);
        if (flowNodes.length === 0 && flowEdges.length === 0) {
          setGraphDetailsError('El grafo está vacío o aún no tiene nodos ni aristas.');
        }
      } else {
        setGraphDetailsError('No se pudieron cargar los detalles del grafo.');
      }
    } catch (error: any) {
      console.error('Error obteniendo detalles del grafo:', error);
      setGraphDetailsError(`Error obteniendo detalles del grafo: ${error.message || 'Error desconocido'}`);
    } finally {
      setLoadingGraphDetails(false);
    }
  };

  const handleDeleteGraph = async (graphId: string, graphName: string) => {
    if (window.confirm(`¿Está seguro de que desea eliminar el grafo "${graphName}"? Esta acción no se puede deshacer.`)) {
      try {
        await deleteGraph(graphName);
        alert(`Grafo "${graphName}" eliminado con éxito.`);
        if (selectedGraph?.id === graphId) {
          setSelectedGraph(null);
          setNodes([]);
          setEdges([]);
        }
        await refreshGraphsList();
      } catch (error: any) {
        console.error('Error eliminando grafo:', error);
        alert(`Error eliminando grafo: ${error.message || 'Error desconocido'}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-blue-600" />
          Grafos de Conocimiento
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Cree, visualice y gestione relaciones y conexiones en su colección de documentos.
        </p>
      </div>

      {/* Error Display (General for graph list) */}
      {graphsError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-400">Error: {graphsError}</span>
          </div>
        </div>
      )}

      {/* Create New Graph */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Crear Nuevo Grafo
        </h2>
        
        <div className="space-y-6">
          {/* Basic Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="newGraphName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del Grafo *
              </label>
              <input
                id="newGraphName"
                type="text"
                value={newGraphName}
                onChange={(e) => setNewGraphName(e.target.value)}
                placeholder="Ej: Análisis Q4 2024"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label htmlFor="selectedGraphType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Análisis
              </label>
              <select
                id="selectedGraphType"
                value={selectedGraphType}
                onChange={(e) => setSelectedGraphType(e.target.value as 'entity' | 'topic' | 'custom')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="entity">Extracción de Entidades</option>
                <option value="topic">Análisis de Tópicos</option>
                <option value="custom">Configuración Personalizada</option>
              </select>
            </div>
          </div>

          {/* Document Selection */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Selección de Documentos
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {selectedDocuments.size} documento(s) seleccionado(s)
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Buscar Documentos
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={documentSearchTerm}
                    onChange={(e) => setDocumentSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o ID..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filtrar por Carpeta
                </label>
                <select
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Todas las carpetas</option>
                  {uniqueFolders.map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tipo de Contenido
                </label>
                <select
                  value={contentTypeFilter}
                  onChange={(e) => setContentTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Todos los tipos</option>
                  {uniqueContentTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selection Actions */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={selectAllFilteredDocuments}
                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                Seleccionar Todos ({filteredDocuments.length})
              </button>
              <button
                onClick={clearDocumentSelection}
                className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Limpiar Selección
              </button>
            </div>

            {/* Document List */}
            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md">
              {loadingDocuments ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="ml-2 text-gray-600 dark:text-gray-400">Cargando documentos...</span>
                </div>
              ) : filteredDocuments.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredDocuments.map(doc => (
                    <div
                      key={doc.external_id}
                      className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.has(doc.external_id)}
                        onChange={() => toggleDocumentSelection(doc.external_id)}
                        className="mr-3 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.filename || doc.external_id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.content_type} • {doc.system_metadata.folder_name || 'Sin carpeta'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(doc.system_metadata.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500 dark:text-gray-400">
                  {documents.length === 0 ? 'No hay documentos disponibles' : 'No se encontraron documentos con los filtros aplicados'}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Options */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-md font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <SettingsIcon className="w-4 h-4" />
                Configuración Avanzada
              </h3>
              {showAdvancedOptions ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>

            {showAdvancedOptions && (
              <div className="mt-4 space-y-4">
                {selectedGraphType === 'entity' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Prompt Personalizado para Extracción de Entidades
                    </label>
                    <textarea
                      value={customPrompts.entityExtraction}
                      onChange={(e) => setCustomPrompts(prev => ({ ...prev, entityExtraction: e.target.value }))}
                      placeholder="Deje en blanco para usar el prompt por defecto..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt Personalizado para Extracción de Relaciones
                  </label>
                  <textarea
                    value={customPrompts.relationshipExtraction}
                    onChange={(e) => setCustomPrompts(prev => ({ ...prev, relationshipExtraction: e.target.value }))}
                    placeholder="Deje en blanco para usar el prompt por defecto..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Custom Metadata Filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filtros de Metadatos Personalizados
                  </label>
                  <div className="space-y-2">
                    {Object.entries(metadataFilters).map(([key, value], index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Clave"
                          value={key}
                          onChange={(e) => {
                            const newFilters = { ...metadataFilters };
                            delete newFilters[key];
                            if (e.target.value) {
                              newFilters[e.target.value] = value;
                            }
                            setMetadataFilters(newFilters);
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Valor"
                          value={value}
                          onChange={(e) => {
                            setMetadataFilters(prev => ({ ...prev, [key]: e.target.value }));
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                        <button
                          onClick={() => {
                            const newFilters = { ...metadataFilters };
                            delete newFilters[key];
                            setMetadataFilters(newFilters);
                          }}
                          className="px-3 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setMetadataFilters(prev => ({ ...prev, '': '' }))}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      + Agregar filtro de metadatos
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Create Button */}
          <div className="flex justify-end">
            <button
              onClick={handleCreateGraph}
              disabled={!newGraphName.trim() || isCreating}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando Grafo...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Crear Grafo
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Graphs List */}
      {loadingGraphs ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Cargando grafos...</span>
          </div>
        </div>
      ) : graphs.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5" />
            Grafos Existentes ({graphs.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {graphs.map((graph) => (
              <div key={graph.id} className={`border rounded-lg p-4 hover:shadow-lg transition-shadow ${selectedGraph?.id === graph.id ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200 dark:border-gray-600'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={graph.name}>{graph.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Tipo: {graph.type || 'Personalizado'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDate(graph.created_at)}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 truncate" title={graph.description}>
                  {graph.description || 'Sin descripción'}
                </p>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {graph.nodes_count || 0} nodos • {graph.edges_count || 0} aristas
                </div>
                
                <div className="flex items-center justify-start space-x-2">
                  <button 
                    onClick={() => handleViewGraph(graph.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                  <button 
                    onClick={() => handleDeleteGraph(graph.id, graph.name)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm"
                    disabled={loadingGraphs} // Disable if graphs are loading (e.g. after deletion)
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center py-8">
            <Network className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay grafos disponibles
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Cree su primer grafo seleccionando documentos y configurando el análisis
            </p>
          </div>
        </div>
      )}

      {/* Graph Visualization Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[500px]">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {selectedGraph ? `Visualización: ${selectedGraph.name}` : 'Visualización de Grafo'}
        </h2>
        
        {loadingGraphDetails ? (
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            <p className="ml-3 text-gray-600 dark:text-gray-400">Cargando datos del grafo...</p>
          </div>
        ) : graphDetailsError ? (
          <div className="h-96 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
            <div className="text-center p-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-red-700 dark:text-red-400 mb-2">
                Error al Cargar Grafo
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {graphDetailsError}
              </p>
              {selectedGraph && (
                <button 
                  onClick={() => handleViewGraph(selectedGraph.id)} 
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Reintentar Carga
                </button>
              )}
            </div>
          </div>
        ) : selectedGraph && nodes.length > 0 ? (
          <div style={{ height: '600px', border: '1px solid #eee', borderRadius: '8px' }} className="dark:border-gray-600">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              attributionPosition="bottom-right"
              className="bg-gray-50 dark:bg-gray-700/30"
            >
              <Controls />
              <MiniMap nodeStrokeWidth={3} zoomable pannable />
              <Background color={document.documentElement.classList.contains('dark') ? "#404040" : "#ddd"} gap={16} />
            </ReactFlow>
          </div>
        ) : (
          <div className="h-96 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Network className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {selectedGraph ? 'Grafo Vacío' : 'Seleccione un Grafo'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {selectedGraph 
                  ? `El grafo "${selectedGraph.name}" no contiene nodos o aristas para visualizar.` 
                  : 'Seleccione un grafo de la lista de arriba para ver su visualización interactiva.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
