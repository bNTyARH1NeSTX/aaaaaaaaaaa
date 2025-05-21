import api from './morphikApi';

// Types for knowledge graph components
export interface GraphQuery {
  query?: string;
  filters?: Record<string, any>;
  limit?: number;
  domain?: string;
}

export interface Node {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties?: Record<string, any>;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  entities?: Entity[];
  relationships?: Relationship[];
}

export interface GraphInfo {
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  entity_count: number;
  relationship_count: number;
}

export interface DomainInfo {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
}

// The API for knowledge graph interactions
export const knowledgeGraphApi = {
  // Create a new graph
  createGraph: async (name: string, description?: string, options?: {
    extractEntities?: boolean,
    resolveEntities?: boolean,
    extractRelationships?: boolean,
    promptOverrides?: Record<string, any>,
    documents?: string[]
  }): Promise<any> => {
    try {
      const response = await api.post<any>('/graph/create', {
        name,
        description,
        extract_entities: options?.extractEntities,
        resolve_entities: options?.resolveEntities,
        extract_relationships: options?.extractRelationships,
        prompt_overrides: options?.promptOverrides,
        documents: options?.documents
      });
      return response.data;
    } catch (error) {
      console.error('Error creating graph:', error);
      throw error;
    }
  },
  
  // Get available graphs
  getGraphs: async (): Promise<GraphInfo[]> => {
    try {
      const response = await api.get<GraphInfo[]>('/graphs');
      return response.data;
    } catch (error) {
      console.error('Error fetching graphs:', error);
      throw error;
    }
  },
  
  // Query a knowledge graph
  query: async (params: GraphQuery): Promise<Graph> => {
    try {
      // For development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Simple mock graph with a few nodes and edges
        return {
          nodes: [
            { id: 'n1', label: 'Invoice', type: 'Document', properties: {} },
            { id: 'n2', label: 'Customer', type: 'Entity', properties: {} },
            { id: 'n3', label: 'Payment', type: 'Transaction', properties: {} },
            { id: 'n4', label: 'Product', type: 'Item', properties: {} },
            { id: 'n5', label: 'Line Item', type: 'Entry', properties: {} }
          ],
          edges: [
            { id: 'e1', source: 'n1', target: 'n2', label: 'ISSUED_TO' },
            { id: 'e2', source: 'n3', target: 'n1', label: 'PAYS' },
            { id: 'e3', source: 'n2', target: 'n3', label: 'MAKES' },
            { id: 'e4', source: 'n1', target: 'n5', label: 'CONTAINS' },
            { id: 'e5', source: 'n5', target: 'n4', label: 'REFERENCES' }
          ]
        };
      }
      
      // In production
      const response = await api.post<{ graph: Graph }>('/knowledge-graph/query', params);
      return response.data.graph;
    } catch (error) {
      console.error('Error querying knowledge graph:', error);
      throw error;
    }
  },
  
  // Get details for a specific node
  getNodeDetails: async (nodeId: string, domain?: string): Promise<Node & { connections: Edge[] }> => {
    try {
      // For development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Mock node details
        return {
          id: nodeId,
          label: 'Invoice',
          type: 'Document',
          properties: {
            definition: 'A commercial document issued by a seller to a buyer, indicating the products, quantities, and agreed prices for products or services',
            examples: ['Sales Invoice', 'Purchase Invoice', 'Credit Memo'],
            related_concepts: ['Payment', 'Customer', 'Line Item']
          },
          connections: [
            { id: 'e1', source: nodeId, target: 'n2', label: 'ISSUED_TO' },
            { id: 'e2', source: 'n3', target: nodeId, label: 'PAYS' },
            { id: 'e4', source: nodeId, target: 'n5', label: 'CONTAINS' }
          ]
        };
      }
      
      // In production
      const response = await api.get<{ node: Node & { connections: Edge[] } }>(
        `/knowledge-graph/node/${nodeId}${domain ? `?domain=${domain}` : ''}`
      );
      return response.data.node;
    } catch (error) {
      console.error(`Error getting details for node ${nodeId}:`, error);
      throw error;
    }
  },
  
  // Get graph data based on query
  getGraphData: async (params: GraphQuery): Promise<Graph> => {
    try {
      const response = await api.post<{ graph: Graph }>('/knowledge-graph/query', params);
      return response.data.graph;
    } catch (error) {
      console.error('Error fetching graph data:', error);
      throw error;
    }
  },

  // Get available domains for knowledge graphs
  getDomains: async (): Promise<DomainInfo[]> => {
    try {
      const response = await api.get<{ domains: DomainInfo[] }>('/knowledge-graph/domains');
      return response.data.domains;
    } catch (error) {
      console.error('Error fetching domains:', error);
      throw error;
    }
  },
};

export default knowledgeGraphApi;