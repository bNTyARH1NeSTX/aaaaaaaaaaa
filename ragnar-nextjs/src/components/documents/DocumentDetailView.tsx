"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDocumentById, retrieveChunks, Document, ChunkResult } from '@/services/api';
import { FileText, ArrowLeft, Clock, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface DocumentDetailViewProps {
  documentId: string;
}

const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({ documentId }) => {
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<ChunkResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Obtener información del documento
        const doc = await getDocumentById(documentId);
        setDocument(doc);
        
        // Obtener chunks del documento si está disponible
        if (doc && doc.system_metadata?.status === 'completed') {
          try {
            // Usamos una consulta vacía para obtener chunks del documento
            const docChunks = await retrieveChunks(
              "", // Consulta vacía para obtener todos los chunks
              { document_ids: [documentId] }, // Filtrar por ID de documento
              10, // Obtener hasta 10 chunks
              0.0, // Sin umbral de similitud
              false, // Sin reranking
              false // Sin ColPali
            );
            setChunks(docChunks);
          } catch (chunksError) {
            console.error("Error al cargar chunks:", chunksError);
            // No fallar si no podemos cargar chunks, solo mostrar el documento
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar el documento';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (documentId) {
      fetchDocumentDetails();
    }
  }, [documentId]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Fecha desconocida';
    return new Date(dateString).toLocaleString('es');
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'processing':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Procesando</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Completado</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Error</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <button onClick={() => router.back()} className="flex items-center text-blue-600 mb-6">
          <ArrowLeft size={16} className="mr-1" />
          Volver
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <button onClick={() => router.back()} className="flex items-center text-blue-600 mb-6">
          <ArrowLeft size={16} className="mr-1" />
          Volver
        </button>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
          No se encontró el documento.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <button onClick={() => router.back()} className="flex items-center text-blue-600 mb-6">
        <ArrowLeft size={16} className="mr-1" />
        Volver a Documentos
      </button>
      
      <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start">
              <FileText size={36} className="text-blue-500 mr-4" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {document.filename || `Documento-${document.external_id.substring(0, 8)}`}
                </h1>
                <div className="flex items-center text-sm text-gray-500">
                  <span className="mr-2">ID: {document.external_id}</span>
                  <span className="mx-2">•</span>
                  <span>{document.content_type}</span>
                </div>
              </div>
            </div>
            <div>
              {formatStatus(document.system_metadata?.status || 'unknown')}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="border border-gray-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">Información</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <CalendarClock size={16} className="text-gray-500 mr-2" />
                  <span className="text-gray-600">Creado:</span>
                  <span className="ml-2">{formatDate(document.system_metadata?.created_at)}</span>
                </div>
                <div className="flex items-center">
                  <Clock size={16} className="text-gray-500 mr-2" />
                  <span className="text-gray-600">Actualizado:</span>
                  <span className="ml-2">{formatDate(document.system_metadata?.updated_at)}</span>
                </div>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">Metadatos</h2>
              {Object.keys(document.metadata).length > 0 ? (
                <div className="space-y-2 text-sm">
                  {Object.entries(document.metadata).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-2">
                      <span className="text-gray-600 font-medium">{key}:</span>
                      <span className="col-span-2">{JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay metadatos disponibles</p>
              )}
            </div>
          </div>

          {document.system_metadata?.status === 'completed' && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-800">Contenido</h2>
              {chunks.length > 0 ? (
                <div className="space-y-4">
                  {chunks.map((chunk, index) => (
                    <div key={`${chunk.document_id}-${chunk.chunk_number}`} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="text-xs text-gray-500 mb-1">Fragmento #{chunk.chunk_number}</div>
                      <div className="text-sm whitespace-pre-wrap">{chunk.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay contenido disponible para mostrar</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailView;
