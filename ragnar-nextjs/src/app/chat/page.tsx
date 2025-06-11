"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, User, Bot, Loader2, AlertCircle, FileText, Database, Settings } from 'lucide-react';
import { sendChatMessage, ChatRequest, ChatResponse, ChatMessage } from '../../api/apiService';
import ChatFeedback from '../../components/ChatFeedback';

// Extended message interface for feedback support
interface ExtendedChatMessage extends ChatMessage {
  response_id?: string;
  query?: string; // Original query for assistant responses
  model_used?: string;
  relevant_images?: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de IA para el sistema Ragnar. Uso el modelo Qwen2.5-VL fine-tuned por defecto para generar respuestas basadas en imágenes del ERP usando ColPali. Puedo ayudarte con consultas sobre manuales del ERP, análisis de imágenes y generación de documentación. ¿En qué puedo asistirte hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [selectedModel, setSelectedModel] = useState<'manual_generation' | 'openai'>('manual_generation');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ExtendedChatMessage = {
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const request: ChatRequest = {
        query: currentInput,
        conversation_id: conversationId,
        k: 3,
        temperature: 0.7,
        model_type: selectedModel,
        use_images: selectedModel === 'manual_generation', // Only use images with manual generation model
      };

      const response: ChatResponse = await sendChatMessage(request);
      
      // Update conversation ID if we received one
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      // Get the completion content
      const completionContent = response.completion || response.response || response.message || 'Sin respuesta';

      const assistantMessage: ExtendedChatMessage = {
        role: 'assistant',
        content: completionContent,
        response_id: response.response_id,
        query: currentInput, // Store original query for feedback
        model_used: response.metadata?.model_used || (selectedModel === 'manual_generation' ? 'Qwen2.5-VL-3B-Instruct (Fine-tuned)' : 'OpenAI GPT-4o-mini'),
        relevant_images: response.metadata?.images_found || 0,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // If there are sources/images in metadata, add them as a separate informational message
      if (response.metadata?.sources && response.metadata.sources.length > 0) {
        const sourcesMessage: ExtendedChatMessage = {
          role: 'assistant',
          content: `**Imágenes relevantes encontradas:**\n${response.metadata.sources.map((source: any, index: number) => {
            const imagePath = source.image_path || source.metadata?.filename || 'Imagen';
            const module = source.module || 'Módulo desconocido';
            const section = source.section || '';
            const functionDetected = source.function_detected || '';
            return `${index + 1}. ${imagePath} (${module}${section ? ' - ' + section : ''}${functionDetected ? ' - ' + functionDetected : ''})`;
          }).join('\n')}`,
        };
        setMessages(prev => [...prev, sourcesMessage]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje');
      
      // Add error message to chat
      const errorMessage: ExtendedChatMessage = {
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: '¡Hola! Soy tu asistente de IA para el sistema Ragnar. Uso el modelo Qwen2.5-VL fine-tuned por defecto para generar respuestas basadas en imágenes del ERP usando ColPali. Puedo ayudarte con consultas sobre manuales del ERP, análisis de imágenes y generación de documentación. ¿En qué puedo asistirte hoy?',
      },
    ]);
    setConversationId(undefined);
    setError(null);
    setShowModelSelector(false);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-blue-600" />
              Asistente IA Ragnar
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Asistente especializado en manuales ERP con búsqueda inteligente de imágenes usando ColPali
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {selectedModel === 'manual_generation' ? 'Qwen2.5-VL' : 'OpenAI'}
            </button>
            <button
              onClick={clearChat}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Limpiar Chat
            </button>
          </div>
        </div>
        
        {/* Model Selector */}
        {showModelSelector && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Seleccionar Modelo de IA</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="model"
                  value="manual_generation"
                  checked={selectedModel === 'manual_generation'}
                  onChange={(e) => setSelectedModel(e.target.value as 'manual_generation' | 'openai')}
                  className="mr-2"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Qwen2.5-VL Fine-tuned (Recomendado)</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Modelo especializado en manuales ERP con ColPali para búsqueda de imágenes</p>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="model"
                  value="openai"
                  checked={selectedModel === 'openai'}
                  onChange={(e) => setSelectedModel(e.target.value as 'manual_generation' | 'openai')}
                  className="mr-2"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">OpenAI GPT-4o-mini</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Modelo general de OpenAI (sin búsqueda de imágenes)</p>
                </div>
              </label>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div className="flex flex-col gap-2 max-w-xs lg:max-w-2xl">
                <div
                  className={`px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content.split('**').map((part: string, i: number) => 
                      i % 2 === 0 ? part : <strong key={i}>{part}</strong>
                    )}
                  </div>
                </div>
                
                {/* Show feedback component for assistant messages with response_id and query */}
                {message.role === 'assistant' && (
                  <div className="ml-2">
                    {message.response_id && message.query ? (
                      <ChatFeedback
                        conversationId={conversationId || 'default'}
                        responseId={message.response_id}
                        query={message.query}
                        response={message.content}
                        modelUsed={message.model_used}
                        relevantImages={message.relevant_images}
                        onFeedbackSubmitted={(rating) => {
                          console.log(`Feedback submitted: ${rating} for response ${message.response_id}`);
                        }}
                      />
                    ) : (
                      <div className="text-xs text-gray-400 mt-1">
                        Feedback not available for this message
                      </div>
                    )}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedModel === 'manual_generation' 
                      ? 'Buscando imágenes relevantes con ColPali y generando respuesta...'
                      : 'Generando respuesta con OpenAI...'
                    }
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escriba su consulta sobre manuales del ERP aquí... Por ejemplo: ¿Cómo agregar una nueva impresora?"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
          
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>
                {selectedModel === 'manual_generation' 
                  ? 'Qwen2.5-VL + ColPali' 
                  : 'OpenAI GPT-4o-mini'
                }
              </span>
            </div>
            {conversationId && (
              <div className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span>ID: {conversationId.slice(0, 8)}...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
