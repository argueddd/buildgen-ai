import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PdfViewer from '../PdfViewer/PdfViewer';
import { buildFileUrl } from '../../config/apiConfig';

export default function ReportPreview({ report, onSelect }) {
  const [showJson, setShowJson] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  let fileName = report.source_file;
  if (!fileName.endsWith('.pdf')) {
    fileName += '.pdf';
  }
  const encodedFile = encodeURIComponent(fileName);
  const fileUrl = buildFileUrl(fileName);
  console.log('fileUrl:', fileUrl);
  const pageNum = Number(report.page_num);
  console.log('page_num:', pageNum);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white border border-gray-200 rounded-xl shadow hover:shadow-lg p-5 mb-6 transition-all"
    >
      {/* 标题 + 分数 */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{report.title}</h3>
          <p className="text-sm text-gray-500">章节：{report.section}</p>
        </div>
        <span className="text-xs text-blue-600 font-mono">分数：{report.score?.toFixed(2)}</span>
      </div>

      {/* 内容摘要 */}
      <p className="text-gray-700 text-sm mb-3 leading-relaxed">
        {report.content.slice(0, 120)}...
      </p>

      {/* 标签 */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
        <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">
          来源文件: {report.source_file}
        </span>
        <span className="px-2 py-0.5 bg-green-50 border border-green-200 rounded">
          匹配字段: {report.field}
        </span>
        {report.tags?.map((t, i) => (
          <span
            key={i}
            className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 rounded"
          >
            {t}
          </span>
        ))}
      </div>

      {/* 按钮组 */}
      <div className="flex flex-wrap gap-3">
        <button
          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
          onClick={onSelect}
        >
          ✅ 选择报告
        </button>

        <button
          className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300 transition"
          onClick={() => setShowJson(prev => !prev)}
        >
          {showJson ? '📂 收起 JSON' : '🔍 预览 JSON'}
        </button>

        <button
          className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm hover:bg-blue-200 transition"
          onClick={() => setShowPdf(prev => !prev)}
        >
          {showPdf ? '📕 收起条文' : '📘 查看条文'}
        </button>
        <button
          className="bg-purple-100 text-purple-800 px-3 py-1 rounded text-sm hover:bg-purple-200 transition"
          onClick={() => {
            // 新窗口打开 PDF 并跳转到指定页码
            const urlWithPage = `${fileUrl}#page=${pageNum}`;
            window.open(urlWithPage, '_blank');
          }}
        >
          🌐 新窗口打开PDF
        </button>
      </div>

      {/* JSON 动画区 */}
      <AnimatePresence>
        {showJson && (
          <motion.pre
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 bg-gray-50 text-gray-800 text-xs border border-gray-200 p-4 rounded overflow-auto max-h-60 whitespace-pre-wrap"
          >
            {JSON.stringify(report, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>

      {/* PDF 内嵌预览区 */}
      <AnimatePresence>
        {showPdf && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-6"
          >
            <PdfViewer key={fileUrl + '-' + pageNum} fileUrl={fileUrl} page={pageNum} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}