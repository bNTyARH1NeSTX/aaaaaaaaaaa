import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  SimpleGrid,
  Icon,
  Stack,
  Flex,
  Button,
  useColorModeValue,
  Image,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FaSearch, FaDatabase, FaPlus, FaBolt } from 'react-icons/fa';
import { GiReactor } from 'react-icons/gi';

const Feature = ({ title, text, icon, color }: { title: string; text: string; icon: React.ReactElement; color: string }) => {
  return (
    <Stack
      bg={useColorModeValue('white', 'gray.800')}
      boxShadow={'lg'}
      rounded={'xl'}
      p={6}
      align={'center'}
      pos={'relative'}
      _hover={{
        transform: 'translateY(-5px)',
        boxShadow: 'xl',
      }}
      transition="all 0.3s ease"
    >
      <Flex
        w={16}
        h={16}
        align={'center'}
        justify={'center'}
        rounded={'full'}
        bg={color}
        mb={1}
      >
        {icon}
      </Flex>
      <Heading fontSize={'xl'} fontFamily={'body'}>
        {title}
      </Heading>
      <Text fontSize={'md'} color={'gray.500'} textAlign={'center'}>
        {text}
      </Text>
    </Stack>
  );
};

export default function HomePage() {
  return (
    <Box>
      {/* Hero Section */}
      <Box 
        bg={useColorModeValue('brand.50', 'gray.900')} 
        pt={20} 
        pb={10}
      >
        <Container maxW={'7xl'}>
          <Stack
            align={'center'}
            spacing={{ base: 8, md: 10 }}
            py={{ base: 10, md: 16 }}
            direction={{ base: 'column', md: 'row' }}
          >
            <Stack flex={1} spacing={{ base: 5, md: 10 }}>
              <Heading
                lineHeight={1.1}
                fontWeight={600}
                fontSize={{ base: '3xl', sm: '4xl', lg: '6xl' }}
              >
                <Text as={'span'} color={'brand.600'}>
                  RAGnar
                </Text>
                <br />
                <Text as={'span'} color={'brand.400'} fontSize={{ base: '2xl', sm: '3xl', lg: '4xl' }}>
                  Intelligent ERP Documentation
                </Text>
              </Heading>
              <Text color={'gray.500'}>
                Powered by Morphik Core, RAGnar is your intelligent companion for BNext ERP documentation.
                Search with natural language, explore knowledge graphs, and get answers instantly - even
                from images, PDFs, and videos.
              </Text>
              <Stack
                spacing={{ base: 4, sm: 6 }}
                direction={{ base: 'column', sm: 'row' }}
              >
                <Button
                  as={RouterLink}
                  to="/chat"
                  rounded={'full'}
                  size={'lg'}
                  fontWeight={'normal'}
                  px={6}
                  colorScheme={'brand'}
                  bg={'brand.500'}
                  _hover={{ bg: 'brand.600' }}
                >
                  Start Chatting
                </Button>
                <Button
                  as={RouterLink}
                  to="/search"
                  rounded={'full'}
                  size={'lg'}
                  fontWeight={'normal'}
                  px={6}
                  leftIcon={<FaSearch />}
                >
                  Search Manuals
                </Button>
              </Stack>
            </Stack>
            <Flex
              flex={1}
              justify={'center'}
              align={'center'}
              position={'relative'}
              w={'full'}
            >
              <Box
                position={'relative'}
                height={'300px'}
                width={'full'}
                overflow={'hidden'}
                rounded={'xl'}
              >
                <Image
                  alt={'Hero Image'}
                  fit={'cover'}
                  align={'center'}
                  w={'100%'}
                  h={'100%'}
                  src={'/src/assets/hero-image.png'}
                  fallbackSrc="https://via.placeholder.com/600x300?text=RAGnar+ERP+Documentation"
                />
              </Box>
            </Flex>
          </Stack>
        </Container>
      </Box>

      {/* Features Section */}
      <Box py={12}>
        <VStack spacing={2} textAlign="center" mb={8}>
          <Heading as="h2" size="xl">
            Powered by Morphik Core
          </Heading>
          <Text color={useColorModeValue('gray.500', 'gray.400')}>
            Advanced features for intelligent documentation retrieval
          </Text>
        </VStack>
        <Container maxW={'7xl'}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={10}>
            <Feature
              icon={<Icon as={FaSearch} w={10} h={10} color={'white'} />}
              title={'Multimodal Search'}
              text={'Search through images, PDFs, videos, and more with natural language queries powered by ColPali.'}
              color={'blue.500'}
            />
            <Feature
              icon={<Icon as={GiReactor} w={10} h={10} color={'white'} />}
              title={'Knowledge Graphs'}
              text={'Explore domain-specific knowledge graphs that connect related concepts within your documentation.'}
              color={'green.500'}
            />
            
            <Feature
              icon={<Icon as={FaDatabase} w={10} h={10} color={'white'} />}
              title={'Metadata Extraction'}
              text={'Extract and visualize metadata including bounding boxes, labels, classifications, and more.'}
              color={'purple.500'}
            />
            <Feature
              icon={<Icon as={FaPlus} w={10} h={10} color={'white'} />}
              title={'Integrations'}
              text={'Connect with existing tools including Google Suite, Slack, and Confluence.'}
              color={'orange.500'}
            />
            <Feature
              icon={<Icon as={FaBolt} w={10} h={10} color={'white'} />}
              title={'Cache-Augmented-Gen'}
              text={'Benefit from persistent KV-caches for faster response generation.'}
              color={'red.500'}
            />
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box bg={useColorModeValue('brand.50', 'gray.900')} py={12}>
        <Container maxW={'5xl'}>
          <Stack
            bg={useColorModeValue('white', 'gray.800')}
            boxShadow={'xl'}
            rounded={'xl'}
            p={10}
            spacing={8}
            align={'center'}
          >
            <Heading
              fontWeight={600}
              fontSize={{ base: '2xl', sm: '3xl', md: '4xl' }}
              lineHeight={'110%'}
              textAlign={'center'}
            >
              Ready to explore BNext ERP documentation?
            </Heading>
            <Text color={'gray.500'} maxW={'3xl'} textAlign={'center'}>
              Start asking questions, searching through manuals, and exploring the knowledge graphs 
              to find exactly what you need.
            </Text>
            <Stack spacing={6} direction={'row'}>
              <Button
                as={RouterLink}
                to="/chat"
                rounded={'full'}
                px={6}
                bg={'brand.500'}
                _hover={{ bg: 'brand.600' }}
                color={'white'}
              >
                Start Chatting
              </Button>
              <Button
                as={RouterLink}
                to="/manuals"
                rounded={'full'}
                px={6}
              >
                Browse Manuals
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
