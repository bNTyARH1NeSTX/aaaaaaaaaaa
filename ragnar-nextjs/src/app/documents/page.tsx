"use client";

import React, { useState } from 'react';
import { FileText, Upload, Search, Download, Eye, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface Document {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  status: 'processing' | 'ready' | 'error';
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: '1',
      name: 'Research Report Q4 2024.pdf',
      size: 2048576,
      type: 'application/pdf',
      uploadedAt: new Date('2024-12-15'),
      status: 'ready',
    },
    {
      id: '2',
      name: 'Product Specifications.docx',
      size: 1024768,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadedAt: new Date('2024-12-14'),
      status: 'ready',
    },
    {
      id: '3',
      name: 'Training Manual.pdf',
      size: 3145728,
      type: 'application/pdf',
      uploadedAt: new Date('2024-12-13'),
      status: 'processing',
    },
  ]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = async (acceptedFiles: File[]) => {
    setIsUploading(true);
    
    // Simulate upload process
    for (const file of acceptedFiles) {
      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        status: 'processing',
      };
      
      setDocuments(prev => [...prev, newDoc]);
      
      // Simulate processing time
      setTimeout(() => {
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === newDoc.id 
              ? { ...doc, status: 'ready' as const }
              : doc
          )
        );
      }, 2000);
    }
    
    setIsUploading(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    multiple: true,
  });

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'ready':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Ready</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Processing</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Error</span>;
    }
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          Document Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload, organize, and manage your documents for AI processing
        </p>
      </div>

      {/* Upload Area */}
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        {isDragActive ? (
          <p className="text-blue-600 dark:text-blue-400">Drop the files here...</p>
        ) : (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Drag & drop files here, or click to select files
            </p>
            <p className="text-sm text-gray-500">
              Supports PDF, DOC, DOCX, and TXT files
            </p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Documents List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Documents ({filteredDocuments.length})
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex items-center space-x-4">
                <FileText className="w-8 h-8 text-gray-400" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">{doc.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(doc.size)} • {doc.uploadedAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {getStatusBadge(doc.status)}
                
                {doc.status === 'ready' && (
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
                  onClick={() => deleteDocument(doc.id)}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          
          {filteredDocuments.length === 0 && (
            <div className="px-6 py-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No documents match your search.' : 'No documents uploaded yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
