import React, { useState } from 'react';
import ModelConfigManager from './ModelConfigManager';
import ModelSelector from './ModelSelector';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('config');

  const tabs = [
    {
      id: 'config',
      name: '大模型配置管理',
      description: '添加、编辑和删除大模型API配置'
    },
    {
      id: 'selector',
      name: '模型选择',
      description: '选择当前活跃的大模型配置'
    }
  ];
  return (
    <div className="bg-white rounded-lg shadow">
      {/* 页面标题 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">系统设置</h2>
        <p className="text-sm text-gray-600 mt-1">管理大模型配置和选择活跃模型</p>
      </div>

      {/* Tab 导航 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 内容 */}
      <div className="p-0">
        {activeTab === 'config' && <ModelConfigManager />}
        {activeTab === 'selector' && <ModelSelector />}
      </div>
    </div>
  );
};

export default SettingsPage;