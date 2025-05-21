import React from 'react';
import useState from 'react';
import useRef from 'react';
import useEffect from 'react';
import {
  Box,
  Flex,
  Input,
  Button,
  Text,
  Avatar,
  VStack,
  useColorModeValue,
  Divider,
  IconButton,
  Collapse,
  Badge,
  Link,
  Spinner,
  useToast,
  HStack,
  Switch,
  FormControl,
  FormLabel,
} from '@chakra-ui/react';
import { SearchIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import ChatIcon from '@chakra-ui/icons';
import ReactMarkdown from 'react-markdown';
import { chatApi, ChatMessage as ApiChatMessage, Source } from '../api/chatApi';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: Source[];
}

interface ChatComponentProps {
  manualId?: string;
}

const ChatComponent = ({ manualId }: ChatComponentProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      content: 'Hello! I can help you with information about BNext ERP manuals. What would you like to know?',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSources, setExpandedSources] = useState<{[key: string]: boolean}>({});
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // Scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    // Add user message
    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      content: newMessage,
      isUser: true,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);
    
    try {
      // Call API
      const response = await chatApi.sendMessage({
        message: newMessage,
        // If you have a conversation ID, you can pass it here
        // conversationId: 'your-conversation-id', 
        // manual_id is not a direct parameter of sendMessage. 
        // If manualId is important for context, it might need to be
        // handled differently, perhaps as part of the message or metadata
        // or a specific backend endpoint that incorporates it.
        // For now, assuming it's not directly used by sendMessage or
        // should be part of a broader context not yet implemented here.
      });
      
      // Add AI response
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        content: response.message.content, // Adjusted to use response.message.content
        isUser: false,
        timestamp: new Date(),
        sources: response.sources,
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to get a response. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleSources = (messageId: string) => {
    setExpandedSources(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      borderColor={borderColor}
      overflow="hidden"
      bg={bgColor}
      boxShadow="sm"
      height="600px"
      display="flex"
      flexDirection="column"
    >
      <Box
        p={4}
        bg={useColorModeValue('brand.500', 'brand.600')}
        color="white"
      >
        <Flex align="center">
          <ChatIcon mr={2} />
          <Text fontWeight="bold">BNext ERP Assistant</Text>
        </Flex>
      </Box>
      
      <Box
        flex="1"
        overflowY="auto"
        p={4}
        bg={useColorModeValue('gray.50', 'gray.900')}
      >
        <VStack spacing={4} align="stretch">
          {messages.map((msg) => (
            <Box key={msg.id}>
              <Flex
                direction={msg.isUser ? 'row-reverse' : 'row'}
                align="start"
                mb={msg.sources && msg.sources.length > 0 ? 1 : 3}
              >
                <Avatar
                  size="sm"
                  name={msg.isUser ? 'User' : 'RAGnar'}
                  src={msg.isUser ? undefined : '/ragnar-logo.png'}
                  bg={msg.isUser ? 'blue.500' : 'brand.500'}
                  mr={msg.isUser ? 0 : 2}
                  ml={msg.isUser ? 2 : 0}
                />
                <Box
                  maxW="80%"
                  p={3}
                  borderRadius="lg"
                  bg={msg.isUser ? 'blue.500' : useColorModeValue('white', 'gray.700')}
                  color={msg.isUser ? 'white' : useColorModeValue('gray.800', 'white')}
                  boxShadow="sm"
                >
                  <Box className="markdown-content">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </Box>
                  <Text
                    fontSize="xs"
                    color={msg.isUser ? 'whiteAlpha.700' : useColorModeValue('gray.500', 'gray.400')}
                    textAlign="right"
                    mt={1}
                  >
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Box>
              </Flex>
              
              {msg.sources && msg.sources.length > 0 && (
                <Box ml={10} mb={3}>
                  <Flex align="center">
                    <Button
                      size="xs"
                      onClick={() => toggleSources(msg.id)}
                      rightIcon={expandedSources[msg.id] ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      variant="outline"
                      colorScheme="gray"
                    >
                      {expandedSources[msg.id] ? 'Hide' : 'Show'} Sources ({msg.sources.length})
                    </Button>
                  </Flex>
                  
                  <Collapse in={expandedSources[msg.id]} animateOpacity>
                    <VStack
                      mt={2}
                      spacing={2}
                      align="stretch"
                      borderLeft="2px"
                      borderColor="gray.200"
                      pl={3}
                    >
                      {msg.sources.map((source, idx) => (
                        <Box
                          key={idx}
                          p={2}
                          borderRadius="md"
                          bg={useColorModeValue('gray.100', 'gray.700')}
                          fontSize="sm"
                        >
                          <Flex justify="space-between" mb={1}>
                            <Text fontWeight="bold">{source.source.title}</Text>
                            <Badge colorScheme="green">
                              {Math.round(source.score * 100)}% match
                            </Badge>
                          </Flex>
                          <Text noOfLines={2}>{source.content}</Text>
                          {source.source.url && (
                            <Link
                              color="brand.500"
                              fontSize="xs"
                              href={source.source.url}
                              isExternal
                            >
                              View source
                            </Link>
                          )}
                        </Box>
                      ))}
                    </VStack>
                  </Collapse>
                </Box>
              )}
            </Box>
          ))}
          
          {isLoading && (
            <Flex justify="center" p={4}>
              <Spinner
                thickness="4px"
                speed="0.65s"
                emptyColor="gray.200"
                color="brand.500"
                size="md"
              />
            </Flex>
          )}
          
          <div ref={endOfMessagesRef} />
        </VStack>
      </Box>
      
      <Divider />
      
      <Box p={4}>
        <form onSubmit={handleSubmit}>
          <Flex>
            <Input
              flex="1"
              placeholder="Type your question here..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isLoading}
            />
            <IconButton
              ml={2}
              colorScheme="brand"
              aria-label="Send message"
              icon={<SearchIcon />}
              type="submit"
              isLoading={isLoading}
            />
          </Flex>
        </form>
      </Box>
    </Box>
  );
};

export default ChatComponent;
