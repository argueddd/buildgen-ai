import React, { useState, useEffect } from 'react';
import PdfUpload from './PdfUpload';
import axios from 'axios';

export default function PdfList({ pdfList, selectedPdf, onPdfSelect, onPdfUpload, onPdfDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);

  // 获取PDF列表
  const fetchPdfList = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8010/pdf-list');
      if (response.data.pdfs) {
        // 更新父组件的pdfList
        onPdfUpload({ type: 'refresh', pdfs: response.data.pdfs });
      }
    } catch (error) {
      console.error('获取PDF列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取PDF列表
  useEffect(() => {
    fetchPdfList();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'processing':
        return '处理中';
      case 'pending':
        return '未处理';
      default:
        return '未知';
    }
  };

  const filteredPdfList = pdfList.filter(pdf => {
    const matchesSearch = pdf.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pdf.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUploadSuccess = (newPdf) => {
    onPdfUpload(newPdf);
    // 上传成功后刷新列表
    fetchPdfList();
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 头部操作区 */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">PDF文档列表</h2>
          <div className="flex space-x-2">
            <button
              onClick={fetchPdfList}
              disabled={loading}
              className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition disabled:opacity-50"
            >
              {loading ? '刷新中...' : '🔄'}
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              上传
            </button>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="搜索PDF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部状态</option>
            <option value="completed">已完成</option>
            <option value="processing">处理中</option>
            <option value="pending">未处理</option>
          </select>
        </div>
      </div>

      {/* PDF列表 */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500 mt-2">加载中...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPdfList.map((pdf) => (
              <div
                key={pdf.id}
                className={`p-3 border rounded-lg cursor-pointer transition ${
                  selectedPdf?.id === pdf.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => onPdfSelect(pdf)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {pdf.name}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500">{pdf.date}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{pdf.size}</span>
                      {pdf.chunksCount && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-blue-600">{pdf.chunksCount} chunks</span>
                        </>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(pdf.status)}`}>
                        {getStatusText(pdf.status)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPdfDelete(pdf.id);
                    }}
                    className="ml-2 text-gray-400 hover:text-red-500 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredPdfList.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || statusFilter !== 'all' ? '没有找到匹配的PDF文档' : '暂无PDF文档'}
          </div>
        )}
      </div>

      {/* 上传弹窗 */}
      {showUpload && (
        <PdfUpload
          onClose={() => setShowUpload(false)}
          onUpload={handleUploadSuccess}
        />
      )}
    </div>
  );
} 