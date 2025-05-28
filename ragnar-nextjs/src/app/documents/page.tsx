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
import { ApiRuleTemplate } from '@/api/apiService'; // Import ApiRuleTemplate type

// Dynamically import the Upload icon to potentially fix hydration issues
const DynamicUploadIcon = dynamic(() => import('lucide-react').then(mod => mod.Upload), {
  ssr: false,
  loading: () => <div className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" /> // Placeholder
});

// Removed hardcoded predefinedRules as they will be fetched from the API

interface BatchProgress {
  completedFiles: number;
  totalFiles: number;
  currentFileProgress?: number;
  currentFileName?: string;
}

export default function DocumentsPage() {
  const [rulesInput, setRulesInput] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [useColpali, setUseColpali] = useState<boolean>(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");

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
    // error: documentsHookError, // General error from the hook, can be used if needed
  } = useDocuments();

  const { 
    templates: ruleTemplates, 
    loading: templatesLoading, 
    error: templatesError, // This is a string
    refresh: refreshTemplates,
    createTemplate,
    deleteTemplate,
  } = useRuleTemplates();
  
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
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPendingFiles(prevFiles => [...prevFiles, ...acceptedFiles]);
    resetSingleUploadState();
    resetBatchUploadState();
  }, []);

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;
    let rulesArray = [];
    try {
      if (rulesInput.trim() !== "") {
        rulesArray = JSON.parse(rulesInput);
      }
    } catch (error) {
      console.error("Invalid JSON in rules input:", error);
      alert("Invalid JSON in rules input. Please correct it before uploading.");
      return;
    }

    resetSingleUploadState();
    resetBatchUploadState();

    if (pendingFiles.length === 1) {
      const file = pendingFiles[0];
      setSingleUploadProgress(1); // Indicate start
      try {
        await hookUploadDocument(file, {}, rulesArray, useColpali);
        setSingleUploadSuccess(true);
        setSingleUploadProgress(100);
        setPendingFiles([]); // Clear files after successful upload
      } catch (err: any) {
        setSingleUploadError(err.message || "Failed to upload file.");
        setSingleUploadProgress(0);
      }
    } else {
      setCurrentBatchProgress({ totalFiles: pendingFiles.length, completedFiles: 0, currentFileName: pendingFiles[0]?.name, currentFileProgress: 0  });
      try {
        // Note: hookUploadMultipleDocuments from useApi.ts doesn't currently support per-file progress reporting to the UI.
        // The progress here will be more coarse (e.g. start/finish or based on final response).
        // For a simple simulation, we can update completed files based on response.
        const response = await hookUploadMultipleDocuments(pendingFiles, {}, rulesArray, useColpali);
        if (response) {
            setCurrentBatchProgress(prev => ({ 
                ...prev, 
                completedFiles: response.successful_ingestions, 
                currentFileProgress: 100 // Mark as done for summary
            }));
            if(response.failed_ingestions > 0) {
                setCurrentBatchError(`${response.failed_ingestions} files failed to upload. Check console for details.`);
                // Log detailed errors if available in response and desired
                console.error("Batch upload failures:", response.failed_files);
            }
            if(response.successful_ingestions === pendingFiles.length) {
                setCurrentBatchSuccess(true);
            } else if (response.successful_ingestions > 0) {
                // Partial success, error message already set for failures
                setCurrentBatchSuccess(false); // Or a specific state for partial success
            }
        } else {
            throw new Error("Batch upload did not return a response.")
        }
        setPendingFiles([]); // Clear files after successful/attempted upload
      } catch (err: any) {
        setCurrentBatchError(err.message || "Failed to upload batch of files.");
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
      alert("Template name and rules content are required.");
      return;
    }
    try {
      const rulesObject = JSON.parse(rulesInput); 
      await createTemplate(newTemplateName, newTemplateDescription || null, rulesObject);
      setShowSaveTemplateModal(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      // refreshTemplates(); // Already handled by the hook
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("Failed to save template. Make sure rules are valid JSON and the template name is unique (if applicable).");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        await deleteTemplate(templateId);
        const deletedTemplate = ruleTemplates.find(t => t.id === templateId);
        if (deletedTemplate && rulesInput === JSON.stringify(JSON.parse(deletedTemplate.rules_json), null, 2)) {
          setRulesInput(""); 
        }
        // refreshTemplates(); // Already handled by the hook
      } catch (error) {
        console.error("Failed to delete template:", error);
        alert("Failed to delete template.");
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

  const isUploading = singleUploadProgress > 0 && singleUploadProgress < 100;
  const isBatchUploading = currentBatchProgress.totalFiles > 0 && currentBatchProgress.completedFiles < currentBatchProgress.totalFiles;
  const isAnyUploadInProgress = isUploading || isBatchUploading;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">Upload Documents</h1>

      {/* Rule Template Selection and Management */}
      <div className="space-y-2">
        <label htmlFor="template-select" className="block text-sm font-medium text-gray-700">
          Select or Manage Rule Templates
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
                    setRulesInput("Error: Could not load template rules.");
                  }
                }
              }
            }}
            disabled={templatesLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={templatesLoading ? "Loading templates..." : "Select a template or start fresh"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (start fresh)</SelectItem>
              {templatesLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
              {templatesError && <SelectItem value="error" disabled>Error loading templates</SelectItem>}
              {!templatesLoading && !templatesError && ruleTemplates.map((template: ApiRuleTemplate) => (
                <SelectItem key={template.id} value={template.id} className="flex justify-between items-center">
                  <span>{template.name} {template.description && `(${template.description})`}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowSaveTemplateModal(true)} variant="outline" disabled={!rulesInput.trim() || templatesLoading} className="w-full md:w-auto">
            <Save className="mr-2 h-4 w-4" /> Save Current as Template
          </Button>
        </div>
        {templatesError && <p className="text-sm text-red-500">Could not load templates: {templatesError}</p>}
        
        {/* List and Delete Templates - Optional UI */}
        {!templatesLoading && !templatesError && ruleTemplates.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-md font-semibold">Saved Templates:</h3>
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
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
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
            <h2 className="text-xl font-semibold">Save Rule Template</h2>
            <div>
              <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <Input 
                id="templateName" 
                value={newTemplateName} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTemplateName(e.target.value)} 
                placeholder="e.g., Invoice Extraction"
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="templateDescription" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <Input 
                id="templateDescription" 
                value={newTemplateDescription} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTemplateDescription(e.target.value)} 
                placeholder="e.g., Extracts items and totals from invoices"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rules (JSON)</label>
              <Textarea value={rulesInput} readOnly className="min-h-[100px] bg-gray-100 dark:bg-gray-800 font-mono text-sm" />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="outline" onClick={() => setShowSaveTemplateModal(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={!newTemplateName.trim() || !rulesInput.trim()}>Save Template</Button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Input */}
      <div className="space-y-2">
        <label htmlFor="rules" className="block text-sm font-medium text-gray-700">
          Rules (JSON Array, Optional)
        </label>
        <Textarea
          id="rules"
          placeholder='Enter rules as a JSON array, e.g., [{"rule_type": "extraction", ...}]'
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
          Use ColPali Embedding Model
        </label>
      </div>

      {/* File Dropzone */}
      <div className="space-y-4">
        <div {...getRootProps()} className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <DynamicUploadIcon /> {/* Removed className as it's handled by the dynamic import's loading component style */}
            <p className={`mb-2 text-sm ${isDragActive ? "text-green-600 font-semibold" : "text-gray-500 dark:text-gray-400"}`}>
              {isDragActive ? "Drop the files here ..." : <><span className="font-semibold">Click to upload</span> or drag and drop</>}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Supports multiple files</p>
          </div>
          <input {...getInputProps()} className="hidden" />
        </div>

        {/* Pending Files List */}
        {pendingFiles.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Files to upload:</h3>
            <ul className="list-disc pl-5 space-y-1">
              {pendingFiles.map((file, index) => (
                <li key={index} className="text-sm flex items-center justify-between">
                  <span><FileText className="inline mr-2 h-4 w-4" />{file.name} ({Math.round(file.size / 1024)} KB)</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upload Controls */}
        {(pendingFiles.length > 0 || isAnyUploadInProgress) && (
          <div className="flex space-x-2">
            <Button onClick={handleUpload} disabled={isAnyUploadInProgress || pendingFiles.length === 0}>
              {isAnyUploadInProgress ? (pendingFiles.length > 1 ? `Uploading ${currentBatchProgress.completedFiles} of ${currentBatchProgress.totalFiles}...` : "Uploading...") : (pendingFiles.length > 1 ? `Upload ${pendingFiles.length} Files` : "Upload File")}
            </Button>
            <Button onClick={handleCancel} variant="outline" disabled={isAnyUploadInProgress}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Upload Progress and Status */}
      {isUploading && (
        <div className="space-y-2">
          <Progress value={singleUploadProgress} className="w-full" />
          <p className="text-sm text-gray-600">Uploading: {singleUploadProgress}%</p>
        </div>
      )}
      {isBatchUploading && (
         <div className="space-y-2">
           <Progress value={(currentBatchProgress.totalFiles > 0 ? (currentBatchProgress.completedFiles / currentBatchProgress.totalFiles) * 100 : 0)} className="w-full" />
           <p className="text-sm text-gray-600">
             Processed {currentBatchProgress.completedFiles} of {currentBatchProgress.totalFiles} files.
             {currentBatchProgress.currentFileName && currentBatchProgress.currentFileProgress !== undefined && currentBatchProgress.currentFileProgress < 100 && 
              ` Current: ${currentBatchProgress.currentFileName} (${currentBatchProgress.currentFileProgress}%)`}
           </p>
         </div>
      )}

      {singleUploadSuccess && (
        <Alert variant="default" className="bg-green-50 border-green-300 text-green-700">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle>Upload Successful</AlertTitle>
          <AlertDescription>File uploaded successfully.</AlertDescription>
        </Alert>
      )}
      {singleUploadError && (
        <Alert variant="destructive">
          <XCircle className="h-5 w-5" />
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>{singleUploadError}</AlertDescription>
        </Alert>
      )}
       {currentBatchSuccess && (
        <Alert variant="default" className="bg-green-50 border-green-300 text-green-700">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle>Batch Upload Complete</AlertTitle>
          <AlertDescription>All {currentBatchProgress.totalFiles} files processed successfully.</AlertDescription>
        </Alert>
      )}
      {currentBatchError && (
        <Alert variant="destructive">
          <XCircle className="h-5 w-5" />
          <AlertTitle>Batch Upload Error</AlertTitle>
          <AlertDescription>{currentBatchError}</AlertDescription>
        </Alert>
      )}
      {/* Display this if some files succeeded and some failed in batch */}
      {!currentBatchSuccess && !currentBatchError && currentBatchProgress.totalFiles > 0 && currentBatchProgress.completedFiles > 0 && currentBatchProgress.completedFiles < currentBatchProgress.totalFiles && (
        <Alert variant="default" className="bg-yellow-50 border-yellow-300 text-yellow-700">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <AlertTitle>Batch Upload Partially Successful</AlertTitle>
            <AlertDescription>
                {currentBatchProgress.completedFiles} of {currentBatchProgress.totalFiles} files uploaded successfully. Some files failed.
            </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
