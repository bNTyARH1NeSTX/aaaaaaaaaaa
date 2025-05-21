'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Container, 
  Heading, 
  VStack, 
  HStack, 
  Text, 
  useToast, 
  Input, 
  FormControl, 
  FormLabel,
  Progress,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  IconButton,
  Badge,
  Flex
} from '@chakra-ui/react';
import { FiFile, FiUpload, FiTrash2, FiFolderPlus, FiFolder } from 'react-icons/fi';
import { documentsApi } from '../../api';
import { Document, Folder } from '../../api/documentsApi';

export default function DocumentsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  
  const toast = useToast();

  // Load initial data
  useEffect(() => {
    loadDocuments();
    loadFolders();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await documentsApi.listDocuments();
      setDocuments(response.data);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Error loading documents',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const loadFolders = async () => {
    try {
      const response = await documentsApi.listFolders();
      setFolders(response.data);
    } catch (error) {
      console.error('Error loading folders:', error);
      toast({
        title: 'Error loading folders',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      if (files.length === 1) {
        await documentsApi.ingestFile(
          files[0],
          {},
          (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        );
      } else {
        await documentsApi.ingestFiles(
          files,
          {},
          (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        );
      }

      setFiles([]);
      loadDocuments();
      
      toast({
        title: 'Subida exitosa',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Error al subir archivos',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: 'Se requiere un nombre para la carpeta',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      await documentsApi.createFolder(newFolderName);
      setNewFolderName('');
      loadFolders();
      
      toast({
        title: 'Folder created',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Failed to create folder',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await documentsApi.deleteDocument(documentId);
      loadDocuments();
      
      toast({
        title: 'Document deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Failed to delete document',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSelectFolder = async (folderId: string) => {
    try {
      const response = await documentsApi.getFolder(folderId);
      setSelectedFolder(response.data);
    } catch (error) {
      console.error('Error loading folder:', error);
      toast({
        title: 'Failed to load folder',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleAddDocumentToFolder = async (documentId: string) => {
    if (!selectedFolder) return;
    
    try {
      await documentsApi.addDocumentToFolder(selectedFolder.id, documentId);
      
      // Refresh folder contents
      const response = await documentsApi.getFolder(selectedFolder.id);
      setSelectedFolder(response.data);
      
      toast({
        title: 'Documento añadido a la carpeta',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding document to folder:', error);
      toast({
        title: 'Error al añadir documento a la carpeta',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Heading as="h1" size="xl">Gestión de Documentos</Heading>
        
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <Heading size="md">Subir Documentos</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Seleccionar archivos PDF o texto</FormLabel>
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.docx,.md"
                  onChange={handleFileChange}
                  disabled={uploading}
                  p={1}
                />
              </FormControl>
              
              {files.length > 0 && (
                <Box>
                  <Text fontWeight="bold" mb={2}>Archivos seleccionados:</Text>
                  {files.map((file, index) => (
                    <Text key={index}><FiFile /> {file.name}</Text>
                  ))}
                </Box>
              )}
              
              {uploading && (
                <Box>
                  <Text mb={2}>Subiendo... {uploadProgress}%</Text>
                  <Progress value={uploadProgress} size="sm" colorScheme="blue" />
                </Box>
              )}
              
              <Button
                leftIcon={<FiUpload />}
                colorScheme="blue"
                onClick={handleUpload}
                isLoading={uploading}
                disabled={files.length === 0}
              >
                Subir
              </Button>
            </VStack>
          </CardBody>
        </Card>
        
        {/* Folders Section */}
        <Card>
          <CardHeader>
            <Heading size="md">Carpetas</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <HStack>
                <Input
                  placeholder="Nombre de la nueva carpeta"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
                <Button
                  leftIcon={<FiFolderPlus />}
                  colorScheme="green"
                  onClick={handleCreateFolder}
                >
                  Crear
                </Button>
              </HStack>
              
              <SimpleGrid columns={[1, 2, 3]} spacing={4}>
                {folders.map((folder) => (
                  <Card 
                    key={folder.id} 
                    variant="outline" 
                    cursor="pointer"
                    _hover={{ shadow: 'md' }}
                    bg={selectedFolder?.id === folder.id ? 'blue.50' : 'white'}
                    onClick={() => handleSelectFolder(folder.id)}
                  >
                    <CardBody>
                      <HStack>
                        <FiFolder size={20} />
                        <Text fontWeight="medium">{folder.name}</Text>
                        <Badge colorScheme="blue" ml="auto">
                          {folder.documents?.length || 0} docs
                        </Badge>
                      </HStack>
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>
            </VStack>
          </CardBody>
        </Card>
        
        {/* Documents Section */}
        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Heading size="md">
                {selectedFolder 
                  ? `Documentos en "${selectedFolder.name}"`
                  : 'Todos los Documentos'}
              </Heading>
              {selectedFolder && (
                <Button 
                  size="sm" 
                  colorScheme="blue" 
                  variant="outline"
                  onClick={() => setSelectedFolder(null)}
                >
                  Volver a Todos
                </Button>
              )}
            </Flex>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={[1, 2, 3]} spacing={4}>
              {(selectedFolder ? selectedFolder.documents : documents).map((doc) => (
                <Card key={doc.id} variant="outline">
                  <CardBody>
                    <VStack align="stretch" spacing={2}>
                      <Flex justify="space-between" align="center">
                        <Heading size="sm" noOfLines={1} title={doc.filename}>
                          {doc.filename}
                        </Heading>
                        <IconButton
                          aria-label="Eliminar documento"
                          icon={<FiTrash2 />}
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id);
                          }}
                        />
                      </Flex>
                      
                      {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold">Metadatos:</Text>
                          {Object.entries(doc.metadata).map(([key, value]) => (
                            <Text key={key} fontSize="xs">
                              <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : value}
                            </Text>
                          ))}
                        </Box>
                      )}
                      
                      {selectedFolder === null && (
                        <Button
                          size="sm"
                          leftIcon={<FiFolder />}
                          isDisabled={!selectedFolder}
                          onClick={() => handleAddDocumentToFolder(doc.id)}
                        >
                          Añadir a Carpeta Seleccionada
                        </Button>
                      )}
                    </VStack>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
            
            {(selectedFolder ? selectedFolder.documents : documents).length === 0 && (
              <Text color="gray.500" textAlign="center" py={4}>
                No se encontraron documentos
              </Text>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
}
