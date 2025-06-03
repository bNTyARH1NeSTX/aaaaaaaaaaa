import React from 'react';
import { useWorkflowStatus } from '@/hooks/useWorkflowStatus';
import WorkflowStatusMonitor from './WorkflowStatusMonitor';
import { WorkflowStatusResponse } from '@/api/apiService';

interface WorkflowStatusMonitorWrapperProps {
  workflowId: string;
  runId?: string;
  onComplete?: (result: WorkflowStatusResponse) => void;
  onError?: (error: string) => void;
}

export default function WorkflowStatusMonitorWrapper({
  workflowId,
  runId,
  onComplete,
  onError
}: WorkflowStatusMonitorWrapperProps) {
  const { status, isPolling } = useWorkflowStatus({
    workflowId,
    autoStart: true,
    onComplete,
    onError
  }); 

  return <WorkflowStatusMonitor status={status} onComplete={onComplete} onError={onError} />;
}
