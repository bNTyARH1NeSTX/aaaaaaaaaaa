'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { entityExtractionApi, Entity, Relationship, EntityExtractionResponse } from '@/api/entities';

// Props interface
interface AdaptiveEntityDisplayProps {
  text?: string;
  entities?: Entity[];
  adaptiveTypes?: string[];
  isLoading?: boolean;
  onAnalyzeText?: (text: string) => void;
  className?: string;
}

// Función para generar colores únicos basados en el tipo de entidad
const generateEntityColor = (entityType: string): string => {
  const colors = [
    '#3B82F6', // blue
    '#EF4444', // red
    '#10B981', // green
    '#F59E0B', // yellow
    '#8B5CF6', // purple
    '#F97316', // orange
    '#06B6D4', // cyan
    '#84CC16', // lime
    '#EC4899', // pink
    '#6B7280', // gray
    '#14B8A6', // teal
    '#A855F7', // violet
  ];
  
  // Crear un hash simple del tipo de entidad
  let hash = 0;
  for (let i = 0; i < entityType.length; i++) {
    hash = entityType.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Función para generar color más claro para el fondo
const lightenColor = (color: string, factor: number = 0.15): string => {
  return color + Math.floor(255 * factor).toString(16).padStart(2, '0');
};

export const AdaptiveEntityDisplay = ({
  text = '',
  entities = [],
  adaptiveTypes = [],
  isLoading = false,
  onAnalyzeText,
  className = ''
}: AdaptiveEntityDisplayProps) => {
  const [inputText, setInputText] = useState(text);
  const [showEntities, setShowEntities] = useState(true);
  const [highlightedText, setHighlightedText] = useState(text);

  // Efecto para actualizar el texto resaltado cuando cambian las entidades
  useEffect(() => {
    if (!text || entities.length === 0) {
      setHighlightedText(text);
      return;
    }

    let highlighted = text;
    
    // Ordenar entidades por longitud (más largas primero) para evitar conflictos
    const sortedEntities = [...entities].sort((a, b) => b.label.length - a.label.length);
    
    sortedEntities.forEach((entity) => {
      const color = generateEntityColor(entity.type);
      const backgroundColor = lightenColor(color);
      
      // Crear regex para encontrar la entidad (case insensitive)
      const regex = new RegExp(`\\b${entity.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      
      highlighted = highlighted.replace(regex, (match) => 
        `<span style="background-color: ${backgroundColor}; color: ${color}; padding: 2px 4px; border-radius: 4px; font-weight: 500;" title="${entity.type}">${match}</span>`
      );
    });

    setHighlightedText(highlighted);
  }, [text, entities]);

  // Agrupar entidades por tipo
  const groupedEntities = entities.reduce((acc, entity) => {
    if (!acc[entity.type]) {
      acc[entity.type] = [];
    }
    acc[entity.type].push(entity);
    return acc;
  }, {} as Record<string, Entity[]>);

  const handleAnalyze = () => {
    if (onAnalyzeText && inputText.trim()) {
      onAnalyzeText(inputText.trim());
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Input Area */}
      {onAnalyzeText && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              Extracción Adaptativa de Entidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Texto para analizar:
              </label>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ingresa el texto que quieres analizar para extraer entidades..."
                rows={4}
                className="resize-none"
              />
            </div>
            <Button 
              onClick={handleAnalyze}
              disabled={isLoading || !inputText.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analizar Texto
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Adaptive Types Display */}
      {adaptiveTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🤖 Tipos de Entidades Determinados por IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {adaptiveTypes.map((type, index) => (
                <Badge 
                  key={index}
                  variant="secondary"
                  style={{ 
                    backgroundColor: lightenColor(generateEntityColor(type)),
                    color: generateEntityColor(type),
                    borderColor: generateEntityColor(type)
                  }}
                  className="text-sm font-medium"
                >
                  {type}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-3">
              La IA determinó automáticamente estos {adaptiveTypes.length} tipos de entidades más relevantes para el contenido analizado.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Text Display with Highlighted Entities */}
      {text && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>📄 Texto Analizado</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEntities(!showEntities)}
                className="h-8"
              >
                {showEntities ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Ocultar entidades
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Mostrar entidades
                  </>
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="prose max-w-none text-sm leading-relaxed border rounded-lg p-4 bg-gray-50"
              dangerouslySetInnerHTML={{ 
                __html: showEntities ? highlightedText : text 
              }}
            />
            {showEntities && entities.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                💡 Las entidades están resaltadas con colores únicos según su tipo
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Entities List */}
      {entities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🎯 Entidades Extraídas ({entities.length})</span>
              <Badge variant="outline">{Object.keys(groupedEntities).length} tipos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(groupedEntities).map(([type, typeEntities]) => {
                const color = generateEntityColor(type);
                const backgroundColor = lightenColor(color);
                
                return (
                  <div key={type} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <h3 className="font-semibold text-gray-800">{type}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {typeEntities.length}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {typeEntities.map((entity, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          style={{ 
                            backgroundColor: backgroundColor,
                            color: color,
                            borderColor: color
                          }}
                          className="text-sm font-medium"
                        >
                          {entity.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && entities.length === 0 && text && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-gray-500">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No se encontraron entidades</p>
              <p className="text-sm">
                Intenta con un texto diferente o verifica que el servicio de análisis esté funcionando.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-lg font-medium text-gray-700">Analizando texto...</p>
            <p className="text-sm text-gray-500 mt-2">
              La IA está determinando los tipos de entidades más relevantes y extrayendo información del contenido.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdaptiveEntityDisplay;
