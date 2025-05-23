"use client";

import React from 'react';
import { useChat } from '@/hooks/useChat';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { Message } from '@/services/api';
import { Search, FileText, MessageSquare } from 'lucide-react';

const ChatView: React.FC = () => {
  const { messages, input, setInput, file, setFile, isLoading, error, sendMessage } = useChat();

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full p-4 md:p-0">
      <div className="flex flex-col h-full bg-card text-card-foreground rounded-xl shadow-2xl overflow-hidden border border-border">
        {/* Header */}
        <div className="bg-background/70 backdrop-blur-md text-foreground p-4 sm:p-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center">
            {/* macOS-like window controls (decorative) */}
            <div className="flex space-x-1.5 mr-3">
              <div className="w-3 h-3 bg-red-500 rounded-full opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full opacity-80 hover:opacity-100 transition-opacity"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full opacity-80 hover:opacity-100 transition-opacity"></div>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold text-primary dark:text-primary-foreground">
              Asistente Morphik
            </h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <a
              href="/search" // Assuming /search is the correct path
              className="text-muted-foreground hover:text-primary dark:hover:text-primary-foreground flex items-center transition-colors text-xs sm:text-sm bg-secondary hover:bg-secondary/80 px-2.5 py-1.5 rounded-md"
            >
              <Search size={16} className="mr-1 sm:mr-1.5" />
              Buscar
            </a>
            <a
              href="/documents"
              className="text-muted-foreground hover:text-primary dark:hover:text-primary-foreground flex items-center transition-colors text-xs sm:text-sm bg-secondary hover:bg-secondary/80 px-2.5 py-1.5 rounded-md"
            >
              <FileText size={16} className="mr-1 sm:mr-1.5" />
              Documentos
            </a>
          </div>
        </div>
        
        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background dark:bg-background/50">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-4 sm:space-y-6">
              <div className="p-4 sm:p-5 rounded-full bg-primary/10 dark:bg-primary/20 text-primary mb-2 sm:mb-3">
                <MessageSquare size={40} className="sm:w-16 sm:h-16" />
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground dark:text-primary-foreground">
                ¿En qué puedo ayudarte hoy?
              </h2>
              <p className="max-w-md text-sm sm:text-base">
                Puedes preguntarme cualquier cosa sobre tus documentos, imágenes o pedirme que analice archivos técnicos para crear manuales paso a paso.
              </p>
              
              {/* Suggestion Buttons */}
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-2">
                {[
                  "¿Cómo generar un manual?",
                  "Analizar imagen técnica",
                  "Buscar en documentos"
                ].map((suggestion) => (
                  <button 
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs sm:text-sm rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((msg: Message) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          
          {isLoading && messages.length === 0 && ( // Show centered spinner only if no messages yet
            <div className="flex justify-center items-center h-full">
              <LoadingSpinner />
            </div>
          )}
          {isLoading && messages.length > 0 && ( // Show spinner at the bottom if messages exist
             <div className="flex justify-center py-4">
                <LoadingSpinner />
            </div>
          )}
        </div>
        
        {error && (
          <div className="p-3 sm:p-4 bg-destructive/10 border-t border-destructive/30">
            <ErrorMessage message={error} />
          </div>
        )}
        
        {/* Input Area */}
        <div className="p-3 sm:p-4 bg-background/80 dark:bg-background/60 backdrop-blur-sm border-t border-border">
          <ChatInput 
            input={input} 
            setInput={setInput} 
            file={file} 
            setFile={setFile} 
            onSendMessage={sendMessage}
            isLoading={isLoading} 
          />
        </div>
      </div>
    </div>
  );
};

export default ChatView;
