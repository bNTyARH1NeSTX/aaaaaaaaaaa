import api from './morphikApi';
import { mockSearchResults } from './mockData';

export interface SearchQuery {
  query: string;
  filters?: Record<string, any>;
  maxResults?: number;
  includeImages?: boolean;
  includePdfs?: boolean;
  includeVideos?: boolean;
}

export interface SearchResult {
  id: string;
  type: 'text' | 'image' | 'pdf' | 'video';
  content: string;
  score: number;
  metadata: Record<string, any>;
  highlights?: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface FileUploadParams {
  file: File;
  metadata?: Record<string, any>;
  tags?: string[];
}

export const multimodalSearchApi = {
  // Search across all content types
  search: async (params: SearchQuery): Promise<SearchResult[]> => {
    // For development, we'll use mock data
    // When ready to connect to real API, remove this comment and use the actual API call
    return Promise.resolve(mockSearchResults.filter(result => 
      result.content.toLowerCase().includes(params.query.toLowerCase()) ||
      result.metadata.source.toLowerCase().includes(params.query.toLowerCase())
    ));
    
    // Uncomment for actual API call:
    // return api.post<{ results: SearchResult[] }>('/search', params)
    //   .then(data => data.results);
  },

  // Upload a file for indexing (image, PDF, video)
  uploadFile: async (params: FileUploadParams) => {
    // Mock response for development
    return Promise.resolve({
      success: true,
      fileId: 'mock-file-' + Date.now(),
      message: 'File uploaded successfully',
      metadata: params.metadata || {}
    });
    
    // Uncomment for actual API call
    // return api.uploadFile<{
    //   success: boolean,
    //   fileId: string,
    //   message: string,
    //   metadata: Record<string, any>
    // }>('/upload', params.file, params.metadata, (progressEvent) => {
    //   // You can report upload progress here if needed
    //   console.log('Upload progress:', progressEvent);
    // });
  },

  // Get supported file types
  getSupportedFileTypes: async () => {
    // Mock response for development
    return Promise.resolve({
      supportedTypes: [
        { type: 'image', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'], maxSize: 10 },
        { type: 'document', extensions: ['.pdf', '.docx', '.txt', '.rtf'], maxSize: 25 },
        { type: 'video', extensions: ['.mp4', '.mov', '.avi', '.webm'], maxSize: 100 }
      ]
    });
    
    // Uncomment for actual API call
    // return api.get<{
    //   supportedTypes: Array<{
    //     type: string,
    //     extensions: string[],
    //     maxSize: number
    //   }>
    // }>('/supported-file-types');
  }
};

export default multimodalSearchApi;
