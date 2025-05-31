import { useEffect, useState } from 'react';
import { WorkflowStatusResponse } from '@/api/apiService';
import { Progress } from '@/components/ui/progress';

interface WorkflowStatusMonitorProps {
  status: WorkflowStatusResponse;
  onComplete?: (result: WorkflowStatusResponse) => void;
  onError?: (error: string) => void;
  title?: string;
}

export const WorkflowStatusMonitor = ({
  status,
  onComplete,
  onError,
  title = 'Estado del Flujo de Trabajo'
}: WorkflowStatusMonitorProps) => {
  useEffect(() => {
    if (status.status === 'completed' && onComplete) {
      onComplete(status);
    } else if (status.status === 'failed' && onError && status.error) {
      onError(status.error);
    }
  }, [status, onComplete, onError]);

  // Determinar el porcentaje de progreso
  const progressPercentage = status.progress || (status.status === 'completed' ? 100 : status.status === 'running' ? 50 : 0);

  // Determinar el mensaje de estado
  const getStatusMessage = () => {
    switch (status.status) {
      case 'completed':
        return 'Proceso completado con éxito';
      case 'running':
        return 'Proceso en ejecución...';
      case 'failed':
        return `Error: ${status.error || 'Se produjo un error desconocido'}`;
      case 'not_supported':
        return 'Esta operación no es compatible con el servicio actual';
      default:
        return 'Estado desconocido';
    }
  };

  // Determinar el color basado en el estado
  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return 'text-green-600';
      case 'running':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      case 'not_supported':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm">Progreso</span>
          <span className="text-sm font-medium">{progressPercentage}%</span>
        </div>
        <Progress value={progressPercentage} className="w-full" />
      </div>
      
      <div className="mt-2">
        <div className="flex items-center">
          <span className="font-medium mr-2">Estado:</span>
          <span className={`${getStatusColor()}`}>{status.status}</span>
        </div>
        <p className="text-sm mt-1">{getStatusMessage()}</p>
        
        {status.message && (
          <div className="mt-2 text-sm text-gray-600">
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowStatusMonitor;
