"use client";

import React from 'react';
import { useChat } from '@/hooks/useChat';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { Message } from '@/services/api';

const ChatView: React.FC = () => {
  const { messages, input, setInput, file, setFile, isLoading, error, sendMessage } = useChat();

  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-blue-100">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex space-x-1 mr-3">
              <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
              Asistente Morphik
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <a
              href="/search"
              className="text-white text-sm hover:text-blue-100 flex items-center transition-all bg-blue-500 bg-opacity-30 px-3 py-1.5 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              Buscar
            </a>
            <a
              href="/documents"
              className="text-white text-sm hover:text-blue-100 flex items-center transition-all bg-blue-500 bg-opacity-30 px-3 py-1.5 rounded-full"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Documentos
            </a>
          </div>
        </div>
        
        <div className="h-[calc(100vh-16rem)] overflow-y-auto p-6 bg-gradient-to-b from-white to-blue-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-700 space-y-5">
              <div className="p-5 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 mb-3 shadow-lg shadow-blue-100 animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">¿En qué puedo ayudarte hoy?</h2>
              <p className="max-w-md text-lg text-gray-600">Puedes preguntarme cualquier cosa sobre tus documentos, imágenes o pedirme que analice archivos técnicos para crear manuales paso a paso.</p>
              
              <div className="flex flex-wrap justify-center gap-3 mt-3">
                <button className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition duration-200">
                  ¿Cómo generar un manual?
                </button>
                <button className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg transition duration-200">
                  Analizar imagen técnica
                </button>
                <button className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition duration-200">
                  Buscar en documentos
                </button>
              </div>
            </div>
          )}
          
          {messages.map((msg: Message) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          
          {isLoading && (
            <div className="flex justify-center my-4">
              <LoadingSpinner />
            </div>
          )}
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border-t border-red-200">
            <ErrorMessage message={error} />
          </div>
        )}
        
        <div className="p-5 bg-white border-t border-blue-100 relative backdrop-blur-sm bg-opacity-90">
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
