import React, { useState, useEffect, useRef } from 'react';
import { chatWithCoach, getCoachRecommendations } from '../utils/api';
import { 
  Send, 
  Bot, 
  Loader2,
  Lightbulb,
  Target,
  Apple
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  program_mods?: string[];
  nutrition_tips?: string[];
  timestamp: string;
}

const Coach: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRecommendations();
    addWelcomeMessage();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm your AI fitness coach. I'm here to help you with your training, nutrition, and overall fitness journey. What would you like to know?",
      suggestions: [
        "How can I improve my bench press?",
        "What should I eat after my workout?",
        "Is my training frequency optimal?",
        "Help me create a workout plan"
      ],
      program_mods: [],
      nutrition_tips: [],
      timestamp: new Date().toISOString()
    };
    setMessages([welcomeMessage]);
  };

  const fetchRecommendations = async () => {
    try {
      const response = await getCoachRecommendations();
      setRecommendations(response);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      // Error is already handled by the API helper
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || inputMessage.trim();
    if (!text) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      // Send conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const response = await chatWithCoach(text, conversationHistory);
      const { message, suggestions, program_mods, nutrition_tips } = response;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: message,
        suggestions: suggestions || [],
        program_mods: program_mods || [],
        nutrition_tips: nutrition_tips || [],
        timestamp: response.timestamp || new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment!",
        suggestions: [],
        program_mods: [],
        nutrition_tips: [],
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Fitness Coach</h1>
        <p className="text-gray-600">Get personalized fitness advice and guidance</p>
      </div>

      {/* Recommendations */}
      {recommendations && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Personalized Recommendations</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.recommendations && recommendations.recommendations.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                  <span>Suggestions</span>
                </h3>
                <ul className="space-y-1">
                  {recommendations.recommendations.slice(0, 3).map((rec: string, index: number) => (
                    <li key={index} className="text-sm text-gray-600">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {recommendations.program_mods && recommendations.program_mods.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span>Program Modifications</span>
                </h3>
                <ul className="space-y-1">
                  {recommendations.program_mods.slice(0, 3).map((mod: string, index: number) => (
                    <li key={index} className="text-sm text-gray-600">• {mod}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {recommendations.nutrition_tips && recommendations.nutrition_tips.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2 flex items-center space-x-2">
                  <Apple className="h-4 w-4 text-green-600" />
                  <span>Nutrition Tips</span>
                </h3>
                <ul className="space-y-1">
                  {recommendations.nutrition_tips.slice(0, 3).map((tip: string, index: number) => (
                    <li key={index} className="text-sm text-gray-600">• {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Interface */}
      <div className="card">
        <div className="h-96 overflow-y-auto space-y-4 mb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="flex items-start space-x-2">
                  {message.role === 'assistant' && (
                    <Bot className="h-5 w-5 mt-0.5 text-gray-600" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
                
                {/* Suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium opacity-75">Quick suggestions:</p>
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => sendMessage(suggestion)}
                        className="block w-full text-left text-xs p-2 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Program Modifications */}
                {message.program_mods && message.program_mods.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium opacity-75 mb-1">Program modifications:</p>
                    <ul className="text-xs space-y-1">
                      {message.program_mods.map((mod, index) => (
                        <li key={index}>• {mod}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Nutrition Tips */}
                {message.nutrition_tips && message.nutrition_tips.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium opacity-75 mb-1">Nutrition tips:</p>
                    <ul className="text-xs space-y-1">
                      {message.nutrition_tips.map((tip, index) => (
                        <li key={index}>• {tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-gray-600" />
                  <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about fitness, nutrition, or training..."
            className="flex-1 input-field"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !inputMessage.trim()}
            className="btn-primary flex items-center space-x-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Coach;
