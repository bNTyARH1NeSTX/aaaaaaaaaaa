"use client";

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Image as ImageIcon, Download, FileText, ZoomIn, X } from 'lucide-react';

interface ManualRendererProps {
  markdownContent: string;
  imageData?: { [key: string]: string }; // Base64 images by path
  title?: string;
  onDownloadPowerPoint?: () => void;
}

interface ImageModalProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ src, alt, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="relative max-w-4xl max-h-full">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <X className="w-8 h-8" />
        </button>
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>
    </div>
  );
};

const ManualRenderer: React.FC<ManualRendererProps> = ({ 
  markdownContent, 
  imageData = {}, 
  title = "Manual de Usuario",
  onDownloadPowerPoint 
}) => {
  const [processedContent, setProcessedContent] = useState<string>('');
  const [imageModal, setImageModal] = useState<{ src: string; alt: string; isOpen: boolean }>({
    src: '',
    alt: '',
    isOpen: false
  });

  useEffect(() => {
    // Process the markdown content to replace IMAGE_PATH references with actual images
    let processed = markdownContent;

    // Find all IMAGE_PATH references
    const imagePathRegex = /!\[([^\]]*)\]\(IMAGE_PATH:([^)]+)\)/g;
    let match;

    while ((match = imagePathRegex.exec(markdownContent)) !== null) {
      const [fullMatch, altText, imagePath] = match;
      
      // Check if we have base64 data for this image
      if (imageData[imagePath]) {
        // Replace with actual image data
        const imageTag = `![${altText}](data:image/png;base64,${imageData[imagePath]})`;
        processed = processed.replace(fullMatch, imageTag);
      } else {
        // Replace with placeholder or keep original path
        const placeholderTag = `![${altText}](#${imagePath})`;
        processed = processed.replace(fullMatch, placeholderTag);
      }
    }

    setProcessedContent(processed);
  }, [markdownContent, imageData]);

  const handleImageClick = (src: string, alt: string) => {
    setImageModal({ src, alt, isOpen: true });
  };

  const customComponents = {
    // Paragraph component that handles nested elements properly
    p: ({ children, ...props }: any) => {
      // Check if the paragraph contains only an image
      const hasOnlyImage = React.Children.count(children) === 1 && 
        React.Children.toArray(children).every(child => 
          React.isValidElement(child) && (child.type === 'img' || 
          (typeof child === 'object' && child && 'type' in child && child.type === customComponents.img))
        );
      
      if (hasOnlyImage) {
        // Don't wrap single images in paragraphs
        return <>{children}</>;
      }
      
      return (
        <p className="my-3 text-gray-700 dark:text-gray-300 leading-relaxed" {...props}>
          {children}
        </p>
      );
    },
    img: ({ src, alt, ...props }: any) => {
      const isPlaceholder = src?.startsWith('#');
      
      if (isPlaceholder) {
        const imagePath = src.substring(1);
        return (
          <div className="not-prose my-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <ImageIcon className="w-8 h-8" />
              <div className="text-center">
                <div className="font-medium">{alt || 'Imagen del ERP'}</div>
                <div className="text-sm">Ruta: {imagePath}</div>
                <div className="text-xs">Imagen no disponible</div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="not-prose my-6 relative group">
          <img
            src={src}
            alt={alt}
            className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleImageClick(src, alt || 'Imagen del manual')}
            {...props}
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
            <ZoomIn className="w-8 h-8 text-white" />
          </div>
          {alt && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">
              {alt}
            </div>
          )}
        </div>
      );
    },
    h1: ({ children, ...props }: any) => (
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mt-6 mb-3" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-xl font-medium text-gray-700 dark:text-gray-200 mt-4 mb-2" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="text-lg font-medium text-gray-700 dark:text-gray-200 mt-3 mb-2" {...props}>
        {children}
      </h4>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc list-inside space-y-1 my-4 text-gray-700 dark:text-gray-300" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal list-inside space-y-1 my-4 text-gray-700 dark:text-gray-300" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="ml-4" {...props}>
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 my-4 italic text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 py-2 rounded-r" {...props}>
        {children}
      </blockquote>
    ),
    code: ({ children, className, ...props }: any) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200" {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className="block bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-sm font-mono text-gray-800 dark:text-gray-200 overflow-x-auto" {...props}>
          {children}
        </code>
      );
    },
    table: ({ children, ...props }: any) => (
      <div className="not-prose overflow-x-auto my-4">
        <table className="min-w-full border border-gray-300 dark:border-gray-600" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }: any) => (
      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-700 font-semibold text-left" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2" {...props}>
        {children}
      </td>
    ),
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          {onDownloadPowerPoint && (
            <button
              onClick={onDownloadPowerPoint}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar PowerPoint
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="prose prose-lg max-w-none dark:prose-invert prose-img:my-0 prose-p:my-3">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={customComponents}
            skipHtml={false}
            unwrapDisallowed={true}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        src={imageModal.src}
        alt={imageModal.alt}
        isOpen={imageModal.isOpen}
        onClose={() => setImageModal({ src: '', alt: '', isOpen: false })}
      />
    </div>
  );
};

export default ManualRenderer;
