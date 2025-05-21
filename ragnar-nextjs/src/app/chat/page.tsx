'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  Input,
  Text,
  VStack,
  HStack,
  Textarea,
  Spinner,
  Card,
  CardBody,
  Avatar,
  Divider,
  IconButton,
  useToast,
  FormControl,
  Switch,
  FormLabel,
  Heading,
  useColorModeValue
} from '@chakra-ui/react';
import { FiSend, FiUser, FiSettings, FiTrash2 } from 'react-icons/fi';
import { queryApi } from '../../api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useAgent, setUseAgent] = useState(true);
  const [useMemory, setUseMemory] = useState(true);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Initial greeting message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: '¡Hola! Soy tu asistente de IA potenciado por RAGnar. Puedo responder preguntas sobre tus documentos utilizando incrustaciones vectoriales y pgvector. ¿Qué te gustaría saber?',
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Call the agent endpoint
      const response = await queryApi.agentQuery({
        query: input,
        filter_metadata: {},
        memory: useMemory,
        stream: false,
        include_sources: true,
        model: 'gpt-4',
      });
      
      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error querying agent:', error);
      toast({
        title: 'Failed to get response',
        description: 'There was an error processing your message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error while processing your request. Please try again later.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const clearConversation = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! Soy tu asistente de IA potenciado por RAGnar. ¿Cómo puedo ayudarte hoy?',
        timestamp: new Date()
      }
    ]);
  };

  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={4} align="stretch" h="calc(100vh - 180px)">
        <Flex justify="space-between" align="center">
          <Heading as="h1" size="xl">Chatea con tus Documentos</Heading>
          <HStack>
            <IconButton
              aria-label="Configuración"
              icon={<FiSettings />}
              variant="ghost"
              onClick={() => setShowSettings(!showSettings)}
            />
            <IconButton
              aria-label="Borrar conversación"
              icon={<FiTrash2 />}
              variant="ghost"
              onClick={clearConversation}
            />
          </HStack>
        </Flex>
        
        {showSettings && (
          <Card variant="outline" mb={4}>
            <CardBody>
              <VStack align="start" spacing={4}>
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="agent" mb="0">
                    Usar Agente
                  </FormLabel>
                  <Switch
                    id="agent"
                    isChecked={useAgent}
                    onChange={() => setUseAgent(!useAgent)}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="memory" mb="0">
                    Usar Memoria de Conversación
                  </FormLabel>
                  <Switch
                    id="memory"
                    isChecked={useMemory}
                    onChange={() => setUseMemory(!useMemory)}
                  />
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="knowledge-base" mb="0">
                    Usar Base de Conocimiento
                  </FormLabel>
                  <Switch
                    id="knowledge-base"
                    isChecked={useKnowledgeBase}
                    onChange={() => setUseKnowledgeBase(!useKnowledgeBase)}
                  />
                </FormControl>
              </VStack>
            </CardBody>
          </Card>
        )}
        
        {/* Chat Messages */}
        <Box
          flex="1"
          overflowY="auto"
          bg={useColorModeValue('gray.50', 'gray.700')}
          borderRadius="md"
          p={4}
        >
          <VStack spacing={4} align="stretch">
            {messages.map((msg) => (
              <HStack
                key={msg.id}
                alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                bg={msg.role === 'user' ? 'blue.500' : useColorModeValue('white', 'gray.800')}
                color={msg.role === 'user' ? 'white' : 'inherit'}
                borderRadius="lg"
                p={4}
                maxW="80%"
                boxShadow="sm"
              >
                <Avatar
                  size="sm"
                  icon={msg.role === 'user' ? <FiUser /> : undefined}
                  name={msg.role === 'user' ? 'Usuario' : 'Asistente'}
                  bg={msg.role === 'user' ? 'blue.600' : 'teal.500'}
                />
                <Box>
                  <Text fontWeight="bold">
                    {msg.role === 'user' ? 'Tú' : 'Asistente'}
                  </Text>
                  <Text whiteSpace="pre-line">{msg.content}</Text>
                  <Text fontSize="xs" opacity={0.7} mt={1}>
                    {msg.timestamp.toLocaleTimeString()}
                  </Text>
                </Box>
              </HStack>
            ))}
            <div ref={messagesEndRef} />
          </VStack>
        </Box>
        
        {/* Input Area */}
        <HStack>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            onKeyDown={handleInputKeyDown}
            resize="none"
            rows={2}
            disabled={isLoading}
          />
          <IconButton
            colorScheme="blue"
            aria-label="Enviar mensaje"
            icon={isLoading ? <Spinner size="sm" /> : <FiSend />}
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
          />
        </HStack>
      </VStack>
    </Container>
  );
}