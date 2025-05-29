"use client";

import React, { useState } from 'react';
import { Search as SearchIcon, FileText, Clock, Filter, Loader2, AlertCircle, Eye, Image } from 'lucide-react';
import { useSearch } from '../../hooks/useApi';

export default function SearchPage() {
  const { results, loading, error, search, clearResults } = useSearch();
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [useColpali, setUseColpali] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setHasSearched(true);
    await search(query, 10, useColpali);
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-700 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SearchIcon className="w-8 h-8 text-blue-600" />
          Búsqueda de Documentos
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Busque en su colección de documentos utilizando búsqueda semántica impulsada por IA
        </p>
      </div>

      {/* Search Interface */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar documentos, contenido o conceptos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-lg"
              disabled={loading}
            />
          </div>
          
          {/* ColPali Toggle */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <Image className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Búsqueda Multimodal (ColPali)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setUseColpali(!useColpali)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                useColpali ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              disabled={loading}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useColpali ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
              {useColpali 
                ? "Busca en texto e imágenes usando IA multimodal" 
                : "Busca solo en contenido de texto"
              }
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SearchIcon className="w-4 h-4" />
              )}
              Buscar
            </button>
            {results.length > 0 && (
              <button 
                type="button"
                onClick={() => {
                  clearResults();
                  setHasSearched(false);
                  setQuery('');
                  setUseColpali(false);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {loading 
                ? 'Buscando...' 
                : `Resultados de búsqueda${results.length > 0 ? ` (${results.length})` : ''}`
              }
              {!loading && hasSearched && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  useColpali 
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
                    : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                }`}>
                  {useColpali ? 'Multimodal' : 'Texto'}
                </span>
              )}
            </h2>
            {query && !loading && (
              <p className="text-sm text-gray-500 mt-1">
                Búsqueda: "{query}" {useColpali && <span className="text-purple-600">(incluye imágenes y contenido visual)</span>}
              </p>
            )}
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="px-6 py-4 animate-pulse">
                  <div className="flex items-start space-x-4">
                    <div className="w-8 h-8 bg-gray-300 rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-full"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : results.length > 0 ? (
              results.map((result, index) => (
                <div key={index} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-start space-x-4">
                    <div className="flex flex-col items-center space-y-1">
                      <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                      {useColpali && (
                        <Eye className="w-4 h-4 text-purple-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 
                          className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          onClick={() => setSelectedResult(result)}
                        >
                          {result.metadata.filename}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            Relevancia: {(result.score * 100).toFixed(1)}%
                          </span>
                          {result.metadata.page && (
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              Página {result.metadata.page}
                            </span>
                          )}
                          {useColpali && (
                            <span className="text-xs text-purple-500 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded">
                              Multimodal
                            </span>
                          )}
                        </div>
                      </div>
                      <p 
                        className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 cursor-pointer hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                        onClick={() => setSelectedResult(result)}
                      >
                        {highlightText(result.content, query)}
                      </p>
                      <div className="mt-2 flex items-center space-x-2">
                        <button 
                          onClick={() => setSelectedResult(result)}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                          Ver detalles →
                        </button>
                        {useColpali && result.metadata.has_image && (
                          <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            Contiene imágenes
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center">
                <SearchIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No se encontraron resultados para su búsqueda.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {useColpali 
                    ? "Intente con diferentes términos o desactive la búsqueda multimodal para buscar solo en texto." 
                    : "Intente con diferentes términos o active la búsqueda multimodal para incluir contenido visual."
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Searches - Solo mostrar si no hay búsqueda activa */}
      {!hasSearched && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Sugerencias de Búsqueda
          </h2>
          
          <div className="space-y-2">
            {[
              { term: 'Estrategias de implementación de IA', multimodal: false },
              { term: 'Gráficos de rendimiento financiero', multimodal: true },
              { term: 'Documentación técnica de APIs', multimodal: false },
              { term: 'Diagramas de arquitectura del sistema', multimodal: true },
              { term: 'Análisis de rendimiento del sistema', multimodal: false },
              { term: 'Tablas y visualizaciones de datos', multimodal: true },
            ].map((searchItem, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(searchItem.term);
                  setUseColpali(searchItem.multimodal);
                  setHasSearched(true);
                  search(searchItem.term, 10, searchItem.multimodal);
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <SearchIcon className="w-4 h-4 inline mr-2" />
                    {searchItem.term}
                  </div>
                  {searchItem.multimodal && (
                    <div className="flex items-center space-x-1 opacity-60 group-hover:opacity-100">
                      <Image className="w-3 h-3 text-purple-600" />
                      <span className="text-xs text-purple-600">Multimodal</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result Detail Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Detalles del Documento
              </h2>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <div className="space-y-4">
                {/* Document Info */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                    {selectedResult.metadata.filename}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Relevancia:</span>
                      <span className="ml-2 font-medium">{(selectedResult.score * 100).toFixed(1)}%</span>
                    </div>
                    {selectedResult.metadata.page && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Página:</span>
                        <span className="ml-2 font-medium">{selectedResult.metadata.page}</span>
                      </div>
                    )}
                    {useColpali && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Tipo de búsqueda:</span>
                        <span className="ml-2 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs">
                          Multimodal
                        </span>
                      </div>
                    )}
                    {selectedResult.metadata.content_type && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Tipo:</span>
                        <span className="ml-2 font-medium">{selectedResult.metadata.content_type}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Contenido:</h4>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {highlightText(selectedResult.content, query)}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                {Object.keys(selectedResult.metadata).length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Metadatos:</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {JSON.stringify(selectedResult.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Visual Content Indicator */}
                {useColpali && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="w-5 h-5 text-purple-600" />
                      <h4 className="font-medium text-purple-900 dark:text-purple-100">
                        Contenido Multimodal
                      </h4>
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Este resultado fue encontrado utilizando búsqueda multimodal ColPali, 
                      que puede incluir contenido de imágenes, tablas, diagramas y otros elementos visuales 
                      además del texto.
                    </p>
                    {selectedResult.metadata.has_image && (
                      <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                        ✓ Contiene elementos visuales detectados
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
