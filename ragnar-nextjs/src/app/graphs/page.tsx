'use client';

import { useState, useEffect, useRef } from 'react';
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
  Select,
  Spinner,
  Card,
  CardBody,
  CardHeader,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Textarea,
  Code,
  Flex,
  useColorModeValue
} from '@chakra-ui/react';
import { FiPlus, FiRefreshCw, FiList, FiSearch } from 'react-icons/fi';
import { graphApi, documentsApi } from '../../api';
import { Graph, Document } from '../../api';
import dynamic from 'next/dynamic';

// Import react-force-graph dynamically (client-side only)
const ForceGraph2D = dynamic(() => import('react-force-graph').then(mod => mod.ForceGraph2D), { ssr: false });

export default function GraphPage() {
  const [graphs, setGraphs] = useState<string[]>([]);
  const [selectedGraph, setSelectedGraph] = useState<string>('');
  const [graphData, setGraphData] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [newGraphName, setNewGraphName] = useState('');
  
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    loadGraphs();
    loadDocuments();
  }, []);

  useEffect(() => {
    if (selectedGraph) {
      loadGraphData(selectedGraph);
    }
  }, [selectedGraph]);

  const loadGraphs = async () => {
    try {
      const response = await graphApi.listGraphs();
      setGraphs(response);
      
      // If there are graphs and none selected, select the first one
      if (response.length > 0 && !selectedGraph) {
        setSelectedGraph(response[0]);
      }
    } catch (error) {
      console.error('Error loading graphs:', error);
      toast({
        title: 'Error loading graphs',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const loadGraphData = async (graphName: string) => {
    setLoading(true);
    try {
      const response = await graphApi.getGraph(graphName);
      setGraphData(response);
    } catch (error) {
      console.error(`Error loading graph data for ${graphName}:`, error);
      toast({
        title: 'Error loading graph data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

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

  const handleCreateGraph = async () => {
    if (!newGraphName.trim()) {
      toast({
        title: 'Graph name is required',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (selectedDocuments.length === 0) {
      toast({
        title: 'Select at least one document',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      await graphApi.createGraph({
        name: newGraphName,
        document_ids: selectedDocuments,
      });
      
      setNewGraphName('');
      setSelectedDocuments([]);
      await loadGraphs();
      setSelectedGraph(newGraphName);
      
      toast({
        title: 'Graph created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating graph:', error);
      toast({
        title: 'Failed to create graph',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGraph = async () => {
    if (!selectedGraph) {
      toast({
        title: 'No graph selected',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (selectedDocuments.length === 0) {
      toast({
        title: 'Select at least one document',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setLoading(true);
    try {
      await graphApi.updateGraph(selectedGraph, {
        document_ids: selectedDocuments,
      });
      
      loadGraphData(selectedGraph);
      setSelectedDocuments([]);
      
      toast({
        title: 'Graph updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating graph:', error);
      toast({
        title: 'Failed to update graph',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  // This function integrates with react-force-graph for visualization
  const renderGraph = () => {
    if (!graphData) return null;

    // Convert our graph data format to the format expected by react-force-graph
    const graphForVisualization = {
      nodes: graphData.nodes?.map(node => ({
        id: node.id,
        name: node.name,
        val: 1.5, // Use for node size
        color: getNodeColorByType(node.entity_type),
        group: node.entity_type,
        ...node
      })) || [],
      links: graphData.relationships?.map(rel => ({
        source: rel.source,
        target: rel.target,
        label: rel.type,
        ...rel
      })) || []
    };

    return (
      <Box 
        ref={graphContainerRef} 
        h="600px" 
        border="1px solid" 
        borderColor="gray.200"
        borderRadius="md"
        overflow="hidden"
        bg={useColorModeValue('white', 'gray.800')}
        boxShadow="base"
      >
        {graphForVisualization.nodes.length > 0 ? (
          <ForceGraph2D
            graphData={graphForVisualization}
            nodeLabel={node => `${node.name} (${node.entity_type})`}
            linkLabel={link => link.type}
            nodeAutoColorBy="group"
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            linkCurvature={0.25}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
            linkWidth={1}
            width={graphContainerRef.current?.clientWidth}
            height={graphContainerRef.current?.clientHeight}
            nodeRelSize={6}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.005}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.1}
          />
        ) : (
          <Flex
            height="100%"
            width="100%"
            align="center"
            justify="center"
            direction="column"
          >
            <Text fontSize="lg" mb={2}>No graph data to visualize</Text>
            <Text fontSize="sm" color="gray.500">
              Create a graph or add documents to see visualization
            </Text>
          </Flex>
        )}
      </Box>
    );
  };
  
  // Function to handle node click
  const handleNodeClick = (node: any) => {
    toast({
      title: `Node: ${node.name}`,
      description: `Type: ${node.entity_type}`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
    
    // You could also show a modal with detailed information about the node
  };
  
  // Function to get node color based on entity type
  const getNodeColorByType = (entityType: string): string => {
    const typeColorMap: Record<string, string> = {
      'PERSON': '#E53E3E', // red
      'ORGANIZATION': '#3182CE', // blue
      'LOCATION': '#38A169', // green
      'DATE': '#D69E2E', // yellow
      'EVENT': '#805AD5', // purple
      'PRODUCT': '#DD6B20', // orange
      'CONCEPT': '#319795', // teal
    };
    
    return typeColorMap[entityType.toUpperCase()] || '#718096'; // gray default
  };

  const renderGraphData = () => {
    if (!graphData) return null;

    return (
      <Tabs variant="enclosed">
        <TabList>
          <Tab>Nodes ({graphData.nodes?.length || 0})</Tab>
          <Tab>Relationships ({graphData.relationships?.length || 0})</Tab>
          <Tab>Raw Data</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel>
            <Box maxH="400px" overflowY="auto">
              {graphData.nodes?.map((node, index) => (
                <Card key={index} mb={2} size="sm">
                  <CardBody>
                    <Text><strong>Name:</strong> {node.name}</Text>
                    <Text><strong>Type:</strong> {node.entity_type}</Text>
                    {node.properties && Object.keys(node.properties).length > 0 && (
                      <Box mt={2}>
                        <Text fontWeight="bold">Properties:</Text>
                        {Object.entries(node.properties).map(([key, value]) => (
                          <Text key={key} fontSize="sm">
                            {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </Text>
                        ))}
                      </Box>
                    )}
                  </CardBody>
                </Card>
              ))}
              {(!graphData.nodes || graphData.nodes.length === 0) && (
                <Text color="gray.500">No nodes found</Text>
              )}
            </Box>
          </TabPanel>
          
          <TabPanel>
            <Box maxH="400px" overflowY="auto">
              {graphData.relationships?.map((rel, index) => (
                <Card key={index} mb={2} size="sm">
                  <CardBody>
                    <Text><strong>From:</strong> {rel.source}</Text>
                    <Text><strong>Relationship:</strong> {rel.type}</Text>
                    <Text><strong>To:</strong> {rel.target}</Text>
                    {rel.properties && Object.keys(rel.properties).length > 0 && (
                      <Box mt={2}>
                        <Text fontWeight="bold">Properties:</Text>
                        {Object.entries(rel.properties).map(([key, value]) => (
                          <Text key={key} fontSize="sm">
                            {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </Text>
                        ))}
                      </Box>
                    )}
                  </CardBody>
                </Card>
              ))}
              {(!graphData.relationships || graphData.relationships.length === 0) && (
                <Text color="gray.500">No relationships found</Text>
              )}
            </Box>
          </TabPanel>
          
          <TabPanel>
            <Box maxH="400px" overflowY="auto">
              <Textarea
                value={JSON.stringify(graphData, null, 2)}
                isReadOnly
                fontFamily="monospace"
                h="300px"
              />
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    );
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Heading as="h1" size="xl">Knowledge Graphs</Heading>
        
        <Tabs isFitted variant="enclosed">
          <TabList mb="1em">
            <Tab>View Graphs</Tab>
            <Tab>Create & Update Graphs</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel p={0}>
              <Card mb={4}>
                <CardBody>
                  <HStack>
                    <FormControl flex="1">
                      <FormLabel>Select Graph</FormLabel>
                      <Select
                        value={selectedGraph}
                        onChange={(e) => setSelectedGraph(e.target.value)}
                        placeholder="Select a graph"
                      >
                        {graphs.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <Button
                      mt={8}
                      leftIcon={<FiRefreshCw />}
                      onClick={loadGraphs}
                      isLoading={loading}
                    >
                      Refresh
                    </Button>
                  </HStack>
                </CardBody>
              </Card>
              
              {loading ? (
                <Flex justify="center" align="center" h="500px">
                  <Spinner size="xl" />
                </Flex>
              ) : selectedGraph ? (
                <VStack spacing={4} align="stretch">
                  {renderGraph()}
                  {renderGraphData()}
                </VStack>
              ) : (
                <Card>
                  <CardBody>
                    <Text textAlign="center" color="gray.500">
                      Select a graph to visualize
                    </Text>
                  </CardBody>
                </Card>
              )}
            </TabPanel>
            
            <TabPanel p={0}>
              <Card mb={4}>
                <CardHeader>
                  <Heading size="md">Create New Graph</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Graph Name</FormLabel>
                      <Input
                        value={newGraphName}
                        onChange={(e) => setNewGraphName(e.target.value)}
                        placeholder="Enter a unique name for the graph"
                      />
                    </FormControl>
                    
                    <Button
                      leftIcon={<FiPlus />}
                      colorScheme="blue"
                      onClick={handleCreateGraph}
                      isLoading={loading}
                      isDisabled={!newGraphName.trim() || selectedDocuments.length === 0}
                    >
                      Create Graph
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
              
              <Card mb={4}>
                <CardHeader>
                  <Heading size="md">Update Existing Graph</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Select Graph</FormLabel>
                      <Select
                        value={selectedGraph}
                        onChange={(e) => setSelectedGraph(e.target.value)}
                        placeholder="Select a graph to update"
                      >
                        {graphs.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <Button
                      leftIcon={<FiRefreshCw />}
                      colorScheme="blue"
                      onClick={handleUpdateGraph}
                      isLoading={loading}
                      isDisabled={!selectedGraph || selectedDocuments.length === 0}
                    >
                      Update Graph
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
              
              <Card>
                <CardHeader>
                  <Heading size="md">Select Documents</Heading>
                </CardHeader>
                <CardBody>
                  <Box maxH="400px" overflowY="auto">
                    {documents.length === 0 ? (
                      <Text color="gray.500" textAlign="center">
                        No documents available
                      </Text>
                    ) : (
                      documents.map((doc) => (
                        <Card
                          key={doc.id}
                          mb={2}
                          variant="outline"
                          cursor="pointer"
                          onClick={() => handleDocumentToggle(doc.id)}
                          bg={selectedDocuments.includes(doc.id) ? 'blue.50' : 'white'}
                        >
                          <CardBody>
                            <HStack justify="space-between">
                              <Text fontWeight="medium">{doc.filename}</Text>
                              <Text fontSize="sm" color="gray.500">
                                {new Date(doc.created_at).toLocaleDateString()}
                              </Text>
                            </HStack>
                          </CardBody>
                        </Card>
                      ))
                    )}
                  </Box>
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
}
