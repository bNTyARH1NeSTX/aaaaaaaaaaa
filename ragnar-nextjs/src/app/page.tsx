'use client';

import { FileText, MessageSquare, Search, BookOpen, BarChart2, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useStats, useHealth } from '../hooks/useApi';

const quickActions = [
  { name: 'Iniciar Chat', href: '/chat', icon: MessageSquare, color: 'bg-blue-500' },
  { name: 'Subir Documento', href: '/documents', icon: FileText, color: 'bg-green-500' },
  { name: 'Generar Manual', href: '/manuals', icon: BookOpen, color: 'bg-purple-500' },
  { name: 'Ver Grafos', href: '/graphs', icon: BarChart2, color: 'bg-orange-500' },
];

export default function Dashboard() {
  const { stats, recentActivity, loading: statsLoading, error: statsError } = useStats();
  const { isHealthy } = useHealth();

  const formatActivityDescription = (activity: any) => {
    switch (activity.operation_type) {
      case 'generate_manual':
        return 'Manual generado';
      case 'ingest_file':
        return `Documento subido: ${activity.metadata?.filename || 'archivo'}`;
      case 'agent_query':
        return 'Sesión de chat con asistente IA';
      case 'create_graph':
        return `Grafo de conocimiento creado: ${activity.metadata?.name || 'grafo'}`;
      default:
        return activity.operation_type;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else {
      return 'hace unos minutos';
    }
  };

  const statsData = [
    { 
      name: 'Total de Documentos', 
      value: stats?.total_documents?.toString() || '0', 
      icon: FileText, 
      change: '+12%' 
    },
    { 
      name: 'Sesiones de Chat', 
      value: stats?.total_chat_sessions?.toString() || '0', 
      icon: MessageSquare, 
      change: '+5%' 
    },
    { 
      name: 'Búsquedas Hoy', 
      value: stats?.searches_today?.toString() || '0', 
      icon: Search, 
      change: '+23%' 
    },
    { 
      name: 'Manuales Generados', 
      value: stats?.manuals_generated?.toString() || '0', 
      icon: BookOpen, 
      change: '+8%' 
    },
  ];
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Panel Principal</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ¡Bienvenido de nuevo! Aquí está lo que está sucediendo con sus documentos y asistente de IA.
          </p>
        </div>
        {/* Estado del servidor */}
        <div className="flex items-center space-x-2">
          {isHealthy === null ? (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          ) : isHealthy ? (
            <div className="flex items-center text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm">Conectado</span>
            </div>
          ) : (
            <div className="flex items-center text-red-600">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Desconectado</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
          ))
        ) : statsError ? (
          <div className="col-span-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 dark:text-red-400">Error cargando estadísticas: {statsError}</span>
            </div>
          </div>
        ) : (
          statsData.map((stat) => (
            <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <stat.icon className="w-6 h-6 text-gray-400" />
                </div>
              </div>
              <div className="mt-2 flex items-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 ml-1">{stat.change}</span>
                <span className="text-sm text-gray-500 ml-1">desde el mes pasado</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className={`${action.color} p-3 rounded-lg`}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">{action.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actividad Reciente</h2>
        <div className="space-y-3">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse flex items-center space-x-3 py-2">
                <div className="w-5 h-5 bg-gray-300 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : recentActivity.length > 0 ? (
            recentActivity.slice(0, 4).map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 py-2">
                <FileText className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">{formatActivityDescription(activity)}</p>
                  <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hay actividad reciente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}