import { api } from './apiService';

// Interfaces para modelos
export interface ModelConfig {
  id: string;
  name: string;
  model_name: string;
  provider?: string;
  vision?: boolean;
  description?: string;
}

export interface AvailableModelsResponse {
  completion_models: ModelConfig[];
  graph_models: ModelConfig[];
  embedding_models: ModelConfig[];
  current_completion_model: string;
  current_graph_model: string;
  current_embedding_model: string;
}

export interface UpdateModelRequest {
  model_type: 'completion' | 'graph' | 'embedding';
  model_id: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  model_used?: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  model_override?: string;
  use_rag?: boolean;
  use_colpali?: boolean;
  use_graph?: boolean;
  graph_name?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  response: string;
  model_used: string;
  sources?: Array<{
    document_id: string;
    chunk_number: number;
    score?: number;
  }>;
  graph_entities?: Array<{
    label: string;
    type: string;
  }>;
}

class ModelService {
  // Obtener modelos disponibles
  async getAvailableModels(): Promise<AvailableModelsResponse> {
    try {
      const response = await api.get('/models/available');
      return response.data;
    } catch (error) {
      console.error('Error fetching available models:', error);
      // Retornar datos mock en caso de error para desarrollo
      return {
        completion_models: [
          {
            id: 'openai_gpt4o_mini',
            name: 'GPT-4o Mini',
            model_name: 'gpt-4o-mini',
            description: 'Modelo rápido y eficiente de OpenAI'
          },
          {
            id: 'qwen_manual_generator_completion',
            name: 'Modelo Manual Personalizado',
            model_name: 'manual_generation_completion',
            provider: 'manual_generation',
            description: 'Modelo fine-tuned para generación de manuales ERP'
          },
          {
            id: 'claude_sonnet',
            name: 'Claude Sonnet',
            model_name: 'claude-3-7-sonnet-latest',
            description: 'Modelo avanzado de Anthropic'
          }
        ],
        graph_models: [
          {
            id: 'openai_gpt4o',
            name: 'GPT-4o para GraphRAG',
            model_name: 'gpt-4o',
            description: 'Modelo GPT-4o optimizado para extracción de entidades'
          },
          {
            id: 'qwen_manual_generator_completion',
            name: 'Modelo Manual para GraphRAG',
            model_name: 'manual_generation_completion',
            provider: 'manual_generation',
            description: 'Modelo personalizado para extracción de entidades en manuales ERP'
          }
        ],
        embedding_models: [
          {
            id: 'openai_embedding',
            name: 'OpenAI Embeddings',
            model_name: 'text-embedding-3-small',
            description: 'Embeddings de OpenAI'
          }
        ],
        current_completion_model: 'openai_gpt4o_mini',
        current_graph_model: 'qwen_manual_generator_completion',
        current_embedding_model: 'openai_embedding'
      };
    }
  }

  // Actualizar modelo
  async updateModel(request: UpdateModelRequest): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/models/update', request);
      return response.data;
    } catch (error) {
      console.error('Error updating model:', error);
      throw error;
    }
  }

  // Chat con modelo específico
  async chatWithModel(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await api.post('/chat/message', request);
      return response.data;
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }

  // Consulta RAG con modelo específico
  async queryWithRAG(request: {
    query: string;
    model_override?: string;
    use_colpali?: boolean;
    use_graph?: boolean;
    graph_name?: string;
    filters?: Record<string, any>;
    k?: number;
    temperature?: number;
    max_tokens?: number;
  }): Promise<ChatResponse> {
    try {
      const response = await api.post('/query', request);
      return {
        response: response.data.completion,
        model_used: request.model_override || 'default',
        sources: response.data.sources,
        graph_entities: response.data.graph_entities
      };
    } catch (error) {
      console.error('Error in RAG query:', error);
      throw error;
    }
  }
}

export const modelService = new ModelService();
