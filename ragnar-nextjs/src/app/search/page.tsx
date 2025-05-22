'use client';

import React, { useState } from 'react';
import { queryCompletion, retrieveChunks, QueryRequest, ChunkResult } from '@/services/api';
import { Send, Search, FileText } from 'lucide-react';
import Link from 'next/link';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<ChunkResult[]>([]);
  const [queryResponse, setQueryResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'retrieve' | 'query'>('retrieve');

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (mode === 'retrieve') {
        // Modo búsqueda: obtener chunks relevantes
        const results = await retrieveChunks(
          query,
          {},  // Sin filtros
          5,   // 5 resultados
          0.3, // Umbral de similitud
          true // Usar reranking
        );
        
        setSearchResults(results);
        setQueryResponse(null);
      } else {
        // Modo consulta: obtener respuesta generada
        const queryPayload: QueryRequest = {
          query,
          k: 4,
          use_reranking: true
        };
        
        const response = await queryCompletion(queryPayload);
        setQueryResponse(response.response);
        
        // También podríamos obtener los chunks para mostrar las fuentes
        if (response.sources) {
          try {
            const sources = await retrieveChunks(
              '',
              { source_ids: response.sources.map(s => ({ document_id: s.document_id, chunk_number: s.chunk_number })) },
              10,
              0,
              false
            );
            setSearchResults(sources);
          } catch (sourcesError) {
            console.error("Error al obtener fuentes:", sourcesError);
          }
        } else {
          setSearchResults([]);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error en la consulta';
      setError(errorMessage);
      setSearchResults([]);
      setQueryResponse(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Búsqueda Vectorial y Consultas</h1>
      
      <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden mb-8">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex space-x-4 mb-4">
            <button
              className={`px-4 py-2 rounded-lg ${mode === 'retrieve' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setMode('retrieve')}
            >
              <Search size={16} className="inline mr-2" />
              Búsqueda
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${mode === 'query' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
              onClick={() => setMode('query')}
            >
              <FileText size={16} className="inline mr-2" />
              Consulta
            </button>
          </div>
          
          <div className="flex">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'retrieve' ? "Buscar en documentos..." : "Haz una pregunta sobre tus documentos..."}
              className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              disabled={isLoading}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="p-3 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 disabled:bg-blue-300"
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? <LoadingSpinner /> : <Send size={20} />}
            </button>
          </div>
        </div>
        
        <div className="p-4">
          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {queryResponse && (
            <div className="p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h2 className="text-lg font-semibold mb-2">Respuesta:</h2>
              <div className="whitespace-pre-wrap">{queryResponse}</div>
            </div>
          )}
          
          {searchResults.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">
                {mode === 'retrieve' ? 'Resultados:' : 'Fuentes:'}
              </h2>
              <div className="space-y-4">
                {searchResults.map((result, index) => (
                  <div key={`${result.document_id}-${result.chunk_number}`} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Link 
                        href={`/documents/${result.document_id}`} 
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                      >
                        <FileText size={16} className="mr-1" />
                        Documento: {result.document_id.substring(0, 8)}...
                      </Link>
                      {result.score !== undefined && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Score: {result.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      Fragmento #{result.chunk_number}
                    </div>
                    <div className="text-sm whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-100">
                      {result.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!isLoading && query.trim() && searchResults.length === 0 && !queryResponse && !error && (
            <div className="text-center py-8 text-gray-500">
              No se encontraron resultados para tu consulta.
            </div>
          )}
          
          {!query.trim() && !isLoading && (
            <div className="text-center py-8 text-gray-500">
              {mode === 'retrieve' 
                ? 'Ingresa una consulta para buscar en tus documentos.' 
                : 'Ingresa una pregunta sobre tus documentos.'}
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center">
        <Link href="/documents" className="text-blue-600 hover:text-blue-800">
          Ir a la lista de documentos
        </Link>
      </div>
    </div>
  );
}
