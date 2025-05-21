import apiClient from '../utils/apiClient';

// Create a wrapped version of apiClient for retrieval operations
const retrievalApi = {
  // Chunk retrieval
  retrieveChunks: (query: string, filters?: Record<string, any>, options?: {
    topK?: number,
    rerank?: boolean,
    rerankTopK?: number,
    includeMetadata?: boolean,
    namespaces?: string[],
    embeddingModel?: string
  }) => 
    apiClient.post<any>('/retrieve/chunks', { 
      query,
      filters,
      top_k: options?.topK,
      rerank: options?.rerank,
      rerank_top_k: options?.rerankTopK,
      include_metadata: options?.includeMetadata,
      namespaces: options?.namespaces,
      embedding_model: options?.embeddingModel
    }),
  
  // Document retrieval
  retrieveDocuments: (query: string, filters?: Record<string, any>, options?: {
    topK?: number,
    rerank?: boolean,
    rerankTopK?: number,
    includeMetadata?: boolean,
    namespaces?: string[],
    embeddingModel?: string
  }) => 
    apiClient.post<any>('/retrieve/docs', { 
      query,
      filters,
      top_k: options?.topK,
      rerank: options?.rerank,
      rerank_top_k: options?.rerankTopK,
      include_metadata: options?.includeMetadata,
      namespaces: options?.namespaces,
      embedding_model: options?.embeddingModel
    }),
  
  // Batch operations
  batchGetDocuments: (ids: string[]) => 
    apiClient.post<any>('/batch/documents', { ids }),
  
  batchGetChunks: (ids: string[]) => 
    apiClient.post<any>('/batch/chunks', { ids }),
  
  // Query completion
  queryCompletion: (query: string, retrievalOptions?: {
    topK?: number,
    filters?: Record<string, any>,
    rerank?: boolean,
    rerankTopK?: number,
    namespaces?: string[],
    embeddingModel?: string
  }, completionOptions?: {
    model?: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number,
    promptOverrides?: Record<string, any>
  }) => 
    apiClient.post<any>('/query', {
      query,
      retrieval_options: {
        top_k: retrievalOptions?.topK,
        filters: retrievalOptions?.filters,
        rerank: retrievalOptions?.rerank,
        rerank_top_k: retrievalOptions?.rerankTopK,
        namespaces: retrievalOptions?.namespaces,
        embedding_model: retrievalOptions?.embeddingModel
      },
      completion_options: {
        model: completionOptions?.model,
        system_prompt: completionOptions?.systemPrompt,
        temperature: completionOptions?.temperature,
        max_tokens: completionOptions?.maxTokens,
        prompt_overrides: completionOptions?.promptOverrides
      }
    }),
  
  // Agent queries
  agentQuery: (query: string, options?: {
    tools?: string[],
    memory?: boolean,
    model?: string,
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number,
    promptOverrides?: Record<string, any>
  }) => 
    apiClient.post<any>('/agent', {
      query,
      tools: options?.tools,
      memory: options?.memory,
      model: options?.model,
      system_prompt: options?.systemPrompt,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      prompt_overrides: options?.promptOverrides
    })
};

export default retrievalApi;
