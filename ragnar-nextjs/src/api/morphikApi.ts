import apiClient from '../utils/apiClient';

// Create a wrapped version of apiClient specifically for morphik-core endpoints
const api = {
  get: <T>(url: string, config?: any) => apiClient.get<T>(`/morphik${url}`, config),
  post: <T>(url: string, data?: any, config?: any) => apiClient.post<T>(`/morphik${url}`, data, config),
  put: <T>(url: string, data?: any, config?: any) => apiClient.put<T>(`/morphik${url}`, data, config),
  delete: <T>(url: string, config?: any) => apiClient.delete<T>(`/morphik${url}`, config),
  uploadFile: <T>(url: string, file: File, additionalData?: Record<string, any>, onProgress?: (progressEvent: any) => void) => 
    apiClient.uploadFile<T>(`/morphik${url}`, file, additionalData, onProgress)
};

export default api;
