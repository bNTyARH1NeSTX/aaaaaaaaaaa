"use client";

import React, { useState } from 'react';
import { BarChart2, Network, Zap, Settings as SettingsIcon, Loader2, AlertCircle, Plus, Eye } from 'lucide-react';
import { useGraphs } from '../../hooks/useApi';

export default function GraphsPage() {
  const { graphs, loading, error, refresh } = useGraphs();
  const [isCreating, setIsCreating] = useState(false);
  const [newGraphName, setNewGraphName] = useState('');
  const [selectedGraphType, setSelectedGraphType] = useState<'entity' | 'topic' | 'custom'>('entity');

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
      // Aquí llamarías a la API para crear el grafo
      // await createGraph({ name: newGraphName, type: selectedGraphType });
      console.log('Creating graph:', { name: newGraphName, type: selectedGraphType });
      setNewGraphName('');
      await refresh();
    } catch (error) {
      console.error('Error creating graph:', error);
    } finally {
      setIsCreating(false);
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
          Visualice relaciones y conexiones en su colección de documentos
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-400">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Create New Graph */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Crear Nuevo Grafo
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre del Grafo
            </label>
            <input
              type="text"
              value={newGraphName}
              onChange={(e) => setNewGraphName(e.target.value)}
              placeholder="Ej: Análisis Q4 2024"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Grafo
            </label>
            <select
              value={selectedGraphType}
              onChange={(e) => setSelectedGraphType(e.target.value as 'entity' | 'topic' | 'custom')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="entity">Grafo de Entidades</option>
              <option value="topic">Grafo de Temas</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleCreateGraph}
              disabled={isCreating || !newGraphName.trim()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors flex items-center justify-center gap-2"
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

      {/* Graph Options Templates */}
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

      {/* Existing Graphs List */}
      {loading ? (
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
            Grafos Existentes
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {graphs.map((graph) => (
              <div key={graph.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{graph.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Tipo: {graph.type || 'Personalizado'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDate(graph.created_at)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {graph.nodes_count || 0} nodos • {graph.edges_count || 0} conexiones
                  </div>
                  <button className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm">
                    <Eye className="w-4 h-4" />
                    Ver
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Visualización de Grafo
        </h2>
        
        <div className="h-96 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Network className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Visualización interactiva próximamente
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Seleccione un grafo existente para visualizar sus conexiones
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
