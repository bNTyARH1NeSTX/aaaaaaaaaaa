import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { chatApi, ChatMessage as ApiChatMessage, Source } from '../api/chatApi';
import { MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react';

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

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
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
      const response = await chatApi.sendMessage({
        message: newMessage,
      });
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        content: response.message.content,
        isUser: false,
        timestamp: new Date(),
        sources: response.sources,
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
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
    <div className="flex flex-col h-[calc(100vh-8rem)] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-400/10 dark:to-purple-400/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            BNext ERP Assistant
          </h1>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-50/50 to-transparent dark:from-gray-900/50">
        <div className="space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-fadeIn">
              <div className={`flex ${msg.isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3 mb-3`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                  msg.isUser 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                    : 'bg-gradient-to-br from-green-500 to-emerald-600'
                }`}>
                  <span className="text-white font-medium">
                    {msg.isUser ? 'U' : 'A'}
                  </span>
                </div>
                <div className={`max-w-[80%] p-4 rounded-2xl shadow-md transform transition-all duration-200 hover:scale-[1.02] ${
                  msg.isUser
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white'
                }`}>
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  <div className={`text-xs mt-2 text-right ${
                    msg.isUser ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="ml-16 mb-3">
                  <button
                    onClick={() => toggleSources(msg.id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-lg transition-colors duration-200"
                  >
                    {expandedSources[msg.id] ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Hide Sources ({msg.sources.length})
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Show Sources ({msg.sources.length})
                      </>
                    )}
                  </button>
                  
                  {expandedSources[msg.id] && (
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      {msg.sources.map((source, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-white dark:bg-gray-700 shadow-sm transform transition-all duration-200 hover:scale-[1.01]"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-bold">{source.source.title}</h3>
                            <span className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full">
                              {Math.round(source.score * 100)}% match
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            {source.content}
                          </p>
                          {source.source.url && (
                            <a
                              href={source.source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:text-blue-600 mt-2 inline-block"
                            >
                              View source →
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={endOfMessagesRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-500/5 to-purple-500/5 dark:from-blue-400/5 dark:to-purple-400/5">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 rounded-xl bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatComponent;
