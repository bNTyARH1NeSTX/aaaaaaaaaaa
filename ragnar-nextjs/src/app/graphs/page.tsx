"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, Network, Settings as SettingsIcon, Loader2, AlertCircle, Plus, Eye, Trash2, FileText, Filter, ChevronDown, ChevronUp, Search, X, GitBranch } from 'lucide-react';
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
import { useWorkflowStatus } from '@/hooks/useWorkflowStatus';
import WorkflowStatusMonitor from '@/components/graph/WorkflowStatusMonitor';
import WorkflowStatusMonitorWrapper from '@/components/graph/WorkflowStatusMonitorWrapper';
import GraphVisualization from '@/components/graph/GraphVisualization';
import CreateGraphForm from '@/components/graph/CreateGraphForm';
import { generateEntityTypeColorMap, getLighterColor, ENTITY_TYPE_COLORS } from '@/utils/colorUtils';

// Helper to transform visualization data to ReactFlow format
const transformVisualizationDataToFlow = (visualizationData: api.GraphVisualizationData): { nodes: Node[], edges: Edge[] } => {
  const nodeCount = visualizationData.nodes?.length || 0;
  
  // Extract unique entity types for rainbow color generation
  const entityTypes = [...new Set((visualizationData.nodes || []).map(node => node.type).filter(Boolean))];
  const entityTypeColorMap = generateEntityTypeColorMap(entityTypes);
  
  // Calculate grid layout for better spacing
  const gridSize = Math.ceil(Math.sqrt(nodeCount));
  const nodeSpacing = 280; // Increased spacing between nodes
  const startX = -((gridSize - 1) * nodeSpacing) / 2; // Center the grid
  const startY = -((gridSize - 1) * nodeSpacing) / 2;
  
  const nodes: Node[] = (visualizationData.nodes || []).map((node, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const position = {
      x: startX + col * nodeSpacing + (Math.random() - 0.5) * 50, // Add small random offset
      y: startY + row * nodeSpacing + (Math.random() - 0.5) * 50
    };
    
    // Get color for this entity type using rainbow distribution
    const entityType = node.type || 'DEFAULT';
    const baseColor = entityTypeColorMap[entityType] || 
                     (ENTITY_TYPE_COLORS as any)[entityType] || 
                     ENTITY_TYPE_COLORS.DEFAULT;
    const backgroundColor = getLighterColor(baseColor, 10); // Less lightening for more vibrant backgrounds
    
    return {
      id: node.id,
      data: { 
        label: node.label,
        type: node.type,
        properties: node.properties || {},
        color: baseColor,
        backgroundColor: backgroundColor
      },
      position,
      type: 'default',
      style: {
        background: backgroundColor,
        border: `4px solid ${baseColor}`, // Thicker border for better visibility
        borderRadius: '12px',
        padding: '14px',
        fontSize: '13px',
        fontWeight: '700', // Bolder text
        color: '#111827', // Darker text for better contrast
        minWidth: '150px',
        minHeight: '55px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 6px 12px rgba(0,0,0,0.15), 0 0 0 2px ${baseColor}30`, // Stronger shadow
        textAlign: 'center',
        transition: 'all 0.3s ease',
      },
    };
  });

  const edges: Edge[] = (visualizationData.links || []).map((link, index) => {
    // Generate more distinct colors based on relationship type
    const getEdgeColor = (type: string) => {
      const colors: { [key: string]: string } = {
        'RELATED_TO': '#2563eb',     // Vibrant blue
        'CONTAINS': '#059669',       // Vibrant emerald  
        'PART_OF': '#7c3aed',        // Vibrant violet
        'REFERENCES': '#ea580c',     // Vibrant orange
        'DEPENDS_ON': '#dc2626',     // Vibrant red
        'SIMILAR_TO': '#0891b2',     // Vibrant cyan
        'CONNECTED_TO': '#4b5563',   // Neutral gray
        'USES': '#16a34a',           // Vibrant green
        'IMPLEMENTS': '#9333ea',     // Vibrant purple
        'EXTENDS': '#c2410c',        // Vibrant amber
        'BELONGS_TO': '#be123c',     // Vibrant rose
        'INCLUDES': '#0d9488',       // Vibrant teal
        'DEFAULT': '#4b5563'         // Neutral gray
      };
      return colors[type.toUpperCase()] || colors['DEFAULT'];
    };

    const edgeColor = getEdgeColor(link.type);

    return {
      id: `edge-${index}`,
      source: link.source,
      target: link.target,
      label: link.type,
      type: 'smoothstep',
      style: {
        stroke: edgeColor,
        strokeWidth: 2.5,
        strokeDasharray: link.type.toLowerCase().includes('similar') ? '5,5' : undefined,
      },
      labelStyle: {
        fontSize: '11px',
        fontWeight: '600',
        fill: '#1f2937',
        textShadow: '1px 1px 2px rgba(255,255,255,0.8)',
      },
      labelBgStyle: {
        fill: '#ffffff',
        stroke: edgeColor,
        strokeWidth: 1,
        fillOpacity: 0.95,
        rx: 4,
        ry: 4,
      },
      data: {
        type: link.type,
        color: edgeColor
      }
    };
  });

  return { nodes, edges };
};

// Helper to transform API graph data to ReactFlow format (fallback)
const transformApiGraphToFlow = (apiGraph: api.Graph): { nodes: Node[], edges: Edge[] } => {
  const nodeCount = apiGraph.nodes?.length || 0;
  
  // Extract unique entity types for rainbow color generation
  const entityTypes = [...new Set((apiGraph.nodes || []).map(node => {
    const nodeType = node.data?.type || 'DEFAULT';
    return typeof nodeType === 'string' ? nodeType : 'DEFAULT';
  }).filter(Boolean))];
  const entityTypeColorMap = generateEntityTypeColorMap(entityTypes);
  
  // Calculate grid layout for better spacing
  const gridSize = Math.ceil(Math.sqrt(nodeCount));
  const nodeSpacing = 250; // Increased spacing between nodes
  const startX = -((gridSize - 1) * nodeSpacing) / 2; // Center the grid
  const startY = -((gridSize - 1) * nodeSpacing) / 2;
  
  const nodes: Node[] = (apiGraph.nodes || []).map((node, index) => {
    let position;
    
    // Use existing position if available, otherwise calculate grid position
    if (node.data?.position) {
      position = node.data.position;
    } else {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      position = {
        x: startX + col * nodeSpacing + (Math.random() - 0.5) * 50, // Add small random offset
        y: startY + row * nodeSpacing + (Math.random() - 0.5) * 50
      };
    }
    
    // Get color for this entity type using rainbow distribution
    const entityType = node.data?.type || 'DEFAULT';
    const typeKey = typeof entityType === 'string' ? entityType : 'DEFAULT';
    const baseColor = entityTypeColorMap[typeKey] || (ENTITY_TYPE_COLORS as any)[typeKey] || ENTITY_TYPE_COLORS.DEFAULT;
    const backgroundColor = getLighterColor(baseColor, 5); // Much less lightening for more vibrant backgrounds
    
    return {
      id: node.id,
      data: { 
        label: node.label || node.id, 
        type: typeKey,
        color: baseColor,
        backgroundColor: backgroundColor,
        ...node.data 
      },
      position,
      type: node.data?.type || 'default',
      style: {
        background: backgroundColor,
        border: `3px solid ${baseColor}`,
        borderRadius: '10px',
        padding: '12px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#1f2937',
        minWidth: '140px',
        minHeight: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 4px 6px rgba(0,0,0,0.1), 0 0 0 1px ${baseColor}20`,
        textAlign: 'center',
        transition: 'all 0.3s ease',
      },
    };
  });

  const edges: Edge[] = (apiGraph.edges || []).map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    data: edge.data,
    type: edge.data?.type || 'smoothstep',
    style: {
      stroke: '#6b7280',
      strokeWidth: 2,
    },
    labelStyle: {
      fontSize: '11px',
      fontWeight: '500',
      fill: '#374151',
    },
    labelBgStyle: {
      fill: '#f9fafb',
      stroke: '#e5e7eb',
      strokeWidth: 1,
      fillOpacity: 0.9,
    },
  }));

  return { nodes, edges };
};

export default function GraphsPage() {
  const { graphs, loading: loadingGraphs, error: graphsError, refresh: refreshGraphsList, createGraph, deleteGraph } = useGraphs();
  const [isCreating, setIsCreating] = useState(false);
  const [isAsyncCreating, setIsAsyncCreating] = useState(false);
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
  
  // Estado para el monitoreo de flujos de trabajo
  const [monitoredWorkflow, setMonitoredWorkflow] = useState<string | null>(null);
  const [workflowGraphName, setWorkflowGraphName] = useState<string | null>(null);

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

  // Función para crear un grafo asíncrono (simplificada)
  const handleCreateAsyncGraph = async () => {
    if (!newGraphName.trim()) return;
    
    // Validate that at least some documents are selected or filters are applied
    if (selectedDocuments.size === 0 && !folderFilter && !contentTypeFilter && Object.keys(metadataFilters).length === 0) {
      alert('Debe seleccionar al menos un documento o aplicar filtros para crear el grafo.');
      return;
    }
    
    setIsAsyncCreating(true);
    
    try {
      const requestData: api.CreateGraphRequest = {
        name: newGraphName.trim(),
        description: newGraphDescription.trim() || undefined,
      };

      // Add document IDs if any are selected
      if (selectedDocuments.size > 0) {
        requestData.documents = Array.from(selectedDocuments);
      }

      // Add filters
      const filters: Record<string, any> = {};
      
      if (contentTypeFilter) {
        filters.content_type = contentTypeFilter;
      }
      
      // Add metadata filters
      Object.keys(metadataFilters).forEach(key => {
        if (metadataFilters[key]) {
          filters[key] = metadataFilters[key];
        }
      });

      if (Object.keys(filters).length > 0) {
        requestData.filters = filters;
      }

      // Add folder filter
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

      console.log('Creando grafo asíncrono con datos:', requestData);
      const created = await createGraph(requestData);
      
      if (created) {
        const workflowId = created.system_metadata?.workflow_id;
        
        if (workflowId) {
          alert(`Grafo "${created.name}" iniciado en modo asíncrono. Se procesará en segundo plano.`);
          // Iniciar monitoreo del workflow
          setMonitoredWorkflow(workflowId);
          setWorkflowGraphName(created.name);
        } else {
          alert(`Grafo "${created.name}" creado con éxito (modo síncrono).`);
        }
        
        // Limpiar formulario
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
      console.error('Error creando grafo asíncrono:', error);
      alert(`Error creando grafo: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsAsyncCreating(false);
    }
  };

  const handleViewGraph = async (graphName: string) => {
    if (!graphName) return;
    
    setLoadingGraphDetails(true);
    setGraphDetailsError(null);
    setSelectedGraph(null);
    
    try {
      console.log('Fetching graph visualization data for:', graphName);
      
      // Try to get visualization data first (preferred method)
      let visualizationData = null;
      try {
        visualizationData = await api.getGraphVisualization(graphName);
        console.log('Received graph visualization data:', visualizationData);
      } catch (vizError) {
        console.warn('Failed to fetch visualization data, falling back to graph details:', vizError);
      }
      
      if (visualizationData) {
        // Use visualization-specific data transformation
        const { nodes: flowNodes, edges: flowEdges } = transformVisualizationDataToFlow(visualizationData);
        setNodes(flowNodes);
        setEdges(flowEdges);
        
        // Create a simplified graph object for selectedGraph state
        // Convert visualization data to match Graph interface
        const convertedNodes: api.ApiNode[] = (visualizationData.nodes || []).map(node => ({
          id: node.id,
          label: node.label,
          data: {
            type: node.type,
            color: node.color,
            properties: node.properties
          }
        }));
        
        const convertedEdges: api.ApiEdge[] = (visualizationData.links || []).map((link, index) => ({
          id: `edge-${index}`,
          source: link.source,
          target: link.target,
          label: link.type,
          data: { type: link.type }
        }));
        
        setSelectedGraph({
          id: graphName,
          name: graphName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          nodes_count: convertedNodes.length,
          edges_count: convertedEdges.length,
          nodes: convertedNodes,
          edges: convertedEdges,
          system_metadata: {},
        });
      } else {
        // Fallback to original method if visualization endpoint fails
        console.log('Falling back to graph details for:', graphName);
        const graphDetails = await api.getGraphDetails(graphName);
        console.log('Received graph details:', graphDetails);
        
        if (graphDetails) {
          setSelectedGraph(graphDetails);
          // Transform API graph to ReactFlow format for visualization
          const { nodes: flowNodes, edges: flowEdges } = transformApiGraphToFlow(graphDetails);
          setNodes(flowNodes);
          setEdges(flowEdges);
        } else {
          setGraphDetailsError(`No se encontró el grafo "${graphName}"`);
        }
      }
    } catch (error) {
      console.error('Error loading graph details:', error);
      setGraphDetailsError('Error al cargar los detalles del grafo');
    } finally {
      setLoadingGraphDetails(false);
    }
  };

  // Función para verificar el estado de un flujo de trabajo de grafo
  const handleCheckWorkflowStatus = async (graph: api.Graph) => {
    // Obtener el ID del flujo de trabajo desde los metadatos del grafo
    const workflowId = graph.system_metadata?.workflow_id;
    
    if (!workflowId) {
      alert('Este grafo no tiene un ID de flujo de trabajo asociado.');
      return;
    }
    
    // Establecer el grafo y el ID del flujo de trabajo que estamos monitoreando
    setMonitoredWorkflow(workflowId);
    setWorkflowGraphName(graph.name);
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

          {/* Create Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCreateGraph}
              disabled={!newGraphName.trim() || isCreating || isAsyncCreating}
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
            
            <button
              onClick={handleCreateAsyncGraph}
              disabled={!newGraphName.trim() || isCreating || isAsyncCreating}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Crear grafo en modo asíncrono para grandes conjuntos de datos"
            >
              {isAsyncCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creando Asíncrono...
                </>
              ) : (
                <>
                  <GitBranch className="w-4 h-4" />
                  Crear Asíncrono
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Async Graph Creation */}
      {isAsyncCreating && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Crear Grafo Asíncrono</h3>
              <button 
                onClick={() => setIsAsyncCreating(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <CreateGraphForm 
                onGraphCreated={(graphName) => {
                  setIsAsyncCreating(false);
                  refreshGraphsList();
                  // Seleccionar el nuevo grafo después de un breve retraso para permitir que la UI se actualice
                  setTimeout(() => {
                    const newGraph = graphs.find(g => g.name === graphName);
                    if (newGraph) {
                      setSelectedGraph(newGraph);
                    }
                  }, 1000);
                }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Workflow Status Monitor */}
      {monitoredWorkflow && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-xl w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Estado del Flujo de Trabajo: {workflowGraphName}
              </h3>
              <button 
                onClick={() => {
                  setMonitoredWorkflow(null);
                  setWorkflowGraphName(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {monitoredWorkflow && (
                <WorkflowStatusMonitorWrapper 
                  workflowId={monitoredWorkflow}
                  onComplete={(status) => {
                    if (status.status === 'completed') {
                      // Refrescar la lista de grafos para actualizar los estados
                      refreshGraphsList();
                      
                      // Si estamos viendo el grafo actualmente, refrescar sus detalles
                      if (selectedGraph?.name === workflowGraphName && workflowGraphName) {
                        handleViewGraph(workflowGraphName);
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

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
                
                <div className="flex items-center justify-start space-x-2 flex-wrap gap-2">
                  <button 
                    onClick={() => {
                      console.log('Clicking View button for graph:', graph);
                      handleViewGraph(graph.name);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                  {graph.system_metadata?.workflow_id && (
                    <button 
                      onClick={() => handleCheckWorkflowStatus(graph)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm"
                      title="Verificar estado del flujo de trabajo"
                    >
                      <GitBranch className="w-4 h-4" />
                      Estado
                    </button>
                  )}
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
                  onClick={() => handleViewGraph(selectedGraph.name)} 
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Reintentar Carga
                </button>
              )}
            </div>
          </div>
        ) : selectedGraph && nodes.length > 0 ? (
          <div className="flex gap-4">
            {/* Graph Visualization */}
            <div className="flex-1">
              <div style={{ height: '700px', border: '1px solid #eee', borderRadius: '8px' }} className="dark:border-gray-600">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  fitView
                  fitViewOptions={{
                    padding: 50,
                    includeHiddenNodes: false,
                    minZoom: 0.1,
                    maxZoom: 1.5
                  }}
                  minZoom={0.1}
                  maxZoom={2}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                  attributionPosition="bottom-right"
                  className="bg-gray-50 dark:bg-gray-700/30"
                  proOptions={{ hideAttribution: true }}
                >
                  <Controls showZoom={true} showFitView={true} showInteractive={true} />
                  <MiniMap 
                    nodeStrokeWidth={3} 
                    zoomable 
                    pannable 
                    style={{
                      height: 120,
                      width: 200,
                    }}
                    position="top-right"
                  />
                  <Background 
                    color={document.documentElement.classList.contains('dark') ? "#404040" : "#ddd"} 
                    gap={20} 
                    size={1}
                  />
                </ReactFlow>
              </div>
            </div>
            
            {/* Entity Legend and Info Panel */}
            <div className="w-80 space-y-4">
              {/* Graph Info */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Network className="w-5 h-5 mr-2" />
                  Graph Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Name:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{selectedGraph.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Nodes:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{nodes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Edges:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{edges.length}</span>
                  </div>
                </div>
              </div>

              {/* Entity Types Legend */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Entity Types
                </h3>
                <div className="space-y-2">
                  {(() => {
                    // Extract unique entity types from nodes
                    const entityTypes = new Map();
                    nodes.forEach(node => {
                      const type = node.data?.type || 'Unknown';
                      const color = node.style?.background || node.style?.backgroundColor || '#6b7280';
                      if (!entityTypes.has(type)) {
                        entityTypes.set(type, { color, count: 0 });
                      }
                      entityTypes.set(type, { 
                        ...entityTypes.get(type), 
                        count: entityTypes.get(type).count + 1 
                      });
                    });

                    return Array.from(entityTypes.entries()).map(([type, info]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div 
                            className="w-4 h-4 rounded-full mr-2 flex-shrink-0 border-2" 
                            style={{ 
                              backgroundColor: info.color,
                              borderColor: info.color
                            }}
                          ></div>
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {type}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {info.count}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Relationship Types */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Relationships ({edges.length})
                </h3>
                <div className="space-y-2">
                  {(() => {
                    // Extract unique relationship types from edges with their colors
                    const relationshipTypes = new Map();
                    edges.forEach(edge => {
                      const type = edge.label || edge.data?.type || 'Connected';
                      const color = edge.data?.color || edge.style?.stroke || '#6b7280';
                      const isDashed = edge.style?.strokeDasharray ? true : false;
                      
                      if (!relationshipTypes.has(type)) {
                        relationshipTypes.set(type, { count: 0, color, isDashed });
                      }
                      relationshipTypes.set(type, { 
                        ...relationshipTypes.get(type), 
                        count: relationshipTypes.get(type).count + 1 
                      });
                    });

                    if (relationshipTypes.size === 0) {
                      return (
                        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                          No relationships found
                        </div>
                      );
                    }

                    return Array.from(relationshipTypes.entries()).map(([type, info]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div 
                            className="w-6 h-0.5 mr-2 rounded-sm flex-shrink-0" 
                            style={{ 
                              backgroundColor: info.isDashed ? 'transparent' : info.color,
                              borderStyle: info.isDashed ? 'dashed' : 'solid',
                              borderWidth: info.isDashed ? '1px' : '0',
                              borderColor: info.color,
                              minHeight: '2px'
                            }}
                          ></div>
                          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                          {info.count}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
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
