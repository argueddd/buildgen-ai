import { useState, useEffect, useRef} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { commonStyles } from '../../styles/commonStyles';
import { 
  LocalStorageKeys, 
  saveToLocalStorage, 
  getFromLocalStorage 
} from '../../utils/localStorage';
import { buildApiUrl, API_ENDPOINTS } from '../../config/apiConfig';

export default function ReportEditor({ searchResults, onBack }) {
  const [selectedPdf, setSelectedPdf] = useState(null);
  
  // 从localStorage恢复可编辑内容
  const [editableContents, setEditableContents] = useState(() => 
    getFromLocalStorage(LocalStorageKeys.EDITABLE_CONTENTS, [])
  );
  
  // 从localStorage恢复聊天消息
  const [chatMessages, setChatMessages] = useState(() => {
    const savedMessages = getFromLocalStorage(LocalStorageKeys.CHAT_MESSAGES, null);
    return savedMessages || [
      { type: 'assistant', content: '您好！我是智能助手，可以帮助您分析和编辑报告内容。请问有什么需要帮助的吗？' }
    ];
  });
  
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [markdownModal, setMarkdownModal] = useState({ isOpen: false, content: '', title: '' });
  // 添加智能问答窗口显示状态
  const [showChatModal, setShowChatModal] = useState(false);
  const pdfRefs = useRef({});
  // 添加弹窗位置和大小状态
  const [chatModalPosition, setChatModalPosition] = useState({ x: 100, y: 100 });
  const [chatModalSize, setChatModalSize] = useState({ width: 400, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // 监听状态变化并保存到localStorage
  useEffect(() => {
    saveToLocalStorage(LocalStorageKeys.CHAT_MESSAGES, chatMessages);
  }, [chatMessages]);

  
  // 添加refs用于稳定ID生成和防抖保存
  const saveTimeoutRef = useRef(null);

    // 添加拖拽处理函数
  const handleMouseDown = (e) => {
    if (e.target.closest('.resize-handle')) return; // 避免与调整大小冲突
    setIsDragging(true);
    setDragStart({
      x: e.clientX - chatModalPosition.x,
      y: e.clientY - chatModalPosition.y
    });
  };
  
  const handleResizeMouseDown = (e) => {
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };
  
  // 防抖保存到localStorage（保留这个）
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (editableContents.length > 0) {
        saveToLocalStorage(LocalStorageKeys.EDITABLE_CONTENTS, editableContents);
      }
    }, 500);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editableContents]);

      // 添加全局鼠标事件监听
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setChatModalPosition({
          x: Math.max(0, Math.min(window.innerWidth - chatModalSize.width, e.clientX - dragStart.x)),
          y: Math.max(0, Math.min(window.innerHeight - chatModalSize.height, e.clientY - dragStart.y))
        });
      } else if (isResizing) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setChatModalSize({
          width: Math.max(300, chatModalSize.width + deltaX),
          height: Math.max(400, chatModalSize.height + deltaY)
        });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, chatModalPosition, chatModalSize]);

  // 获取所有PDF名称，只显示包含"正文"内容的PDF
  const pdfNames = [...new Set(
    searchResults
      .filter(result => result.text_role === "正文") // 只考虑正文内容
      .map(result => result.source_file)
  )];

  // 根据选中的PDF过滤结果，并且只显示text_role为"正文"的内容
  const filteredResults = selectedPdf 
    ? searchResults.filter(result => 
        result.source_file === selectedPdf && 
        result.text_role === "正文"
      )
    : searchResults.filter(result => result.text_role === "正文");

  useEffect(() => {
    // 按PDF名称分组并排序
    const sortedResults = [...filteredResults].sort((a, b) => {
      // 首先按PDF名称排序
      const pdfCompare = a.source_file.localeCompare(b.source_file);
      if (pdfCompare !== 0) return pdfCompare;
      
      // 如果PDF名称相同，按标题排序
      const titleCompare = (a.title || '').localeCompare(b.title || '');
      if (titleCompare !== 0) return titleCompare;
      
      // 最后按章节排序
      return (a.section || '').localeCompare(b.section || '');
    });

    // 生成新的内容数组
    const newContents = sortedResults.map((result, index) => ({
      id: `${result.source_file}-${result.title || 'untitled'}-${result.section || 'nosection'}-${index}`,
      content: result.content,
      originalContent: result.content,
      source_file: result.source_file,
      matched_keyword: result.matched_keyword,
      title: result.title,
      section: result.section
    }));

    // 只有当内容真正发生变化时才更新状态
    setEditableContents(prev => {
      // 比较新旧内容是否相同
      if (prev.length !== newContents.length) {
        return newContents;
      }
      
      // 检查每个项目是否相同
      const hasChanges = newContents.some((newItem, index) => {
        const prevItem = prev[index];
        return !prevItem || 
              prevItem.id !== newItem.id || 
              prevItem.originalContent !== newItem.originalContent;
      });
      
      return hasChanges ? newContents : prev;
    });
  }, [filteredResults]);

  const handleContentChange = (id, newContent) => {
    setEditableContents(prev => 
      prev.map(item => 
        item.id === id ? { ...item, content: newContent } : item
      )
    );
  };

  // 添加删除函数
  // 添加删除项目的状态
  const [deletedIds, setDeletedIds] = useState(new Set());
  
  // 修改删除函数
  const handleDeleteContent = (id) => {
    console.log('尝试删除ID:', id);
    if (window.confirm('确定要删除这个文本块吗？此操作不可撤销。')) {
      setDeletedIds(prev => new Set([...prev, id]));
    }
  };
  
  // 修改 groupedContents 计算
  const groupedContents = editableContents
    .filter(item => !deletedIds.has(item.id))
    .reduce((groups, item) => {
      const pdfName = item.source_file;
      if (!groups[pdfName]) {
        groups[pdfName] = [];
      }
      groups[pdfName].push(item);
      return groups;
    }, {});

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsLoading(true);
    
    // 添加用户消息
    setChatMessages(prev => [
      ...prev,
      { type: 'user', content: userMessage }
    ]);
    
    // 构建上下文信息
    let context = '';
    if (selectedPdf) {
      const pdfContents = editableContents
        .filter(item => item.source_file === selectedPdf)
        .map(item => `标题: ${item.title}\n章节: ${item.section}\n内容: ${item.content}`)
        .join('\n\n');
      context = `当前查看的文档内容：\n${pdfContents}`;
    } else {
      const allContents = editableContents
        .slice(0, 5)
        .map(item => `文档: ${item.source_file}\n标题: ${item.title}\n章节: ${item.section}\n内容: ${item.content}`)
        .join('\n\n');
      context = `相关文档内容：\n${allContents}`;
    }
    
    // 在 handleSendMessage 函数中，大约第182-190行
    try {
    // 使用流式接口
    const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT.STREAM), {
    method: 'POST',
    headers: {
    'Content-Type': 'application/json',
    },
    body: JSON.stringify({
    question: userMessage,  // 改为 question
    context: context        // 保持 context（虽然后端暂时没用到）
    })
    });
    
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 添加一个空的AI消息，用于流式更新
      setChatMessages(prev => [
        ...prev,
        { type: 'assistant', content: '' }
      ]);
      
      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // 解码数据块
        buffer += decoder.decode(value, { stream: true });
        
        // 处理可能包含多个事件的缓冲区
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个可能不完整的行
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          // 解析 Server-Sent Events 格式
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // 移除 'data: ' 前缀
            
            if (data === '[DONE]') {
              // 流结束标志
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.success && parsed.content) {
                // 更新AI消息内容
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessageIndex = newMessages.length - 1;
                  if (newMessages[lastMessageIndex] && newMessages[lastMessageIndex].type === 'assistant') {
                    newMessages[lastMessageIndex] = {
                      ...newMessages[lastMessageIndex],
                      content: newMessages[lastMessageIndex].content + parsed.content
                    };
                  }
                  return newMessages;
                });
              } else if (parsed.error) {
                // 处理错误
                setChatMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessageIndex = newMessages.length - 1;
                  if (newMessages[lastMessageIndex] && newMessages[lastMessageIndex].type === 'assistant') {
                    newMessages[lastMessageIndex] = {
                      ...newMessages[lastMessageIndex],
                      content: `抱歉，服务出现错误：${parsed.error}`
                    };
                  }
                  return newMessages;
                });
                break;
              }
            } catch (parseError) {
              console.error('解析流数据失败:', parseError, 'Raw data:', data);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('发送消息失败:', error);
      setChatMessages(prev => [
        ...prev,
        { type: 'assistant', content: '抱歉，网络连接出现问题，请稍后重试。' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 点击PDF名称时滚动到对应位置
  const handlePdfClick = (pdfName) => {
    if (selectedPdf === pdfName) {
      // 如果点击的是当前选中的PDF，滚动到对应位置
      const element = pdfRefs.current[pdfName];
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }
    } else {
      // 如果点击的是其他PDF，先设置选中状态
      setSelectedPdf(pdfName);
      // 延迟滚动，等待DOM更新
      setTimeout(() => {
        const element = pdfRefs.current[pdfName];
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          });
        }
      }, 100);
    }
  };


  // 添加显示markdown弹框的函数
  const showMarkdownModal = (content, title = '内容详情') => {
    setMarkdownModal({
      isOpen: true,
      content: content,
      title: title
    });
  };

  // 关闭markdown弹框
  const closeMarkdownModal = () => {
    setMarkdownModal({ isOpen: false, content: '', title: '' });
  };

  // 添加条文说明相关状态
  const [explanationModal, setExplanationModal] = useState({ 
    isOpen: false, 
    explanations: [], 
    title: '',
    section: '' 
  });

  // 添加获取条文说明的函数
  const fetchExplanations = async (sourceFile, section, title) => {
    try {
      // 直接使用source_file作为参数，后端会匹配JSON中的filename字段
      const encodedSourceFile = encodeURIComponent(sourceFile);
      
      const response = await fetch(buildApiUrl(API_ENDPOINTS.SEARCH.EXPLANATIONS(encodedSourceFile)));
      const data = await response.json();
      
      if (response.ok) {
        // 查找匹配的条文说明
        const matchedPair = data.explanation_pairs.find(pair => pair.section === section);
        
        if (matchedPair && matchedPair.条文说明) {
          setExplanationModal({
            isOpen: true,
            explanations: [matchedPair],
            title: title,
            section: section
          });
        } else {
          alert('未找到该章节的条文说明');
        }
      } else {
        alert(`获取条文说明失败: ${data.error}`);
      }
    } catch (error) {
      console.error('获取条文说明失败:', error);
      alert('获取条文说明失败，请稍后重试');
    }
  };

  // 关闭条文说明弹框
  const closeExplanationModal = () => {
    setExplanationModal({ isOpen: false, explanations: [], title: '', section: '' });
  };


  return (
    <div className={commonStyles.pageContainer}>
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className={commonStyles.mainTitle}>编辑报告</h1>
            <div className="flex items-center space-x-4">
              <button 
                className={commonStyles.primaryButton}
                onClick={() => {
                  // 这里可以添加保存报告的逻辑
                  console.log('保存报告');
                  alert('报告已保存！');
                }}
              >
                保存报告
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex" style={{ height: 'calc(100vh - 80px)' }}>
        {/* 左侧面板 - 修改为全屏高度 */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
          {/* PDF列表 - 占满整个左侧面板 */}
          <div className="flex-1 p-4 h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className={commonStyles.secondaryTitle}>文档列表</h2>
              {/* 机器人图标按钮 */}
              <button
                onClick={() => setShowChatModal(true)}
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                title="智能问答"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 2.98.97 4.29L1 23l6.71-1.97C9.02 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.4 0-2.73-.35-3.89-.98L7 19.5l.5-1.11C6.85 17.73 6.5 16.4 6.5 15c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5-2.46 5.5-5.5 5.5z"/>
                  <circle cx="9" cy="15" r="1"/>
                  <circle cx="12" cy="15" r="1"/>
                  <circle cx="15" cy="15" r="1"/>
                </svg>
              </button>
            </div>
            <div className="h-full overflow-y-auto space-y-2 pr-2">
              {pdfNames.map((pdfName, index) => {
                return (
                  <button
                    key={index}
                    onClick={() => handlePdfClick(pdfName)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedPdf === pdfName 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <div className="truncate" title={pdfName}>
                      {pdfName} 
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右侧内容展示区域 - 按PDF分组显示 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="w-full space-y-8">
            {selectedPdf ? (
              // 显示选中PDF的内容
              Object.entries(groupedContents).length > 0 ? (
                Object.entries(groupedContents).map(([pdfName, items]) => (
                  <div key={pdfName} className="space-y-4">
                    {/* PDF分组标题 - 添加ref用于定位 */}
                    <div 
                      ref={el => pdfRefs.current[pdfName] = el}
                      className="bg-blue-50 border border-blue-200 rounded-lg p-4 scroll-mt-6"
                    >
                      <h2 className={commonStyles.secondaryTitle + " text-blue-800 mb-1"}>{pdfName}</h2>
                      <p className={commonStyles.auxiliaryText + " text-blue-600"}>{items.length} 个内容项</p>
                    </div>
                
                {/* 该PDF下的所有内容 */}
                <div className="space-y-6">
                  {items.map((item, index) => (
                    <div key={item.id} className={commonStyles.card + " p-6"}>
                      {/* 信息标签 */}
                      <div className="mb-4 grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className={commonStyles.auxiliaryText + " font-medium"}>匹配关键词：</span>
                          <span className="text-blue-600">{item.matched_keyword}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">标题：</span>
                          <span className="text-gray-600">{item.title}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">章节：</span>
                          <span className="text-gray-600">{item.section}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">序号：</span>
                          <span className="text-gray-600">#{index + 1}</span>
                        </div>
                      </div>
                      
                      {/* 可编辑文本框 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          内容
                        </label>
                        <textarea
                          value={item.content}
                          onChange={(e) => handleContentChange(item.id, e.target.value)}
                          className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-vertical text-gray-900 bg-white"
                          placeholder="编辑内容..."
                        />
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="mt-4 flex justify-end space-x-2">
                        <button
                          onClick={() => showMarkdownModal(item.content, `${item.title || '内容'} - Markdown格式`)}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                          显示Markdown
                        </button>
                        <button
                          onClick={() => fetchExplanations(item.source_file, item.section, item.title)}
                          className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                        >
                          查看条文说明
                        </button>
                        <button
                          onClick={() => handleContentChange(item.id, item.originalContent)}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          重置
                        </button>
                        <button
                          onClick={() => handleDeleteContent(item.id)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        >
                          删除
                        </button>
                        <button className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors">
                          保存
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
              ) : (
                // 选中PDF但没有内容的情况
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暂无内容</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    当前选中的PDF「{selectedPdf}」中没有找到符合条件的正文内容。
                    <br />请尝试选择其他PDF文档或检查搜索条件。
                  </p>
                </div>
              )
            ) : (
              // 没有选中PDF的情况
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">请选择PDF文档</h3>
                <p className="text-gray-500 text-center max-w-md">
                  请从左侧文档列表中选择一个PDF文档来查看和编辑其内容。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Markdown显示弹框 */}
      {markdownModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* 弹框头部 */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{markdownModal.title}</h3>
              <button
                onClick={closeMarkdownModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 弹框内容 - 支持数学公式和HTML表格 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-md p-4 border prose prose-sm max-w-none text-gray-800 leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                  components={{
                    // 自定义表格样式
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
                    )
                  }}
                >
                  {markdownModal.content}
                </ReactMarkdown>
              </div>
            </div>
            
            {/* 弹框底部 */}
            <div className="flex justify-end p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(markdownModal.content);
                  alert('内容已复制到剪贴板！');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mr-2"
              >
                复制内容
              </button>
              <button
                onClick={closeMarkdownModal}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 条文说明显示弹框 */}
      {explanationModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* 弹框头部 */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                条文说明 - {explanationModal.title} ({explanationModal.section})
              </h3>
              <button
                onClick={closeExplanationModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* 弹框内容 */}
            <div className="flex-1 overflow-y-auto p-4">
              {explanationModal.explanations.length > 0 ? (
                explanationModal.explanations.map((pair, index) => (
                  <div key={index} className="mb-6">
                    {/* 正文部分 */}
                    <div className="mb-4">
                      <h4 className="text-md font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
                        正文内容
                      </h4>
                      <div className="bg-blue-50 rounded-md p-4 border prose prose-sm max-w-none text-gray-800 leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex, rehypeRaw]}
                        >
                          {pair.正文}
                        </ReactMarkdown>
                      </div>
                    </div>
                    
                    {/* 条文说明部分 */}
                    <div>
                      <h4 className="text-md font-semibold text-gray-800 mb-2 border-b border-gray-200 pb-1">
                        条文说明
                      </h4>
                      <div className="bg-yellow-50 rounded-md p-4 border prose prose-sm max-w-none text-gray-800 leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex, rehypeRaw]}
                          components={{
                            // 自定义表格样式
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
                            )
                          }}
                        >
                          {pair.条文说明}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>未找到匹配的条文说明</p>
                </div>
              )}
            </div>
            
            {/* 弹框底部 */}
            <div className="flex justify-end p-4 border-t border-gray-200">
              <button
                onClick={() => {
                  const content = explanationModal.explanations.map(pair => 
                    `## 正文内容\n\n${pair.正文}\n\n## 条文说明\n\n${pair.条文说明}`
                  ).join('\n\n---\n\n');
                  navigator.clipboard.writeText(content);
                  alert('条文说明内容已复制到剪贴板！');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mr-2"
              >
                复制内容
              </button>
              <button
                onClick={closeExplanationModal}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 智能问答弹窗 */}
      {showChatModal && (
        <div 
          className="fixed z-40 shadow-2xl select-none"
          style={{
            left: `${chatModalPosition.x}px`,
            top: `${chatModalPosition.y}px`,
            width: `${chatModalSize.width}px`,
            height: `${chatModalSize.height}px`,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
        >
          <div className="bg-white rounded-lg w-full h-full flex flex-col border border-gray-300 overflow-hidden">
            {/* 弹窗头部 - 可拖拽区域 */}
            <div 
              className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 pointer-events-none">智能问答</h3>
                <button
                  onClick={() => setShowChatModal(false)}
                  className="text-gray-400 hover:text-gray-600 pointer-events-auto"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedPdf && (
                <p className="text-sm text-gray-600 mt-1 pointer-events-none">当前分析文档: {selectedPdf}</p>
              )}
            </div>
            
            {/* 对话历史 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {chatMessages.map((message, index) => (
                <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-800'
                  }`}>
                    {message.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-xs px-3 py-2 rounded-lg text-sm bg-gray-200 text-gray-800">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 输入框 */}
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder="输入问题..."
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !chatInput.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? '发送中...' : '发送'}
                </button>
              </div>
            </div>
            
            {/* 调整大小手柄 */}
            <div 
              className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 hover:bg-gray-400 transition-colors"
              onMouseDown={handleResizeMouseDown}
              style={{
                clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}