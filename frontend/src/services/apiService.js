// API服务文件 - 封装所有API调用逻辑
import axios from 'axios';
import { buildApiUrl, buildFileUrl, buildUploadUrl, API_ENDPOINTS } from '../config/apiConfig';

// 创建axios实例
const apiClient = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API请求失败:', error);
    return Promise.reject(error);
  }
);

// PDF管理相关API
export const pdfApi = {
  // 获取PDF列表
  getList: () => apiClient.get(buildApiUrl(API_ENDPOINTS.PDF.LIST)),
  
  // 上传单个PDF
  uploadSingle: (formData, onProgress) => {
    return apiClient.post(buildApiUrl(API_ENDPOINTS.PDF.UPLOAD_SINGLE), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
  },
  
  // 批量上传PDF
  uploadBatch: (formData, onProgress) => {
    return apiClient.post(buildApiUrl(API_ENDPOINTS.PDF.UPLOAD_BATCH), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
  },
  
  // 删除PDF
  delete: (pdfId) => apiClient.delete(buildApiUrl(API_ENDPOINTS.PDF.DELETE(pdfId))),
  
  // 获取处理状态
  getProcessed: (fileId) => apiClient.get(buildApiUrl(API_ENDPOINTS.PDF.PROCESSED(fileId))),
  
  // 获取Markdown内容
  getMarkdown: (fileId) => apiClient.get(buildApiUrl(API_ENDPOINTS.PDF.PROCESSED_MARKDOWN(fileId))),
  
  // 构建文件URL
  getFileUrl: (fileName) => buildFileUrl(fileName),
  
  // 构建上传文件URL
  getUploadUrl: (fileName) => buildUploadUrl(fileName),
};

// 搜索相关API
export const searchApi = {
  // 搜索报告
  searchReports: (keyword, limit = 5) => {
    return apiClient.get(buildApiUrl(API_ENDPOINTS.SEARCH.REPORTS), {
      params: {
        query: keyword,
        limit,
      },
    });
  },
  
  // 获取解释
  getExplanations: (sourceFile) => {
    const encodedSourceFile = encodeURIComponent(sourceFile);
    return fetch(buildApiUrl(API_ENDPOINTS.SEARCH.EXPLANATIONS(encodedSourceFile)));
  },
};

// 聊天相关API
export const chatApi = {
  // 流式聊天
  streamChat: (data) => {
    return fetch(buildApiUrl(API_ENDPOINTS.CHAT.STREAM), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  },
};

// 配置管理API
export const configApi = {
  // 获取配置
  get: () => apiClient.get(buildApiUrl(API_ENDPOINTS.CONFIG.GET)),
  
  // 保存配置
  save: (data) => apiClient.post(buildApiUrl(API_ENDPOINTS.CONFIG.SAVE), data),
  
  // 删除配置
  delete: (modelKey) => apiClient.delete(buildApiUrl(API_ENDPOINTS.CONFIG.DELETE(modelKey))),
};

// 导出默认API服务
export default {
  pdf: pdfApi,
  search: searchApi,
  chat: chatApi,
  config: configApi,
};