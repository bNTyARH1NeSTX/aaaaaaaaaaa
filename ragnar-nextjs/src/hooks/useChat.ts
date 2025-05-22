'use client';

import { useState, useCallback } from 'react';
import { ingestFile, queryCompletion, queryAgent, ChunkSource, QueryResponse, QueryRequest, Message } from '@/services/api';

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to add or update messages
  const addOrUpdateMessage = useCallback((message: Partial<Message> & { id: string }) => {
    setMessages(prevMessages => {
      const existingMsgIndex = prevMessages.findIndex(m => m.id === message.id);
      if (existingMsgIndex !== -1) {
        const updatedMessages = [...prevMessages];
        updatedMessages[existingMsgIndex] = { ...prevMessages[existingMsgIndex], ...message };
        return updatedMessages;
      }
      return [...prevMessages, message as Message]; // Cast as Message, assuming all required fields are present for new messages
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() && !file) return;

    setIsLoading(true);
    setError(null);

    const userMessageId = `user-${Date.now()}`;
    let userMessageContent = input;
    let userFileInfo: Message['fileInfo'] | undefined = undefined;

    if (file) {
      userFileInfo = { name: file.name, type: file.type, size: file.size };
    }

    addOrUpdateMessage({
      id: userMessageId,
      role: 'user',
      content: userMessageContent,
      fileInfo: userFileInfo,
    });
    
    setInput(''); // Clear input after preparing the message
    const currentFile = file; // Capture file to use in this async function
    setFile(null); // Clear file from state after capturing it

    try {
      let ingestedFileId: string | undefined;
      let fileProcessingInfo: string | undefined;

      // Si hay un archivo, procesarlo primero
      if (currentFile) {
        const fileMessageId = `system-file-${Date.now()}`;
        addOrUpdateMessage({
          id: fileMessageId,
          role: 'system',
          content: `Subiendo ${currentFile.name}...`,
        });

        try {
          // Usar el nuevo método para subir archivos
          const ingestResponse = await ingestFile(
            currentFile, 
            { source: 'chat_upload' } // Metadata básica
          );
          
          if (ingestResponse && ingestResponse.external_id) {
            ingestedFileId = ingestResponse.external_id;
            fileProcessingInfo = `Archivo "${currentFile.name}" procesado. ID: ${ingestedFileId}`;
            
            addOrUpdateMessage({
              id: fileMessageId, // Update the existing system message
              role: 'system',
              content: fileProcessingInfo,
              fileInfo: { name: currentFile.name, type: currentFile.type, size: currentFile.size }
            });
          } else {
            throw new Error('Error al procesar el archivo: No se recibió document_id.');
          }
        } catch (uploadError) {
          const uploadErrorMsg = uploadError instanceof Error ? uploadError.message : 'Error desconocido al subir archivo';
          addOrUpdateMessage({
            id: fileMessageId,
            role: 'system',
            content: `Error al subir el archivo ${currentFile.name}: ${uploadErrorMsg}`,
          });
          setError(uploadErrorMsg);
          setIsLoading(false);
          return;
        }
      }

      const assistantMessageId = `assistant-${Date.now()}`;
      addOrUpdateMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: 'Pensando...',
      });

      // Decidir entre usar queryAgent o queryCompletion según si hay archivos
      let response: QueryResponse | null = null;

      if (input.trim()) {
        if (ingestedFileId) {
          // Si tenemos un ID de documento, podemos incluirlo en los filtros para que el backend lo considere
          const queryPayload: QueryRequest = {
            query: input,
            filters: { document_ids: [ingestedFileId] }
          };
          
          response = await queryCompletion(queryPayload);
        } else {
          // Consulta normal sin filtros específicos
          const queryPayload: QueryRequest = {
            query: input
          };
          
          response = await queryCompletion(queryPayload);
        }
      } else if (currentFile && !input.trim()) {
        // Si solo tenemos archivo pero no pregunta, podemos dar un mensaje informativo
        addOrUpdateMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: fileProcessingInfo 
            ? `${fileProcessingInfo}. ¿Qué te gustaría saber o hacer con este archivo?` 
            : "Archivo procesado. ¿Tienes alguna pregunta sobre él?"
        });
        setIsLoading(false);
        return;
      }

      // Actualizar mensaje del asistente con la respuesta
      if (response) {
        // Convertir los sources al formato esperado por el componente de mensaje
        const formattedSources = response.sources as ChunkSource[];
        
        addOrUpdateMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: response.response || "No se recibió respuesta del backend.",
          sources: formattedSources
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ocurrió un error desconocido';
      setError(errorMessage);
      addOrUpdateMessage({
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${errorMessage}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, input, setInput, file, setFile, isLoading, error, sendMessage, addOrUpdateMessage };
};