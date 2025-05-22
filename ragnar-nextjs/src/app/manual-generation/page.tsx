'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, Upload, MessagesSquare, BookOpen, CheckCircle } from 'lucide-react';

export default function ManualGenerationPage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-12 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
          Generación de Manuales Paso a Paso
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Transforme imágenes técnicas, documentos PDF y contenido visual en manuales detallados con nuestra tecnología de IA.
        </p>
      </div>

      {/* Proceso de generación */}
      <div className="mb-16">
        <h2 className="text-2xl font-semibold mb-8 text-center text-gray-800">Cómo Funciona</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-medium mb-3 text-gray-800">1. Suba sus Archivos</h3>
            <p className="text-gray-600">
              Suba imágenes técnicas, diagramas, planos, PDFs o cualquier contenido visual que requiera documentación.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <MessagesSquare className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-medium mb-3 text-gray-800">2. Interactúe con la IA</h3>
            <p className="text-gray-600">
              Converse con nuestro asistente inteligente para especificar el tipo de manual que necesita y el nivel de detalle.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-medium mb-3 text-gray-800">3. Reciba su Manual</h3>
            <p className="text-gray-600">
              Obtenga un manual estructurado y detallado que puede exportar, compartir o continuar refinando según sus necesidades.
            </p>
          </div>
        </div>
      </div>

      {/* Ejemplo de casos de uso */}
      <div className="mb-16">
        <h2 className="text-2xl font-semibold mb-8 text-center text-gray-800">Casos de Uso</h2>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
            <div className="flex items-start">
              <CheckCircle className="text-blue-600 mt-1 mr-3 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Manuales de Mantenimiento</h3>
                <p className="text-gray-600">Transforme diagramas técnicos e imágenes de equipos en guías de mantenimiento detalladas.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
            <div className="flex items-start">
              <CheckCircle className="text-blue-600 mt-1 mr-3 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Instrucciones de Montaje</h3>
                <p className="text-gray-600">Convierta planos y esquemas en instrucciones de ensamblaje claras paso a paso.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
            <div className="flex items-start">
              <CheckCircle className="text-blue-600 mt-1 mr-3 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Documentación Técnica</h3>
                <p className="text-gray-600">Genere documentos técnicos detallados a partir de información visual y diagramas complejos.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
            <div className="flex items-start">
              <CheckCircle className="text-blue-600 mt-1 mr-3 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Manuales de Usuario</h3>
                <p className="text-gray-600">Cree guías de usuario amigables a partir de capturas de pantalla e interfaces de productos.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Llamada a la acción */}
      <div className="bg-blue-600 text-white p-8 rounded-xl text-center">
        <h2 className="text-2xl font-bold mb-4">¿Listo para comenzar?</h2>
        <p className="text-lg mb-6 opacity-90">
          Pruebe nuestra tecnología de generación de manuales y automatice su documentación técnica.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            href="/chat" 
            className="bg-white text-blue-600 hover:bg-blue-50 font-semibold py-3 px-6 rounded-lg transition-all inline-flex items-center justify-center"
          >
            Crear un Manual <ArrowRight size={18} className="ml-2" />
          </Link>
          <Link 
            href="/documents" 
            className="bg-blue-700 text-white hover:bg-blue-800 font-semibold py-3 px-6 rounded-lg transition-all inline-flex items-center justify-center"
          >
            Ver Ejemplos <FileText size={18} className="ml-2" />
          </Link>
        </div>
      </div>
    </div>
  );
}
