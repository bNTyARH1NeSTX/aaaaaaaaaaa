"use client";

import React, { useState } from 'react';
import { BookOpen, Wand2, FileSearch, CheckCircle, AlertCircle, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { generateManual, generatePowerPoint, ManualGenerationRequest, ManualGenerationResponse, PowerPointGenerationRequest } from '../../api/apiService';
import ManualRenderer from '../../components/ManualRenderer';

export default function ManualsPage() {
  const [formData, setFormData] = useState<ManualGenerationRequest>({
    query: '',
    k_images: 3, // Valor por defecto, oculto al usuario
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedManual, setGeneratedManual] = useState<ManualGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: ManualGenerationRequest) => ({ ...prev, [name]: value }));
  };

  const handleGenerateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.query.trim()) {
      setError('Por favor, proporcione una consulta para generar el manual');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedManual(null);

    try {
      // Generar el manual
      const result = await generateManual(formData);
      setGeneratedManual(result);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el manual');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePowerPoint = async () => {
    if (!generatedManual) return;

    try {
      setIsGenerating(true);
      
      const powerPointRequest: PowerPointGenerationRequest = {
        query: formData.query,
        k_images: formData.k_images,
      };

      const blob = await generatePowerPoint(powerPointRequest);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `manual_${formData.query.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar PowerPoint');
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
          Genere manuales completos y detallados utilizando IA avanzada. El sistema selecciona automáticamente las imágenes más relevantes del ERP usando ColPali
        </p>
      </div>

      <div className="space-y-6">
        {/* Manual renderizado con imágenes */}
        {generatedManual && (
          <ManualRenderer
            markdownContent={generatedManual.generated_text}
            imageData={generatedManual.images_base64 || {}}
            title={`Manual: ${generatedManual.query}`}
            onDownloadPowerPoint={handleGeneratePowerPoint}
          />
        )}

        {/* Formulario y resultados básicos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-blue-600" />
            Generación Automática de Manuales
          </h2>
          
          <form onSubmit={handleGenerateManual} className="space-y-4">
            <div>
              <label htmlFor="query" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción del Manual *
              </label>
              <textarea
                id="query"
                name="query"
                value={formData.query}
                onChange={handleInputChange}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none text-lg"
                placeholder="Ejemplo: 
• Cómo configurar un nuevo usuario en el sistema ERP
• Proceso de facturación paso a paso 
• Configuración de inventario
• Registro de nuevas impresoras
• Gestión de productos en catálogo..."
                disabled={isGenerating}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                💡 El sistema automáticamente encontrará y utilizará las imágenes más relevantes del ERP para crear su manual
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isGenerating || !formData.query.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-md transition-colors flex items-center justify-center gap-2 text-lg font-medium"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generando Manual...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Generar Manual
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleReset}
                disabled={isGenerating}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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

                {/* Imágenes utilizadas */}
                {generatedManual.relevant_images_used && generatedManual.relevant_images_used.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Imágenes Seleccionadas Automáticamente ({generatedManual.relevant_images_used.length})
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <div className="space-y-2">
                        {generatedManual.relevant_images_used.map((img, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-600 rounded border">
                            <ImageIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {img.image_path || `Imagen ${index + 1}`}
                              </p>
                              {img.prompt && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {img.prompt}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Estas imágenes fueron seleccionadas automáticamente por ColPali basándose en su relevancia con la consulta
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!error && !generatedManual && !isGenerating && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-center">
                Escriba la descripción de su manual y el sistema automáticamente:
              </p>
              <ul className="text-sm text-gray-400 dark:text-gray-500 mt-2 text-left max-w-sm mx-auto">
                <li className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Buscará imágenes relevantes usando ColPali
                </li>
                <li className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Generará contenido con IA especializada
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  Creará un manual completo y profesional
                </li>
              </ul>
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">
                Generando su manual y PowerPoint... Esto puede tardar algunos minutos.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                La IA está seleccionando automáticamente las imágenes más relevantes del ERP y generando contenido personalizado
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
