"use client";

import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, TrendingUp, Users, Database, RefreshCw, Filter, Calendar } from 'lucide-react';
import { getChatFeedback, getChatFeedbackStats, ChatFeedbackEntry, ChatFeedbackStats } from '../../api/apiService';

export default function FeedbackPage() {
  const [feedbackData, setFeedbackData] = useState<ChatFeedbackEntry[]>([]);
  const [stats, setStats] = useState<ChatFeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    rating: '' as 'up' | 'down' | '',
    model: '',
  });

  const loadFeedbackData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load both feedback entries and stats
      const [feedbackEntries, feedbackStats] = await Promise.all([
        getChatFeedback(0, 100, filters.rating || undefined, filters.model || undefined),
        getChatFeedbackStats()
      ]);

      setFeedbackData(feedbackEntries);
      setStats(feedbackStats);
    } catch (err) {
      setError('Error cargando datos de feedback');
      console.error('Error loading feedback data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbackData();
  }, [filters]);

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const getRatingIcon = (rating: string) => {
    return rating === 'up' ? (
      <ThumbsUp className="w-4 h-4 text-green-600" />
    ) : (
      <ThumbsDown className="w-4 h-4 text-red-600" />
    );
  };

  const getRatingColor = (rating: string) => {
    return rating === 'up' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-600" />
            Dashboard de Feedback
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Análisis de feedback de usuarios sobre respuestas del chat IA
          </p>
        </div>
        <button
          onClick={loadFeedbackData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Feedback</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_feedback}</p>
              </div>
              <Database className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Thumbs Up</p>
                <p className="text-2xl font-bold text-green-600">{stats.thumbs_up}</p>
              </div>
              <ThumbsUp className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Thumbs Down</p>
                <p className="text-2xl font-bold text-red-600">{stats.thumbs_down}</p>
              </div>
              <ThumbsDown className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Satisfacción</p>
                <p className="text-2xl font-bold text-blue-600">{(stats.satisfaction_rate * 100).toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      )}

      {/* Model Performance */}
      {stats && stats.model_stats && Object.keys(stats.model_stats).length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Rendimiento por Modelo
          </h2>
          <div className="grid gap-4">
            {Object.entries(stats.model_stats).map(([model, modelStats]) => {
              const total = modelStats.up + modelStats.down;
              const satisfactionRate = total > 0 ? (modelStats.up / total) * 100 : 0;
              
              return (
                <div key={model} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white">{model}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-green-600" />
                        {modelStats.up}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsDown className="w-3 h-3 text-red-600" />
                        {modelStats.down}
                      </span>
                      <span>Total: {total}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {satisfactionRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">Satisfacción</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros:</span>
          </div>
          
          <select
            value={filters.rating}
            onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value as 'up' | 'down' | '' }))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Todas las calificaciones</option>
            <option value="up">Solo Thumbs Up</option>
            <option value="down">Solo Thumbs Down</option>
          </select>

          <select
            value={filters.model}
            onChange={(e) => setFilters(prev => ({ ...prev, model: e.target.value }))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="">Todos los modelos</option>
            {stats?.model_stats && Object.keys(stats.model_stats).map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Feedback Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Feedback Reciente ({feedbackData.length} entradas)
          </h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Cargando feedback...</p>
          </div>
        ) : feedbackData.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No hay feedback disponible</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Consulta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Modelo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Imágenes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Comentario
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {feedbackData.map((feedback, index) => (
                  <tr key={feedback.id} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/30' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(feedback.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getRatingColor(feedback.rating)}`}>
                        {getRatingIcon(feedback.rating)}
                        {feedback.rating === 'up' ? 'Positivo' : 'Negativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs">
                      <div className="truncate" title={feedback.query}>
                        {feedback.query}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {feedback.model_used || 'Desconocido'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {feedback.relevant_images || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                      {feedback.comment ? (
                        <div className="truncate" title={feedback.comment}>
                          {feedback.comment}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Sin comentario</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
