import React, { useState, useRef, useEffect } from 'react';
import { searchReports, extractKeywords, searchByKeywords } from '../../services/searchService';
import { commonStyles } from '../../styles/commonStyles';
import { buildFileUrl } from '../../config/apiConfig';

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
  
  // 关键词拆分相关状态
  const [extractedKeywords, setExtractedKeywords] = useState(null);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [keywordSearchMode, setKeywordSearchMode] = useState(false);
  const [searchSettings, setSearchSettings] = useState({
    searchType: 'hybrid', // 'hybrid' or 'keyword'
    filterType: 'topN', // 'topN' or 'threshold'
    topN: 10,
    threshold: 0.7
  });
  const [showSettings, setShowSettings] = useState(false);

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

  // 按PDF名称分组并提取matched_keyword，只显示包含正文的PDF
  const groupResultsByPdf = (searchResults) => {
    const grouped = {};
    
    searchResults.forEach(result => {
      const pdfName = result.source_file;
      if (!grouped[pdfName]) {
        grouped[pdfName] = {
          pdfName: pdfName,
          matchedKeywords: new Set(),
          totalResults: 0,
          contentTypes: {
            '正文': 0,
            '条文说明': 0
          }
        };
      }
      
      // 添加matched_keyword到集合中（自动去重）
      if (result.matched_keyword) {
        grouped[pdfName].matchedKeywords.add(result.matched_keyword);
      }
      
      // 按text_role分类统计
      const textRole = result.text_role;
      if (textRole === '正文' || textRole === '条文说明') {
        grouped[pdfName].contentTypes[textRole]++;
        grouped[pdfName].totalResults++;
      }
    });
    
    // 转换为数组格式，将Set转为Array，并且只返回包含正文的PDF
    return Object.values(grouped)
      .filter(group => group.contentTypes['正文'] > 0) // 只显示包含正文的PDF
      .map(group => ({
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
    setKeywordSearchMode(false); // 重置关键词搜索模式

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

  // 提取关键词
  const handleExtractKeywords = async () => {
    if (!keyword.trim()) return;
    setKeywordLoading(true);
    setExtractedKeywords(null);
    setSelectedKeywords([]);
    
    try {
      const keywords = await extractKeywords(keyword);
      setExtractedKeywords(keywords);
    } catch (error) {
      console.error('关键词提取失败:', error);
    } finally {
      setKeywordLoading(false);
    }
  };

  // 关键词选择处理
  const handleKeywordToggle = (keyword) => {
    setSelectedKeywords(prev => {
      if (prev.includes(keyword)) {
        return prev.filter(k => k !== keyword);
      } else {
        return [...prev, keyword];
      }
    });
  };

  // 基于选定关键词进行检索
  const handleKeywordSearch = async () => {
    if (selectedKeywords.length === 0) {
      alert('请至少选择一个关键词');
      return;
    }
    
    setGroupedResults([]);
    setGlobalSearchResults([]);
    setProgress(0);
    setLoading(true);
    setKeywordSearchMode(true);

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
      let res;
      if (searchSettings.searchType === 'hybrid') {
         // 混合检索，传递关键词和搜索设置
         res = await searchReports(keyword, {
           keywords: selectedKeywords,
           filterType: searchSettings.filterType,
           topN: searchSettings.topN,
           threshold: searchSettings.threshold
         });
       } else {
         // 纯关键词检索
         res = await searchByKeywords(selectedKeywords, searchSettings.filterType, searchSettings.topN, searchSettings.threshold);
       }
      setGlobalSearchResults(res);
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
            onKeyDown={e => e.key === 'Enter' && handleExtractKeywords()}
            className={commonStyles.input}
          />
          <button
            onClick={handleExtractKeywords}
            disabled={keywordLoading || !keyword.trim()}
            className={commonStyles.primaryButton + " disabled:bg-gray-400"}
          >
            {keywordLoading ? '拆分中...' : '拆分关键词'}
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

        {/* 关键词拆分结果显示 */}
        {extractedKeywords && (
          <div className="mb-4">
            <h3 className={commonStyles.tertiaryTitle + " mb-3"}>关键词拆分结果</h3>
            <KeywordDisplay 
              keywords={extractedKeywords} 
              selectedKeywords={selectedKeywords}
              onKeywordToggle={handleKeywordToggle}
            />
            {selectedKeywords.length > 0 && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  已选择 {selectedKeywords.length} 个关键词
                </span>
                <button
                  onClick={handleKeywordSearch}
                  disabled={loading}
                  className={commonStyles.primaryButton + " disabled:bg-gray-400"}
                >
                  {loading && keywordSearchMode ? '检索中...' : '搜索'}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={commonStyles.secondaryButton}
                >
                  搜索设置
                </button>
              </div>
            )}
            
            {/* 搜索设置面板 */}
            {showSettings && selectedKeywords.length > 0 && (
              <div className="mt-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
                <h3 className="text-lg font-semibold mb-3">搜索设置</h3>
                
                {/* 检索类型 */}
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-2">检索类型:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="hybrid"
                        checked={searchSettings.searchType === 'hybrid'}
                        onChange={e => setSearchSettings({...searchSettings, searchType: e.target.value})}
                        className="mr-2"
                      />
                      混合检索
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="keyword"
                        checked={searchSettings.searchType === 'keyword'}
                        onChange={e => setSearchSettings({...searchSettings, searchType: e.target.value})}
                        className="mr-2"
                      />
                      关键词检索
                    </label>
                  </div>
                </div>

                {/* 结果筛选 */}
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-2">检索结果筛选:</label>
                  <div className="flex gap-4 items-center">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="topN"
                        checked={searchSettings.filterType === 'topN'}
                        onChange={e => setSearchSettings({...searchSettings, filterType: e.target.value})}
                        className="mr-2"
                      />
                      相似度前
                    </label>
                    {searchSettings.filterType === 'topN' && (
                      <input
                        type="number"
                        value={searchSettings.topN}
                        onChange={e => setSearchSettings({...searchSettings, topN: parseInt(e.target.value)})}
                        className="w-16 px-2 py-1 border border-gray-300 rounded"
                        min="1"
                        max="100"
                      />
                    )}
                    <span className="mr-4">个</span>
                    
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="threshold"
                        checked={searchSettings.filterType === 'threshold'}
                        onChange={e => setSearchSettings({...searchSettings, filterType: e.target.value})}
                        className="mr-2"
                      />
                      相似度大于
                    </label>
                    {searchSettings.filterType === 'threshold' && (
                      <input
                        type="number"
                        value={searchSettings.threshold}
                        onChange={e => setSearchSettings({...searchSettings, threshold: parseFloat(e.target.value)})}
                        className="w-20 px-2 py-1 border border-gray-300 rounded"
                        min="0"
                        max="1"
                        step="0.1"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 搜索结果区域 */}
      {groupedResults.length > 0 && (
        <div className={commonStyles.card}>
          <div className="p-6 border-b border-gray-200">
            <h2 className={commonStyles.secondaryTitle}>
              {keywordSearchMode ? '关键词检索结果' : '搜索结果'} ({groupedResults.length} 个文档)
            </h2>
            {keywordSearchMode && selectedKeywords.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">检索关键词：</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedKeywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
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

// 关键词显示组件
function KeywordDisplay({ keywords, selectedKeywords, onKeywordToggle }) {
  const keywordCategories = [
    { key: 'material_keywords', label: '材料相关', color: 'bg-red-50 text-red-700 border-red-200' },
    { key: 'functional_keywords', label: '功能特性', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { key: 'component_keywords', label: '结构构件', color: 'bg-green-50 text-green-700 border-green-200' },
    { key: 'process_keywords', label: '工艺流程', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { key: 'similar_task_keywords', label: '相关任务', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { key: 'combinational_keywords', label: '组合关键词', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  ];

  return (
    <div className="space-y-4">
      {keywordCategories.map(category => {
        const categoryKeywords = keywords[category.key] || [];
        if (categoryKeywords.length === 0) return null;
        
        return (
          <div key={category.key}>
            <h4 className="text-sm font-medium text-gray-700 mb-2">{category.label}</h4>
            <div className="flex flex-wrap gap-2">
              {categoryKeywords.map((keyword, index) => {
                const isSelected = selectedKeywords.includes(keyword);
                return (
                  <button
                    key={`${category.key}-${index}`}
                    onClick={() => onKeywordToggle(keyword)}
                    className={`px-3 py-1 rounded-md text-sm border transition-all ${
                      isSelected 
                        ? 'bg-gray-800 text-white border-gray-800' 
                        : category.color + ' hover:opacity-80'
                    }`}
                  >
                    {keyword}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
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
  const fileUrl = buildFileUrl(fileName);

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
      
      <div className="space-y-3">
        {/* 内容类型统计 */}
        {group.contentTypes && (
          <div>
            <p className={commonStyles.auxiliaryText + " mb-2"}>内容类型分布：</p>
            <div className="flex gap-4">
              {group.contentTypes['正文'] > 0 && (
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm border border-green-200">
                  正文: {group.contentTypes['正文']}条
                </span>
              )}
              {group.contentTypes['条文说明'] > 0 && (
                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-sm border border-orange-200">
                  条文说明: {group.contentTypes['条文说明']}条
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* 匹配关键词 */}
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
    </div>
  );
}