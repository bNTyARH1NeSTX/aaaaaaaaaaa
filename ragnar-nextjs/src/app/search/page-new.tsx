'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  VStack,
  Textarea,
  Spinner,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Flex,
  HStack,
  useToast,
  Select,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Divider,
  Code,
  IconButton,
  SimpleGrid,
  Progress,
  useColorModeValue
} from '@chakra-ui/react';
import { FiSearch, FiFile, FiFilter, FiSettings, FiUpload, FiDownload, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { queryApi, documentsApi } from '../../api';
import { ChunkResult } from '../../api/documentsApi';
import { CompletionResponse } from '../../api/queryApi';

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [chunks, setChunks] = useState<ChunkResult[]>([]);
  const [completionAnswer, setCompletionAnswer] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isQueryingLLM, setIsQueryingLLM] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Advanced search options
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [topK, setTopK] = useState(5);
  const [rerank, setRerank] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  
  const toast = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadFile = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      await documentsApi.ingestFile(
        file,
        {},
        (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        }
      );
      
      toast({
        title: 'File uploaded successfully',
        description: 'Your file has been processed and indexed',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      setFile(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: 'There was an error uploading your file',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Query required',
        description: 'Please enter a search query',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSearching(true);
    setChunks([]);

    try {
      const results = await documentsApi.retrieveChunks({
        query: searchQuery,
        top_k: topK,
        rerank: rerank,
        include_metadata: includeMetadata,
      });
      
      setChunks(results);
      
      if (results.length === 0) {
        toast({
          title: 'No results found',
          description: 'Try modifying your search query or uploading relevant documents',
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast({
        title: 'Search failed',
        description: 'There was an error processing your search',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleQueryCompletion = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Query required',
        description: 'Please enter a question',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsQueryingLLM(true);
    setCompletionAnswer('');

    try {
      const response = await queryApi.queryCompletion({
        query: searchQuery,
        top_k: topK,
        include_sources: true,
        filter_metadata: {},
      });
      
      setCompletionAnswer(response.answer);
      
      // If there are sources, update the chunks
      if (response.sources && response.sources.length > 0) {
        setChunks(response.sources);
      }
    } catch (error) {
      console.error('Error querying completion:', error);
      toast({
        title: 'Query failed',
        description: 'There was an error generating a response',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsQueryingLLM(false);
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Vector Search & Embeddings
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Search through your documents using semantic similarity with pgvector
          </Text>
        </Box>
        
        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <Heading size="md">Upload Documents</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Select PDF or Text Files</FormLabel>
                <Input
                  type="file"
                  accept=".pdf,.txt,.docx,.md"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  p={1}
                />
              </FormControl>
              
              {file && (
                <Text>
                  <FiFile style={{ display: 'inline', marginRight: '8px' }} />
                  {file.name}
                </Text>
              )}
              
              {isUploading && (
                <Box>
                  <Text mb={2}>Uploading... {uploadProgress}%</Text>
                  <Progress value={uploadProgress} size="sm" colorScheme="blue" />
                </Box>
              )}
              
              <Button
                leftIcon={<FiUpload />}
                colorScheme="blue"
                onClick={handleUploadFile}
                isLoading={isUploading}
                loadingText="Uploading..."
                disabled={!file || isUploading}
              >
                Upload Document
              </Button>
            </VStack>
          </CardBody>
        </Card>
        
        {/* Search Section */}
        <Card>
          <CardHeader>
            <Heading size="md">Search</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Enter your search query or question</FormLabel>
                <Textarea
                  placeholder="E.g., 'How do I implement pgvector in PostgreSQL?' or 'Tell me about embeddings for semantic search'"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="md"
                  rows={3}
                />
              </FormControl>
              
              {/* Advanced Search Options */}
              <Box>
                <Button
                  rightIcon={showAdvancedOptions ? <FiChevronUp /> : <FiChevronDown />}
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                >
                  Advanced Options
                </Button>
                
                {showAdvancedOptions && (
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mt={4} p={4} bg="gray.50" borderRadius="md">
                    <FormControl>
                      <FormLabel fontSize="sm">Top K Results</FormLabel>
                      <NumberInput
                        min={1}
                        max={50}
                        value={topK}
                        onChange={(valueStr) => setTopK(parseInt(valueStr))}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="rerank" mb="0" fontSize="sm">
                        Rerank Results
                      </FormLabel>
                      <Switch
                        id="rerank"
                        isChecked={rerank}
                        onChange={() => setRerank(!rerank)}
                      />
                    </FormControl>
                    
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="include-metadata" mb="0" fontSize="sm">
                        Include Metadata
                      </FormLabel>
                      <Switch
                        id="include-metadata"
                        isChecked={includeMetadata}
                        onChange={() => setIncludeMetadata(!includeMetadata)}
                      />
                    </FormControl>
                  </SimpleGrid>
                )}
              </Box>
              
              <HStack spacing={4}>
                <Button
                  leftIcon={<FiSearch />}
                  colorScheme="blue"
                  onClick={handleSearch}
                  isLoading={isSearching}
                  loadingText="Searching..."
                  disabled={!searchQuery || isSearching}
                  flex="1"
                >
                  Search Documents
                </Button>
                
                <Button
                  leftIcon={<FiSearch />}
                  colorScheme="teal"
                  onClick={handleQueryCompletion}
                  isLoading={isQueryingLLM}
                  loadingText="Generating..."
                  disabled={!searchQuery || isQueryingLLM}
                  flex="1"
                >
                  Ask Question
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
        
        {/* LLM Response */}
        {completionAnswer && (
          <Card>
            <CardHeader>
              <Heading size="md">Answer</Heading>
            </CardHeader>
            <CardBody>
              <Text whiteSpace="pre-line">{completionAnswer}</Text>
            </CardBody>
          </Card>
        )}
        
        {/* Search Results */}
        {chunks.length > 0 && (
          <Card>
            <CardHeader>
              <Heading size="md">Search Results</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                {chunks.map((chunk, index) => (
                  <Card key={chunk.id} variant="outline">
                    <CardBody>
                      <HStack mb={2} justify="space-between">
                        <Badge colorScheme="blue">
                          Score: {Math.round(chunk.score * 100)}%
                        </Badge>
                        <Badge colorScheme="gray">
                          Document ID: {chunk.document_id.substring(0, 8)}...
                        </Badge>
                      </HStack>
                      
                      <Text>{chunk.text}</Text>
                      
                      {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                        <Accordion allowToggle mt={2}>
                          <AccordionItem border="none">
                            <AccordionButton px={0}>
                              <Text fontSize="sm" fontWeight="bold">Metadata</Text>
                              <AccordionIcon />
                            </AccordionButton>
                            <AccordionPanel pb={4} bg="gray.50" borderRadius="md">
                              <SimpleGrid columns={2} spacing={2}>
                                {Object.entries(chunk.metadata).map(([key, value]) => (
                                  <Box key={key}>
                                    <Text fontSize="xs" fontWeight="bold">{key}:</Text>
                                    <Text fontSize="xs">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </Text>
                                  </Box>
                                ))}
                              </SimpleGrid>
                            </AccordionPanel>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>
    </Container>
  );
}
