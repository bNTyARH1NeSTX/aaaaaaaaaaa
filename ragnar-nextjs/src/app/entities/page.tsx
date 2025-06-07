'use client';

import { useState } from 'react';
import { AdaptiveEntityDisplay } from '@/components/graph/AdaptiveEntityDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, FileText, Lightbulb } from 'lucide-react';

// Ejemplos de texto para probar
const sampleTexts = {
  technology: {
    title: "Tecnología",
    icon: "💻",
    content: `Apple Inc. anunció el lanzamiento del nuevo iPhone 15 Pro Max, con capacidades avanzadas de IA impulsadas por el chip A17 Pro. El dispositivo incluye tecnología de cámara mejorada con algoritmos de fotografía computacional. Tim Cook, CEO de Apple, declaró que esto representa un salto significativo en la innovación de smartphones. El teléfono será fabricado en China y distribuido globalmente a través de Apple Stores y retailers autorizados.`
  },
  medical: {
    title: "Medicina",
    icon: "🏥", 
    content: `La Dra. Sarah Johnson publicó una investigación revolucionaria sobre terapia génica CRISPR en la Universidad de Stanford. El estudio se enfoca en tratar enfermedades hereditarias usando modificaciones genéticas dirigidas. El equipo de investigación probó exitosamente la terapia en pacientes con anemia falciforme. La FDA aprobó ensayos clínicos para este enfoque de tratamiento innovador. La terapia podría revolucionar el tratamiento de trastornos genéticos que afectan a millones en todo el mundo.`
  },
  finance: {
    title: "Finanzas",
    icon: "💰",
    content: `Goldman Sachs reportó ganancias trimestrales sólidas impulsadas por actividades de banca de inversión. Los ingresos por trading del banco aumentaron 15% comparado con el trimestre anterior. El CEO David Solomon anunció planes para expandir servicios de banca digital y plataformas de trading de criptomonedas. Las decisiones de tasas de interés de la Reserva Federal continúan impactando los préstamos hipotecarios y mercados de crédito al consumidor en las principales instituciones financieras.`
  },
  scientific: {
    title: "Científico",
    icon: "🔬",
    content: `Investigadores del MIT desarrollaron un nuevo algoritmo de computación cuántica que demuestra supremacía cuántica en la resolución de problemas de optimización. El algoritmo utiliza qubits superconductores operando a temperaturas cercanas al cero absoluto. El avance podría acelerar procesos de descubrimiento de medicamentos y mejorar el entrenamiento de modelos de inteligencia artificial. La investigación fue publicada en Nature Physics y financiada por la National Science Foundation.`
  }
};

interface Entity {
  label: string;
  type: string;
  properties?: Record<string, any>;
}

export default function EntitiesPage() {
  const [selectedText, setSelectedText] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [adaptiveTypes, setAdaptiveTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeText = async (text: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedText(text);
    
    try {
      // Simular llamada a la API de extracción de entidades
      const response = await fetch('/api/analyze-entities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Error al analizar el texto');
      }

      const data = await response.json();
      setEntities(data.entities || []);
      setAdaptiveTypes(data.adaptiveTypes || []);
      
    } catch (err) {
      console.error('Error analyzing text:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      
      // Para desarrollo, usar datos mock
      const mockData = generateMockEntities(text);
      setEntities(mockData.entities);
      setAdaptiveTypes(mockData.adaptiveTypes);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para generar datos mock mientras desarrollamos
  const generateMockEntities = (text: string): { entities: Entity[], adaptiveTypes: string[] } => {
    const entities: Entity[] = [];
    const adaptiveTypes: string[] = [];

    if (text.toLowerCase().includes('apple') || text.toLowerCase().includes('iphone')) {
      adaptiveTypes.push('EMPRESA', 'PRODUCTO', 'TECNOLOGÍA', 'PERSONA', 'UBICACIÓN');
      entities.push(
        { label: 'Apple Inc.', type: 'EMPRESA' },
        { label: 'iPhone 15 Pro Max', type: 'PRODUCTO' },
        { label: 'A17 Pro chip', type: 'TECNOLOGÍA' },
        { label: 'Tim Cook', type: 'PERSONA' },
        { label: 'China', type: 'UBICACIÓN' }
      );
    } else if (text.toLowerCase().includes('goldman') || text.toLowerCase().includes('banking')) {
      adaptiveTypes.push('EMPRESA', 'PERSONA', 'SERVICIO FINANCIERO', 'INSTITUCIÓN FINANCIERA', 'PORCENTAJE');
      entities.push(
        { label: 'Goldman Sachs', type: 'EMPRESA' },
        { label: 'David Solomon', type: 'PERSONA' },
        { label: 'banca de inversión', type: 'SERVICIO FINANCIERO' },
        { label: 'Reserva Federal', type: 'INSTITUCIÓN FINANCIERA' },
        { label: '15%', type: 'PORCENTAJE' }
      );
    } else if (text.toLowerCase().includes('stanford') || text.toLowerCase().includes('crispr')) {
      adaptiveTypes.push('PERSONA', 'INSTITUCIÓN', 'TECNOLOGÍA', 'ENFERMEDAD', 'ORGANIZACIÓN');
      entities.push(
        { label: 'Dra. Sarah Johnson', type: 'PERSONA' },
        { label: 'Universidad de Stanford', type: 'INSTITUCIÓN' },
        { label: 'CRISPR', type: 'TECNOLOGÍA' },
        { label: 'anemia falciforme', type: 'ENFERMEDAD' },
        { label: 'FDA', type: 'ORGANIZACIÓN' }
      );
    } else if (text.toLowerCase().includes('mit') || text.toLowerCase().includes('quantum')) {
      adaptiveTypes.push('INSTITUCIÓN', 'ALGORITMO', 'TECNOLOGÍA', 'PUBLICACIÓN', 'FINANCIADOR');
      entities.push(
        { label: 'MIT', type: 'INSTITUCIÓN' },
        { label: 'algoritmo de computación cuántica', type: 'ALGORITMO' },
        { label: 'supremacía cuántica', type: 'TECNOLOGÍA' },
        { label: 'Nature Physics', type: 'PUBLICACIÓN' },
        { label: 'National Science Foundation', type: 'FINANCIADOR' }
      );
    } else {
      adaptiveTypes.push('PERSONA', 'LUGAR', 'CONCEPTO', 'FECHA', 'CANTIDAD');
    }

    return { entities, adaptiveTypes };
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">
            Extracción Adaptativa de Entidades
          </h1>
        </div>
        <p className="text-lg text-gray-600 max-w-3xl">
          Prueba el sistema de extracción de entidades impulsado por IA que determina automáticamente 
          los tipos de entidades más relevantes para cada dominio de contenido.
        </p>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">IA Adaptativa</h3>
            </div>
            <p className="text-sm text-gray-600">
              La IA determina automáticamente los tipos de entidades más relevantes según el contenido.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Visualización Rica</h3>
            </div>
            <p className="text-sm text-gray-600">
              Colores únicos y resaltado de texto para identificar fácilmente cada tipo de entidad.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              <h3 className="font-semibold">Multi-dominio</h3>
            </div>
            <p className="text-sm text-gray-600">
              Funciona con textos de tecnología, medicina, finanzas, ciencia y más dominios.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sample Texts Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Textos de Ejemplo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(sampleTexts).map(([key, sample]) => (
                <Button
                  key={key}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => analyzeText(sample.content)}
                  disabled={isLoading}
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{sample.icon}</span>
                      <span className="font-medium">{sample.title}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {sample.content.substring(0, 100)}...
                    </p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Analysis Panel */}
        <div className="lg:col-span-2">
          <AdaptiveEntityDisplay
            text={selectedText}
            entities={entities}
            adaptiveTypes={adaptiveTypes}
            isLoading={isLoading}
            onAnalyzeText={analyzeText}
          />
          
          {error && (
            <Card className="mt-4 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700">
                  <span className="font-medium">Error:</span>
                  <span>{error}</span>
                </div>
                <p className="text-sm text-red-600 mt-2">
                  Mostrando datos de ejemplo para fines de demostración.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
