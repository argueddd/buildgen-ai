import React, { useState } from "react";

export default function ReportCard({ reportItem, onSelect }) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="bg-white shadow-md rounded-lg p-4 mb-4 border border-gray-200 relative">
      <h2 className="text-lg font-semibold mb-1">{reportItem.title}</h2>
      <p className="text-sm text-gray-700 mb-1">
        <span className="font-medium">文件:</span> {reportItem.source_file}
      </p>
      <p className="text-sm text-gray-700 mb-2">
        <span className="font-medium">章节:</span> {reportItem.section}
      </p>
      <p className="text-gray-800 text-sm mb-2">正文: {reportItem.content}</p>
      <p className="text-xs text-gray-500 italic">
        匹配字段: {reportItem.field} | 分数: {reportItem.score?.toFixed(4)}
      </p>

      <div className="mt-3 flex gap-3">
        <button
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          onClick={() => onSelect(reportItem)}
        >
          选择报告
        </button>
        <button
          className="px-3 py-1 bg-gray-100 text-sm rounded hover:bg-gray-200"
          onClick={() => setShowJson(!showJson)}
        >
          🔍 {showJson ? "关闭预览" : "预览 JSON"}
        </button>
      </div>

      {showJson && (
        <pre className="mt-4 text-xs bg-gray-50 p-3 rounded overflow-x-auto border border-gray-200 max-h-60 whitespace-pre-wrap">
          {JSON.stringify(reportItem, null, 2)}
        </pre>
      )}
    </div>
  );
}