import React, { useState, useEffect } from 'react';
import { configApi } from '../../config/apiService';

const ModelConfigManager = () => {
  const [config, setConfig] = useState({
    API_KEY: '',
    BASE_URL: '',
    MODEL_TYPE: ''
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModelKey, setSelectedModelKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(true);

  // 获取当前配置
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const response = await configApi.getConfig();
      if (response.data.success) {
        setAvailableModels(response.data.available_models || []);
        // 清空当前配置，让用户选择要编辑的模型
        setConfig({
          API_KEY: '',
          BASE_URL: '',
          MODEL_TYPE: ''
        });
        setSelectedModelKey('');
      }
    } catch (error) {
      console.error('获取配置失败:', error);
      setMessage({ type: 'error', text: '获取配置失败，请检查后端服务是否正常运行' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleModelSelect = (modelKey) => {
    setSelectedModelKey(modelKey);
    const selectedModel = availableModels.find(model => model.key === modelKey);
    if (selectedModel) {
      setConfig({
        API_KEY: selectedModel.api_key,
        BASE_URL: selectedModel.base_url,
        MODEL_TYPE: selectedModel.model_type
      });
    }
    setMessage({ type: '', text: '' });
  };

  const handleCreateNew = () => {
    setSelectedModelKey('new');
    setConfig({
      API_KEY: '',
      BASE_URL: '',
      MODEL_TYPE: ''
    });
    setMessage({ type: '', text: '' });
  };

  const handleDelete = async (modelKey) => {
    if (!window.confirm(`确定要删除模型配置 "${modelKey}" 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });
      
      const response = await configApi.deleteConfig(modelKey);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        // 重新获取配置以更新可用模型列表
        await fetchConfig();
        // 如果删除的是当前选中的模型，重置选择
        if (selectedModelKey === modelKey) {
          setSelectedModelKey('');
          setConfig({
            API_KEY: '',
            BASE_URL: '',
            MODEL_TYPE: ''
          });
        }
      } else {
        setMessage({ type: 'error', text: response.data.error || '删除失败' });
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      setMessage({ type: 'error', text: '删除失败：' + (error.response?.data?.error || error.message) });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.API_KEY || !config.BASE_URL || !config.MODEL_TYPE) {
      setMessage({ type: 'error', text: '请填写所有必填字段' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ type: '', text: '' });
      
      // 确定要保存的模型键
      const modelKey = selectedModelKey === 'new' ? config.MODEL_TYPE : selectedModelKey;
      
      const saveData = {
        ...config,
        MODEL_KEY: modelKey,
        SET_AS_ACTIVE: false // 配置管理器只保存，不设置为活跃
      };
      
      const response = await configApi.saveConfig(saveData);
      
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message || '配置保存成功！' });
        // 重新获取配置以更新可用模型列表
        await fetchConfig();
      } else {
        setMessage({ type: 'error', text: response.data.error || '保存失败' });
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      setMessage({ type: 'error', text: '保存失败：' + (error.response?.data?.error || error.message) });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('确定要重置配置吗？这将清除所有当前设置。')) {
      fetchConfig();
      setMessage({ type: '', text: '' });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">加载配置中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 页面标题 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">大模型配置管理</h2>
        <p className="text-sm text-gray-600 mt-1">添加、编辑和删除大模型API配置</p>
      </div>

      {/* 配置表单 */}
      <div className="p-6">
        {/* 消息提示 */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {/* 模型选择器 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            选择要配置的模型
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
             {availableModels.map((model) => (
               <div key={model.key} className="relative group">
                 <button
                   onClick={() => handleModelSelect(model.key)}
                   className={`px-4 py-2 pr-8 rounded-lg border transition ${
                     selectedModelKey === model.key
                       ? 'bg-blue-600 text-white border-blue-600'
                       : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                   }`}
                 >
                   {model.model_type}
                 </button>
                 <button
                   onClick={(e) => {
                     e.stopPropagation();
                     handleDelete(model.key);
                   }}
                   disabled={loading}
                   className={`absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition ${
                     selectedModelKey === model.key
                       ? 'text-white hover:bg-red-500'
                       : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                   } disabled:opacity-50 disabled:cursor-not-allowed`}
                   title="删除此模型配置"
                 >
                   ×
                 </button>
               </div>
             ))}
            <button
              onClick={handleCreateNew}
              className={`px-4 py-2 rounded-lg border transition ${
                selectedModelKey === 'new'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-300'
              }`}
            >
              + 新建模型
            </button>
          </div>
          {selectedModelKey === 'new' && (
            <p className="text-sm text-blue-600">正在创建新的模型配置</p>
          )}
          {selectedModelKey && selectedModelKey !== 'new' && (
            <p className="text-sm text-gray-600">正在编辑: {availableModels.find(m => m.key === selectedModelKey)?.model_type}</p>
          )}
        </div>

        <div className="space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={config.API_KEY}
              onChange={(e) => handleInputChange('API_KEY', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="请输入API Key"
            />
            <p className="text-xs text-gray-500 mt-1">用于访问大模型API的密钥</p>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={config.BASE_URL}
              onChange={(e) => handleInputChange('BASE_URL', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://api.example.com/v1"
            />
            <p className="text-xs text-gray-500 mt-1">大模型API的基础URL地址</p>
          </div>

          {/* Model Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              模型类型 <span className="text-red-500">*</span>
            </label>
            {selectedModelKey === 'new' ? (
              <input
                type="text"
                value={config.MODEL_TYPE}
                onChange={(e) => handleInputChange('MODEL_TYPE', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请输入模型类型，如: qwen-turbo, yi-large"
              />
            ) : (
              <select
                value={config.MODEL_TYPE}
                onChange={(e) => handleInputChange('MODEL_TYPE', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">请选择模型类型</option>
                <option value="qwen-turbo">qwen-turbo</option>
                <option value="yi-large">yi-large</option>
                <option value="qwen-plus">qwen-plus</option>
                <option value="qwen-max">qwen-max</option>
                <option value="yi-lightning">yi-lightning</option>
                <option value="yi-medium">yi-medium</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                <option value="gpt-4">gpt-4</option>
                <option value="gpt-4-turbo">gpt-4-turbo</option>
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              {selectedModelKey === 'new' 
                ? '输入新模型的类型标识符'
                : '选择要使用的大模型类型'
              }
            </p>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              disabled={loading}
            >
              重置
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={fetchConfig}
                className="px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                disabled={loading}
              >
                刷新
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !config.API_KEY || !config.BASE_URL || !config.MODEL_TYPE}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    保存中...
                  </div>
                ) : (
                  '保存配置'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 配置说明 */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-2">配置说明</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <p>• 支持多模型配置：可以同时配置多个不同的大模型</p>
          <p>• API Key: 从大模型服务提供商获取的访问密钥</p>
          <p>• Base URL: API服务的基础地址，通常以 /v1 结尾</p>
          <p>• 模型类型: 具体的模型标识符，如 qwen-turbo、yi-large 等</p>
          <p>• 新建模型：可以添加新的模型配置，支持自定义模型类型</p>
          <p>• 配置保存后需要在"模型选择"页面设置为活跃配置才能生效</p>
        </div>
      </div>
    </div>
  );
};

export default ModelConfigManager;