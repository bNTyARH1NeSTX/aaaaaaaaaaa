"use client";

import dynamic from 'next/dynamic';
import React, { useState, useCallback, useEffect, ChangeEvent } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDocuments, useRuleTemplates } from "@/hooks/useApi";
import { FileText, XCircle, CheckCircle, Save, Trash2, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiRuleTemplate } from '@/api/apiService';

// Dynamically import the Upload icon to fix hydration issues
const DynamicUploadIcon = dynamic(() => import('lucide-react').then(mod => mod.Upload), {
  ssr: false,
  loading: () => <div className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
});

interface BatchProgress {
  completedFiles: number;
  totalFiles: number;
  currentFileProgress?: number;
  currentFileName?: string;
}

export default function DocumentsPageClient() {
  const [rulesInput, setRulesInput] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [useColpali, setUseColpali] = useState<boolean>(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [mounted, setMounted] = useState(false);
  
  // Metadata fields
  const [metadata, setMetadata] = useState<{ [key: string]: any }>({});
  const [metadataKey, setMetadataKey] = useState("");
  const [metadataValue, setMetadataValue] = useState("");

  // Local state for single upload
  const [singleUploadProgress, setSingleUploadProgress] = useState(0);
  const [singleUploadError, setSingleUploadError] = useState<string | null>(null);
  const [singleUploadSuccess, setSingleUploadSuccess] = useState(false);

  // Local state for batch upload
  const [currentBatchProgress, setCurrentBatchProgress] = useState<BatchProgress>({ completedFiles: 0, totalFiles: 0 });
  const [currentBatchError, setCurrentBatchError] = useState<string | null>(null);
  const [currentBatchSuccess, setCurrentBatchSuccess] = useState(false);

  const { 
    uploadDocument: hookUploadDocument,
    uploadMultiple: hookUploadMultipleDocuments,
    documents,
    loading: documentsLoading,
    error: documentsError,
    deleteDocument,
    refresh: refreshDocuments,
  } = useDocuments();

  const { 
    templates: ruleTemplates, 
    loading: templatesLoading, 
    error: templatesError,
    refresh: refreshTemplates,
    createTemplate,
    deleteTemplate,
  } = useRuleTemplates();
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const resetSingleUploadState = () => {
    setSingleUploadProgress(0);
    setSingleUploadError(null);
    setSingleUploadSuccess(false);
  };

  const resetBatchUploadState = () => {
    setCurrentBatchProgress({ completedFiles: 0, totalFiles: 0 });
    setCurrentBatchError(null);
    setCurrentBatchSuccess(false);
  };

  // Metadata management functions
  const addMetadataField = () => {
    if (metadataKey.trim() && metadataValue.trim()) {
      setMetadata(prev => ({
        ...prev,
        [metadataKey]: metadataValue
      }));
      setMetadataKey("");
      setMetadataValue("");
    }
  };

  const removeMetadataField = (key: string) => {
    setMetadata(prev => {
      const newMetadata = { ...prev };
      delete newMetadata[key];
      return newMetadata;
    });
  };

  const clearAllMetadata = () => {
    setMetadata({});
  };
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPendingFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
    resetSingleUploadState();
    resetBatchUploadState();
  }, []);

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllPendingFiles = () => {
    setPendingFiles([]);
    resetSingleUploadState();
    resetBatchUploadState();
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    let rulesArray = [];
    try {
      if (rulesInput.trim() !== "") {
        rulesArray = JSON.parse(rulesInput);
      }
    } catch (error) {
      console.error("Invalid JSON in rules input:", error);
      alert("JSON inválido en las reglas. Por favor, corrígelo antes de subir.");
      return;
    }

    resetSingleUploadState();
    resetBatchUploadState();

    if (pendingFiles.length === 1) {
      const file = pendingFiles[0];
      setSingleUploadProgress(1);
      try {
        await hookUploadDocument(file, metadata, rulesArray, useColpali);
        setSingleUploadSuccess(true);
        setSingleUploadProgress(100);
        setPendingFiles([]);
        clearAllMetadata();
      } catch (err: any) {
        setSingleUploadError(err.message || "Error al subir el archivo.");
        setSingleUploadProgress(0);
      }
    } else {
      setCurrentBatchProgress({ totalFiles: pendingFiles.length, completedFiles: 0, currentFileName: pendingFiles[0]?.name, currentFileProgress: 0  });
      try {
        const response = await hookUploadMultipleDocuments(pendingFiles, metadata, rulesArray, useColpali);
        if (response) {
            // successful_ingestions is now the count of documents returned
            const successfulIngestionsCount = response.documents ? response.documents.length : 0;
            // failed_ingestions is now the count of errors returned
            const failedIngestionsCount = response.errors ? response.errors.length : 0;

            setCurrentBatchProgress(prev => ({ 
                ...prev, 
                completedFiles: successfulIngestionsCount, 
                currentFileProgress: 100 // Mark current file as done, overall progress reflects queued files
            }));

            if(failedIngestionsCount > 0) {
                // Construct an error message from response.errors
                const errorDetails = response.errors.map(err => Object.entries(err).map(([fileName, errMsg]) => `${fileName}: ${errMsg}`).join(', ')).join('; ');
                setCurrentBatchError(`${failedIngestionsCount} archivos fallaron al iniciar la subida. Detalles: ${errorDetails}`);
                console.error("Batch upload initiation failures:", response.errors);
            }

            if(successfulIngestionsCount === pendingFiles.length) {
                setCurrentBatchSuccess(true);
                clearAllMetadata();
            } else if (successfulIngestionsCount > 0) {
                // Partial success in queuing
                setCurrentBatchSuccess(false); // Not fully successful, but some were queued.
            }
        } else {
            throw new Error("La subida por lotes no devolvió una respuesta.")
        }
        setPendingFiles([]);
      } catch (err: any) {
        setCurrentBatchError(err.message || "Error al subir el lote de archivos.");
      }
    }
  };

  const handleCancel = () => {
    setPendingFiles([]);
    resetSingleUploadState();
    resetBatchUploadState();
  };
  
  const handleSaveTemplate = async () => {
    if (!newTemplateName || !rulesInput) {
      alert("El nombre de la plantilla y el contenido de las reglas son obligatorios.");
      return;
    }
    try {
      const rulesObject = JSON.parse(rulesInput); 
      await createTemplate(newTemplateName, newTemplateDescription || null, rulesObject);
      setShowSaveTemplateModal(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("Error al guardar la plantilla. Asegúrate de que las reglas sean JSON válido y que el nombre de la plantilla sea único (si aplica).");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta plantilla?")) {
      try {
        await deleteTemplate(templateId);
        const deletedTemplate = ruleTemplates.find(t => t.id === templateId);
        if (deletedTemplate && rulesInput === JSON.stringify(JSON.parse(deletedTemplate.rules_json), null, 2)) {
          setRulesInput(""); 
        }
      } catch (error) {
        console.error("Failed to delete template:", error);
        alert("Error al eliminar la plantilla.");
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

  const isUploading = singleUploadProgress > 0 && singleUploadProgress < 100;
  const isBatchUploading = currentBatchProgress.totalFiles > 0 && currentBatchProgress.completedFiles < currentBatchProgress.totalFiles;
  const isAnyUploadInProgress = isUploading || isBatchUploading;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Subir Documentos</h1>

      {/* Rule Template Selection and Management */}
      <div className="space-y-2">
        <label htmlFor="template-select" className="block text-sm font-medium text-gray-700">
          Seleccionar o Gestionar Plantillas de Reglas
        </label>
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
          <Select
            onValueChange={(value: string) => {
              if (value === "none") {
                setRulesInput("");
              } else {
                const selectedRule = ruleTemplates.find(r => r.id === value);
                if (selectedRule) {
                  try {
                    setRulesInput(JSON.stringify(JSON.parse(selectedRule.rules_json), null, 2));
                  } catch (e) {
                    console.error("Failed to parse rule template JSON", e);
                    setRulesInput("Error: No se pudieron cargar las reglas de la plantilla.");
                  }
                }
              }
            }}
            disabled={templatesLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={templatesLoading ? "Cargando plantillas..." : "Selecciona una plantilla o comienza desde cero"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguna (comenzar desde cero)</SelectItem>
              {templatesLoading && <SelectItem value="loading" disabled>Cargando...</SelectItem>}
              {templatesError && <SelectItem value="error" disabled>Error cargando plantillas</SelectItem>}
              {!templatesLoading && !templatesError && ruleTemplates.map((template: ApiRuleTemplate) => (
                <SelectItem key={template.id} value={template.id} className="flex justify-between items-center">
                  <span>{template.name} {template.description && `(${template.description})`}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowSaveTemplateModal(true)} variant="outline" disabled={!rulesInput.trim() || templatesLoading} className="w-full md:w-auto border-gray-300 hover:bg-gray-50">
            <Save className="mr-2 h-4 w-4" /> Guardar Actual como Plantilla
          </Button>
        </div>
        {templatesError && <p className="text-sm text-red-500">No se pudieron cargar las plantillas: {templatesError}</p>}
        
        {/* List and Delete Templates */}
        {!templatesLoading && !templatesError && ruleTemplates.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-md font-semibold">Plantillas Guardadas:</h3>
            <ul className="border rounded-md divide-y">
              {ruleTemplates.map((template: ApiRuleTemplate) => (
                <li key={template.id} className="p-2 flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{template.name}</span>
                    {template.description && <span className="text-gray-500 ml-2">- {template.description}</span>}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDeleteTemplate(template.id)} 
                    title="Eliminar plantilla"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl space-y-4 w-full max-w-md">
            <h2 className="text-xl font-semibold">Guardar Plantilla de Reglas</h2>
            <div>
              <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Plantilla</label>
              <Input 
                id="templateName" 
                value={newTemplateName} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTemplateName(e.target.value)} 
                placeholder="ej. Extracción de Facturas"
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="templateDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
              <Input 
                id="templateDescription" 
                value={newTemplateDescription} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTemplateDescription(e.target.value)} 
                placeholder="ej. Extrae elementos y totales de facturas"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reglas (JSON)</label>
              <Textarea value={rulesInput} readOnly className="min-h-[100px] bg-gray-100 dark:bg-gray-800 font-mono text-sm" />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="outline" onClick={() => setShowSaveTemplateModal(false)} className="border-gray-300 hover:bg-gray-50">Cancelar</Button>
              <Button onClick={handleSaveTemplate} disabled={!newTemplateName.trim() || !rulesInput.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">Guardar Plantilla</Button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Input */}
      <div className="space-y-2">
        <label htmlFor="rules" className="block text-sm font-medium text-gray-700">
          Reglas (Array JSON, Opcional)
        </label>
        <Textarea
          id="rules"
          placeholder='Ingresa reglas como un array JSON, ej. [{"rule_type": "extraction", ...}]'
          value={rulesInput}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setRulesInput(e.target.value)}
          className="min-h-[150px] font-mono text-sm"
        />
      </div>
      
      {/* Colpali Toggle */}
      <div className="flex items-center space-x-2 py-2">
        <input
          type="checkbox"
          id="useColpali"
          checked={useColpali}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUseColpali(e.target.checked)}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="useColpali" className="text-sm font-medium text-gray-700">
          Usar Modelo de Embedding ColPali
        </label>
      </div>

      {/* Document Metadata Input */}
      <div className="space-y-4 border rounded-lg p-4 bg-gray-50 text-gray-900">
        <h3 className="text-lg font-semibold text-gray-900">Metadatos del Documento</h3>
        
        {/* Add metadata field */}
        <div className="flex space-x-2">
          <div className="flex-1">
            <Input
              placeholder="Clave (ej. autor, categoría, etc.)"
              value={metadataKey}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMetadataKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addMetadataField()}
              className="text-gray-900 placeholder-gray-500"
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Valor"
              value={metadataValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setMetadataValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addMetadataField()}
              className="text-gray-900 placeholder-gray-500"
            />
          </div>
          <Button onClick={addMetadataField} disabled={!metadataKey.trim() || !metadataValue.trim()} className="bg-green-600 hover:bg-green-700 text-white">
            Agregar
          </Button>
        </div>

        {/* Display current metadata */}
        {Object.keys(metadata).length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-gray-900">Metadatos Actuales:</h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllMetadata}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
              >
                Limpiar Todo
              </Button>
            </div>
            <div className="space-y-1">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-white p-2 rounded border">
                  <span className="text-sm text-gray-900">
                    <strong>{key}:</strong> {value}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMetadataField(key)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* File Dropzone */}
      <div className="space-y-4">
        {mounted ? (
          <div {...getRootProps()} className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <DynamicUploadIcon />
              <p className={`mb-2 text-sm ${isDragActive ? "text-green-600 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
                {isDragActive ? "Suelta los archivos aquí..." : <><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</>}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Soporta múltiples archivos</p>
            </div>
            <input {...getInputProps()} className="hidden" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <div className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
              </p>
              <p className="text-xs text-gray-500">Soporta múltiples archivos</p>
            </div>
          </div>
        )}

        {/* Pending Files List */}
        {pendingFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Archivos para subir:</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllPendingFiles}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 hover:border-red-400"
              >
                Limpiar Todo
              </Button>
            </div>
            <ul className="space-y-1">
              {pendingFiles.map((file, index) => (
                <li key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                  <span className="text-sm text-black">{file.name} ({Math.round(file.size / 1024)} KB)</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePendingFile(index)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={isAnyUploadInProgress}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            {Object.keys(metadata).length > 0 && (
              <div className="flex items-center text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded">
                <span>Incluirá {Object.keys(metadata).length} campo{Object.keys(metadata).length !== 1 ? 's' : ''} de metadatos</span>
              </div>
            )}
            <div className="flex space-x-2">
              <Button onClick={handleUpload} disabled={isAnyUploadInProgress || pendingFiles.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isAnyUploadInProgress ? (pendingFiles.length > 1 ? `Subiendo ${currentBatchProgress.completedFiles} de ${currentBatchProgress.totalFiles}...` : "Subiendo...") : (pendingFiles.length > 1 ? `Subir ${pendingFiles.length} Archivos` : "Subir Archivo")}
              </Button>
              <Button onClick={handleCancel} variant="outline" disabled={isAnyUploadInProgress} className="border-gray-300 hover:bg-gray-50">
                Cancelar Subida
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <Progress value={singleUploadProgress} className="w-full" />
          <p className="text-sm text-gray-600">Subiendo: {singleUploadProgress}%</p>
        </div>
      )}
      {isBatchUploading && (
        <div className="space-y-2">
          <Progress value={(currentBatchProgress.completedFiles / currentBatchProgress.totalFiles) * 100} className="w-full" />
           <p className="text-sm text-gray-600">
             Procesados {currentBatchProgress.completedFiles} de {currentBatchProgress.totalFiles} archivos.
             {currentBatchProgress.currentFileName && currentBatchProgress.currentFileProgress !== undefined && currentBatchProgress.currentFileProgress < 100 && 
              ` Actual: ${currentBatchProgress.currentFileName} (${currentBatchProgress.currentFileProgress}%)`}
           </p>
        </div>
      )}

      {singleUploadSuccess && (
        <Alert variant="default" className="bg-green-50 border-green-300 text-green-700">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle>Subida Exitosa</AlertTitle>
          <AlertDescription>Archivo subido exitosamente.</AlertDescription>
        </Alert>
      )}
      {singleUploadError && (
        <Alert variant="destructive">
          <XCircle className="h-5 w-5" />
          <AlertTitle>Error de Subida</AlertTitle>
          <AlertDescription>{singleUploadError}</AlertDescription>
        </Alert>
      )}
       {currentBatchSuccess && (
        <Alert variant="default" className="bg-green-50 border-green-300 text-green-700">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle>Subida por Lotes Completada</AlertTitle>
          <AlertDescription>Los {currentBatchProgress.totalFiles} archivos se procesaron exitosamente.</AlertDescription>
        </Alert>
      )}
      {currentBatchError && (
        <Alert variant="destructive">
          <XCircle className="h-5 w-5" />
          <AlertTitle>Error de Subida por Lotes</AlertTitle>
          <AlertDescription>{currentBatchError}</AlertDescription>
        </Alert>
      )}
      {!currentBatchSuccess && !currentBatchError && currentBatchProgress.totalFiles > 0 && currentBatchProgress.completedFiles > 0 && currentBatchProgress.completedFiles < currentBatchProgress.totalFiles && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertTitle>Subida por Lotes Parcialmente Exitosa</AlertTitle>
            <AlertDescription>
                {currentBatchProgress.completedFiles} de {currentBatchProgress.totalFiles} archivos se subieron exitosamente. Algunos archivos fallaron.
            </AlertDescription>
        </Alert>
      )}

      {/* Uploaded Documents List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Documentos Subidos</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshDocuments}
            disabled={documentsLoading}
            className="border-gray-300 hover:bg-gray-50"
          >
            {documentsLoading ? "Cargando..." : "Actualizar"}
          </Button>
        </div>

        {documentsError && (
          <Alert variant="destructive">
            <XCircle className="h-5 w-5" />
            <AlertTitle>Error Cargando Documentos</AlertTitle>
            <AlertDescription>{documentsError}</AlertDescription>
          </Alert>
        )}

        {documentsLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-sm text-gray-600">Cargando documentos...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p>Aún no se han subido documentos.</p>
            <p className="text-sm">Sube tu primer documento arriba para comenzar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.external_id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium text-gray-900">{doc.filename || 'Nombre no disponible'}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        doc.system_metadata?.status === 'completed' ? 'bg-green-100 text-green-800' :
                        doc.system_metadata?.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        (doc.system_metadata?.status === 'error' || doc.system_metadata?.status === 'failed') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800' // Default for unknown status
                      }`}>
                        {doc.system_metadata?.status === 'completed' ? 'completado' :
                         doc.system_metadata?.status === 'processing' ? 'procesando' :
                         (doc.system_metadata?.status === 'error' || doc.system_metadata?.status === 'failed') ? 'error' :
                         doc.system_metadata?.status || 'desconocido'}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <p>Tamaño: {(() => {
                        let size: number | string | undefined | null = undefined;
                        // Prefer size from storage_files[0].metadata.size if available (hypothetical, adjust if actual path differs)
                        // Or, more reliably, if the backend puts a total size in storage_info or top-level metadata
                        if (doc.storage_info && typeof doc.storage_info.size === 'number') {
                          size = doc.storage_info.size;
                        } else if (doc.metadata && typeof doc.metadata.size === 'number') {
                            size = doc.metadata.size;
                        } else if (doc.storage_files && doc.storage_files.length > 0 && doc.storage_files[0].filename) {
                            // This is a fallback, ideally backend provides total size
                            // For now, if individual file size is not directly available, we can't sum them up easily here.
                            // We'll rely on storage_info.size or metadata.size for the aggregate.
                            // If you have individual file sizes in storage_files[i].size, you could sum them.
                        }
                        
                        if (size !== undefined && size !== null && !isNaN(Number(size))) {
                          return `${Math.round(Number(size) / 1024)} KB`;
                        }
                        return 'N/A KB'; // Ensure KB is always there for consistency
                      })()}</p>
                      <p>Subido: {doc.system_metadata?.created_at ? new Date(doc.system_metadata.created_at).toLocaleString('es-ES') : 'Fecha inválida'}</p>
                      {doc.system_metadata?.updated_at && doc.system_metadata.updated_at !== doc.system_metadata.created_at && (
                        <p>Actualizado: {new Date(doc.system_metadata.updated_at).toLocaleString('es-ES')}</p>
                      )}
                    </div>

                    {/* Display document metadata */}
                    {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Metadatos:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {Object.entries(doc.metadata).map(([key, value]) => (
                            <div key={`${doc.external_id}-metadata-${key}`} className="bg-gray-50 p-2 rounded text-sm">
                              <span className="font-medium text-gray-700">{key}:</span>{' '}
                              <span className="text-gray-600">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (window.confirm(`¿Estás seguro de que quieres eliminar "${doc.filename}"?`)) {
                        try {
                          await deleteDocument(doc.external_id);
                        } catch (error) {
                          console.error('Failed to delete document:', error);
                          alert('Error al eliminar el documento. Por favor, inténtalo de nuevo.');
                        }
                      }
                    }}
                    className="text-red-600 hover:text-red-700 hover:border-red-300 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
