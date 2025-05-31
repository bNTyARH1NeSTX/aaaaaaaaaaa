import { useState, useEffect, useCallback } from 'react';
import { checkWorkflowStatus, WorkflowStatusResponse } from '@/api/apiService';

interface UseWorkflowStatusOptions {
  workflowId: string | null | undefined;
  pollingInterval?: number;
  maxAttempts?: number;
  autoStart?: boolean;
  onComplete?: (result: WorkflowStatusResponse) => void;
  onError?: (error: string) => void;
}

export const useWorkflowStatus = ({
  workflowId,
  pollingInterval = 5000,
  maxAttempts = 60,
  autoStart = true,
  onComplete,
  onError
}: UseWorkflowStatusOptions) => {
  const [status, setStatus] = useState<WorkflowStatusResponse>({
    status: 'running'
  });
  const [isPolling, setIsPolling] = useState<boolean>(autoStart);
  const [attempts, setAttempts] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Función para iniciar el polling
  const startPolling = useCallback(() => {
    if (!workflowId) {
      setError('No se proporcionó un ID de flujo de trabajo');
      setIsPolling(false);
      return;
    }
    setIsPolling(true);
    setAttempts(0);
  }, [workflowId]);

  // Función para detener el polling
  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  // Efecto para manejar el polling
  useEffect(() => {
    if (!isPolling || !workflowId) return;

    // Función para realizar una verificación
    const checkStatus = async () => {
      try {
        const result = await checkWorkflowStatus(workflowId);
        setStatus(result);

        // Si el proceso ha terminado (completado o fallido), detener el polling
        if (result.status === 'completed') {
          setIsPolling(false);
          if (onComplete) onComplete(result);
        } else if (result.status === 'failed') {
          setIsPolling(false);
          if (onError && result.error) onError(result.error);
        } else {
          // Incrementar el contador de intentos
          setAttempts(prev => prev + 1);

          // Si se excede el número máximo de intentos, detener el polling
          if (attempts >= maxAttempts) {
            setIsPolling(false);
            setError(`Se excedió el número máximo de intentos (${maxAttempts})`);
            if (onError) onError(`Se excedió el número máximo de intentos (${maxAttempts})`);
          }
        }
      } catch (err) {
        console.error('Error al verificar el estado del flujo de trabajo:', err);
        setError('Error al verificar el estado del flujo de trabajo');
        if (onError) onError('Error al verificar el estado del flujo de trabajo');
      }
    };

    // Realizar la primera verificación inmediatamente
    checkStatus();

    // Configurar el intervalo de polling si el estado sigue siendo "running"
    const intervalId = setInterval(() => {
      if (status.status === 'running' && isPolling) {
        checkStatus();
      } else {
        clearInterval(intervalId);
      }
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [workflowId, isPolling, pollingInterval, attempts, maxAttempts, status.status, onComplete, onError]);

  return {
    status,
    isPolling,
    error,
    attempts,
    startPolling,
    stopPolling,
  };
};

export default useWorkflowStatus;
