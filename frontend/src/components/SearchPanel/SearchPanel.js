import React, { useState, useRef, useEffect } from 'react';
import { searchReports } from '../../services/searchService';
import { commonStyles } from '../../styles/commonStyles';

export default function SearchPanel({ 
  globalSearchResults, 
  setGlobalSearchResults,
  searchKeyword,
  setSearchKeyword
}) {
  const [keyword, setKeyword] = useState(searchKeyword || '');
  const [groupedResults, setGroupedResults] = useState([]);
  // 删除未使用的 originalResults 状态变量
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);

  // 初始化时恢复状态
  useEffect(() => {
    if (globalSearchResults.length > 0) {
      // 删除 setOriginalResults 调用，因为不再需要
      const grouped = groupResultsByPdf(globalSearchResults);
      setGroupedResults(grouped);
    }
  }, [globalSearchResults]);

  // 同步关键词状态
  useEffect(() => {
    setKeyword(searchKeyword || '');
  }, [searchKeyword]);

  // 按PDF名称分组并提取matched_keyword
  const groupResultsByPdf = (searchResults) => {
    const grouped = {};
    
    searchResults.forEach(result => {
      const pdfName = result.source_file;
      if (!grouped[pdfName]) {
        grouped[pdfName] = {
          pdfName: pdfName,
          matchedKeywords: new Set(),
          totalResults: 0
        };
      }
      
      // 添加matched_keyword到集合中（自动去重）
      if (result.matched_keyword) {
        grouped[pdfName].matchedKeywords.add(result.matched_keyword);
      }
      
      // 只计算text_role为"正文"的结果
      if (result.text_role === '正文') {
        grouped[pdfName].totalResults++;
      }
    });
    
    // 转换为数组格式，将Set转为Array
    return Object.values(grouped).map(group => ({
      ...group,
      matchedKeywords: Array.from(group.matchedKeywords)
    }));
  };

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setGroupedResults([]);
    // 删除 setOriginalResults([]) 调用
    setGlobalSearchResults([]); // 清空全局状态
    setProgress(0);
    setLoading(true);
    setSearchKeyword(keyword); // 保存搜索关键词

    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev < 20) return prev + 2;
        if (prev < 40) return prev + 1;
        if (prev < 60) return prev + 1;
        if (prev < 85) return prev + 1;
        return prev;
      });
    }, 160);

    try {
      const res = await searchReports(keyword);
      // 删除 setOriginalResults(res) 调用
      setGlobalSearchResults(res); // 保存到全局状态
      const grouped = groupResultsByPdf(res);
      setGroupedResults(grouped);
    } finally {
      clearInterval(progressRef.current);
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 300);
    }
  };

  return (
    <div className={commonStyles.contentArea}>
      {/* 搜索框区域 */}
      <div className={commonStyles.card + " p-6 mb-6"}>
        <h1 className={commonStyles.mainTitle + " mb-6"}>文档检索</h1>
        
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="请输入关键词"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className={commonStyles.input}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className={commonStyles.primaryButton + " disabled:bg-gray-400"}
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>

        {/* 进度条 */}
        {loading && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">正在搜索... {progress}%</p>
          </div>
        )}
      </div>

      {/* 搜索结果区域 */}
      {groupedResults.length > 0 && (
        <div className={commonStyles.card}>
          <div className="p-6 border-b border-gray-200">
            <h2 className={commonStyles.secondaryTitle}>
              搜索结果 ({groupedResults.length} 个文档)
            </h2>
          </div>
          
          {/* 可滚动的结果区域 */}
          <div className="max-h-96 overflow-y-auto p-6">
            <div className="space-y-4">
              {groupedResults.map((group, idx) => (
                <PdfResultCard key={`${group.pdfName}-${idx}`} group={group} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PDF结果卡片组件
function PdfResultCard({ group }) {
  let fileName = group.pdfName;
  if (!fileName.endsWith('.pdf')) {
    fileName += '.pdf';
  }
  const encodedFile = encodeURIComponent(fileName);
  const fileUrl = `http://aireportbackend.s7.tunnelfrp.com/pdfs/${encodedFile}`;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={commonStyles.tertiaryTitle}>{group.pdfName}</h3>
          <p className={commonStyles.auxiliaryText + " mt-1"}>{group.totalResults} 条匹配结果</p>
        </div>
        <button
          onClick={() => window.open(fileUrl, '_blank')}
          className={commonStyles.secondaryButton}
        >
          查看文档
        </button>
      </div>
      
      <div>
        <p className={commonStyles.auxiliaryText + " mb-2"}>匹配关键词：</p>
        <div className="flex flex-wrap gap-2">
          {group.matchedKeywords.map((keyword, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-200"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}