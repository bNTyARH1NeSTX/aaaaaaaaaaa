import { useState, FormEvent } from 'react';
import { 
  createGraph, 
  checkWorkflowStatus, 
  WorkflowStatusResponse, 
  getGraphVisualization,
  GraphVisualizationData
} from '@/api/apiService';
import { useWorkflowStatus } from '@/hooks/useWorkflowStatus';
import WorkflowStatusMonitor from '@/components/graph/WorkflowStatusMonitor';
import GraphVisualization from '@/components/graph/GraphVisualization';

interface CreateGraphFormProps {
  onGraphCreated?: (graphName: string) => void;
}

export default function CreateGraphForm({ onGraphCreated }: CreateGraphFormProps) {
  const [graphName, setGraphName] = useState('');
  const [documentIds, setDocumentIds] = useState('');
  const [filters, setFilters] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [visualizationData, setVisualizationData] = useState<GraphVisualizationData | null>(null);
  const [isVisualizationLoading, setIsVisualizationLoading] = useState(false);

  // Hook para monitorear el estado del flujo de trabajo
  const { status, isPolling } = useWorkflowStatus({
    workflowId,
    autoStart: !!workflowId,
    onComplete: async (result) => {
      console.log('Grafo creado con éxito:', result);
      // Cargar los datos de visualización cuando el grafo esté listo aa
      if (graphName) {
        await loadVisualizationData(graphName);
      }
      if (onGraphCreated && graphName) {
        onGraphCreated(graphName);
      }
    },
    onError: (error) => {
      setError(`Error en la creación del grafo: ${error}`);
    }
  });

  // Función para cargar datos de visualización
  const loadVisualizationData = async (name: string) => {
    setIsVisualizationLoading(true);
    try {
      const data = await getGraphVisualization(name);
      setVisualizationData(data);
    } catch (err) {
      console.error('Error al cargar datos de visualización:', err);
      setError('No se pudieron cargar los datos de visualización del grafo');
    } finally {
      setIsVisualizationLoading(false);
    }
  };

  // Manejar el envío del formulario
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWorkflowId(null);
    setVisualizationData(null);

    try {
      // Parsear los IDs de documentos y filtros
      const docIds = documentIds.split(',').map(id => id.trim()).filter(id => id);
      let filterObj = {};
      
      if (filters.trim()) {
        try {
          filterObj = JSON.parse(filters);
        } catch (err) {
          throw new Error('Los filtros deben estar en formato JSON válido');
        }
      }

      // Datos para crear el grafo
      const graphData = {
        name: graphName,
        documents: docIds,
        filters: filterObj
      };

      // Crear el grafo
      const result = await createGraph(graphData);
      
      if (result) {
        // Verificar si hay un ID de flujo de trabajo en los metadatos del sistema
        const workflowId = result.system_metadata?.workflow_id;
        
        if (workflowId) {
          // Si hay un ID de flujo de trabajo, significa que el proceso es asíncrono
          setWorkflowId(workflowId);
          console.log('Creación de grafo iniciada de forma asíncrona. ID de flujo de trabajo:', workflowId);
        } else {
          // Si no hay un ID de flujo de trabajo, el grafo se creó de forma síncrona
          console.log('Grafo creado de forma síncrona:', result);
          // Cargar datos de visualización
          await loadVisualizationData(graphName);
          
          if (onGraphCreated) {
            onGraphCreated(graphName);
          }
        }
      }
    } catch (err: any) {
      console.error('Error al crear el grafo:', err);
      setError(err.message || 'Error al crear el grafo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Crear un Grafo de Conocimiento</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="graphName" className="block text-sm font-medium text-gray-700">
            Nombre del Grafo
          </label>
          <input
            type="text"
            id="graphName"
            value={graphName}
            onChange={(e) => setGraphName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="documentIds" className="block text-sm font-medium text-gray-700">
            IDs de Documentos (separados por comas)
          </label>
          <input
            type="text"
            id="documentIds"
            value={documentIds}
            onChange={(e) => setDocumentIds(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <div>
          <label htmlFor="filters" className="block text-sm font-medium text-gray-700">
            Filtros (JSON)
          </label>
          <textarea
            id="filters"
            value={filters}
            onChange={(e) => setFilters(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            rows={3}
            placeholder='{"category": "tech"}'
          />
        </div>
        
        <button
          type="submit"
          disabled={loading || isPolling}
          className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
        >
          {loading ? 'Creando...' : isPolling ? 'Procesando...' : 'Crear Grafo'}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {workflowId && (
        <div className="mt-6">
          <WorkflowStatusMonitor 
            status={status} 
            title={`Creando grafo "${graphName}"`}
          />
        </div>
      )}

      {visualizationData && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Visualización del Grafo</h3>
          <GraphVisualization 
            graphName={graphName}
            visualizationData={visualizationData}
            isLoading={isVisualizationLoading}
          />
        </div>
      )}
    </div>
  );
}
