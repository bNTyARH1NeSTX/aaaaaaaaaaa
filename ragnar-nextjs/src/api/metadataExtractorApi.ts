import api from './morphikApi';

// Types for metadata extraction
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Entity {
  id: string;
  type: string;
  label: string;
  confidence: number;
  boundingBox?: BoundingBox;
  properties?: Record<string, any>;
  text?: string; // Added optional text property
}

export interface Table {
  id: string;
  title?: string;
  rows: number;
  columns: number;
  headers?: string[];
  data?: string[][];
  boundingBox?: BoundingBox;
}

export interface Image {
  id: string;
  width: number;
  height: number;
  caption?: string;
  tags?: string[];
  contentType?: string;
  url?: string;
}

export interface ExtractMetadataParams {
  file: File;
  options?: {
    extractText?: boolean;
    extractEntities?: boolean;
    extractTables?: boolean;
    extractImages?: boolean;
    extractFormats?: boolean;
    languages?: string[];
  };
}

export interface ExtractCapabilities {
  supportsTextExtraction: boolean;
  supportsEntityExtraction: boolean;
  supportsTableExtraction: boolean;
  supportsImageExtraction: boolean;
  supportedLanguages: string[];
  supportedFileTypes: string[];
}

export interface MetadataExtractionResult {
  documentId: string;
  mimeType: string;
  pageCount: number;
  entities?: Entity[];
  tables?: Table[];
  images?: Image[];
  textContent?: string;
  summary?: string;
  languages?: string[];
}

// API for metadata extraction
export const metadataExtractorApi = {
  // Get capabilities of the metadata extractor
  getCapabilities: async (): Promise<ExtractCapabilities> => {
    try {
      // For development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
          supportsTextExtraction: true,
          supportsEntityExtraction: true,
          supportsTableExtraction: true,
          supportsImageExtraction: true,
          supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja'],
          supportedFileTypes: ['pdf', 'docx', 'pptx', 'xlsx', 'jpg', 'png', 'txt', 'html']
        };
      }
      
      // In production
      const response = await api.get<ExtractCapabilities>('/metadata-extractor/capabilities');
      return response;
    } catch (error) {
      console.error('Error getting metadata extractor capabilities:', error);
      throw error;
    }
  },
  
  // Extract metadata from a file
  extract: async (params: ExtractMetadataParams): Promise<MetadataExtractionResult> => {
    try {
      // For development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay for processing
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // Mock result based on file type
        const fileType = params.file.name.split('.').pop()?.toLowerCase() || '';
        
        // Basic mock result for development
        const mockResult: MetadataExtractionResult = {
          documentId: `doc-${Date.now()}`,
          mimeType: params.file.type,
          pageCount: fileType === 'pdf' ? 5 : 1,
          languages: ['en'],
          summary: `This is a sample ${fileType.toUpperCase()} document about BNext ERP.`
        };
        
        // Add entities if requested
        if (params.options?.extractEntities) {
          mockResult.entities = [
            {
              id: 'entity-1',
              type: 'PERSON',
              label: 'John Smith',
              confidence: 0.92,
              boundingBox: { x: 120, y: 150, width: 80, height: 20 }
            },
            {
              id: 'entity-2',
              type: 'ORGANIZATION',
              label: 'BNext Software Inc.',
              confidence: 0.88,
              boundingBox: { x: 200, y: 300, width: 150, height: 20 }
            },
            {
              id: 'entity-3',
              type: 'DATE',
              label: 'January 15, 2025',
              confidence: 0.95,
              boundingBox: { x: 400, y: 50, width: 100, height: 20 }
            }
          ];
        }
        
        // Add tables if requested
        if (params.options?.extractTables) {
          mockResult.tables = [
            {
              id: 'table-1',
              title: 'Financial Summary',
              rows: 4,
              columns: 3,
              headers: ['Quarter', 'Revenue', 'Expenses'],
              data: [
                ['Q1 2025', '$250,000', '$180,000'],
                ['Q2 2025', '$310,000', '$220,000'],
                ['Q3 2025', '$280,000', '$200,000']
              ],
              boundingBox: { x: 100, y: 400, width: 400, height: 150 }
            }
          ];
        }
        
        // Add images if requested
        if (params.options?.extractImages) {
          mockResult.images = [
            {
              id: 'image-1',
              width: 640,
              height: 480,
              caption: 'BNext ERP Dashboard Screenshot',
              tags: ['UI', 'dashboard', 'analytics'],
              contentType: 'image/png',
              url: '/mock/images/dashboard.png'
            },
            {
              id: 'image-2',
              width: 320,
              height: 240,
              caption: 'Company Logo',
              tags: ['logo', 'branding'],
              contentType: 'image/png',
              url: '/mock/images/logo.png'
            }
          ];
        }
        
        return mockResult;
      }
      
      // In production, use the actual API
      const formData = new FormData();
      formData.append('file', params.file);
      
      if (params.options) {
        formData.append('options', JSON.stringify(params.options));
      }
      
      const response = await api.uploadFile<MetadataExtractionResult>(
        '/metadata-extractor/extract',
        params.file,
        params.options
      );
      
      return response;
    } catch (error) {
      console.error('Error extracting metadata:', error);
      throw error;
    }
  },
  
  // Get the results of a previously submitted extraction job
  getExtractionResult: async (documentId: string): Promise<MetadataExtractionResult> => {
    try {
      // In development, return mock data
      if (process.env.NODE_ENV === 'development') {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock result
        return {
          documentId,
          mimeType: 'application/pdf',
          pageCount: 5,
          languages: ['en'],
          summary: 'This is a sample PDF document about BNext ERP.',
          entities: [
            {
              id: 'entity-1',
              type: 'PERSON',
              label: 'John Smith',
              confidence: 0.92,
              boundingBox: { x: 120, y: 150, width: 80, height: 20 }
            }
          ],
          tables: [
            {
              id: 'table-1',
              title: 'Financial Summary',
              rows: 4,
              columns: 3,
              headers: ['Quarter', 'Revenue', 'Expenses'],
              data: [
                ['Q1 2025', '$250,000', '$180,000'],
                ['Q2 2025', '$310,000', '$220,000'],
                ['Q3 2025', '$280,000', '$200,000']
              ],
              boundingBox: { x: 100, y: 400, width: 400, height: 150 }
            }
          ]
        };
      }
      
      // In production
      const response = await api.get<MetadataExtractionResult>(`/metadata-extractor/results/${documentId}`);
      return response;
    } catch (error) {
      console.error(`Error getting extraction result for document ${documentId}:`, error);
      throw error;
    }
  }
};

export default metadataExtractorApi;