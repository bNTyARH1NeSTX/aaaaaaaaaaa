"use client";

import React, { useState, useEffect } from 'react';
import { Settings, Bot, Zap, ChevronDown, Check, AlertCircle } from 'lucide-react';
import * as api from '../../api/apiService';

interface ModelSelectorProps {
  modelType: 'completion' | 'graph' | 'embedding' | 'agent';
  currentModel?: string;
  onModelChange?: (modelKey: string) => void;
  className?: string;
  label?: string;
  disabled?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  modelType,
  currentModel,
  onModelChange,
  className = '',
  label,
  disabled = false
}) => {
  const [models, setModels] = useState<api.RegisteredModelWithKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(currentModel || '');

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    setSelectedModel(currentModel || '');
  }, [currentModel]);

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = await api.getAvailableModels();
      const modelEntries = Object.entries(config.registered_models).map(([key, model]) => ({
        key,
        ...model
      }));
      setModels(modelEntries);
      
      // Set current model if not set
      if (!selectedModel) {
        const currentModelKey = config[`${modelType}_model` as keyof api.ModelConfiguration] as string;
        setSelectedModel(currentModelKey);
      }
    } catch (err) {
      setError('Error al cargar modelos disponibles');
      console.error('Error loading models:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = async (modelKey: string) => {
    if (disabled) return;
    
    try {
      await api.updateModelSelection({
        model_type: modelType,
        model_key: modelKey
      });
      
      setSelectedModel(modelKey);
      setIsOpen(false);
      
      if (onModelChange) {
        onModelChange(modelKey);
      }
    } catch (err) {
      setError('Error al actualizar el modelo');
      console.error('Error updating model:', err);
    }
  };

  const getModelIcon = (modelKey: string) => {
    if (modelKey.includes('qwen') || modelKey.includes('manual')) {
      return <Zap className="w-4 h-4 text-yellow-500" />;
    }
    if (modelKey.includes('openai') || modelKey.includes('gpt')) {
      return <Bot className="w-4 h-4 text-green-500" />;
    }
    if (modelKey.includes('claude')) {
      return <Bot className="w-4 h-4 text-purple-500" />;
    }
    if (modelKey.includes('ollama')) {
      return <Bot className="w-4 h-4 text-blue-500" />;
    }
    return <Bot className="w-4 h-4 text-gray-500" />;
  };

  const getModelDisplayName = (modelKey: string, model: api.RegisteredModelWithKey) => {
    if (modelKey.includes('qwen_manual_generator')) {
      return 'Qwen Manual Generator (Personalizado)';
    }
    if (modelKey.includes('openai_gpt4o')) {
      return 'GPT-4o (OpenAI)';
    }
    if (modelKey.includes('claude')) {
      return 'Claude (Anthropic)';
    }
    return model.model_name || modelKey;
  };

  const selectedModelData = models.find(m => m.key === selectedModel);

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="text-sm text-gray-500">Cargando modelos...</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full flex items-center justify-between px-3 py-2 text-left
            bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
            rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500
            focus:border-blue-500 transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-600'}
          `}
        >
          <div className="flex items-center space-x-2">
            {selectedModelData && getModelIcon(selectedModel)}
            <span className="text-sm text-gray-900 dark:text-white">
              {selectedModelData ? getModelDisplayName(selectedModel, selectedModelData) : 'Seleccionar modelo...'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
            {models.map((model) => (
              <button
                key={model.key}
                onClick={() => handleModelSelect(model.key)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 text-left
                  hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors
                  ${selectedModel === model.key ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                `}
              >
                <div className="flex items-center space-x-2">
                  {getModelIcon(model.key)}
                  <div>
                    <div className="text-sm text-gray-900 dark:text-white">
                      {getModelDisplayName(model.key, model)}
                    </div>
                    {model.provider && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Provider: {model.provider}
                      </div>
                    )}
                  </div>
                </div>
                {selectedModel === model.key && (
                  <Check className="w-4 h-4 text-blue-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mr-1" />
          {error}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
