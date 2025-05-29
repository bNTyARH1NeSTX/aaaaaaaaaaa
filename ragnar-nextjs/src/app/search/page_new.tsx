"use client";

import React, { useState } from 'react';
import { Search as SearchIcon, FileText, Clock, Loader2, AlertCircle, Eye, Image, X } from 'lucide-react';
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
          {/* Search Input */}
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
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center space-x-2">
              <Image className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Búsqueda Multimodal (ColPali)
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {useColpali 
                  ? "Busca en texto e imágenes" 
                  : "Solo texto"
                }
              </span>
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
            </div>
          </div>
          
          {/* Search Button */}
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {loading 
                  ? 'Buscando...' 
                  : `Resultados de búsqueda${results.length > 0 ? ` (${results.length})` : ''}`
                }
              </h2>
              {useColpali && (
                <div className="flex items-center space-x-1 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                  <Image className="w-3 h-3" />
                  <span>ColPali</span>
                </div>
              )}
            </div>
            {query && !loading && (
              <p className="text-sm text-gray-500 mt-1">
                Búsqueda: "{query}" {useColpali && '(incluyendo contenido visual)'}
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
                <div key={index} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                     onClick={() => setSelectedResult(result)}>
                  <div className="flex items-start space-x-4">
                    <FileText className="w-8 h-8 text-gray-400 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
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
                            <div className="flex items-center space-x-1">
                              <Eye className="w-3 h-3 text-purple-600" />
                              <span className="text-xs text-purple-600">Visual</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                        {highlightText(result.content, query)}
                      </p>
                      <div className="mt-2 flex items-center text-xs text-gray-400">
                        <span>Hacer clic para ver detalles</span>
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
                    ? "Intente con diferentes términos o verifique que haya documentos con contenido visual cargados."
                    : "Intente con diferentes términos o active la búsqueda multimodal para incluir contenido visual."
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested Searches */}
      {!hasSearched && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Sugerencias de Búsqueda
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { text: 'Estrategias de implementación de IA', colpali: false },
              { text: 'Gráficos y diagramas técnicos', colpali: true },
              { text: 'Reportes financieros trimestrales', colpali: false },
              { text: 'Imágenes de productos o prototipos', colpali: true },
              { text: 'Documentación técnica de APIs', colpali: false },
              { text: 'Esquemas y arquitecturas visuales', colpali: true },
            ].map((searchItem, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(searchItem.text);
                  setUseColpali(searchItem.colpali);
                  setHasSearched(true);
                  search(searchItem.text, 10, searchItem.colpali);
                }}
                className="block w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <SearchIcon className="w-4 h-4 inline mr-2" />
                    <span>{searchItem.text}</span>
                  </div>
                  {searchItem.colpali && (
                    <div className="flex items-center space-x-1 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-1 py-0.5 rounded">
                      <Image className="w-3 h-3" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detalles del Resultado
              </h3>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Archivo</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedResult.metadata.filename}</p>
                </div>
                
                {selectedResult.metadata.page && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Página</h4>
                    <p className="text-sm text-gray-900 dark:text-white">{selectedResult.metadata.page}</p>
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Relevancia</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{(selectedResult.score * 100).toFixed(1)}%</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contenido</h4>
                  <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                    {highlightText(selectedResult.content, query)}
                  </div>
                </div>
                
                {useColpali && (
                  <div className="flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400">
                    <Image className="w-4 h-4" />
                    <span>Resultado encontrado usando búsqueda multimodal (ColPali)</span>
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
