import { useEffect, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes,
  ReactFlowInstance,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { GraphVisualizationData } from '@/api/apiService';
import { Spinner } from '@chakra-ui/react';

// Definición personalizada para nodos
const CustomNode = ({ data }: { data: any }) => {
  return (
    <div
      className="px-4 py-2 rounded-md shadow-md border border-gray-200"
      style={{ backgroundColor: data.color || '#ffffff' }}
    >
      <div className="font-medium text-gray-800">{data.label}</div>
      <div className="text-xs text-gray-600">{data.type}</div>
    </div>
  );
};

// Mapeo de tipos de nodos personalizados
const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

interface GraphVisualizationProps {
  graphName: string;
  visualizationData?: GraphVisualizationData;
  isLoading?: boolean;
  error?: string;
}

export const GraphVisualization = ({
  graphName,
  visualizationData,
  isLoading = false,
  error
}: GraphVisualizationProps) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (visualizationData && !isLoading) {
      // Transformar la visualización al formato requerido por ReactFlow
      const flowNodes = visualizationData.nodes.map((node) => ({
        id: node.id,
        type: 'custom',
        data: {
          label: node.label,
          type: node.type,
          color: node.color,
          properties: node.properties
        },
        position: { x: 0, y: 0 }, // Se posicionará automáticamente con el layout aa a
      }));

      const flowEdges = visualizationData.links.map((link, index) => ({
        id: `edge-${index}`,
        source: link.source,
        target: link.target,
        label: link.type,
        animated: false,
        style: { stroke: '#888' },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);

      // Auto-layout cuando tenemos el instance
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2 });
        }, 300);
      }
    }
  }, [visualizationData, isLoading, reactFlowInstance]);

  // Cuando se instancia ReactFlow
  const onInit = (instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 w-full">
        <Spinner size="xl" color="blue.500" />
        <p className="ml-3 text-lg">Cargando visualización del grafo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 w-full">
        <div className="text-red-500 text-center">
          <p className="text-lg font-medium">Error al cargar la visualización</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!visualizationData || visualizationData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 w-full">
        <p className="text-gray-500 text-lg">
          No hay datos de visualización disponibles para el grafo "{graphName}".
        </p>
      </div>
    );
  }

  return (
    <div className="h-[600px] w-full border border-gray-200 rounded-lg bg-white">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          attributionPosition="bottom-right"
        >
          <Controls />
          <MiniMap />
          <Background gap={12} size={1} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default GraphVisualization;
