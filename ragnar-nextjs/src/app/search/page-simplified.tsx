'use client';

import React, { useState, useRef } from 'react';
import { retrieveChunks, queryCompletion, ChunkResult } from '@/services/api';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [chunks, setChunks] = useState<ChunkResult[]>([]);
  const [completionAnswer, setCompletionAnswer] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isQueryingLLM, setIsQueryingLLM] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Opciones avanzadas de búsqueda
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [topK, setTopK] = useState(5);
  const [rerank, setRerank] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSearchChunks = async () => {
    if (!searchQuery.trim()) {
      alert('Ingrese una consulta de búsqueda');
      return;
    }

    setIsSearching(true);
    setChunks([]);

    try {
      const results = await retrieveChunks(
        searchQuery,
        {}, // filtros
        topK, // top_k
        0.0, // min_score
        rerank // usar reranking
      );
      
      setChunks(results);
      
      if (results.length === 0) {
        alert('No se encontraron resultados. Intente modificar su consulta o suba documentos relevantes.');
      }
    } catch (error) {
      console.error('Error al buscar:', error);
      alert('Ocurrió un error al procesar su búsqueda');
    } finally {
      setIsSearching(false);
    }
  };

  const handleQueryLLM = async () => {
    if (!searchQuery.trim()) {
      alert('Ingrese una consulta');
      return;
    }

    setIsQueryingLLM(true);
    setCompletionAnswer('');

    try {
      const response = await queryCompletion({
        query: searchQuery,
        k: topK,
        use_reranking: rerank
      });
      
      setCompletionAnswer(response.response || "");
      
      // Si hay sources, actualizar los chunks
      if (response.sources && response.sources.length > 0) {
        // Podríamos buscar los chunks correspondientes
        const sourceChunks = await retrieveChunks(
          "",
          { source_ids: response.sources.map(s => ({ document_id: s.document_id, chunk_number: s.chunk_number })) },
          response.sources.length,
          0,
          false
        );
        setChunks(sourceChunks);
      }
    } catch (error) {
      console.error('Error al consultar LLM:', error);
      alert('Ocurrió un error al procesar su consulta');
    } finally {
      setIsQueryingLLM(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Búsqueda Vectorial</h1>
      
      {/* Área de búsqueda */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-6">
          <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 mb-2">
            Consulta
          </label>
          <div className="flex">
            <input
              id="searchQuery"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en documentos o hacer una pregunta..."
              className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearchChunks}
              disabled={isSearching || !searchQuery.trim()}
              className={`px-4 py-3 bg-blue-600 text-white font-medium rounded-r-lg flex items-center ${
                isSearching ? 'opacity-70' : 'hover:bg-blue-700'
              }`}
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Buscando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Buscar Fragmentos
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            {showAdvancedOptions ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`ml-1 h-4 w-4 transition-transform ${
                showAdvancedOptions ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          
          <button
            onClick={handleQueryLLM}
            disabled={isQueryingLLM || !searchQuery.trim()}
            className={`px-4 py-2 bg-teal-600 text-white font-medium rounded-lg flex items-center ${
              isQueryingLLM ? 'opacity-70' : 'hover:bg-teal-700'
            }`}
          >
            {isQueryingLLM ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Consultando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Consultar IA
              </>
            )}
          </button>
        </div>
        
        {showAdvancedOptions && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="topk" className="block text-sm font-medium text-gray-700 mb-1">
                Número de resultados (Top K)
              </label>
              <input
                id="topk"
                type="number"
                min="1"
                max="20"
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={rerank}
                  onChange={(e) => setRerank(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Usar reranking</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Mejora la relevancia de los resultados reordenando los fragmentos
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Resultados LLM */}
      {completionAnswer && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Respuesta de IA</h2>
          <div className="p-4 bg-teal-50 border border-teal-100 rounded-lg whitespace-pre-wrap">
            {completionAnswer}
          </div>
        </div>
      )}
      
      {/* Resultados de búsqueda */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Fragmentos Relevantes {chunks.length > 0 && `(${chunks.length})`}
        </h2>
        
        {isSearching ? (
          <div className="flex justify-center items-center py-10">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : chunks.length > 0 ? (
          <div className="space-y-4">
            {chunks.map((chunk, index) => (
              <div 
                key={`${chunk.document_id}-${chunk.chunk_number}`} 
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between">
                  <div className="font-medium text-sm">
                    Documento: {chunk.document_id.substring(0, 12)}...
                  </div>
                  <div className="text-sm text-gray-500">
                    {chunk.score !== undefined && `Relevancia: ${(chunk.score * 100).toFixed(1)}%`}
                  </div>
                </div>
                <div className="p-4 bg-white">
                  <p className="whitespace-pre-wrap text-gray-700">{chunk.content}</p>
                  
                  {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <details>
                        <summary className="text-sm text-blue-600 cursor-pointer">
                          Ver metadatos
                        </summary>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(chunk.metadata).map(([key, value]) => (
                            <div key={key} className="p-2 bg-gray-50 rounded">
                              <span className="font-medium">{key}:</span>{' '}
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            {searchQuery.trim() ? (
              <p>No se encontraron fragmentos para su consulta. Intente con otra consulta o suba documentos relevantes.</p>
            ) : (
              <p>Ingrese una consulta para buscar fragmentos en sus documentos.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
