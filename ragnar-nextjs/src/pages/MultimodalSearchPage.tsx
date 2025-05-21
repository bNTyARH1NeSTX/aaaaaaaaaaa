import React, { useState } from 'react';
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
  Image,
  Card,
  CardBody,
  Stack,
  Divider,
  CardFooter,
  IconButton,
  Flex,
  FormControl,
  FormLabel,
  useColorModeValue,
  Icon,
  Badge,
  useToast,
  ButtonGroup,
} from '@chakra-ui/react';
import { FaUpload, FaSearch, FaFilePdf, FaImage, FaFileVideo, FaFile } from 'react-icons/fa';

interface SearchResult {
  id: string;
  title: string;
  contentType: 'text' | 'image' | 'pdf' | 'video';
  snippet: string;
  thumbnailUrl?: string;
  sourceUrl: string;
  confidence: number;
}

// Mock data for demonstration
const MOCK_RESULTS: SearchResult[] = [
  {
    id: '1',
    title: 'BNext ERP User Interface Guide',
    contentType: 'pdf',
    snippet: 'The navigation menu provides access to all modules in the BNext ERP system, including finance, inventory, and customer relations...',
    thumbnailUrl: 'https://via.placeholder.com/300x150?text=PDF+Preview',
    sourceUrl: '/manuals/ui-guide',
    confidence: 0.92,
  },
  {
    id: '2',
    title: 'Invoice Processing Tutorial',
    contentType: 'video',
    snippet: 'This video demonstrates the complete invoice processing workflow in BNext ERP, from creation to approval and payment.',
    thumbnailUrl: 'https://via.placeholder.com/300x150?text=Video+Tutorial',
    sourceUrl: '/manuals/invoice-tutorial',
    confidence: 0.88,
  },
  {
    id: '3',
    title: 'Inventory Management Dashboard',
    contentType: 'image',
    snippet: 'Screenshot showing the inventory management dashboard with real-time stock levels and alerts.',
    thumbnailUrl: 'https://via.placeholder.com/300x150?text=Dashboard+Screenshot',
    sourceUrl: '/manuals/inventory-dashboard',
    confidence: 0.95,
  },
  {
    id: '4',
    title: 'Financial Reporting Documentation',
    contentType: 'text',
    snippet: 'The financial reporting module provides comprehensive tools for generating balance sheets, income statements, and cash flow reports...',
    sourceUrl: '/manuals/financial-reporting',
    confidence: 0.89,
  },
];

export default function MultimodalSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const toast = useToast();
  
  // Function to handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      toast({
        title: 'File selected',
        description: `${event.target.files[0].name} is ready for search`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  // Function to handle search submission
  const handleSearch = () => {
    setIsLoading(true);
    
    // In a real application, you would make an API call to your backend here
    setTimeout(() => {
      setSearchResults(MOCK_RESULTS);
      setIsLoading(false);
    }, 1500);
  };
  
  // Function to get icon based on content type
  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'pdf':
        return <Icon as={FaFilePdf} color="red.500" />;
      case 'image':
        return <Icon as={FaImage} color="green.500" />;
      case 'video':
        return <Icon as={FaFileVideo} color="blue.500" />;
      default:
        return <Icon as={FaFile} color="gray.500" />;
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Multimodal Search
          </Heading>
          <Text color="gray.600">
            Search through text, images, PDFs, and videos with ColPali-powered intelligent search
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
                placeholder="E.g., 'Show me how to create a new invoice in BNext ERP'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="lg"
              />
            </FormControl>
            
            <HStack width="full" justify="space-between" align="flex-end">
              <FormControl maxW="60%">
                <FormLabel>Upload File (Optional)</FormLabel>
                <Flex>
                  <Input
                    type="file"
                    id="file-upload"
                    accept=".pdf,.png,.jpg,.jpeg,.mp4,.webm"
                    onChange={handleFileChange}
                    display="none"
                  />
                  <Button
                    as="label"
                    htmlFor="file-upload"
                    leftIcon={<FaUpload />}
                    colorScheme="gray"
                    cursor="pointer"
                  >
                    {file ? file.name : 'Upload File'}
                  </Button>
                  {file && (
                    <IconButton
                      aria-label="Clear file"
                      icon={<Icon as={FaFile} />}
                      ml={2}
                      size="sm"
                      onClick={() => setFile(null)}
                    />
                  )}
                </Flex>
              </FormControl>
              
              <Button
                leftIcon={<FaSearch />}
                colorScheme="brand"
                size="lg"
                onClick={handleSearch}
                isLoading={isLoading}
                loadingText="Searching..."
                isDisabled={!searchQuery && !file}
              >
                Search
              </Button>
            </HStack>
          </VStack>
        </Box>
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <Box>
            <Heading as="h2" size="lg" mb={4}>
              Search Results
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
              {searchResults.map((result) => (
                <Card key={result.id} maxW="md" variant="outline">
                  {result.thumbnailUrl && (
                    <Image
                      src={result.thumbnailUrl}
                      alt={result.title}
                      borderTopRadius="lg"
                      height="150px"
                      objectFit="cover"
                    />
                  )}
                  <CardBody>
                    <HStack mb={2}>
                      {getContentTypeIcon(result.contentType)}
                      <Badge colorScheme={
                        result.contentType === 'pdf' ? 'red' : 
                        result.contentType === 'image' ? 'green' : 
                        result.contentType === 'video' ? 'blue' : 'gray'
                      }>
                        {result.contentType.toUpperCase()}
                      </Badge>
                      <Badge colorScheme={
                        result.confidence > 0.9 ? 'green' : 
                        result.confidence > 0.8 ? 'yellow' : 'orange'
                      }>
                        {Math.round(result.confidence * 100)}% Match
                      </Badge>
                    </HStack>
                    <Stack mt="1" spacing="2">
                      <Heading size="md">{result.title}</Heading>
                      <Text py="2">{result.snippet}</Text>
                    </Stack>
                  </CardBody>
                  <Divider />
                  <CardFooter>
                    <ButtonGroup spacing="2">
                      <Button variant="solid" colorScheme="brand">
                        View Content
                      </Button>
                      <Button variant="ghost" colorScheme="brand">
                        Save
                      </Button>
                    </ButtonGroup>
                  </CardFooter>
                </Card>
              ))}
            </SimpleGrid>
          </Box>
        )}
        
        {/* Information about the ColPali engine */}
        <Box 
          bg={useColorModeValue('gray.50', 'gray.700')} 
          p={6} 
          borderRadius="md"
          mt={8}
        >
          <Heading as="h3" size="md" mb={4}>
            About ColPali Multimodal Search
          </Heading>
          <Text mb={4}>
            RAGnar uses the advanced ColPali engine from Morphik Core to enable true multimodal search capabilities. This allows you to:
          </Text>
          <SimpleGrid columns={{base: 1, md: 2}} spacing={4}>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Search Within Images</Heading>
              <Text fontSize="sm">
                Find information contained in charts, diagrams, screenshots, and other visual content within your BNext ERP documentation.
              </Text>
            </Box>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Extract from PDFs</Heading>
              <Text fontSize="sm">
                Automatically extract and search through text, tables, and images embedded in PDF manuals and reports.
              </Text>
            </Box>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Video Content Analysis</Heading>
              <Text fontSize="sm">
                Find specific moments in training videos by searching for what is being shown or discussed.
              </Text>
            </Box>
            <Box p={4} bg={useColorModeValue('white', 'gray.800')} borderRadius="md" boxShadow="sm">
              <Heading size="sm" mb={2}>Cross-Modal Queries</Heading>
              <Text fontSize="sm">
                Ask questions that span different content types, like "Show me videos related to this invoice screenshot."
              </Text>
            </Box>
          </SimpleGrid>
        </Box>
      </VStack>
    </Container>
  );
}
