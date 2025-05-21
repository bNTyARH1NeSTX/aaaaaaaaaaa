import api from './morphikApi';
import { chatApi } from './chatApi';
import { knowledgeGraphApi } from './knowledgeGraphApi';
import { metadataExtractorApi } from './metadataExtractorApi';
import { multimodalSearchApi } from './multimodalSearchApi';
import { manualApi } from './manualApi';

export {
  chatApi,
  knowledgeGraphApi,
  metadataExtractorApi,
  multimodalSearchApi,
  manualApi,
  api
};

// Export types from individual API modules
export type { ChatMessage, ChatRequest, ChatResponse, Conversation, Source } from './chatApi';
export type { Node, Edge, Graph, GraphQuery, DomainInfo } from './knowledgeGraphApi';
export type { 
  ExtractMetadataParams, 
  Entity, 
  BoundingBox,
  Table,
  Image,
  MetadataExtractionResult,
  ExtractCapabilities
} from './metadataExtractorApi';
export type { SearchQuery, SearchResult } from './manualApi';
