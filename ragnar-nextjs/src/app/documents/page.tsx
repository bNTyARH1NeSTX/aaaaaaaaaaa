"use client";

import React, { useState, useEffect } from 'react';
import { FileText, Upload, Search, Download, Eye, Trash2, AlertCircle, Loader2, CheckCircle, XCircle, Info } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useDocuments } from '../../hooks/useApi';
import * as api from '../../api/apiService'; // Import api service

export default function DocumentsPage() {
  const { documents, loading, error, uploadDocument, deleteDocument, refresh } = useDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const [useColpali, setUseColpali] = useState<boolean>(false);
  const [metadataInput, setMetadataInput] = useState<string>('');
  const [rulesInput, setRulesInput] = useState<string>('');
  const [showMetadataModal, setShowMetadataModal] = useState<string | null>(null); // Stores doc.id or null
  
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Clear any previous errors/messages
    setUploadError(null);
    setUploadSuccessMessage(null);
    
    // Set pending files
    setPendingFiles(prevFiles => [...prevFiles, ...acceptedFiles]); // Append new files
  };

  const handleDirectUpload = async () => { // Renamed from handleUploadConfirmation
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    let parsedMetadata = {};
    try {
      parsedMetadata = metadataInput ? JSON.parse(metadataInput) : {};
    } catch (e) {
      setUploadError('Error: El JSON de Metadatos no es válido.');
      setIsUploading(false);
      setPendingFiles([]);
      return;
    }

    let parsedRules: any[] = []; // Initialize with an empty array
    if (rulesInput.trim()) { // Only attempt to parse if rulesInput is not empty or just whitespace
      try {
        const tempRules = JSON.parse(rulesInput);
        if (!Array.isArray(tempRules)) {
          setUploadError('Error: El JSON de Rules debe ser un Array (por ejemplo, [{"type": "metadata_extraction", ...}]).');
          setIsUploading(false);
          setPendingFiles([]);
          return;
        }
        parsedRules = tempRules;
      } catch (e) {
        setUploadError('Error: El JSON de Rules no es válido. Asegúrese de que sea un array JSON bien formado.');
        setIsUploading(false);
        setPendingFiles([]);
        return;
      }
    }
    // If rulesInput was empty or whitespace, parsedRules remains []
    
    try {
      if (pendingFiles.length === 1) {
        const newDoc = await uploadDocument(pendingFiles[0], parsedMetadata, parsedRules, useColpali);
        if (newDoc) {
          setUploadSuccessMessage(`Documento "${newDoc.filename}" subido con éxito.`);
        } else {
          setUploadError('Error subiendo el archivo. No se recibió confirmación.');
        }
      } else if (pendingFiles.length > 1) {
        const response = await api.uploadMultipleDocuments(
          pendingFiles, 
          parsedMetadata, 
          parsedRules, 
          useColpali, 
          true, 
          selectedFolderName || undefined
        );
        if (response) {
          let successMsg = `${response.successful_ingestions} de ${response.total_files} archivos subidos con éxito.`;
          if (response.failed_ingestions > 0) {
            successMsg += ` ${response.failed_ingestions} fallaron.`;
            console.warn('Archivos fallidos:', response.failed_files);
          }
          setUploadSuccessMessage(successMsg);
          if (response.failed_ingestions > 0 && response.successful_ingestions === 0) {
             setUploadError(`Todos los ${response.failed_ingestions} archivos fallaron al subirse.`);
             setUploadSuccessMessage(null); 
          }
        } else {
          setUploadError('Error subiendo los archivos. No se recibió respuesta del servidor.');
        }
      }
      setSelectedFolderName(''); 
      setUseColpali(false); 
      setMetadataInput('');
      setRulesInput('');
      await refresh(); // Correctly call refresh from useDocuments
    } catch (err: any) {
      setUploadError(err.message || 'Error subiendo archivos. Por favor, intente de nuevo.');
      console.error('Error uploading files:', err);
    } finally {
      setIsUploading(false);
      setPendingFiles([]);
    }
  };

  const handleCancelUpload = () => {
    setPendingFiles([]);
    setUploadError(null);
    setUploadSuccessMessage(null);
    // Optionally reset other inputs like folderName, metadataInput etc. if desired
    // setSelectedFolderName('');
    // setMetadataInput('');
    // setRulesInput('');
    // setUseColpali(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB por archivo
    disabled: isUploading, // MODIFIED: Only disable if an upload is actively in progress
  });

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteDocument = async (docId: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este documento?')) {
      try {
        await deleteDocument(docId);
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'processing':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'processing':
        return 'Procesando';
      case 'error':
        return 'Error';
      default:
        return 'Desconocido';
    }
  };

  useEffect(() => {
    console.log("Cliente: doc", documents);
  }, [documents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 key="documents-page-title" className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          Gestión de Documentos
        </h1>
        <p key="documents-page-subtitle" className="text-gray-600 dark:text-gray-400 mt-1">
          Cargue, busque y administre sus documentos y fuentes de conocimiento.
        </p>
      </div>

      {/* Upload Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div 
            {...getRootProps()} 
            className={`flex-grow w-full p-8 border-2 border-dashed rounded-lg cursor-pointer 
              ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 
                pendingFiles.length > 0 ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
              transition-colors duration-200 ease-in-out text-center`}
          >
            <input {...getInputProps()} /> {/* Removed disabled prop, handled by useDropzone's disabled state */}
            <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            {pendingFiles.length > 0 ? (
              <div>
                <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                  {pendingFiles.length} {pendingFiles.length === 1 ? 'archivo listo' : 'archivos listos'} para subir.
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                  Puede agregar más archivos o usar los botones de abajo para continuar.
                </p>
              </div>
            ) : isDragActive ? (
              <p className="text-blue-600 dark:text-blue-400">Suelte los archivos aquí...</p>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                Arrastre y suelte archivos aquí, o haga clic para seleccionar (Máx. 50MB por archivo)
              </p>
            )}
            {isUploading && (
              <div className="mt-4 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                <span className="text-blue-600 dark:text-blue-400">Subiendo archivos... No cierre esta ventana.</span>
              </div>
            )}
            {uploadError && !isUploading && ( // Show uploadError only if not currently uploading
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
            {uploadSuccessMessage && !isUploading && ( // Show success message only if not currently uploading
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-md text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{uploadSuccessMessage}</span>
              </div>
            )}
            {error && !uploadError && !isUploading && ( 
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                <Info className="w-5 h-5 flex-shrink-0" />
                <span>Error del sistema: {error}. Intente refrescar la página.</span>
              </div>
            )}
          </div>
          <div className="w-full md:w-72 space-y-3 pt-2 md:pt-0"> 
            <div>
              <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Carpeta de Destino (Opcional)
              </label>
              <input 
                type="text" 
                id="folderName"
                value={selectedFolderName}
                onChange={(e) => setSelectedFolderName(e.target.value)}
                placeholder="Ej: Reportes Q1"
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="metadataInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Metadatos (JSON, Opcional)
              </label>
              <textarea 
                id="metadataInput"
                value={metadataInput}
                onChange={(e) => setMetadataInput(e.target.value)}
                placeholder={'Ej: { "clave": "valor", "proyecto": "Ragnar" }'}
                rows={3}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="rulesInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rules (JSON Array, Opcional)
              </label>
              <textarea 
                id="rulesInput"
                value={rulesInput}
                onChange={(e) => setRulesInput(e.target.value)}
                placeholder={'Ej: [ { "type": "metadata_extraction", "schema": {...} } ]'}
                rows={3}
                disabled={isUploading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="useColpali"
                checked={useColpali}
                onChange={(e) => setUseColpali(e.target.checked)}
                disabled={isUploading}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
              />
              <label htmlFor="useColpali" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Usar COLPALI (si aplica)
              </label>
            </div>
          </div>
        </div>
        {/* Fixed Buttons for Upload and Cancel */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
          {pendingFiles.length > 0 && !isUploading && (
            <button
              onClick={handleCancelUpload}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto"
            >
              Cancelar ({pendingFiles.length})
            </button>
          )}
          <button
            onClick={handleDirectUpload}
            disabled={pendingFiles.length === 0 || isUploading}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Subir {pendingFiles.length === 0 ? 'archivo(s)' : pendingFiles.length === 1 ? '1 archivo' : `${pendingFiles.length} archivos`}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar documentos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Documents List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Documentos ({filteredDocuments.length})
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="px-6 py-4 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gray-300 rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))
          ) : filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-center space-x-4">
                  <FileText className="w-8 h-8 text-gray-400" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{doc.filename}</h3>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.size)} • {formatDate(doc.created_at)}
                    </p>
                    {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                      <button 
                        onClick={() => setShowMetadataModal(doc.id)}
                        className="mt-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Ver Metadatos
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(doc.status)}`}>
                    {getStatusText(doc.status)}
                  </span>
                  
                  {doc.status === 'completed' && (
                    <div className="flex space-x-2">
                      <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-green-600 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No se encontraron documentos que coincidan con su búsqueda.' : 'Aún no se han subido documentos.'}
              </p>
              {!searchQuery && (
                <p className="text-sm text-gray-400 mt-2">
                  Comience subiendo algunos archivos usando el área de arrastrar y soltar arriba.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para ver Metadatos */}
      {showMetadataModal && documents.find(doc => doc.id === showMetadataModal)?.metadata && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Metadatos de: {documents.find(doc => doc.id === showMetadataModal)?.filename}
              </h3>
              <button 
                onClick={() => setShowMetadataModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
              {JSON.stringify(documents.find(doc => doc.id === showMetadataModal)?.metadata, null, 2)}
            </pre>
            {documents.find(doc => doc.id === showMetadataModal)?.rules && (
              <>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mt-4 mb-2">Rules Aplicadas:</h4>
                <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                  {JSON.stringify(documents.find(doc => doc.id === showMetadataModal)?.rules, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
