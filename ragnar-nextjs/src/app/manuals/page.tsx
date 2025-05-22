'use client';

import React, { useState } from 'react';
import { FileText, Upload, BookOpen, Loader2 } from 'lucide-react';

export default function ManualsGenerationPage() {
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [generatedManualUrl, setGeneratedManualUrl] = useState<string | null>(null);
  
  // Plantillas predefinidas para la generación de manuales
  const templates = [
    {
      id: 'technical',
      name: 'Manual Técnico',
      description: 'Documentación detallada para ingenieros y desarrolladores.',
      icon: <FileText className="h-10 w-10 text-blue-600" />
    },
    {
      id: 'user',
      name: 'Manual de Usuario',
      description: 'Guía amigable con instrucciones paso a paso para usuarios finales.',
      icon: <BookOpen className="h-10 w-10 text-green-600" />
    },
    {
      id: 'quickstart',
      name: 'Guía Rápida',
      description: 'Instrucciones concisas para comenzar a utilizar el producto rápidamente.',
      icon: <FileText className="h-10 w-10 text-purple-600" />
    }
  ];
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate || selectedFiles.length === 0) {
      alert('Por favor, seleccione una plantilla y al menos un archivo.');
      return;
    }
    
    setLoading(true);
    
    // Simular generación de manual (en una implementación real, esto enviaría los archivos al backend)
    setTimeout(() => {
      setGeneratedManualUrl('/sample-manual.pdf');
      setLoading(false);
    }, 3000);
  };
  
  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent animate-slide-up">
          Generador de Manuales
        </h1>
        <p className="mt-2 text-gray-600 animate-fade-in">
          Crea manuales profesionales automáticamente a partir de tus documentos utilizando IA.
        </p>
      </div>

      {!generatedManualUrl ? (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 animate-slide-up hover-lift">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {templates.map((template) => (
              <div 
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`
                  relative p-6 rounded-xl cursor-pointer transition-all duration-300 animate-fade-in hover-scale
                  border-2 ${selectedTemplate === template.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-blue-300 bg-white'}
                `}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full">
                    {template.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{template.name}</h3>
                  <p className="text-gray-600 text-sm">{template.description}</p>
                </div>
                {selectedTemplate === template.id && (
                  <div className="absolute top-3 right-3">
                    <div className="h-4 w-4 bg-blue-500 rounded-full"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gradient-to-br from-gray-50 to-white">
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Upload className="h-12 w-12 text-gray-400 animate-bounce" />
                </div>
                <h3 className="text-lg font-medium">Sube tus documentos</h3>
                <p className="text-gray-500 text-sm">
                  Arrastra y suelta archivos o haz clic para seleccionar
                </p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  Seleccionar archivos
                </label>
              </div>
            </div>
            
            {selectedFiles.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Archivos seleccionados ({selectedFiles.length})</h4>
                <ul className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <li key={index} className="flex items-center p-2 bg-white rounded-md shadow-sm">
                      <FileText className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="ml-auto text-xs text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex justify-center pt-4">
              <button
                type="submit"
                disabled={!selectedTemplate || selectedFiles.length === 0 || loading}
                className={`
                  px-6 py-3 rounded-lg text-white font-medium
                  transition-all duration-300 shadow-md hover:shadow-lg
                  ${loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}
                `}
              >
                {loading ? (
                  <div className="flex items-center">
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    <span>Generando manual...</span>
                  </div>
                ) : (
                  <span>Generar Manual</span>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center animate-fade-in">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-green-100 text-green-600 mb-4">
              <BookOpen className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Manual generado con éxito!</h2>
            <p className="text-gray-600">Tu manual está listo para descargar o compartir.</p>
          </div>
          
          <div className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
            <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600 mr-3" />
                <div className="text-left">
                  <h3 className="font-medium">Manual_Generado.pdf</h3>
                  <p className="text-sm text-gray-500">1.2 MB • Generado el {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <a
                href={generatedManualUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Descargar
              </a>
            </div>
          </div>
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setGeneratedManualUrl(null);
                setSelectedTemplate(null);
                setSelectedFiles([]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Crear otro manual
            </button>
          </div>
        </div>
      )}
      
      <div className="mt-8 bg-gradient-to-r from-blue-100 to-indigo-100 p-6 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">¿Cómo funciona?</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-lg shadow-sm hover-lift">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-blue-600 font-semibold">1</span>
            </div>
            <h3 className="font-medium mb-2">Selecciona una plantilla</h3>
            <p className="text-gray-600 text-sm">Elige el tipo de manual que deseas generar según tus necesidades.</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm hover-lift">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-blue-600 font-semibold">2</span>
            </div>
            <h3 className="font-medium mb-2">Sube tus documentos</h3>
            <p className="text-gray-600 text-sm">Agrega los archivos que contienen la información para el manual.</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm hover-lift">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-blue-600 font-semibold">3</span>
            </div>
            <h3 className="font-medium mb-2">Genera y descarga</h3>
            <p className="text-gray-600 text-sm">La IA procesa tus documentos y crea un manual profesional listo para usar.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
