import axios from 'axios';
import { buildApiUrl, buildFileUrl, buildUploadUrl, API_ENDPOINTS } from './apiConfig';

// 创建axios实例
const apiClient = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('Response Error:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// PDF管理API
export const pdfApi = {
  // 获取PDF列表
  getPdfList: () => apiClient.get(buildApiUrl(API_ENDPOINTS.PDF.LIST)),
  
  // 单个文件上传
  uploadSingle: (formData) => {
    const config = {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 2分钟超时
    };
    return apiClient.post(buildUploadUrl(API_ENDPOINTS.PDF.UPLOAD_SINGLE), formData, config);
  },
  
  // 批量文件上传
  uploadBatch: (formData) => {
    const config = {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000 // 5分钟超时
    };
    return apiClient.post(buildUploadUrl(API_ENDPOINTS.PDF.UPLOAD_BATCH), formData, config);
  },
  
  // 删除PDF
  deletePdf: (fileId) => apiClient.delete(buildApiUrl(API_ENDPOINTS.PDF.DELETE(fileId))),
  
  // 获取处理信息
  getProcessedInfo: (fileId) => apiClient.get(buildApiUrl(API_ENDPOINTS.PDF.PROCESSED_INFO(fileId))),
  
  // 获取Markdown内容
  getMarkdown: (fileId) => apiClient.get(buildApiUrl(API_ENDPOINTS.PDF.MARKDOWN(fileId))),
  
  // 获取处理状态
  getProcessingStatus: () => apiClient.get(buildApiUrl(API_ENDPOINTS.PDF.PROCESSING_STATUS))
};

// 搜索API
export const searchApi = {
  // 搜索报告
  searchReports: (params) => apiClient.get(buildApiUrl(API_ENDPOINTS.SEARCH.REPORTS), { params }),
  
  // 获取解释对
  getExplanations: (sourceFile) => apiClient.get(buildApiUrl(API_ENDPOINTS.SEARCH.EXPLANATIONS(sourceFile)))
};

// 聊天API
export const chatApi = {
  // 流式聊天
  streamChat: (data) => {
    return fetch(buildApiUrl(API_ENDPOINTS.CHAT.STREAM), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
  }
};

// 配置管理API
export const configApi = {
  // 获取配置
  getConfig: () => apiClient.get(buildApiUrl(API_ENDPOINTS.CONFIG.GET)),
  
  // 保存配置
  saveConfig: (configData) => apiClient.post(buildApiUrl(API_ENDPOINTS.CONFIG.SAVE), configData),
  
  // 删除配置
  deleteConfig: (modelKey) => apiClient.delete(buildApiUrl(API_ENDPOINTS.CONFIG.DELETE(modelKey))),
  
  // 设置活跃配置
  setActiveConfig: (modelKey) => apiClient.post(buildApiUrl(API_ENDPOINTS.CONFIG.SET_ACTIVE(modelKey)))
};

// 文件URL构建辅助函数
export const fileUtils = {
  // 构建文件URL
  buildFileUrl: (filename) => buildFileUrl(filename),
  
  // 构建上传URL
  buildUploadUrl: (endpoint) => buildUploadUrl(endpoint)
};

export default apiClient;