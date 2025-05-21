import api from './morphikApi';
import { chatApi } from './chatApi';
import { knowledgeGraphApi } from './knowledgeGraphApi';
import { metadataExtractorApi } from './metadataExtractorApi';
import { multimodalSearchApi } from './multimodalSearchApi';
import { manualApi } from './manualApi';
import * as documentsApi from './documentsApi';
import * as graphApi from './graphApi';
import * as queryApi from './queryApi';

export {
  chatApi,
  knowledgeGraphApi,
  metadataExtractorApi,
  multimodalSearchApi,
  manualApi,
  documentsApi,
  graphApi,
  queryApi,
  api
};

// Export types from individual API modules
export type { ChatMessage, ChatRequest, ChatResponse, Conversation, Source } from './chatApi';
export type { Node, Edge, Graph as KnowledgeGraph, GraphQuery, DomainInfo } from './knowledgeGraphApi';
export type { 
  ExtractMetadataParams, 
  Entity, 
  BoundingBox,
  Table,
  Image,
  MetadataExtractionResult,
  ExtractCapabilities
} from './metadataExtractorApi';
export type { SearchQuery, SearchResult } from './multimodalSearchApi';

// Export types from new API modules
export type {
  Document,
  Folder,
  RetrieveChunksRequest,
  ChunkResult
} from './documentsApi';

export type {
  GraphCreateRequest,
  Graph,
  UpdateGraphRequest
} from './graphApi';

export type {
  QueryCompletionRequest,
  CompletionResponse,
  AgentQueryRequest
} from './queryApi';
