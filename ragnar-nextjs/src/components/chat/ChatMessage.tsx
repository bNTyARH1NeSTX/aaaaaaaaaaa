"use client";

import React from 'react';
import { Message } from '@/services/api';
import { FileText } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  // Determinamos si es un mensaje del sistema, usuario o asistente
  const isSystem = message.role === 'system';
  const isUser = message.role === 'user';
  
  if (isSystem) {
    return (
      <div className="px-5 py-3 my-4 text-sm text-gray-600 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl max-w-md mx-auto text-center shadow-sm border border-gray-100 animate-fade-in">
        <div className="flex items-center justify-center mb-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span className="font-medium text-gray-500">Sistema</span>
        </div>
        {message.content}
      </div>
    );
  }

  return (
    <div className={`flex mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      {/* Avatar o indicador */}
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mr-3 flex-shrink-0 shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
            <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
          </svg>
        </div>
      )}
      
      {/* Contenido del mensaje */}
      <div 
        className={`px-5 py-4 rounded-2xl max-w-3xl shadow-md ${
          isUser 
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none' 
            : 'bg-white border border-blue-50 rounded-bl-none'
        }`}
      >
        {/* Contenido principal */}
        <div className={`whitespace-pre-wrap leading-relaxed ${!isUser ? 'text-gray-800' : ''}`}>{message.content}</div>
        
        {/* Información de archivo adjunto */}
        {message.fileInfo && (
          <div className={`mt-4 pt-3 ${
            isUser 
              ? 'border-t border-blue-400 border-opacity-50' 
              : 'border-t border-gray-200'
          }`}>
            <div className="flex items-center text-sm">
              <div className={`p-1.5 ${isUser ? 'bg-blue-500' : 'bg-blue-100'} rounded-lg mr-2`}>
                <FileText size={16} className={isUser ? 'text-white' : 'text-blue-600'} />
              </div>
              <div>
                <span className={`font-medium ${isUser ? 'text-blue-100' : 'text-blue-700'}`}>
                  {message.fileInfo.name}
                </span>
                <div className="mt-1 text-xs flex flex-wrap gap-2">
                  <span className={`${
                    isUser 
                      ? 'bg-blue-500 bg-opacity-40 text-white' 
                      : 'bg-blue-100 text-blue-700'
                  } px-2 py-0.5 rounded-full`}>
                    {message.fileInfo.type.split('/')[1] || message.fileInfo.type}
                  </span>
                  <span className={`${
                    isUser 
                      ? 'bg-blue-500 bg-opacity-40 text-white' 
                      : 'bg-blue-100 text-blue-700'
                  } px-2 py-0.5 rounded-full`}>
                    {(message.fileInfo.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Fuentes de información */}
        {message.sources && message.sources.length > 0 && (
          <div className={`mt-4 pt-3 ${
            isUser 
              ? 'border-t border-blue-400 border-opacity-50' 
              : 'border-t border-gray-200'
          }`}>
            <div className="flex items-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 ${isUser ? 'text-blue-200' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className={`text-sm font-medium ${isUser ? 'text-blue-100' : 'text-blue-600'}`}>
                Fuentes ({message.sources.length})
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {message.sources.map((source, index) => (
                <a 
                  key={index}
                  href={`/documents/${source.document_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs flex items-center px-3 py-1.5 rounded-lg ${
                    isUser 
                      ? 'bg-blue-500 bg-opacity-30 text-white hover:bg-opacity-40' 
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  } transition-colors duration-150`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Doc: {source.document_id.substring(0, 6)}...
                  {source.chunk_number !== undefined && 
                    <span className="ml-1 bg-opacity-50 px-1 rounded">#{source.chunk_number}</span>
                  }
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Avatar del usuario */}
      {isUser && (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 text-white flex items-center justify-center ml-3 flex-shrink-0 shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
