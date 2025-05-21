import  useState  from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Input,
  FormControl,
  FormLabel,
  SimpleGrid,
  Flex,
  Image,
  Badge,
  useColorModeValue,
  IconButton,
  Card,
  CardBody,
  Divider,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Tooltip,
  Code,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
  Progress,
  Select,
  Switch,
} from '@chakra-ui/react';
import {
  FaUpload,
  FaDownload,
  FaCog,
  FaInfoCircle,
  FaSearch,
  FaTrash,
  FaCopy,
} from 'react-icons/fa';
import { FaEye } from 'react-icons/fa6';
import {
  MdTableChart as FaTable,
  MdLabel as FaTag,
  MdOutlineContentCopy as FaBoxes,
  MdOutlineDraw as FaDrawPolygon
} from 'react-icons/md';

interface ExtractedMetadata {
  type: string;
  confidence: number;
  data: any;
}

interface ProcessedDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  preview?: string;
  metadata: ExtractedMetadata[];
}

// Mock data for demonstration
const mockDocuments: ProcessedDocument[] = [
  {
    id: '1',
    name: 'invoice_sample.pdf',
    size: '2.4 MB',
    type: 'pdf',
    status: 'completed',
    progress: 100,
    preview: 'https://via.placeholder.com/400x500?text=Invoice+PDF',
    metadata: [
      {
        type: 'form_fields',
        confidence: 0.94,
        data: {
          invoice_number: 'INV-2023-1234',
          date: '2023-05-15',
          customer: 'Acme Corp',
          total_amount: '$1,250.00',
          payment_terms: 'Net 30',
          status: 'Pending'
        }
      },
      {
        type: 'tables',
        confidence: 0.91,
        data: [
          ['Item', 'Quantity', 'Price', 'Total'],
          ['Widget A', '5', '$50.00', '$250.00'],
          ['Service B', '10', '$75.00', '$750.00'],
          ['Product C', '1', '$250.00', '$250.00']
        ]
      },
      {
        type: 'entities',
        confidence: 0.87,
        data: [
          { type: 'PERSON', text: 'John Smith', position: { x: 120, y: 450, width: 80, height: 20 } },
          { type: 'ORGANIZATION', text: 'Acme Corp', position: { x: 120, y: 150, width: 90, height: 20 } },
          { type: 'DATE', text: '2023-05-15', position: { x: 350, y: 120, width: 100, height: 20 } }
        ]
      }
    ]
  },
  {
    id: '2',
    name: 'product_catalog.jpg',
    size: '1.8 MB',
    type: 'image',
    status: 'completed',
    progress: 100,
    preview: 'https://via.placeholder.com/400x300?text=Product+Catalog',
    metadata: [
      {
        type: 'object_detection',
        confidence: 0.89,
        data: [
          { label: 'Product A', box: { x: 50, y: 80, width: 200, height: 150 }, confidence: 0.92 },
          { label: 'Product B', box: { x: 300, y: 80, width: 180, height: 150 }, confidence: 0.88 },
          { label: 'Price Tag', box: { x: 80, y: 240, width: 100, height: 30 }, confidence: 0.95 }
        ]
      },
      {
        type: 'text_detection',
        confidence: 0.93,
        data: [
          { text: 'Premium Widget', position: { x: 60, y: 60, width: 180, height: 30 } },
          { text: '$129.99', position: { x: 80, y: 240, width: 100, height: 30 } },
          { text: 'Deluxe Model', position: { x: 310, y: 60, width: 160, height: 30 } },
          { text: '$149.99', position: { x: 330, y: 240, width: 100, height: 30 } }
        ]
      }
    ]
  },
  {
    id: '3',
    name: 'shipping_label.png',
    size: '0.9 MB',
    type: 'image',
    status: 'completed',
    progress: 100,
    preview: 'https://via.placeholder.com/400x300?text=Shipping+Label',
    metadata: [
      {
        type: 'barcode',
        confidence: 0.99,
        data: {
          format: 'CODE_128',
          value: '123456789012',
          position: { x: 150, y: 220, width: 200, height: 50 }
        }
      },
      {
        type: 'text_detection',
        confidence: 0.96,
        data: [
          { text: 'SHIP TO:', position: { x: 50, y: 50, width: 100, height: 20 } },
          { text: 'John Doe', position: { x: 50, y: 80, width: 150, height: 20 } },
          { text: '123 Main St', position: { x: 50, y: 110, width: 180, height: 20 } },
          { text: 'Anytown, CA 12345', position: { x: 50, y: 140, width: 200, height: 20 } }
        ]
      }
    ]
  }
];

export default function MetadataExtractorPage() {
  const [documents, setDocuments] = useState<ProcessedDocument[]>(mockDocuments);
  const [selectedDocument, setSelectedDocument] = useState<ProcessedDocument | null>(mockDocuments[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const toast = useToast();
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setIsProcessing(true);
      
      // Simulate processing delay
      setTimeout(() => {
        const file = event.target.files![0];
        const newDoc: ProcessedDocument = {
          id: (documents.length + 1).toString(),
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          type: file.type.split('/')[0],
          status: 'processing',
          progress: 0,
          metadata: []
        };
        
        setDocuments([...documents, newDoc]);
        
        // Simulate progress updates
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          if (progress <= 100) {
            setDocuments(prevDocs => 
              prevDocs.map(doc => 
                doc.id === newDoc.id 
                  ? { ...doc, progress } 
                  : doc
              )
            );
          } else {
            clearInterval(interval);
            setIsProcessing(false);
            
            // Add placeholder preview and metadata
            setDocuments(prevDocs => 
              prevDocs.map(doc => 
                doc.id === newDoc.id 
                  ? { 
                      ...doc, 
                      status: 'completed', 
                      preview: `https://via.placeholder.com/400x300?text=${encodeURIComponent(file.name)}`,
                      metadata: [
                        {
                          type: 'text_detection',
                          confidence: 0.87,
                          data: [
                            { text: 'Sample Text 1', position: { x: 50, y: 50, width: 150, height: 20 } },
                            { text: 'Sample Text 2', position: { x: 50, y: 80, width: 180, height: 20 } }
                          ]
                        }
                      ]
                    } 
                  : doc
              )
            );
            
            toast({
              title: 'Processing Complete',
              description: `Metadata extracted from ${file.name}`,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
          }
        }, 300);
      }, 500);
    }
  };
  
  const handleDeleteDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
    if (selectedDocument?.id === id) {
      setSelectedDocument(documents.length > 1 ? documents[0] : null);
    }
  };
  
  const handleViewDocument = (doc: ProcessedDocument) => {
    setSelectedDocument(doc);
  };
  
  const handleTabChange = (index: number) => {
    setSelectedTab(index);
  };
  
  const copyToClipboard = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({
      title: 'Copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };
  
  // Function to render different metadata type content
  const renderMetadataContent = (metadata: ExtractedMetadata) => {
    switch (metadata.type) {
      case 'form_fields':
        return (
          <Table variant="simple" size="sm">
            <Tbody>
              {Object.entries(metadata.data).map(([key, value]) => (
                <Tr key={key}>
                  <Th>{key.replace(/_/g, ' ')}</Th>
                  <Td>{value as string}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        );
        
      case 'tables':
        return (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  {metadata.data[0].map((header: string, i: number) => (
                    <Th key={i}>{header}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {metadata.data.slice(1).map((row: string[], rowIndex: number) => (
                  <Tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <Td key={cellIndex}>{cell}</Td>
                    ))}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        );
        
      case 'entities':
      case 'text_detection':
        return (
          <Box>
            <SimpleGrid columns={3} spacing={4}>
              {metadata.data.map((item: any, i: number) => (
                <Card key={i} size="sm">
                  <CardBody>
                    <Text fontWeight="bold">{item.text}</Text>
                    {item.type && (
                      <Badge colorScheme="purple" mt={1}>
                        {item.type}
                      </Badge>
                    )}
                    <Text fontSize="xs" mt={2}>
                      Position: x:{item.position.x}, y:{item.position.y}
                    </Text>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          </Box>
        );
        
      case 'object_detection':
        return (
          <Box>
            <SimpleGrid columns={2} spacing={4}>
              {metadata.data.map((item: any, i: number) => (
                <Card key={i} size="sm">
                  <CardBody>
                    <HStack justifyContent="space-between">
                      <Text fontWeight="bold">{item.label}</Text>
                      <Badge colorScheme="green">
                        {Math.round(item.confidence * 100)}%
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" mt={2}>
                      Box: x:{item.box.x}, y:{item.box.y}, w:{item.box.width}, h:{item.box.height}
                    </Text>
                  </CardBody>
                </Card>
              ))}
            </SimpleGrid>
          </Box>
        );
        
      case 'barcode':
        return (
          <Box>
            <Card>
              <CardBody>
                <VStack align="stretch">
                  <Text fontWeight="bold">Format: {metadata.data.format}</Text>
                  <Text>Value: {metadata.data.value}</Text>
                  <Text fontSize="xs">
                    Position: x:{metadata.data.position.x}, y:{metadata.data.position.y}, 
                    w:{metadata.data.position.width}, h:{metadata.data.position.height}
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          </Box>
        );
        
      default:
        return (
          <Code p={2} w="100%">
            {JSON.stringify(metadata.data, null, 2)}
          </Code>
        );
    }
  };
  
  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Metadata Extraction
          </Heading>
          <Text color="gray.600">
            Extract structured data from documents including tables, form fields, entities, and more
          </Text>
        </Box>
        
        <HStack spacing={4} align="flex-start">
          {/* Document List */}
          <Box 
            w="300px" 
            bg={useColorModeValue('white', 'gray.800')} 
            p={4} 
            borderRadius="md"
            boxShadow="base"
          >
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Heading size="md">Documents</Heading>
                <HStack>
                  <Input
                    type="file"
                    id="file-upload"
                    hidden
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                  <Button
                    as="label"
                    htmlFor="file-upload"
                    leftIcon={<FaUpload />}
                    size="sm"
                    colorScheme="brand"
                    isLoading={isProcessing}
                    cursor="pointer"
                  >
                    Upload
                  </Button>
                </HStack>
              </HStack>
              
              <Divider />
              
              <VStack spacing={2} align="stretch" maxH="500px" overflowY="auto">
                {documents.map(doc => (
                  <Box
                    key={doc.id}
                    p={2}
                    borderWidth={1}
                    borderRadius="md"
                    borderColor={selectedDocument?.id === doc.id 
                      ? 'brand.500' 
                      : useColorModeValue('gray.200', 'gray.700')}
                    bg={selectedDocument?.id === doc.id 
                      ? useColorModeValue('brand.50', 'brand.900') 
                      : 'transparent'}
                    _hover={{
                      bg: useColorModeValue('gray.50', 'gray.700'),
                    }}
                    position="relative"
                  >
                    <HStack justify="space-between">
                      <VStack align="start" spacing={0}>
                        <HStack>
                          <Badge colorScheme={
                            doc.type === 'pdf' ? 'red' : 
                            doc.type === 'image' ? 'green' : 
                            'gray'
                          }>
                            {doc.type.toUpperCase()}
                          </Badge>
                          <Badge colorScheme={
                            doc.status === 'completed' ? 'green' : 
                            doc.status === 'processing' ? 'blue' : 
                            'red'
                          }>
                            {doc.status}
                          </Badge>
                        </HStack>
                        <Text fontWeight="medium" noOfLines={1} mt={1}>{doc.name}</Text>
                        <Text fontSize="xs" color="gray.500">{doc.size}</Text>
                      </VStack>
                      <HStack spacing={1}>
                        <IconButton
                          aria-label="View document"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewDocument(doc)}
                        />
                        <IconButton
                          aria-label="Delete document"
                          icon={<FaTrash />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleDeleteDocument(doc.id)}
                        />
                      </HStack>
                    </HStack>
                    
                    {doc.status === 'processing' && (
                      <Progress 
                        value={doc.progress} 
                        size="xs" 
                        colorScheme="brand"
                        borderRadius="full"
                        mt={2}
                      />
                    )}
                  </Box>
                ))}
                
                {documents.length === 0 && (
                  <Box textAlign="center" py={4}>
                    <Text color="gray.500">No documents</Text>
                    <Text fontSize="sm" color="gray.400">
                      Upload a document to extract metadata
                    </Text>
                  </Box>
                )}
              </VStack>
            </VStack>
          </Box>
          
          {/* Document Preview and Metadata */}
          <Box 
            flex={1} 
            bg={useColorModeValue('white', 'gray.800')} 
            p={4} 
            borderRadius="md"
            boxShadow="base"
          >
            {selectedDocument ? (
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Heading size="md">{selectedDocument.name}</Heading>
                  <HStack>
                    <Select size="sm" maxW="200px">
                      <option value="automatic">Automatic Extraction</option>
                      <option value="tables">Tables Only</option>
                      <option value="text">Text Only</option>
                      <option value="forms">Forms Only</option>
                    </Select>
                    <IconButton
                      aria-label="Download metadata"
                      icon={<FaDownload />}
                      size="sm"
                      onClick={() => {
                        toast({
                          title: 'Metadata Downloaded',
                          description: 'Metadata JSON has been downloaded',
                          status: 'success',
                          duration: 3000,
                          isClosable: true,
                        });
                      }}
                    />
                    <IconButton
                      aria-label="Settings"
                      icon={<FaCog />}
                      size="sm"
                    />
                  </HStack>
                </HStack>
                
                <Flex gap={4} direction={{ base: 'column', md: 'row' }} align="start">
                  {/* Document Preview */}
                  <Box 
                    w={{ base: '100%', md: '400px' }} 
                    borderWidth={1} 
                    borderRadius="md" 
                    overflow="hidden"
                    position="relative"
                  >
                    {selectedDocument.preview ? (
                      <Image 
                        src={selectedDocument.preview} 
                        alt={selectedDocument.name}
                        w="100%"
                      />
                    ) : (
                      <Flex 
                        w="100%" 
                        h="300px" 
                        justify="center" 
                        align="center"
                        bg="gray.100"
                      >
                        <Text color="gray.500">No preview available</Text>
                      </Flex>
                    )}
                    
                    {/* Overlay with bounding boxes for visualization */}
                    {selectedDocument.metadata.some(m => 
                      ['object_detection', 'text_detection', 'entities', 'barcode'].includes(m.type)
                    ) && (
                      <Box 
                        position="absolute" 
                        top={0} 
                        left={0} 
                        right={0} 
                        bottom={0} 
                        pointerEvents="none"
                      >
                        {/* This would be replaced with actual bounding box visualization */}
                        {/* For demo purposes, we'll just show placeholder boxes */}
                        <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                          <rect x="50" y="50" width="150" height="30" fill="none" stroke="red" strokeWidth="2" />
                          <rect x="50" y="100" width="200" height="30" fill="none" stroke="blue" strokeWidth="2" />
                          <rect x="150" y="200" width="100" height="100" fill="none" stroke="green" strokeWidth="2" />
                        </svg>
                      </Box>
                    )}
                  </Box>
                  
                  {/* Metadata Display */}
                  <Box flex={1}>
                    <Tabs 
                      isFitted 
                      variant="enclosed-colored" 
                      colorScheme="brand"
                      onChange={handleTabChange}
                      index={selectedTab}
                    >
                      <TabList>
                        <Tab>
                          <HStack>
                            <FaTable />
                            <Text>Tables</Text>
                          </HStack>
                        </Tab>
                        <Tab>
                          <HStack>
                            <FaTag />
                            <Text>Entities</Text>
                          </HStack>
                        </Tab>
                        <Tab>
                          <HStack>
                            <FaBoxes />
                            <Text>Form Fields</Text>
                          </HStack>
                        </Tab>
                        <Tab>
                          <HStack>
                            <FaDrawPolygon />
                            <Text>Objects</Text>
                          </HStack>
                        </Tab>
                      </TabList>
                      
                      <TabPanels>
                        {/* Tables */}
                        <TabPanel>
                          {selectedDocument.metadata.find(m => m.type === 'tables') ? (
                            <Box>
                              <HStack justify="space-between" mb={4}>
                                <HStack>
                                  <Heading size="sm">Extracted Tables</Heading>
                                  <Badge colorScheme="green">
                                    {Math.round(selectedDocument.metadata.find(m => m.type === 'tables')!.confidence * 100)}% Confidence
                                  </Badge>
                                </HStack>
                                <IconButton
                                  aria-label="Copy to clipboard"
                                  icon={<FaCopy />}
                                  size="sm"
                                  onClick={() => copyToClipboard(selectedDocument.metadata.find(m => m.type === 'tables')!.data)}
                                />
                              </HStack>
                              {renderMetadataContent(selectedDocument.metadata.find(m => m.type === 'tables')!)}
                            </Box>
                          ) : (
                            <Box textAlign="center" py={4}>
                              <Text color="gray.500">No tables detected</Text>
                            </Box>
                          )}
                        </TabPanel>
                        
                        {/* Entities */}
                        <TabPanel>
                          {selectedDocument.metadata.find(m => m.type === 'entities' || m.type === 'text_detection') ? (
                            <Box>
                              <HStack justify="space-between" mb={4}>
                                <HStack>
                                  <Heading size="sm">Extracted Entities & Text</Heading>
                                  <Badge colorScheme="green">
                                    {Math.round(selectedDocument.metadata.find(m => m.type === 'entities' || m.type === 'text_detection')!.confidence * 100)}% Confidence
                                  </Badge>
                                </HStack>
                                <IconButton
                                  aria-label="Copy to clipboard"
                                  icon={<FaCopy />}
                                  size="sm"
                                  onClick={() => copyToClipboard(selectedDocument.metadata.find(m => m.type === 'entities' || m.type === 'text_detection')!.data)}
                                />
                              </HStack>
                              {renderMetadataContent(selectedDocument.metadata.find(m => m.type === 'entities' || m.type === 'text_detection')!)}
                            </Box>
                          ) : (
                            <Box textAlign="center" py={4}>
                              <Text color="gray.500">No entities detected</Text>
                            </Box>
                          )}
                        </TabPanel>
                        
                        {/* Form Fields */}
                        <TabPanel>
                          {selectedDocument.metadata.find(m => m.type === 'form_fields') ? (
                            <Box>
                              <HStack justify="space-between" mb={4}>
                                <HStack>
                                  <Heading size="sm">Extracted Form Fields</Heading>
                                  <Badge colorScheme="green">
                                    {Math.round(selectedDocument.metadata.find(m => m.type === 'form_fields')!.confidence * 100)}% Confidence
                                  </Badge>
                                </HStack>
                                <IconButton
                                  aria-label="Copy to clipboard"
                                  icon={<FaCopy />}
                                  size="sm"
                                  onClick={() => copyToClipboard(selectedDocument.metadata.find(m => m.type === 'form_fields')!.data)}
                                />
                              </HStack>
                              {renderMetadataContent(selectedDocument.metadata.find(m => m.type === 'form_fields')!)}
                            </Box>
                          ) : (
                            <Box textAlign="center" py={4}>
                              <Text color="gray.500">No form fields detected</Text>
                            </Box>
                          )}
                        </TabPanel>
                        
                        {/* Objects */}
                        <TabPanel>
                          {selectedDocument.metadata.find(m => m.type === 'object_detection' || m.type === 'barcode') ? (
                            <Box>
                              <HStack justify="space-between" mb={4}>
                                <HStack>
                                  <Heading size="sm">Detected Objects</Heading>
                                  <Badge colorScheme="green">
                                    {Math.round(selectedDocument.metadata.find(m => m.type === 'object_detection' || m.type === 'barcode')!.confidence * 100)}% Confidence
                                  </Badge>
                                </HStack>
                                <IconButton
                                  aria-label="Copy to clipboard"
                                  icon={<FaCopy />}
                                  size="sm"
                                  onClick={() => copyToClipboard(selectedDocument.metadata.find(m => m.type === 'object_detection' || m.type === 'barcode')!.data)}
                                />
                              </HStack>
                              {renderMetadataContent(selectedDocument.metadata.find(m => m.type === 'object_detection' || m.type === 'barcode')!)}
                            </Box>
                          ) : (
                            <Box textAlign="center" py={4}>
                              <Text color="gray.500">No objects detected</Text>
                            </Box>
                          )}
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </Box>
                </Flex>
                
                {/* Raw Metadata JSON View */}
                <Box mt={4}>
                  <HStack justify="space-between" mb={2}>
                    <Heading size="sm">Raw Metadata</Heading>
                    <HStack>
                      <Button 
                        size="xs"
                        leftIcon={<FaCopy />}
                        onClick={() => copyToClipboard(selectedDocument.metadata)}
                      >
                        Copy JSON
                      </Button>
                      <Button 
                        size="xs"
                        leftIcon={<FaDownload />}
                      >
                        Download
                      </Button>
                    </HStack>
                  </HStack>
                  <Box
                    bg={useColorModeValue('gray.50', 'gray.900')}
                    p={3}
                    borderRadius="md"
                    maxH="300px"
                    overflow="auto"
                  >
                    <Code display="block" whiteSpace="pre" p={2}>
                      {JSON.stringify(selectedDocument.metadata, null, 2)}
                    </Code>
                  </Box>
                </Box>
                
                {/* Extraction Settings */}
                <Card mt={4}>
                  <CardBody>
                    <Heading size="sm" mb={4}>
                      <HStack>
                        <FaCog />
                        <Text>Extraction Settings</Text>
                      </HStack>
                    </Heading>
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="table-extraction" mb="0" fontSize="sm">
                          Table Extraction
                        </FormLabel>
                        <Switch id="table-extraction" defaultChecked />
                      </FormControl>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="ocr" mb="0" fontSize="sm">
                          OCR Processing
                        </FormLabel>
                        <Switch id="ocr" defaultChecked />
                      </FormControl>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="entity-recognition" mb="0" fontSize="sm">
                          Entity Recognition
                        </FormLabel>
                        <Switch id="entity-recognition" defaultChecked />
                      </FormControl>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="form-detection" mb="0" fontSize="sm">
                          Form Detection
                        </FormLabel>
                        <Switch id="form-detection" defaultChecked />
                      </FormControl>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="barcode-scan" mb="0" fontSize="sm">
                          Barcode Scanning
                        </FormLabel>
                        <Switch id="barcode-scan" defaultChecked />
                      </FormControl>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="object-detection" mb="0" fontSize="sm">
                          Object Detection
                        </FormLabel>
                        <Switch id="object-detection" defaultChecked />
                      </FormControl>
                    </SimpleGrid>
                  </CardBody>
                </Card>
              </VStack>
            ) : (
              <Box textAlign="center" py={12}>
                <VStack spacing={4}>
                  <Text color="gray.500">No document selected</Text>
                  <Text fontSize="sm" color="gray.400">
                    Select a document from the list or upload a new one
                  </Text>
                  <Input
                    type="file"
                    id="file-upload-empty"
                    hidden
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                  />
                  <Button
                    as="label"
                    htmlFor="file-upload-empty"
                    leftIcon={<FaUpload />}
                    colorScheme="brand"
                    isLoading={isProcessing}
                    cursor="pointer"
                  >
                    Upload Document
                  </Button>
                </VStack>
              </Box>
            )}
          </Box>
        </HStack>
        
        {/* Metadata Extraction Info */}
        <Box 
          bg={useColorModeValue('gray.50', 'gray.700')} 
          p={6} 
          borderRadius="md"
        >
          <Heading as="h3" size="md" mb={4}>
            About Metadata Extraction
          </Heading>
          <Text mb={4}>
            RAGnar uses Morphik Core's advanced metadata extraction capabilities to automatically identify and extract structured data from your documents:
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            <Card>
              <CardBody>
                <HStack mb={2}>
                  <FaTable color="#4299E1" />
                  <Heading size="sm">Table Extraction</Heading>
                </HStack>
                <Text fontSize="sm">
                  Automatically identify and extract tables from documents, preserving their structure for easy import into databases or spreadsheets.
                </Text>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <HStack mb={2}>
                  <FaTag color="#48BB78" />
                  <Heading size="sm">Entity Recognition</Heading>
                </HStack>
                <Text fontSize="sm">
                  Detect and classify named entities such as people, organizations, dates, and financial values within your documents.
                </Text>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <HStack mb={2}>
                  <FaBoxes color="#ED8936" />
                  <Heading size="sm">Form Field Detection</Heading>
                </HStack>
                <Text fontSize="sm">
                  Identify form fields and their values in structured documents like invoices, purchase orders, and applications.
                </Text>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <HStack mb={2}>
                  <FaDrawPolygon color="#9F7AEA" />
                  <Heading size="sm">Object Detection</Heading>
                </HStack>
                <Text fontSize="sm">
                  Recognize and locate objects, logos, and visual elements within images and document scans.
                </Text>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <HStack mb={2}>
                  <FaSearch color="#F56565" />
                  <Heading size="sm">OCR Processing</Heading>
                </HStack>
                <Text fontSize="sm">
                  Extract text from images and scanned documents with high accuracy, including text within complex layouts.
                </Text>
              </CardBody>
            </Card>
            
            <Card>
              <CardBody>
                <HStack mb={2}>
                  <FaInfoCircle color="#667EEA" />
                  <Heading size="sm">Confidence Scoring</Heading>
                </HStack>
                <Text fontSize="sm">
                  Each extracted element comes with a confidence score, allowing you to prioritize high-confidence data or review lower-confidence extractions.
                </Text>
              </CardBody>
            </Card>
          </SimpleGrid>
        </Box>
      </VStack>
    </Container>
  );
}
