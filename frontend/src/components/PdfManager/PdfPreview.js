import React, { useState, useEffect } from 'react';
import PdfViewer from '../PdfViewer/PdfViewer';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function PdfPreview({ selectedPdf }) {
  const [activeTab, setActiveTab] = useState('preview');
  const [markdownContent, setMarkdownContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [chunksData, setChunksData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const chunksPerPage = 3; // 每页显示3个chunks
  const [renderMode, setRenderMode] = useState('markdown'); // 'markdown' 或 'raw'

  // 当选择PDF时，获取Markdown内容
  useEffect(() => {
    if (selectedPdf && selectedPdf.fileId) {
      fetchMarkdownContent(selectedPdf.fileId);
      fetchChunksData(selectedPdf.fileId);
      setCurrentPage(1); // 重置页码
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

  const fetchChunksData = async (fileId) => {
    try {
      const response = await axios.get(`http://localhost:8010/processed/${fileId}`);
      if (response.data.chunks) {
        setChunksData(response.data.chunks);
      }
    } catch (error) {
      console.error('获取chunks数据失败:', error);
      setChunksData([]);
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
            {selectedPdf.processing_steps && (selectedPdf.status === 'uploading' || selectedPdf.status === 'processing') && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-blue-800">处理进度</span>
                  <span className="text-blue-600">{selectedPdf.processing_steps.current_step}/{selectedPdf.processing_steps.total_steps}</span>
                </div>
                <div className="mt-2 text-sm text-blue-700">
                  {selectedPdf.processing_steps.description}
                </div>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(selectedPdf.processing_steps.current_step / selectedPdf.processing_steps.total_steps) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
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
            <div className="text-sm text-gray-500 mb-2">
              文件URL: http://localhost:8010{selectedPdf.fileUrl}
            </div>
            <div className="border rounded-lg">
              <PdfViewer fileUrl={`http://localhost:8010${selectedPdf.fileUrl}`} page={1} />
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
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown 
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-lg font-bold text-gray-900 mb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-base font-bold text-gray-900 mb-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-sm font-bold text-gray-900 mb-1" {...props} />,
                      p: ({node, ...props}) => <p className="text-sm text-gray-800 mb-2" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm text-gray-800 mb-2" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm text-gray-800 mb-2" {...props} />,
                      li: ({node, ...props}) => <li className="text-sm text-gray-800" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                      em: ({node, ...props}) => <em className="italic text-gray-800" {...props} />,
                      code: ({node, ...props}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                      pre: ({node, ...props}) => <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700" {...props} />
                    }}
                  >
                    {markdownContent || '暂无Markdown内容'}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">结构化数据</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">渲染模式:</span>
                <button
                  onClick={() => setRenderMode('markdown')}
                  className={`px-3 py-1 text-sm rounded transition ${
                    renderMode === 'markdown'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Markdown
                </button>
                <button
                  onClick={() => setRenderMode('raw')}
                  className={`px-3 py-1 text-sm rounded transition ${
                    renderMode === 'raw'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  原始文本
                </button>
              </div>
            </div>
            {chunksData.length > 0 ? (
              <div>
                {/* 分页信息 */}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-600">
                    共 {chunksData.length} 个chunks，第 {currentPage} 页，每页 {chunksPerPage} 个
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-600">
                      {currentPage} / {Math.ceil(chunksData.length / chunksPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(chunksData.length / chunksPerPage), prev + 1))}
                      disabled={currentPage === Math.ceil(chunksData.length / chunksPerPage)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>

                {/* Chunks列表 */}
                <div className="space-y-4">
                  {chunksData
                    .slice((currentPage - 1) * chunksPerPage, currentPage * chunksPerPage)
                    .map((chunk, index) => {
                      const globalIndex = (currentPage - 1) * chunksPerPage + index;
                      return (
                        <div key={globalIndex} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-700">
                                Chunk {globalIndex + 1}: {chunk.title || chunk.section || '未命名'}
                              </h4>
                              {/* 关键字展示 */}
                              {chunk.tags && chunk.tags.trim() && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {chunk.tags.split(',').map((tag, tagIndex) => {
                                    const trimmedTag = tag.trim();
                                    return trimmedTag && (
                                      <span key={tagIndex} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                                        {trimmedTag}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 ml-2">#{globalIndex + 1}</span>
                          </div>
                          
                          {/* 内容 */}
                          <div className="mb-3">
                            <h5 className="text-xs font-medium text-gray-600 mb-1">内容:</h5>
                            <div className="text-sm text-gray-800 bg-white p-3 rounded border max-h-48 overflow-y-auto">
                              {renderMode === 'markdown' ? (
                                <div className="prose prose-sm max-w-none">
                                  <ReactMarkdown 
                                    components={{
                                      h1: ({node, ...props}) => <h1 className="text-lg font-bold text-gray-900 mb-2" {...props} />,
                                      h2: ({node, ...props}) => <h2 className="text-base font-bold text-gray-900 mb-2" {...props} />,
                                      h3: ({node, ...props}) => <h3 className="text-sm font-bold text-gray-900 mb-1" {...props} />,
                                      p: ({node, ...props}) => <p className="text-sm text-gray-800 mb-2" {...props} />,
                                      ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm text-gray-800 mb-2" {...props} />,
                                      ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm text-gray-800 mb-2" {...props} />,
                                      li: ({node, ...props}) => <li className="text-sm text-gray-800" {...props} />,
                                      strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                                      em: ({node, ...props}) => <em className="italic text-gray-800" {...props} />,
                                      code: ({node, ...props}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                                      pre: ({node, ...props}) => <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto" {...props} />,
                                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700" {...props} />
                                    }}
                                  >
                                    {chunk.content || '无内容'}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                                  {chunk.content || '无内容'}
                                </pre>
                              )}
                            </div>
                          </div>

                          {/* 问题 */}
                          {(chunk.question1 || chunk.question2 || chunk.question3) && (
                            <div className="mb-3">
                              <h5 className="text-xs font-medium text-gray-600 mb-1">相关问题:</h5>
                              <div className="space-y-1">
                                {chunk.question1 && (
                                  <p className="text-xs text-blue-600 bg-blue-50 p-1 rounded">1. {chunk.question1}</p>
                                )}
                                {chunk.question2 && (
                                  <p className="text-xs text-blue-600 bg-blue-50 p-1 rounded">2. {chunk.question2}</p>
                                )}
                                {chunk.question3 && (
                                  <p className="text-xs text-blue-600 bg-blue-50 p-1 rounded">3. {chunk.question3}</p>
                                )}
                              </div>
                            </div>
                          )}



                          {/* 其他信息 */}
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                              {chunk.section && <span>章节: {chunk.section}</span>}
                              {chunk.parent_section && <span>父章节: {chunk.parent_section}</span>}
                              {chunk.parent_title && <span>父标题: {chunk.parent_title}</span>}
                            </div>

                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>暂无结构化数据</p>
                <p className="text-sm mt-1">PDF处理完成后将显示chunks数据</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 