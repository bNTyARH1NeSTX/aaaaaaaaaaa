"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { BarChart2, Network, Settings as SettingsIcon, Loader2, AlertCircle, Plus, Eye, Trash2 } from 'lucide-react';
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

  const [selectedGraph, setSelectedGraph] = useState<api.Graph | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loadingGraphDetails, setLoadingGraphDetails] = useState(false);
  const [graphDetailsError, setGraphDetailsError] = useState<string | null>(null);

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
    
    setIsCreating(true);
    try {
      const newGraphData: Partial<Omit<api.Graph, 'id' | 'created_at' | 'updated_at' | 'nodes_count' | 'edges_count'>> = {
        name: newGraphName,
        description: newGraphDescription || undefined,
        type: selectedGraphType,
      };
      const created = await createGraph(newGraphData); // Use the createGraph from the hook
      if (created) {
        alert(`Grafo "${created.name}" creado con éxito.`);
        setNewGraphName('');
        setNewGraphDescription('');
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
        await deleteGraph(graphId);
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end">
          <div className="md:col-span-2">
            <label htmlFor="newGraphName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre del Grafo
            </label>
            <input
              id="newGraphName"
              type="text"
              value={newGraphName}
              onChange={(e) => setNewGraphName(e.target.value)}
              placeholder="Ej: Análisis Q4 2024"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label htmlFor="selectedGraphType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de Grafo
            </label>
            <select
              id="selectedGraphType"
              value={selectedGraphType}
              onChange={(e) => setSelectedGraphType(e.target.value as 'entity' | 'topic' | 'custom')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="entity">Grafo de Entidades</option>
              <option value="topic">Grafo de Temas</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          
          <div className="md:col-span-4">
            <label htmlFor="newGraphDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción (Opcional)
            </label>
            <textarea
              id="newGraphDescription"
              value={newGraphDescription}
              onChange={(e) => setNewGraphDescription(e.target.value)}
              placeholder="Breve descripción del propósito o contenido del grafo"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="md:col-span-4">
            <button
              onClick={handleCreateGraph}
              disabled={isCreating || !newGraphName.trim()}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Crear Grafo
            </button>
          </div>
        </div>
      </div>

      {/* Graph Options Templates - Can be removed or adapted if direct creation is preferred */}
      {/* For now, let's comment it out to simplify the UI focus on creation and visualization */}
      {/* 
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Network className="w-8 h-8 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Grafo de Entidades</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Visualice entidades y sus relaciones a través de los documentos
          </p>
          <button 
            onClick={() => {
              setSelectedGraphType('entity');
              setNewGraphName('Grafo de Entidades');
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors"
          >
            Usar esta Plantilla
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-8 h-8 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Grafo de Temas</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Explore grupos temáticos y relaciones semánticas
          </p>
          <button 
            onClick={() => {
              setSelectedGraphType('topic');
              setNewGraphName('Grafo de Temas');
            }}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-md transition-colors"
          >
            Usar esta Plantilla
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-8 h-8 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Grafo Personalizado</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Cree visualizaciones personalizadas con parámetros específicos
          </p>
          <button 
            onClick={() => {
              setSelectedGraphType('custom');
              setNewGraphName('Grafo Personalizado');
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors"
          >
            Usar esta Plantilla
          </button>
        </div>
      </div>
      */}

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
              Cree su primer grafo usando las plantillas de arriba
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
