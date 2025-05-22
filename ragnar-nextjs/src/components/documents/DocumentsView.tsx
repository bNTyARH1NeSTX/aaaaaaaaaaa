"use client";

import React, { useEffect, useState } from 'react';
import { listDocuments, deleteDocumentById, Document } from '@/services/api';
import { FileText, Trash2, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const docs = await listDocuments(100);  // Obtener hasta 100 documentos
      setDocuments(docs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar documentos';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDeleteDocument = async (documentId: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este documento?')) {
      try {
        await deleteDocumentById(documentId);
        // Actualizar la lista de documentos después de eliminar
        setDocuments(documents.filter(doc => doc.external_id !== documentId));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al eliminar el documento';
        setError(errorMessage);
      }
    }
  };

  const filteredDocuments = documents.filter(doc => {
    // Buscar en el nombre del archivo
    const filename = doc.filename?.toLowerCase() || '';
    // Buscar en el tipo de contenido
    const contentType = doc.content_type.toLowerCase();
    // Buscar en los metadatos
    const metadataString = JSON.stringify(doc.metadata).toLowerCase();
    
    const search = searchTerm.toLowerCase();
    
    return filename.includes(search) || 
           contentType.includes(search) || 
           metadataString.includes(search);
  });

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Documentos</h1>
        <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center">
          <span className="mr-2">Volver al chat</span>
          <ExternalLink size={16} />
        </Link>
      </div>
      
      <div className="mb-6 relative">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No hay documentos</h3>
          <p className="text-gray-500">
            {searchTerm ? 'No se encontraron documentos que coincidan con tu búsqueda.' : 'Aún no has subido ningún documento.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDocuments.map((doc) => (
                <tr key={doc.external_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText size={20} className="text-gray-500 mr-3" />
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        <Link href={`/documents/${doc.external_id}`} className="hover:text-blue-600">
                          {doc.filename || `Documento-${doc.external_id.substring(0, 8)}`}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{doc.content_type}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatStatus(doc.system_metadata.status || 'unknown')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatDate(doc.system_metadata.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteDocument(doc.external_id)}
                      className="text-red-600 hover:text-red-900 ml-4"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DocumentsView;
