"use client";

import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Bell, Lock, Palette, Database, Server, Shield, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useHealth } from '../../hooks/useApi';

export default function SettingsPage() {
  const { isHealthy, lastChecked, checkHealth, isLoading: isLoadingHealth } = useHealth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkHealth();
    // Add a small delay for perceived responsiveness if needed, or remove if checkHealth is fast
    setTimeout(() => setIsRefreshing(false), 300); 
  };

  // Do not render health status until client has mounted and initial check is not loading
  const canDisplayHealth = hasMounted && !isLoadingHealth;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          Configuración
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Administre su cuenta y preferencias de la aplicación
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Menu */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Configuración</h2>
          <nav className="space-y-2">
            {[
              { icon: User, label: 'Perfil', active: true },
              { icon: Bell, label: 'Notificaciones', active: false },
              { icon: Lock, label: 'Seguridad', active: false },
              { icon: Palette, label: 'Apariencia', active: false },
              { icon: Database, label: 'Datos y Almacenamiento', active: false },
            ].map((item, index) => (
              <button
                key={index}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  item.active
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Configuración de Perfil</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre para Mostrar
              </label>
              <input
                type="text"
                defaultValue="John Doe"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Dirección de Correo
              </label>
              <input
                type="email"
                defaultValue="juan.perez@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Idioma
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                <option>Español</option>
                <option>Inglés</option>
                <option>Francés</option>
                <option>Alemán</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Zona Horaria
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white">
                <option>UTC-5 (Hora del Este)</option>
                <option>UTC-6 (Hora Central)</option>
                <option>UTC-7 (Hora de la Montaña)</option>
                <option>UTC-8 (Hora del Pacífico)</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="email_notifications"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                defaultChecked
              />
              <label htmlFor="email_notifications" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Habilitar notificaciones por correo
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="auto_save"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                defaultChecked
              />
              <label htmlFor="auto_save" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Autoguardar documentos
              </label>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors">
                  Guardar Cambios
                </button>
                <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Server Health Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" />
          Estado del Servidor
        </h2>
        
        <div className="space-y-4">
          {hasMounted ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isLoadingHealth ? (
                  <RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" />
                ) : isHealthy ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500" />
                )}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {isLoadingHealth 
                      ? 'Verificando estado inicial...'
                      : isHealthy 
                        ? 'Servidor funcionando correctamente' 
                        : 'Problemas de conexión con el servidor'}
                  </h3>
                  {canDisplayHealth && lastChecked && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Última verificación: {lastChecked.toLocaleTimeString('es-ES')}
                    </p>
                  )}
                  {!canDisplayHealth && !lastChecked && (
                     <p className="text-sm text-gray-600 dark:text-gray-400">Comprobando...</p>
                  )}
                </div>
              </div>
              <button 
                onClick={handleRefresh}
                className="flex items-center gap-2 p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                disabled={isRefreshing || isLoadingHealth}
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
              </button>
            </div>
          ) : (
            // Placeholder or skeleton while waiting for mount, to match server render
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    Verificando estado...
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Comprobando...
                  </p>
                </div>
              </div>
               <button 
                className="flex items-center gap-2 p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                disabled={true}
              >
                <RefreshCw className={`w-5 h-5`} />
                <span>Actualizar</span>
              </button>
            </div>
          )}

          {hasMounted && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint API</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                  {process.env.NEXT_PUBLIC_API_URL || 'https://ag61pyffws3ral-8000.proxy.runpod.net'}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado de Servicio</h4>
                {isLoadingHealth ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Verificando...</p>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      isHealthy ? 'bg-green-500' : isHealthy === false ? 'bg-red-500' : 'bg-yellow-500' // Added yellow for null state before first check
                    }`}></span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {isHealthy ? 'Operativo' : isHealthy === false ? 'No operativo' : 'Desconocido'}
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Versión del Servidor</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {/* TODO: Obtener versión del servidor desde API si está disponible */}
                  No disponible
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
