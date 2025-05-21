import apiClient from '../utils/apiClient';

// Create an api object that prepends '/manuals' to paths
const api = {
  get: <T>(url: string, config?: any) => apiClient.get<T>(`/manuals${url}`, config),
  post: <T>(url: string, data?: any, config?: any) => apiClient.post<T>(`/manuals${url}`, data, config),
  put: <T>(url: string, data?: any, config?: any) => apiClient.put<T>(`/manuals${url}`, data, config),
  delete: <T>(url: string, config?: any) => apiClient.delete<T>(`/manuals${url}`, config),
};

// Interface for query parameters
export interface QueryParams {
  query: string;
  max_results?: number;
  manual_id?: string;
  include_sources?: boolean;
}

// Interface for document upload
export interface UploadDocumentParams {
  file: File;
  title: string;
  description?: string;
  tags?: string[];
  manual_id: string;
}

// Interface for search results
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  type: 'pdf' | 'manual' | 'text';
  source: {
    id: string;
    title: string;
    url?: string;
    manual_id: string;
  };
  highlights?: string[];
}

// Interface for a manual
export interface Manual {
  id: string;
  title: string;
  description?: string;
  sections?: {
    id: string;
    title: string;
    content?: string;
  }[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

// Mock manuals for development
const MOCK_MANUALS: Manual[] = [
  {
    id: 'bnext-user-guide',
    title: 'BNext ERP User Guide',
    description: 'Comprehensive guide for end users of the BNext ERP system',
    created_at: '2025-02-15T00:00:00Z',
    updated_at: '2025-05-01T00:00:00Z',
    tags: ['user guide', 'getting started', 'basics'],
  },
  {
    id: 'bnext-admin-guide',
    title: 'BNext ERP Administrator Guide',
    description: 'Technical guide for system administrators managing BNext ERP',
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-04-20T00:00:00Z',
    tags: ['admin', 'configuration', 'security'],
  },
  {
    id: 'bnext-financial-module',
    title: 'Financial Module Documentation',
    description: 'Detailed documentation for the BNext ERP Financial Module',
    created_at: '2025-03-05T00:00:00Z',
    updated_at: '2025-04-30T00:00:00Z',
    tags: ['finance', 'accounting', 'reporting'],
  },
  {
    id: 'bnext-inventory',
    title: 'Inventory Management Guide',
    description: 'Complete guide to inventory management in BNext ERP',
    created_at: '2025-02-20T00:00:00Z',
    updated_at: '2025-05-05T00:00:00Z',
    tags: ['inventory', 'warehouse', 'stock'],
  },
];

// API endpoints
export const manualApi = {
  // Search across manuals
  search: async (params: QueryParams): Promise<SearchResult[]> => {
    try {
      // In development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Generate mock results based on the query
        const mockResults: SearchResult[] = [
          {
            id: 'result-1',
            title: `${params.query} - Related Documentation`,
            content: `This section explains how to use ${params.query} in BNext ERP. The process involves several steps including configuration and validation.`,
            score: 0.95,
            type: 'manual',
            source: {
              id: 'bnext-user-guide',
              title: 'BNext ERP User Guide',
              manual_id: 'bnext-user-guide',
            },
            highlights: [
              `This section explains how to use <em>${params.query}</em> in BNext ERP.`,
              `When using <em>${params.query}</em>, make sure to follow the proper procedures.`,
            ],
          },
          {
            id: 'result-2',
            title: 'Configuration Guide',
            content: `Configuration steps for BNext ERP features including ${params.query} and related functionality. This guide covers all aspects of setup.`,
            score: 0.82,
            type: 'pdf',
            source: {
              id: 'config-guide',
              title: 'BNext ERP Configuration Guide',
              url: '/manuals/config-guide.pdf',
              manual_id: 'bnext-admin-guide',
            },
            highlights: [
              `Configuration steps for BNext ERP features including <em>${params.query}</em> and related functionality.`,
            ],
          },
          {
            id: 'result-3',
            title: 'Troubleshooting Common Issues',
            content: `Common issues and solutions when working with ${params.query} in BNext ERP. This troubleshooting guide addresses most frequent problems.`,
            score: 0.78,
            type: 'text',
            source: {
              id: 'troubleshooting',
              title: 'Troubleshooting Guide',
              manual_id: params.manual_id || 'bnext-user-guide',
            },
            highlights: [
              `Common issues and solutions when working with <em>${params.query}</em> in BNext ERP.`,
              `If <em>${params.query}</em> doesn't respond, try restarting the service.`,
            ],
          },
        ];
        
        // Filter by manual_id if provided
        if (params.manual_id) {
          return mockResults.filter(result => result.source.manual_id === params.manual_id);
        }
        
        return mockResults;
      }
      
      // In production, call the actual API
      const response = await api.post<{ results: SearchResult[] }>('/search', params);
      return response.results;
    } catch (error) {
      console.error('Error searching manuals:', error);
      throw error;
    }
  },

  // Ask a question and get an AI-generated answer
  askQuestion: async (params: QueryParams): Promise<{
    answer: string;
    sources: SearchResult[];
  }> => {
    try {
      // In development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay for AI processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate mock search results for sources
        const mockSources: SearchResult[] = [
          {
            id: 'source-1',
            title: `${params.query} - Related Documentation`,
            content: `This section explains how to use ${params.query} in BNext ERP.`,
            score: 0.95,
            type: 'manual',
            source: {
              id: 'bnext-user-guide',
              title: 'BNext ERP User Guide',
              manual_id: 'bnext-user-guide',
            },
          },
          {
            id: 'source-2',
            title: 'Configuration Guide',
            content: `Configuration steps for BNext ERP features including ${params.query}.`,
            score: 0.82,
            type: 'pdf',
            source: {
              id: 'config-guide',
              title: 'BNext ERP Configuration Guide',
              manual_id: 'bnext-admin-guide',
            },
          },
        ];
        
        // Generate a mock answer based on the query
        return {
          answer: `To address your question about "${params.query}" in BNext ERP, you need to follow these steps:
          
1. Navigate to the main dashboard and select the appropriate module
2. Look for the configuration options related to ${params.query}
3. Follow the on-screen instructions to complete the setup
4. Verify the changes have been applied correctly

The BNext ERP documentation recommends testing in a staging environment before applying changes to production. For more detailed instructions, please refer to the sources provided below.`,
          sources: mockSources,
        };
      }
      
      // In production, call the actual API
      const response = await api.post<{ answer: string; sources: SearchResult[] }>('/ask', params);
      return {
        answer: response.answer,
        sources: response.sources || [],
      };
    } catch (error) {
      console.error('Error asking question:', error);
      throw error;
    }
  },

  // List all available manuals
  listManuals: async (): Promise<Manual[]> => {
    try {
      // In development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        return MOCK_MANUALS;
      }
      
      // In production, call the actual API
      const response = await api.get<{ manuals: Manual[] }>('/manuals');
      return response.manuals;
    } catch (error) {
      console.error('Error listing manuals:', error);
      throw error;
    }
  },

  // Get a specific manual with its sections
  getManual: async (manualId: string): Promise<Manual> => {
    try {
      // In development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Find the manual in our mock data
        const manual = MOCK_MANUALS.find(m => m.id === manualId);
        
        if (!manual) {
          throw new Error(`Manual with ID ${manualId} not found`);
        }
        
        // Add mock sections to the manual
        return {
          ...manual,
          sections: [
            {
              id: `${manualId}-section-1`,
              title: 'Introduction',
              content: 'Introduction to the manual and its purpose.',
            },
            {
              id: `${manualId}-section-2`,
              title: 'Getting Started',
              content: 'How to get started with the features described in this manual.',
            },
            {
              id: `${manualId}-section-3`,
              title: 'Core Functionality',
              content: 'Detailed explanations of core functionality and features.',
            },
            {
              id: `${manualId}-section-4`,
              title: 'Advanced Topics',
              content: 'Advanced topics and configurations for power users.',
            },
            {
              id: `${manualId}-section-5`,
              title: 'Troubleshooting',
              content: 'Common issues and their solutions.',
            },
          ]
        };
      }
      
      // In production, call the actual API
      const response = await api.get<{ manual: Manual }>(`/manuals/${manualId}`);
      return response.manual;
    } catch (error) {
      console.error(`Error getting manual ${manualId}:`, error);
      throw error;
    }
  },

  // Upload a document to a manual
  uploadDocument: async (params: UploadDocumentParams) => {
    try {
      const formData = new FormData();
      formData.append('file', params.file);
      formData.append('title', params.title);
      
      if (params.description) {
        formData.append('description', params.description);
      }
      
      if (params.tags && params.tags.length > 0) {
        formData.append('tags', JSON.stringify(params.tags));
      }
      
      formData.append('manual_id', params.manual_id);

      const response = await api.post<any>('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },
};

export default api;
