import useState from 'react';
import useEffect from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Input,
  Button,
  VStack,
  HStack,
  SimpleGrid,
  Card,
  CardBody,
  Stack,
  Divider,
  CardFooter,
  FormControl,
  FormLabel,
  useColorModeValue,
  Icon,
  Badge,
  useToast,
  Select,
  Flex,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import FaSearch from 'react-icons/fa';
import FaFilePdf from 'react-icons/fa';
import FaBook from 'react-icons/fa';
import FaFileAlt from 'react-icons/fa';
import { manualApi, SearchResult } from '../api/manualApi';

// Interface for our local state
interface ManualOption {
  id: string;
  title: string;
  description?: string;
}

export default function ManualSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManual, setSelectedManual] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [manuals, setManuals] = useState<ManualOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingManuals, setIsLoadingManuals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiSources, setAiSources] = useState<SearchResult[]>([]);
  const toast = useToast();

  // Load available manuals on component mount
  useEffect(() => {
    const fetchManuals = async () => {
      setIsLoadingManuals(true);
      setError(null);
      
      try {
        const manualsData = await manualApi.listManuals();
        setManuals(manualsData);
      } catch (err) {
        console.error('Error fetching manuals:', err);
        setError('Failed to load available manuals. Please try again later.');
        toast({
          title: 'Error',
          description: 'Failed to load available manuals.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoadingManuals(false);
      }
    };

    fetchManuals();
  }, [toast]);
  
  // Function to handle search submission
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Please enter a search term',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAiAnswer(null);
    setAiSources([]);
    
    try {
      const results = await manualApi.search({
        query: searchQuery,
        manual_id: selectedManual || undefined,
        include_sources: true,
      });
      
      setSearchResults(results);
      
      if (results.length === 0) {
        toast({
          title: 'No results found',
          description: 'Try broadening your search terms',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (err) {
      console.error('Error searching manuals:', err);
      setError('An error occurred while searching. Please try again later.');
      toast({
        title: 'Search Error',
        description: 'Failed to perform search. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to handle asking a question
  const handleAskQuestion = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: 'Empty Question',
        description: 'Please enter a question',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsAskingQuestion(true);
    setError(null);
    setAiAnswer(null);
    setAiSources([]);
    setSearchResults([]);
    
    try {
      const { answer, sources } = await manualApi.askQuestion({
        query: searchQuery,
        manual_id: selectedManual || undefined,
        include_sources: true,
      });
      
      setAiAnswer(answer);
      setAiSources(sources);
    } catch (err) {
      console.error('Error asking question:', err);
      setError('An error occurred while processing your question. Please try again later.');
      toast({
        title: 'Question Error',
        description: 'Failed to process your question. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsAskingQuestion(false);
    }
  };
  
  // Function to get icon based on content type
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <Icon as={FaFilePdf} color="red.500" />;
      case 'manual':
        return <Icon as={FaBook} color="blue.500" />;
      default:
        return <Icon as={FaFileAlt} color="gray.500" />;
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Manual Search
          </Heading>
          <Text color="gray.600">
            Search through BNext ERP manuals with precise and intelligent retrieval
          </Text>
        </Box>
        
        {/* Search Controls */}
        <Box
          bg={useColorModeValue('white', 'gray.800')}
          boxShadow="base"
          borderRadius="lg"
          p={6}
        >
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>Search Query</FormLabel>
              <Input
                placeholder="E.g., 'How to configure invoice approval workflow'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="lg"
              />
            </FormControl>
            
            <FormControl>
              <FormLabel>Filter by Manual (Optional)</FormLabel>
              <Select 
                placeholder="All Manuals" 
                value={selectedManual}
                onChange={(e) => setSelectedManual(e.target.value)}
                isDisabled={isLoadingManuals || manuals.length === 0}
              >
                {manuals.map(manual => (
                  <option key={manual.id} value={manual.id}>
                    {manual.title}
                  </option>
                ))}
              </Select>
            </FormControl>
            
            <Flex width="full" justify="space-between">
              <HStack>
                <Button
                  leftIcon={<FaSearch />}
                  colorScheme="brand"
                  size="lg"
                  onClick={handleSearch}
                  isLoading={isLoading}
                  loadingText="Searching..."
                  isDisabled={!searchQuery.trim() || isAskingQuestion}
                >
                  Search Manuals
                </Button>
                <Button
                  colorScheme="teal"
                  size="lg"
                  onClick={handleAskQuestion}
                  isLoading={isAskingQuestion}
                  loadingText="Processing..."
                  isDisabled={!searchQuery.trim() || isLoading}
                >
                  Ask Question
                </Button>
              </HStack>
            </Flex>
          </VStack>
        </Box>
        
        {/* Error Display */}
        {error && (
          <Alert status="error">
            <AlertIcon />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Loading manuals indicator */}
        {isLoadingManuals && (
          <Box textAlign="center" py={4}>
            <Spinner size="lg" color="brand.500" />
            <Text mt={2}>Loading available manuals...</Text>
          </Box>
        )}
        
        {/* AI Answer Display */}
        {aiAnswer && (
          <Box
            bg={useColorModeValue('white', 'gray.800')}
            boxShadow="lg"
            borderRadius="lg"
            p={6}
            mb={8}
          >
            <Heading as="h2" size="lg" mb={4}>
              Answer
            </Heading>
            <Text whiteSpace="pre-line" mb={6}>{aiAnswer}</Text>
            
            {aiSources.length > 0 && (
              <Box>
                <Heading as="h3" size="md" mb={3}>
                  Sources
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  {aiSources.map(source => (
                    <Box
                      key={source.id}
                      p={3}
                      bg={useColorModeValue('gray.50', 'gray.700')}
                      borderRadius="md"
                    >
                      <HStack mb={1}>
                        {getContentTypeIcon(source.type)}
                        <Text fontWeight="bold">{source.title}</Text>
                      </HStack>
                      <Text fontSize="sm" noOfLines={2}>{source.content}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            )}
          </Box>
        )}
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Search Results ({searchResults.length})
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              {searchResults.map((result) => (
                <Card key={result.id} variant="outline">
                  <CardBody>
                    <HStack mb={2}>
                      {getContentTypeIcon(result.type)}
                      <Badge colorScheme={
                        result.type === 'pdf' ? 'red' : 
                        result.type === 'manual' ? 'blue' : 'gray'
                      }>
                        {result.type.toUpperCase()}
                      </Badge>
                      <Badge colorScheme={
                        result.score > 0.9 ? 'green' : 
                        result.score > 0.7 ? 'yellow' : 'orange'
                      }>
                        {Math.round(result.score * 100)}% Match
                      </Badge>
                    </HStack>
                    <Stack mt="1" spacing="2">
                      <Heading size="md">{result.title}</Heading>
                      <Text py="2">{result.content}</Text>
                      {result.highlights && result.highlights.length > 0 && (
                        <Box 
                          mt={2} 
                          p={3} 
                          bg={useColorModeValue('gray.50', 'gray.700')}
                          borderRadius="md"
                        >
                          <Text fontWeight="semibold" mb={1}>Highlights:</Text>
                          {result.highlights.map((highlight, index) => (
                            <Text 
                              key={index} 
                              fontSize="sm" 
                              dangerouslySetInnerHTML={{ 
                                __html: highlight
                                  .replace(/<em>/g, '<em style="background-color:#FBEA8C; font-style:normal">')
                              }} 
                            />
                          ))}
                        </Box>
                      )}
                      {result.source && (
                        <Text fontSize="sm" color="gray.500">
                          Source: {result.source.title}
                        </Text>
                      )}
                    </Stack>
                  </CardBody>
                  <Divider />
                  <CardFooter>
                    <HStack spacing="2">
                      <Button variant="solid" colorScheme="brand">
                        View Full Content
                      </Button>
                      <Button variant="ghost" colorScheme="brand">
                        Save Reference
                      </Button>
                    </HStack>
                  </CardFooter>
                </Card>
              ))}
            </SimpleGrid>
          </Box>
        )}
        
        {/* Informational Section */}
        <Box 
          bg={useColorModeValue('gray.50', 'gray.700')} 
          p={6} 
          borderRadius="md"
          mt={8}
        >
          <Heading as="h3" size="md" mb={4}>
            About BNext ERP Manual Search
          </Heading>
          <Text mb={4}>
            Our manual search feature provides intelligent, context-aware search capabilities across all BNext ERP documentation:
          </Text>
          <SimpleGrid columns={{base: 1, md: 2}} spacing={4}>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Semantic Understanding</Heading>
              <Text fontSize="sm">
                Find relevant information even when your search terms don't exactly match the document text, thanks to our semantic search capabilities.
              </Text>
            </Box>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Context-Aware Results</Heading>
              <Text fontSize="sm">
                Results are ranked by relevance to your query, with the most important information highlighted for quick reference.
              </Text>
            </Box>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Comprehensive Coverage</Heading>
              <Text fontSize="sm">
                Search across user manuals, technical documentation, training materials, and implementation guides all at once.
              </Text>
            </Box>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Regular Updates</Heading>
              <Text fontSize="sm">
                Documentation is updated regularly to reflect the latest BNext ERP features and best practices.
              </Text>
            </Box>
          </SimpleGrid>
        </Box>
      </VStack>
    </Container>
  );
}