import React, { useState, useEffect } from 'react';
import PdfViewer from '../PdfViewer/PdfViewer';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

// 常量配置
const CHUNKS_PER_PAGE = 3;
const API_BASE_URL = 'http://aireportbackend.s7.tunnelfrp.com';

// 标签页配置
const TABS = {
  PREVIEW: 'preview',
  MARKDOWN: 'markdown',
  DATA: 'data'
};

// 渲染模式配置
const RENDER_MODES = {
  MARKDOWN: 'markdown',
  RAW: 'raw'
};

// ReactMarkdown组件配置
const MARKDOWN_COMPONENTS = {
  // eslint-disable-next-line jsx-a11y/heading-has-content
  h1: ({node, ...props}) => <h1 className="text-lg font-bold text-gray-900 mb-2" {...props} />,
  // eslint-disable-next-line jsx-a11y/heading-has-content
  h2: ({node, ...props}) => <h2 className="text-base font-bold text-gray-900 mb-2" {...props} />,
  // eslint-disable-next-line jsx-a11y/heading-has-content
  h3: ({node, ...props}) => <h3 className="text-sm font-bold text-gray-900 mb-1" {...props} />,
  p: ({node, ...props}) => <p className="text-sm text-gray-800 mb-2" {...props} />,
  ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm text-gray-800 mb-2" {...props} />,
  ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm text-gray-800 mb-2" {...props} />,
  li: ({node, ...props}) => <li className="text-sm text-gray-800" {...props} />,
  strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
  em: ({node, ...props}) => <em className="italic text-gray-800" {...props} />,
  code: ({node, ...props}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
  pre: ({node, ...props}) => <pre className="bg-gray-100 p-2 rounded text-xs font-mono overflow-x-auto" {...props} />,
  blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700" {...props} />,
  table: ({children}) => (
    <table className="min-w-full border-collapse border border-gray-300 my-4">
      {children}
    </table>
  ),
  thead: ({children}) => (
    <thead className="bg-gray-50">
      {children}
    </thead>
  ),
  tbody: ({children}) => (
    <tbody className="bg-white">
      {children}
    </tbody>
  ),
  tr: ({children}) => (
    <tr className="border-b border-gray-200">
      {children}
    </tr>
  ),
  td: ({children, ...props}) => (
    <td 
      className="px-4 py-2 border border-gray-300 text-sm"
      {...props}
    >
      {children}
    </td>
  ),
  th: ({children, ...props}) => (
    <th 
      className="px-4 py-2 border border-gray-300 text-sm font-semibold text-gray-900 bg-gray-100"
      {...props}
    >
      {children}
    </th>
  ),
};

// 加载组件
const LoadingSpinner = () => (
  <div className="text-center py-8">
    <div className="w-8 h-8 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
    <p className="text-sm text-gray-500 mt-2">加载中...</p>
  </div>
);

// 空状态组件
const EmptyState = () => (
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

// 处理进度组件
const ProcessingProgress = ({ processingSteps }) => (
  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium text-blue-800">处理进度</span>
      <span className="text-blue-600">
        {processingSteps.current_step}/{processingSteps.total_steps}
      </span>
    </div>
    <div className="mt-2 text-sm text-blue-700">
      {processingSteps.description}
    </div>
    <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
        style={{ 
          width: `${(processingSteps.current_step / processingSteps.total_steps) * 100}%` 
        }}
      ></div>
    </div>
  </div>
);

// 标签按钮组件
const TabButton = ({ isActive, onClick, children }) => (
  <button
    onClick={onClick}
    className={`py-3 px-1 border-b-2 font-medium text-sm ${
      isActive
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
  >
    {children}
  </button>
);

// 操作按钮组件
const ActionButton = ({ variant = 'default', onClick, children }) => {
  const baseClasses = 'px-3 py-1 text-sm rounded transition';
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    success: 'bg-green-600 text-white hover:bg-green-700'
  };
  
  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

// 分页组件
const Pagination = ({ currentPage, totalPages, onPageChange }) => (
  <div className="flex justify-between items-center mb-4 flex-shrink-0">
    <span className="text-sm text-gray-600">
      第 {currentPage} 页，共 {totalPages} 页
    </span>
    <div className="flex space-x-2">
      <ActionButton
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        上一页
      </ActionButton>
      <span className="px-3 py-1 text-sm text-gray-600">
        {currentPage} / {totalPages}
      </span>
      <ActionButton
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        下一页
      </ActionButton>
    </div>
  </div>
);

// 标签组件
const TagList = ({ tags }) => {
  if (!tags || !tags.trim()) return null;
  
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.split(',').map((tag, index) => {
        const trimmedTag = tag.trim();
        return trimmedTag && (
          <span 
            key={index} 
            className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200"
          >
            {trimmedTag}
          </span>
        );
      })}
    </div>
  );
};

// 问题列表组件
const QuestionList = ({ chunk }) => {
  const questions = [chunk.question1, chunk.question2, chunk.question3].filter(Boolean);
  
  if (questions.length === 0) return null;
  
  return (
    <div className="mb-3">
      <h5 className="text-xs font-medium text-gray-600 mb-1">相关问题:</h5>
      <div className="space-y-1">
        {questions.map((question, index) => (
          <p key={index} className="text-xs text-blue-600 bg-blue-50 p-1 rounded">
            {index + 1}. {question}
          </p>
        ))}
      </div>
    </div>
  );
};

// Chunk信息组件
const ChunkInfo = ({ chunk }) => {
  const infoItems = [
    { label: '章节', value: chunk.section },
    { label: '父章节', value: chunk.parent_section },
    { label: '父标题', value: chunk.parent_title }
  ].filter(item => item.value);
  
  if (infoItems.length === 0) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {infoItems.map((item, index) => (
          <span key={index}>{item.label}: {item.value}</span>
        ))}
      </div>
    </div>
  );
};

// Chunk内容组件
const ChunkContent = ({ content, renderMode }) => (
  <div className="text-sm text-gray-800 bg-white p-3 rounded border max-h-48 overflow-y-auto">
    {renderMode === RENDER_MODES.MARKDOWN ? (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex, rehypeRaw]}
          components={MARKDOWN_COMPONENTS}
        >
          {content || '无内容'}
        </ReactMarkdown>
      </div>
    ) : (
      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
        {content || '无内容'}
      </pre>
    )}
  </div>
);

// 内容类型标签组件
const ContentTypeTag = ({ textRole }) => {
  if (!textRole) return null;
  
  const getTagStyle = (role) => {
    switch (role) {
      case '正文':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case '条文说明':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTagStyle(textRole)}`}>
      {textRole}
    </span>
  );
};

// Chunk项组件
const ChunkItem = ({ chunk, index, renderMode }) => (
  <div className="border rounded-lg p-4 bg-gray-50">
    <div className="flex justify-between items-start mb-3">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-medium text-gray-700">
            Chunk {index + 1}: {chunk.title || chunk.section || '未命名'}
          </h4>
          <ContentTypeTag textRole={chunk.text_role} />
        </div>
        <TagList tags={chunk.tags} />
      </div>
      <span className="text-xs text-gray-500 ml-2">#{index + 1}</span>
    </div>
    
    <div className="mb-3">
      <h5 className="text-xs font-medium text-gray-600 mb-1">内容:</h5>
      <ChunkContent content={chunk.content} renderMode={renderMode} />
    </div>

    <QuestionList chunk={chunk} />
    <ChunkInfo chunk={chunk} />
  </div>
);

export default function PdfPreview({ selectedPdf }) {
  const [activeTab, setActiveTab] = useState(TABS.PREVIEW);
  const [markdownContent, setMarkdownContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [chunksData, setChunksData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [renderMode, setRenderMode] = useState(RENDER_MODES.MARKDOWN);

  // API调用函数
  const fetchMarkdownContent = async (fileId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/processed/${fileId}/markdown`);
      setMarkdownContent(response.data.markdown || '');
    } catch (error) {
      console.error('获取Markdown内容失败:', error);
      setMarkdownContent('获取内容失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchChunksData = async (fileId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/processed/${fileId}`);
      setChunksData(response.data.chunks || []);
    } catch (error) {
      console.error('获取chunks数据失败:', error);
      setChunksData([]);
    }
  };

  // 副作用
  useEffect(() => {
    if (selectedPdf?.fileId) {
      fetchMarkdownContent(selectedPdf.fileId);
      fetchChunksData(selectedPdf.fileId);
      setCurrentPage(1);
    }
  }, [selectedPdf]);

  // 计算分页数据
  const totalPages = Math.ceil(chunksData.length / CHUNKS_PER_PAGE);
  const currentChunks = chunksData.slice(
    (currentPage - 1) * CHUNKS_PER_PAGE,
    currentPage * CHUNKS_PER_PAGE
  );

  if (!selectedPdf) {
    return <EmptyState />;
  }

  const renderPreviewTab = () => (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-medium text-gray-900 mb-4">文档内容预览</h3>
      <div className="text-sm text-gray-500 mb-2">
        文件URL: {API_BASE_URL}{selectedPdf.fileUrl}
      </div>
      <div className="h-screen border rounded-lg overflow-hidden">
        <PdfViewer fileUrl={`${API_BASE_URL}${selectedPdf.fileUrl}`} page={1} />
      </div>
    </div>
  );

  const renderMarkdownTab = () => (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Markdown内容</h3>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="h-screen border rounded-lg p-4 bg-gray-50 overflow-y-auto">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeRaw]}
              components={MARKDOWN_COMPONENTS}
            >
              {markdownContent || '暂无Markdown内容'}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );

  const renderDataTab = () => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">结构化数据</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">渲染模式:</span>
          <ActionButton
            variant={renderMode === RENDER_MODES.MARKDOWN ? 'primary' : 'default'}
            onClick={() => setRenderMode(RENDER_MODES.MARKDOWN)}
          >
            Markdown
          </ActionButton>
          <ActionButton
            variant={renderMode === RENDER_MODES.RAW ? 'primary' : 'default'}
            onClick={() => setRenderMode(RENDER_MODES.RAW)}
          >
            原始文本
          </ActionButton>
        </div>
      </div>
      
      {chunksData.length > 0 ? (
        <div>
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          
          <div className="h-screen overflow-y-auto">
            <div className="space-y-4">
              {currentChunks.map((chunk, index) => {
                const globalIndex = (currentPage - 1) * CHUNKS_PER_PAGE + index;
                return (
                  <ChunkItem 
                    key={globalIndex}
                    chunk={chunk}
                    index={globalIndex}
                    renderMode={renderMode}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>暂无结构化数据</p>
          <p className="text-sm mt-1">PDF处理完成后将显示chunks数据</p>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.PREVIEW:
        return renderPreviewTab();
      case TABS.MARKDOWN:
        return renderMarkdownTab();
      case TABS.DATA:
        return renderDataTab();
      default:
        return renderPreviewTab();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
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
            {selectedPdf.processing_steps && 
             (selectedPdf.status === 'uploading' || selectedPdf.status === 'processing') && (
              <ProcessingProgress processingSteps={selectedPdf.processing_steps} />
            )}
          </div>
          <div className="flex space-x-2">
            <ActionButton>添加标签</ActionButton>
            <ActionButton variant="primary">AI提取</ActionButton>
            <ActionButton variant="success">保存</ActionButton>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b">
        <nav className="flex space-x-8 px-4">
          <TabButton 
            isActive={activeTab === TABS.PREVIEW}
            onClick={() => setActiveTab(TABS.PREVIEW)}
          >
            文档内容
          </TabButton>
          <TabButton 
            isActive={activeTab === TABS.MARKDOWN}
            onClick={() => setActiveTab(TABS.MARKDOWN)}
          >
            Markdown
          </TabButton>
          <TabButton 
            isActive={activeTab === TABS.DATA}
            onClick={() => setActiveTab(TABS.DATA)}
          >
            结构化数据
          </TabButton>
        </nav>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 p-4 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
}