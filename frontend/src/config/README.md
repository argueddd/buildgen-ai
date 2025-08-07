# API配置管理

本目录包含前端应用的API配置管理文件，用于统一管理所有后端接口的URL和相关配置。

## 文件说明

### apiConfig.js
主要的API配置文件，包含：
- `API_BASE_URL`: 后端API的基础地址
- `API_ENDPOINTS`: 所有API端点的路径配置
- `buildApiUrl()`: 构建完整API URL的辅助函数
- `buildFileUrl()`: 构建文件URL的辅助函数
- `buildUploadUrl()`: 构建上传文件URL的辅助函数

## 使用方法

### 1. 基本用法

```javascript
import { buildApiUrl, API_ENDPOINTS } from '../config/apiConfig';

// 构建API URL
const url = buildApiUrl(API_ENDPOINTS.PDF.LIST);
// 结果: http://aireportbackend.s7.tunnelfrp.com/pdf-list
```

### 2. 动态参数

```javascript
// 带参数的端点
const deleteUrl = buildApiUrl(API_ENDPOINTS.PDF.DELETE('123'));
// 结果: http://aireportbackend.s7.tunnelfrp.com/delete-pdf/123
```

### 3. 文件URL构建

```javascript
import { buildFileUrl, buildUploadUrl } from '../config/apiConfig';

// PDF文件URL
const pdfUrl = buildFileUrl('document.pdf');
// 结果: http://aireportbackend.s7.tunnelfrp.com/pdfs/document.pdf

// 上传文件URL
const uploadUrl = buildUploadUrl('document.pdf');
// 结果: http://aireportbackend.s7.tunnelfrp.com/uploads/document.pdf
```

## API端点分类

### PDF管理 (API_ENDPOINTS.PDF)
- `LIST`: 获取PDF列表
- `UPLOAD_SINGLE`: 单文件上传
- `UPLOAD_BATCH`: 批量上传
- `DELETE(pdfId)`: 删除PDF
- `PROCESSED(fileId)`: 获取处理状态
- `PROCESSED_MARKDOWN(fileId)`: 获取Markdown内容
- `FILE_URL(fileName)`: 文件访问路径
- `PDF_URL(fileName)`: PDF文件路径

### 搜索 (API_ENDPOINTS.SEARCH)
- `REPORTS`: 搜索报告
- `EXPLANATIONS(sourceFile)`: 获取解释

### 聊天 (API_ENDPOINTS.CHAT)
- `STREAM`: 流式聊天

### 配置管理 (API_ENDPOINTS.CONFIG)
- `GET`: 获取配置
- `SAVE`: 保存配置
- `DELETE(modelKey)`: 删除配置

## 修改API地址

如需修改后端API地址，只需更新 `apiConfig.js` 中的 `API_BASE_URL` 常量：

```javascript
export const API_BASE_URL = 'http://your-new-api-domain.com';
```

所有使用该配置的组件将自动使用新的API地址。

## 最佳实践

1. **统一导入**: 始终从配置文件导入API相关常量，避免硬编码URL
2. **使用辅助函数**: 使用 `buildApiUrl()` 等辅助函数构建URL，确保一致性
3. **参数化端点**: 对于需要参数的端点，使用函数形式定义
4. **错误处理**: 在API调用时添加适当的错误处理逻辑

## 相关文件

- `../services/apiService.js`: 封装了具体的API调用逻辑
- `../services/searchService.js`: 搜索相关的服务函数