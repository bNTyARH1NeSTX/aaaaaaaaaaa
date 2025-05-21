// Mock data for development and testing without requiring an actual backend

import { 
  SearchResult 
} from './manualApi';

import {
  Node,
  Edge,
  Graph
} from './knowledgeGraphApi';

import {
  MetadataExtractionResult
} from './metadataExtractorApi';

import {
  ChatMessage,
  ChatResponse
} from './chatApi';

// --- Tipos auxiliares para robustez de mocks ---
// Si GraphData no está definido, usa Graph como alias
type GraphData = Graph;

// Si BoundingBox importado no tiene 'page', extiéndelo aquí
type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
};

// Si el tipo de imagen no tiene boundingBox, exténdelo para los mocks
export type ImageWithBox = {
  id: string;
  url: string;
  boundingBox: BoundingBox;
  caption?: string;
};
// --- Fin de tipos auxiliares ---

// Define a separate MultimodalSearchResult interface for multimodal search results
export interface MultimodalSearchResult {
  id: string;
  type: 'text' | 'image' | 'pdf' | 'video';
  content: string;
  score: number;
  metadata: Record<string, any>;
  highlights?: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
}

// Mock multimodal search results
export const mockSearchResults: MultimodalSearchResult[] = [
  {
    id: '1',
    type: 'text',
    content: 'BNext ERP inventory management allows tracking of stock levels in real-time across multiple warehouses.',
    score: 0.92,
    metadata: {
      source: 'BNext User Manual',
      section: 'Inventory Management',
      page: 45
    },
    highlights: ['inventory management', 'stock levels', 'real-time', 'warehouses']
  },
  {
    id: '2',
    type: 'image',
    content: 'Screenshot of BNext ERP inventory dashboard',
    score: 0.87,
    metadata: {
      source: 'BNext Training Materials',
      section: 'UI Screenshots',
      createDate: '2024-01-15'
    },
    imageUrl: '/mock/images/inventory-dashboard.png',
    thumbnailUrl: '/mock/images/inventory-dashboard-thumb.png'
  },
  {
    id: '3',
    type: 'pdf',
    content: 'BNext ERP Financial Module Documentation',
    score: 0.85,
    metadata: {
      source: 'BNext Technical Docs',
      sections: ['Financial Module', 'GL Accounts', 'Banking'],
      pages: 120
    },
    thumbnailUrl: '/mock/images/financial-module-thumb.png'
  }
];

// Mock knowledge graph data
export const mockGraphData: GraphData = {
  nodes: [
    {
      id: 'invoice',
      label: 'Invoice',
      type: 'document',
      properties: {
        description: 'A document requesting payment for goods or services',
        schema: 'financial'
      }
    },
    {
      id: 'customer',
      label: 'Customer',
      type: 'entity',
      properties: {
        description: 'Business or individual who purchases goods or services',
        schema: 'sales'
      }
    },
    {
      id: 'product',
      label: 'Product',
      type: 'entity',
      properties: {
        description: 'Item or service offered for sale',
        schema: 'inventory'
      }
    },
    {
      id: 'payment',
      label: 'Payment',
      type: 'transaction',
      properties: {
        description: 'Financial transaction to settle an invoice',
        schema: 'financial'
      }
    }
  ],
  edges: [
    {
      id: 'e1',
      source: 'invoice',
      target: 'customer',
      label: 'issued_to',
      properties: {
        description: 'Invoice is issued to a customer',
        cardinality: 'many-to-one'
      }
    },
    {
      id: 'e2',
      source: 'invoice',
      target: 'product',
      label: 'contains',
      properties: {
        description: 'Invoice contains product line items',
        cardinality: 'many-to-many'
      }
    },
    {
      id: 'e3',
      source: 'payment',
      target: 'invoice',
      label: 'settles',
      properties: {
        description: 'Payment settles an invoice',
        cardinality: 'many-to-many'
      }
    }
  ]
};

// Mock metadata extraction result
export const mockMetadataResult: MetadataExtractionResult = {
  documentId: 'doc-123',
  mimeType: 'application/pdf',
  pageCount: 5,
  entities: [
    {
      id: 'ent-1',
      label: 'John Smith',
      type: 'PERSON',
      confidence: 0.95,
      boundingBox: { x: 100, y: 200, width: 80, height: 20 },
      text: 'John Smith' // Ensured text property is part of the type or handled appropriately
    },
    {
      id: 'ent-2',
      label: 'Acme Corp',
      type: 'ORGANIZATION',
      confidence: 0.92,
      boundingBox: { x: 300, y: 250, width: 100, height: 20 },
      text: 'Acme Corp' // Ensured text property is part of the type or handled appropriately
    },
    {
      id: 'ent-3',
      label: '$1,250.00',
      type: 'MONEY',
      confidence: 0.98,
      boundingBox: { x: 450, y: 350, width: 70, height: 20 },
      text: '$1,250.00' // Ensured text property is part of the type or handled appropriately
    },
    {
      id: 'ent-4',
      label: 'January 15, 2025',
      type: 'DATE',
      confidence: 0.96,
      boundingBox: { x: 200, y: 100, width: 120, height: 20 },
      text: 'January 15, 2025' // Ensured text property is part of the type or handled appropriately
    }
  ],
  tables: [
    {
      id: 'table-1',
      data: [
        ['Item', 'Quantity', 'Unit Price', 'Total'],
        ['Widget A', '5', '$50.00', '$250.00'],
        ['Widget B', '10', '$75.00', '$750.00'],
        ['Service C', '2', '$125.00', '$250.00']
      ],
      headers: ['Item', 'Quantity', 'Unit Price', 'Total'],
      rows: 4, // Added based on data array length
      columns: 4, // Added based on data[0] array length
      boundingBox: { x: 100, y: 400, width: 400, height: 150 }
    }
  ],
  images: [
    {
      id: 'img-1',
      url: '/mock/images/logo.png',
      caption: 'Company Logo',
      width: 100, // Added mock width
      height: 50  // Added mock height
    },
    {
      id: 'img-2',
      url: '/mock/images/signature.png',
      caption: 'Signature',
      width: 150, // Added mock width
      height: 30  // Added mock height
    }
  ],
  textContent: "INVOICE\nAcme Corp\n123 Business St.\nBusiness City, BC 12345\n\nTo: John Smith\nDate: January 15, 2025\nInvoice #: INV-2025-0123\n\nDescription of services and products...",
  summary: 'This is a sample invoice from Acme Corp to John Smith.',
  languages: ['en']
  // Removed rawMetadata or ensured it's part of MetadataExtractionResult type
};

// Mock chat messages and responses
export const mockChatMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'system',
    content: 'You are RAGnar, an AI assistant for the BNext ERP system.',
    timestamp: '2025-05-20T10:30:00Z'
  },
  {
    id: 'msg-2',
    role: 'user',
    content: 'How do I create a new invoice?',
    timestamp: '2025-05-20T10:30:15Z'
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content: 'To create a new invoice in BNext ERP, navigate to the Finance module and select Invoicing > Create New. From there, you can select a customer, add line items, apply taxes, and set payment terms. The system will automatically generate an invoice number and you can save it as a draft or finalize it immediately.',
    timestamp: '2025-05-20T10:30:25Z',
    metadata: {
      sourcesUsed: ['user-manual-p45', 'finance-guide-p12'],
      confidenceScore: 0.95,
      generationTime: 0.8
    }
  }
];

// Mock chat response with caching info
export const mockChatResponse: ChatResponse = {
  message: {
    id: 'msg-4',
    role: 'assistant',
    content: 'Yes, you can create recurring invoices in BNext ERP. Go to Finance > Invoicing > Recurring Templates and set up a new template with your invoice details. You can specify the frequency (daily, weekly, monthly, etc.), start date, and optional end date or number of occurrences. The system will then automatically generate invoices according to your schedule.',
    timestamp: '2025-05-20T10:32:00Z'
  },
  sources: [
    {
      id: 'src-1',
      title: 'BNext User Guide - Invoicing',
      content: 'Recurring invoices can be set up through templates with customizable frequencies and parameters.',
      score: 0.92,
      metadata: {
        page: 48,
        section: 'Advanced Invoicing Features'
      }
    },
    {
      id: 'src-2',
      title: 'BNext Admin Guide - Automation',
      content: 'The recurring documents system allows scheduled generation of invoices, purchase orders, and other documents.',
      score: 0.85,
      metadata: {
        page: 72,
        section: 'Document Automation'
      }
    }
  ],
  cacheMetrics: {
    cacheHit: true,
    retrievalTime: 0.12,
    cacheScore: 0.95,
    savedTokens: 2450
  }
};

// Remove invalid 'page' and 'boundingBox' properties or rename them if needed:
export const mockBoundingBoxes = [
  {
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    // page: 1, // remove or rename if not in BoundingBox
  },
];

export const mockImages = [
  {
    id: '01',
    width: 640,
    height: 480
    // removed boundingBox entirely
  },
  // ...existing code...
];

// If 'MultimodalSearchResult' differs from 'SearchResult', unify or cast types properly
// e.g.:
// (mockMultimodalSearchResults as SearchResult[])

// Export mock implementations of API functions
export const getSearchResults = (query: string): Promise<SearchResult[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        mockSearchResults
          .map(result => (({
          id: result.id,
          type: result.type as 'pdf' | 'manual' | 'text',
          content: result.content,
          title: result.content,
          score: result.score,
          highlights: result.highlights,

          source: {
            id: result.metadata?.source_id || `${result.id}-source`, 
            title: result.metadata?.source || 'Unknown Source',
            manual_id: result.metadata?.manual_id || `${result.id}-manual`, 
            url: result.metadata?.url,
          },

          imageUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl
        }) as SearchResult))
          .filter(result =>
            (result.title && typeof result.title === 'string' && result.title.toLowerCase().includes(query.toLowerCase())) ||
            (result.source && result.source.title && typeof result.source.title === 'string' && result.source.title.toLowerCase().includes(query.toLowerCase()))
          )
      );
    }, 800);
  });
};

export const getGraphData = (): Promise<GraphData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockGraphData);
    }, 1000);
  });
};

export const extractMetadata = (): Promise<MetadataExtractionResult> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockMetadataResult);
    }, 1500);
  });
};

export const getChatResponse = (message: string): Promise<ChatResponse> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ...mockChatResponse,
        message: {
          ...mockChatResponse.message,
          content: message.toLowerCase().includes('invoice') 
            ? mockChatResponse.message.content 
            : `I understand you're asking about ${message}. In the BNext ERP system, you can find information on this topic in the relevant module documentation.`
        }
      });
    }, 1200);
  });
};
