"use client";

import React, { useState } from 'react';
import { BookOpen, Wand2, FileSearch, CheckCircle, AlertCircle, Loader2, Image, FileText } from 'lucide-react';
import { generateManual, ManualGenerationRequest, ManualGenerationResponse } from '../../api/apiService';

export default function ManualsPage() {
  const [formData, setFormData] = useState<ManualGenerationRequest>({
    query: '',
    k_images: 3,
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedManual, setGeneratedManual] = useState<ManualGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'k_images') {
      setFormData((prev: ManualGenerationRequest) => ({ ...prev, [name]: parseInt(value) || 3 }));
    } else {
      setFormData((prev: ManualGenerationRequest) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.query.trim()) {
      setError('Por favor, proporcione una consulta para generar el manual');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedManual(null);

    try {
      const result = await generateManual(formData);
      setGeneratedManual(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el manual');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setFormData({
      query: '',
      k_images: 3,
    });
    setGeneratedManual(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-blue-600" />
          Generación de Manuales Ragnar
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Genere manuales completos y detallados utilizando IA avanzada con análisis de imágenes ColPali
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-blue-600" />
            Configuración del Manual
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="query" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Consulta para el Manual *
              </label>
              <textarea
                id="query"
                name="query"
                value={formData.query}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Ejemplo: Cómo configurar un nuevo usuario en el sistema ERP, Proceso de facturación paso a paso, Configuración de inventario..."
                disabled={isGenerating}
              />
            </div>

            <div>
              <label htmlFor="k_images" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Número de Imágenes Relevantes
              </label>
              <select
                id="k_images"
                name="k_images"
                value={formData.k_images}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isGenerating}
              >
                <option value={1}>1 imagen</option>
                <option value={2}>2 imágenes</option>
                <option value={3}>3 imágenes</option>
                <option value={4}>4 imágenes</option>
                <option value={5}>5 imágenes</option>
              </select>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Imagen Específica (Opcional)
              </label>
              <div className="space-y-3">
                <div>
                  <label htmlFor="image_path" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Ruta de la Imagen
                  </label>
                  <input
                    type="text"
                    id="image_path"
                    name="image_path"
                    value={formData.image_path || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Ej: /path/to/specific/image.jpg"
                    disabled={isGenerating}
                  />
                </div>
                <div>
                  <label htmlFor="image_prompt" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Descripción de la Imagen
                  </label>
                  <input
                    type="text"
                    id="image_prompt"
                    name="image_prompt"
                    value={formData.image_prompt || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    placeholder="Descripción del contenido de la imagen..."
                    disabled={isGenerating}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isGenerating || !formData.query.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Generar Manual
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={isGenerating}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-green-600" />
            Resultados de la Generación
          </h2>
          
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {generatedManual && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  ¡Manual generado exitosamente!
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2">Manual Generado</h3>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {generatedManual.generated_text}
                    </pre>
                  </div>
                </div>
                
                {generatedManual.relevant_images_used.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                      Imágenes Utilizadas ({generatedManual.relevant_images_used.length})
                    </h3>
                    <div className="space-y-2">
                      {generatedManual.relevant_images_used.map((image: any, index: number) => (
                        <div key={index} className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start gap-2">
                            <Image className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                                {image.image_path}
                              </p>
                              {image.prompt && (
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                  <span className="font-medium">Descripción:</span> {image.prompt}
                                </p>
                              )}
                              {image.respuesta && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <span className="font-medium">Respuesta:</span> {image.respuesta}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Consulta original:</span> {generatedManual.query}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!error && !generatedManual && !isGenerating && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                Complete el formulario y haga clic en &quot;Generar Manual&quot; para crear su documento
              </p>
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">
                Generando su manual... Esto puede tardar algunos minutos.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                La IA está analizando imágenes relevantes y creando contenido personalizado
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
