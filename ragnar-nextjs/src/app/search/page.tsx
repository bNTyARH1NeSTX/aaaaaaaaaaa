"use client";

import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, FileText, Clock, Loader2, AlertCircle, Eye, Image, X } from 'lucide-react';
import { useSearch } from '../../hooks/useApi';

export default function SearchPage() {
  const { results, loading, error, search, clearResults } = useSearch();
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [useColpali, setUseColpali] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Fix hydration issue by ensuring component is mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Log selectedResult when modal opens for debugging
  useEffect(() => {
    if (selectedResult) {
      console.log("Selected Result for Modal:", selectedResult);
    }
  }, [selectedResult]);

  // Prevent hydration mismatch by not rendering loading-dependent content on server
  if (!mounted) {
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
        {/* Show minimal UI during SSR */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
          </div>
        </div>
      </div>
    );
  }

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

  // Utility function to detect if content is base64 image data
  const isBase64Image = (content: string) => {
    if (!content || typeof content !== 'string') return false;
    const trimmedContent = content.trim();
    
    // Check if it's already a data URL
    if (trimmedContent.startsWith('data:image/')) return true;
    
    // For ColPali results, check if content is very long base64 string (likely image)
    if (trimmedContent.length > 1000 && /^[A-Za-z0-9+/]*={0,2}$/.test(trimmedContent)) {
      return true;
    }
    
    // Check if it looks like base64 image data (common patterns)
    const base64ImagePatterns = [
      /^\/9j\//, // JPEG
      /^iVBORw0KGgo/, // PNG  
      /^R0lGOD/, // GIF
      /^UklGRg/, // WebP
      /^Qk0/, // BMP
    ];
    
    return base64ImagePatterns.some(pattern => pattern.test(trimmedContent.substring(0, 20)));
  };

  // Get proper image source for base64 content
  const getImageSrc = (content: string, contentType?: string) => {
    if (!content || typeof content !== 'string') return '';
    
    const trimmedContent = content.trim();

    // If it's already a complete data URL, return it
    if (trimmedContent.startsWith('data:')) return trimmedContent;
    
    // Determine MIME type
    let mimeType = 'image/jpeg'; // Default to jpeg for ColPali
    
    if (contentType && contentType.startsWith('image/')) {
      mimeType = contentType;
    } else if (trimmedContent.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (trimmedContent.startsWith('iVBORw0KGgo')) {
      mimeType = 'image/png';
    } else if (trimmedContent.startsWith('R0lGOD')) {
      mimeType = 'image/gif';
    }
    
    // Return properly formatted data URI
    return `data:${mimeType};base64,${trimmedContent}`;
  };

  // Enhanced image error handler
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, content: string) => {
    console.error('Image load error:', e);
    console.log('Content preview:', content.substring(0, 100) + '...');
    
    const target = e.currentTarget;
    target.style.display = 'none';
    
    // Create fallback element
    const parent = target.parentElement;
    if (parent) {
      parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-700 rounded"><span class="text-xs">Imagen no disponible</span></div>';
    }
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
              )
              }
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
              results.map((result, index) => {
                const isImageContent = result.metadata.is_image || isBase64Image(result.content);
                
                return (
                <div key={index} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                     onClick={() => setSelectedResult(result)}>
                  <div className="flex items-start space-x-4">
                    {isImageContent ? (
                      <div className="w-16 h-16 flex-shrink-0 mt-1 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        <img 
                          src={getImageSrc(result.content, result.metadata.content_type)}
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('Error loading image preview:', e);
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 0V7c0-1.1-.9-2-2-2s-2 .9-2 2v1c0 .55-.45 1-1 1s-1-.45-1-1V7c0-2.21 1.79-4 4-4s4 1.79 4 4zM9.5 8C10.33 8 11 7.33 11 6.5S10.33 5 9.5 5 8 5.67 8 6.5 8.67 8 9.5 8zM19 13c0-.55-.45-1-1-1s-1 .45-1 1-.45 1-1 1-1-.45-1-1 .45-1 1-1 1 .45 1 1zm-3 7H8c-1.1 0-2-.9-2-2v-5l2-2 3 3 2-2 3 3v5z"/></svg></div>';
                          }}
                        />
                      </div>
                    ) : (
                      <FileText className="w-8 h-8 text-gray-400 flex-shrink-0 mt-1" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {result.metadata.filename || 'Sin nombre'}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            Relevancia: {((result.score ?? 0) * 100).toFixed(1)}%
                          </span>
                          {result.metadata.page && (
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              Página {result.metadata.page}
                            </span>
                          )}
                          {isImageContent && (
                            <div className="flex items-center space-x-1">
                              <Image className="w-3 h-3 text-purple-600" />
                              <span className="text-xs text-purple-600">Imagen</span>
                            </div>
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
                        {isImageContent ? (
                          <span className="italic text-gray-500">Contenido visual - haz clic para ver detalles</span>
                        ) : (
                          highlightText(result.content, query)
                        )}
                      </p>
                      <div className="mt-2 flex items-center text-xs text-gray-400">
                        <span>Hacer clic para ver detalles</span>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Archivo</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedResult.metadata.filename || selectedResult.filename || 'Sin nombre'}</p>
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
                
                {/* Show image if content contains base64 image data */}
                {(selectedResult.metadata.is_image || isBase64Image(selectedResult.content)) && selectedResult.content && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Imagen</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <img 
                        src={getImageSrc(selectedResult.content, selectedResult.metadata.content_type)}
                        alt="Contenido visual del documento"
                        className="max-w-full h-auto rounded-lg shadow-sm"
                        onError={(e) => {
                          console.error('Error loading image in modal:', e);
                          e.currentTarget.style.display = 'none';
                          // Show error message
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'text-red-500 text-sm italic p-4 text-center';
                          errorDiv.textContent = 'Error al cargar la imagen. Es posible que el formato no sea compatible.';
                          e.currentTarget.parentElement!.appendChild(errorDiv);
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contenido</h4>
                  <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-4 rounded-lg max-h-96 overflow-y-auto">
                    {(selectedResult.metadata.is_image || isBase64Image(selectedResult.content)) ? (
                      <div className="space-y-2">
                        <p className="text-gray-500 italic">Este es un chunk que contiene contenido visual. La imagen se muestra arriba.</p>
                        {selectedResult.metadata.content_type && (
                          <p className="text-xs text-gray-400">Tipo de contenido: {selectedResult.metadata.content_type}</p>
                        )}
                        {selectedResult.content && selectedResult.content.length > 50 && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-gray-500 text-xs hover:text-gray-700">
                              Ver datos base64 (primeros 100 caracteres)
                            </summary>
                            <pre className="text-xs text-gray-400 mt-1 break-all">
                              {selectedResult.content.substring(0, 100)}...
                            </pre>
                          </details>
                        )}
                      </div>
                    ) : (
                      highlightText(selectedResult.content, query)
                    )}
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