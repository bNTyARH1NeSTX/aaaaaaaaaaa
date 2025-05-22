"use client";

import React, { useState, useRef } from 'react';
import { Paperclip, Send } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  // El onSendMessage ahora debe ser una función sin argumentos
  onSendMessage: () => Promise<void>; 
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ input, setInput, file, setFile, onSendMessage, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleSend = () => {
    // Directamente llamamos onSendMessage que debe activar el hook sendMessage
    onSendMessage();
    // La limpieza del input y el estado del archivo se maneja en el hook useChat después del procesamiento del mensaje
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isLoading) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center p-3 bg-white rounded-xl shadow-lg">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.txt,.md"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className={`p-2.5 rounded-full ${isLoading ? 'text-gray-400' : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50'} transition-all duration-200 disabled:opacity-60`}
        disabled={isLoading}
        title="Adjuntar archivo"
      >
        <Paperclip size={20} />
      </button>
      <div className="relative flex-1 mx-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={file ? `Archivo: ${file.name} (Escribe un mensaje...)` : "Escribe un mensaje..."}
          className="w-full p-3 pl-4 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 transition-all duration-200"
          disabled={isLoading}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={handleSend}
        className={`p-3 text-white rounded-xl transition-all duration-200 ${
          isLoading || (!input.trim() && !file)
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
        }`}
        disabled={isLoading || (!input.trim() && !file)}
        title="Enviar mensaje"
      >
        <Send size={20} />
      </button>
      
      {file && (
        <div className="absolute bottom-16 left-4 right-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm">
              <div className="p-1.5 bg-blue-100 rounded-lg mr-2">
                <Paperclip size={16} className="text-blue-600" />
              </div>
              <div>
                <span className="font-medium text-blue-800 truncate">{file.name}</span>
                <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
            <button 
              onClick={() => setFile(null)}
              className="p-1.5 rounded-full bg-white border border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
              title="Eliminar archivo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInput;
