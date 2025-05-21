import useState from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  Center,
  Spinner,
} from '@chakra-ui/react';

export default function KnowledgeGraphPage() {
  const [isLoading] = useState(true);

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Knowledge Graph Explorer
          </Heading>
          <Text color="gray.600">
            Explore domain-specific knowledge graphs for BNext ERP documentation
          </Text>
        </Box>
        
        <Box
          bg={useColorModeValue('white', 'gray.800')}
          boxShadow="base"
          borderRadius="lg"
          p={6}
          height="600px"
          position="relative"
        >
          {isLoading ? (
            <Center h="100%">
              <VStack>
                <Spinner size="xl" thickness="4px" speed="0.65s" color="brand.500" />
                <Text mt={4}>Loading Knowledge Graph...</Text>
                <Text fontSize="sm" color="gray.500" maxW="md" textAlign="center">
                  The Knowledge Graph feature is under development and will be available soon.
                </Text>
              </VStack>
            </Center>
          ) : (
            <Center h="100%">
              <Text>Knowledge Graph Visualization Will Appear Here</Text>
            </Center>
          )}
        </Box>
        
        <Box 
          bg={useColorModeValue('gray.50', 'gray.700')} 
          p={6} 
          borderRadius="md"
        >
          <Heading as="h3" size="md" mb={4}>
            About Knowledge Graphs
          </Heading>
          <Text>
            Knowledge graphs help you understand relationships between different concepts in the BNext ERP documentation.
            This feature allows you to explore connections between related features, processes, and best practices.
          </Text>
        </Box>
      </VStack>
    </Container>
  );
}