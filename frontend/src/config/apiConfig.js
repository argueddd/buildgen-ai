// API配置文件 - 统一管理所有接口URL

// 基础API地址
export const API_BASE_URL = 'http://localhost:8010';

// API端点配置
export const API_ENDPOINTS = {
  // PDF管理相关
  PDF: {
    LIST: '/pdf-list',
    UPLOAD_SINGLE: '/upload-pdf',
    UPLOAD_BATCH: '/upload-pdfs-batch',
    DELETE: (pdfId) => `/delete-pdf/${pdfId}`,
    PROCESSED: (fileId) => `/processed/${fileId}`,
    PROCESSED_MARKDOWN: (fileId) => `/processed/${fileId}/markdown`,
    FILE_URL: (fileName) => `/uploads/${fileName}`,
    PDF_URL: (fileName) => `/pdfs/${fileName}`,
  },
  
  // 搜索相关
  SEARCH: {
    REPORTS: '/search',
    EXPLANATIONS: (sourceFile) => `/explanations/${sourceFile}`,
    EXTRACT_KEYWORDS: '/keywords/extract',
    KEYWORD_SEARCH: '/search/keywords',
  },
  
  // 聊天相关
  CHAT: {
    STREAM: '/chat/stream',
  },
  
  // 配置管理
  CONFIG: {
    GET: '/api/config',
    SAVE: '/api/config',
    DELETE: (modelKey) => `/api/config/${encodeURIComponent(modelKey)}`,
    SET_ACTIVE: (modelKey) => `/api/config/set-active/${encodeURIComponent(modelKey)}`,
  },
};

// 构建完整URL的辅助函数
export const buildApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// 构建文件URL的辅助函数
export const buildFileUrl = (fileName) => {
  const encodedFile = encodeURIComponent(fileName);
  return buildApiUrl(API_ENDPOINTS.PDF.PDF_URL(encodedFile));
};

// 构建上传文件URL的辅助函数
export const buildUploadUrl = (fileName) => {
  return buildApiUrl(API_ENDPOINTS.PDF.FILE_URL(fileName));
};

// 导出默认配置对象
export default {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: API_ENDPOINTS,
  buildApiUrl,
  buildFileUrl,
  buildUploadUrl,
};