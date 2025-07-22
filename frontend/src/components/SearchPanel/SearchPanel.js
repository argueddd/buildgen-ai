import React, { useState, useRef } from 'react';
import ReportPreview from '../ReportPreview/ReportPreview';
import { searchReports } from '../../services/searchService';

export default function SearchPanel({ onSelectReport }) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setResults([]);
    setProgress(0);
    setLoading(true);

    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev < 20) return prev + 2;      // 0-20 慢慢来
        if (prev < 40) return prev + 1;    // 20-40 更慢
        if (prev < 60) return prev + 1;    // 40-60 稳住
        if (prev < 85) return prev + 1;    // 最慢往上爬
        return prev;
      });
    }, 160);  // 每 160ms 更新一次/ 每 150ms 更新一次（更平稳）

    try {
      const res = await searchReports(keyword);
      setResults(res);
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
    <div className="bg-white border border-gray-200 rounded-xl shadow-md p-6">
      <h2 className="text-xl font-semibold text-blue-700 mb-4">🔍 搜索报告</h2>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="输入关键词（如“保温层”）"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-900 shadow-sm transition"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          搜索
        </button>
      </div>

      {/* 进度条部分 */}
      {loading && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-1">⏳ 正在查询中… {progress}%</p>
        </div>
      )}

      <div className="space-y-4">
        {results.map((report, idx) => (
          <ReportPreview
            key={`${report.title}-${idx}`}
            report={report}
            onSelect={() => onSelectReport(report)}
          />
        ))}
      </div>
    </div>
  );
}