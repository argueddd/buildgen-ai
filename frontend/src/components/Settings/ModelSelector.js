import React, { useState, useEffect } from 'react';
import { configApi } from '../../config/apiService';

const ModelSelector = () => {
  const [availableModels, setAvailableModels] = useState([]);
  const [currentModel, setCurrentModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 获取模型列表
  useEffect(() => {
    fetchModels();
  }, []);



  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await configApi.getConfig();
      if (response.data.success) {
        const models = response.data.available_models || [];
        setAvailableModels(models);
        
        // 直接使用后端返回的活跃模型，不依赖localStorage
        const activeModel = models.find(model => model.is_active);
        if (activeModel) {
          setCurrentModel(activeModel.key);
          // 同步更新localStorage
          localStorage.setItem('selectedModel', activeModel.key);
        } else if (models.length > 0) {
          // 如果没有活跃模型，使用第一个模型
          setCurrentModel(models[0].key);
          localStorage.setItem('selectedModel', models[0].key);
        }
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
      setMessage('获取模型列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = async (modelKey) => {
    if (!modelKey || modelKey === currentModel) return;
    
    try {
      setLoading(true);
      setMessage('');
      
      const response = await configApi.setActiveConfig(modelKey);
      
      if (response.data.success) {
        setCurrentModel(modelKey);
        // 同步更新localStorage
        localStorage.setItem('selectedModel', modelKey);
        setMessage('模型切换成功');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('模型切换失败');
      }
    } catch (error) {
      console.error('切换模型失败:', error);
      setMessage('模型切换失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 页面标题 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">模型选择</h2>
        <p className="text-sm text-gray-600 mt-1">选择当前使用的大模型</p>
      </div>

      {/* 选择器内容 */}
      <div className="p-6">
        {/* 消息提示 */}
        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">
            {message}
          </div>
        )}

        {/* 模型选择下拉框 */}
        {availableModels.length > 0 ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              当前模型
            </label>
            <select
              value={currentModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>
                请选择模型
              </option>
              {availableModels.map((model) => (
                <option key={model.key} value={model.key}>
                  {model.model_type}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              选择的模型将用于所有AI功能（PDF处理、聊天问答等）
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500">
              <p className="text-lg font-medium">暂无可用模型</p>
              <p className="text-sm mt-2">请先在"大模型配置管理"中添加模型配置</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center mt-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">处理中...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;