import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const apiClient = {
  get: <T>(url: string, config?: any) => axiosInstance.get<T>(url, config),
  post: <T>(url: string, data?: any, config?: any) => axiosInstance.post<T>(url, data, config),
  put: <T>(url: string, data?: any, config?: any) => axiosInstance.put<T>(url, data, config),
  delete: <T>(url: string, config?: any) => axiosInstance.delete<T>(url, config),
  uploadFile: <T>(
    url: string,
    file: File,
    additionalData?: Record<string, any>,
    onProgress?: (progressEvent: any) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, JSON.stringify(value));
      });
    }
    
    return axiosInstance.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
  },
};

export default apiClient;
