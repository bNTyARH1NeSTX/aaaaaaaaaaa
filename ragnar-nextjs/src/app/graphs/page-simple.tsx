'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { listDocuments, Document } from '@/services/documents';

export default function GraphsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const docs = await listDocuments(10, 0);
      setDocuments(docs);
    } catch (err) {
      console.error('Error loading documents:', err);
      setError('Error al cargar documentos. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Grafos de Conocimiento</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-6 text-center">
          <div className="text-xl font-medium mb-2">Construcción de Grafos de Conocimiento</div>
          <p className="text-gray-600 mb-4">
            Esta funcionalidad está en desarrollo. Próximamente podrá visualizar y analizar conexiones entre documentos y entidades mediante grafos de conocimiento interactivos.
          </p>
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 mb-4">
            <p className="font-medium">Beneficios de los Grafos de Conocimiento:</p>
            <ul className="list-disc pl-5 mt-2 text-left">
              <li>Visualización de relaciones entre conceptos</li>
              <li>Descubrimiento de conexiones no evidentes</li>
              <li>Navegación contextual entre documentos relacionados</li>
              <li>Exploración de jerarquías y agrupaciones temáticas</li>
            </ul>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-medium mb-4 text-gray-700">Documentos Disponibles</h2>
          
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-600">{error}</div>
          ) : documents.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents.map(doc => (
                <div key={doc.external_id} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="flex items-start">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium">{doc.filename || "Documento sin nombre"}</div>
                      <div className="text-sm text-gray-500">{doc.content_type}</div>
                      <div className="mt-2 text-xs">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">ID: {doc.external_id.substring(0, 8)}...</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No hay documentos disponibles para generar grafos.</p>
              <Link href="/documents" className="mt-3 inline-block text-blue-600 hover:underline">
                Ir a la sección de documentos
              </Link>
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Estamos trabajando en la implementación de esta funcionalidad. Próximamente podrá visualizar relaciones entre sus documentos y generar grafos de conocimiento interactivos.
          </p>
        </div>
      </div>
    </div>
  );
}
