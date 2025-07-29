import React, { useState, useEffect } from 'react';
import PdfViewer from '../PdfViewer/PdfViewer';
import axios from 'axios';

export default function PdfPreview({ selectedPdf }) {
  const [activeTab, setActiveTab] = useState('preview');
  const [markdownContent, setMarkdownContent] = useState('');
  const [loading, setLoading] = useState(false);

  // 当选择PDF时，获取Markdown内容
  useEffect(() => {
    if (selectedPdf && selectedPdf.fileId) {
      fetchMarkdownContent(selectedPdf.fileId);
    }
  }, [selectedPdf]);

  const fetchMarkdownContent = async (fileId) => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:8010/processed/${fileId}/markdown`);
      if (response.data.markdown) {
        setMarkdownContent(response.data.markdown);
      }
    } catch (error) {
      console.error('获取Markdown内容失败:', error);
      setMarkdownContent('获取内容失败');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedPdf) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center text-gray-500">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">未选择文档</h3>
          <p className="mt-1 text-sm text-gray-500">请从左侧列表中选择一个PDF文档进行预览</p>
        </div>
      </div>
    );
  }

  const structuredData = {
    productName: '木头盘子',
    material: '优质木材',
    process: '传统雕刻工艺',
    features: '耐用、防水、环保',
    specifications: '直径20cm,高3cm',
    applications: '餐具、装饰品',
    notes: '每件产品都有独特的纹理和雕刻图案'
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 头部 */}
      <div className="p-4 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{selectedPdf.name}</h2>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
              <span>上传时间: {selectedPdf.date}</span>
              <span>文件大小: {selectedPdf.size}</span>
              {selectedPdf.chunksCount && (
                <span>Chunks: {selectedPdf.chunksCount}</span>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">
              添加标签
            </button>
            <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition">
              AI提取
            </button>
            <button className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition">
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b">
        <nav className="flex space-x-8 px-4">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            文档内容
          </button>
          <button
            onClick={() => setActiveTab('markdown')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'markdown'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Markdown
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            结构化数据
          </button>
        </nav>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {activeTab === 'preview' ? (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">文档内容预览</h3>
            <div className="border rounded-lg">
              <PdfViewer fileUrl={selectedPdf.fileUrl} page={1} />
            </div>
          </div>
        ) : activeTab === 'markdown' ? (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Markdown内容</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500 mt-2">加载中...</p>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                  {markdownContent || '暂无Markdown内容'}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">结构化数据</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(structuredData).map(([key, value]) => (
                <div key={key} className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    {key === 'productName' && '产品名称'}
                    {key === 'material' && '材料'}
                    {key === 'process' && '工艺'}
                    {key === 'features' && '特性'}
                    {key === 'specifications' && '尺寸规格'}
                    {key === 'applications' && '应用场景'}
                    {key === 'notes' && '备注'}
                  </h4>
                  <p className="text-sm text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 