"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, User, Bot, Loader2, AlertCircle, FileText, Database } from 'lucide-react';
import { sendChatMessage, ChatRequest, ChatResponse, ChatMessage } from '../../api/manualApi';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de IA para el sistema Ragnar. Puedo ayudarte con consultas sobre documentos, generación de manuales y análisis de información. ¿En qué puedo asistirte hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
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

    const userMessage: ChatMessage = {
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
        k: 4,
        temperature: 0.7,
      };

      const response: ChatResponse = await sendChatMessage(request);
      
      // Update conversation ID if we received one
      if (response.conversation_id) {
        setConversationId(response.conversation_id);
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.completion,
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // If there are sources, add them as a separate informational message
      if (response.sources && response.sources.length > 0) {
        const sourcesMessage: ChatMessage = {
          role: 'assistant',
          content: `**Fuentes consultadas:**\n${response.sources.map((source: { score: number; metadata?: { filename?: string; page?: number } }, index: number) => 
            `${index + 1}. ${source.metadata?.filename || 'Documento'} (Score: ${(source.score * 100).toFixed(1)}%)`
          ).join('\n')}`,
        };
        setMessages(prev => [...prev, sourcesMessage]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje');
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
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
        content: '¡Hola! Soy tu asistente de IA para el sistema Ragnar. Puedo ayudarte con consultas sobre documentos, generación de manuales y análisis de información. ¿En qué puedo asistirte hoy?',
      },
    ]);
    setConversationId(undefined);
    setError(null);
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
              Haga preguntas sobre sus documentos o solicite ayuda con cualquier tarea
            </p>
          </div>
          <button
            onClick={clearChat}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Limpiar Chat
          </button>
        </div>
        
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
              
              <div
                className={`max-w-xs lg:max-w-2xl px-4 py-3 rounded-lg ${
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
                    Analizando documentos y generando respuesta...
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
              placeholder="Escriba su mensaje aquí..."
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
              <span>Conectado al backend Ragnar</span>
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
