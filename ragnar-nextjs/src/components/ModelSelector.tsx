import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings, Brain, Network, Database, Check, AlertTriangle } from 'lucide-react';
import { modelService, ModelConfig, AvailableModelsResponse } from '@/api/modelService';
import { useToast } from '@/hooks/use-toast';

interface ModelSelectorProps {
  onModelChange?: (modelType: string, modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelChange }) => {
  const [models, setModels] = useState<AvailableModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const availableModels = await modelService.getAvailableModels();
      setModels(availableModels);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los modelos disponibles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleModelUpdate = async (modelType: 'completion' | 'graph' | 'embedding', modelId: string) => {
    try {
      setUpdating(`${modelType}-${modelId}`);
      await modelService.updateModel({ model_type: modelType, model_id: modelId });
      
      // Actualizar el estado local
      if (models) {
        const updatedModels = { ...models };
        if (modelType === 'completion') {
          updatedModels.current_completion_model = modelId;
        } else if (modelType === 'graph') {
          updatedModels.current_graph_model = modelId;
        } else if (modelType === 'embedding') {
          updatedModels.current_embedding_model = modelId;
        }
        setModels(updatedModels);
      }

      onModelChange?.(modelType, modelId);
      
      toast({
        title: "Modelo actualizado",
        description: `El modelo ${modelType} ha sido actualizado correctamente`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `No se pudo actualizar el modelo ${modelType}`,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const getModelIcon = (modelType: string) => {
    switch (modelType) {
      case 'completion':
        return <Brain className="h-5 w-5" />;
      case 'graph':
        return <Network className="h-5 w-5" />;
      case 'embedding':
        return <Database className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  const getModelTypeTitle = (modelType: string) => {
    switch (modelType) {
      case 'completion':
        return 'Modelo de Completación';
      case 'graph':
        return 'Modelo de GraphRAG';
      case 'embedding':
        return 'Modelo de Embeddings';
      default:
        return 'Modelo';
    }
  };

  const renderModelSelector = (
    modelType: 'completion' | 'graph' | 'embedding',
    availableModels: ModelConfig[],
    currentModel: string
  ) => {
    const isUpdating = updating?.startsWith(modelType);

    return (
      <Card key={modelType} className="w-full">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getModelIcon(modelType)}
            {getModelTypeTitle(modelType)}
            {currentModel.includes('manual') && (
              <Badge variant="secondary" className="text-xs">
                Personalizado
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={currentModel}
            onValueChange={(value) => handleModelUpdate(modelType, value)}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar modelo..." />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      {model.provider === 'manual_generation' && (
                        <Badge variant="outline" className="text-xs">
                          Fine-tuned
                        </Badge>
                      )}
                      {model.vision && (
                        <Badge variant="outline" className="text-xs">
                          Vision
                        </Badge>
                      )}
                      {model.id === currentModel && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    {model.description && (
                      <span className="text-sm text-gray-500">{model.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isUpdating && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Actualizando modelo...
            </div>
          )}

          {currentModel.includes('manual') && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <strong>Modelo personalizado activo:</strong> Este modelo ha sido fine-tuned específicamente 
                para la generación de manuales ERP y puede ofrecer mejores resultados para este dominio.
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Cargando modelos...</span>
        </CardContent>
      </Card>
    );
  }

  if (!models) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <span className="ml-2">Error al cargar modelos</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Configuración de Modelos de IA</h2>
      </div>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {renderModelSelector('completion', models.completion_models, models.current_completion_model)}
        {renderModelSelector('graph', models.graph_models, models.current_graph_model)}
      </div>

      <div className="grid gap-6 md:grid-cols-1">
        {renderModelSelector('embedding', models.embedding_models, models.current_embedding_model)}
      </div>

      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg">Información sobre los Modelos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <Brain className="h-4 w-4 text-blue-600 mt-1" />
            <div>
              <strong>Modelo de Completación:</strong> Usado para generar respuestas en el chat y completaciones de texto.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Network className="h-4 w-4 text-green-600 mt-1" />
            <div>
              <strong>Modelo de GraphRAG:</strong> Usado para extraer entidades y relaciones de los documentos.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Database className="h-4 w-4 text-purple-600 mt-1" />
            <div>
              <strong>Modelo de Embeddings:</strong> Usado para crear representaciones vectoriales de los documentos.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
