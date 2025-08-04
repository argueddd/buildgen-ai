// src/components/PdfViewer/PdfViewer.js
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
// import 'react-pdf/dist/esm/Page/TextLayer.css';

// 设置 pdfjs worker 路径
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

export default function PdfViewer({ fileUrl, page }) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(page || 1);
  const [inputPage, setInputPage] = useState(page || 1);
  const [error, setError] = useState(null);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setError(null);
    // 如果外部 page 变了，自动跳转
    setCurrentPage(page || 1);
    setInputPage(page || 1);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF加载失败:', error);
    setError('PDF文件加载失败，请检查文件是否存在');
  };

  const goToPage = (p) => {
    if (p >= 1 && p <= numPages) {
      setCurrentPage(p);
      setInputPage(p);
    }
  };

  return (
    <div className="border rounded-xl bg-white p-4 shadow h-screen overflow-y-auto">
      {error ? (
        <div className="text-center py-8 text-red-500">
          <p>{error}</p>
          <p className="text-sm text-gray-500 mt-2">URL: {fileUrl}</p>
        </div>
      ) : (
        <div className="flex justify-center">
          <Document 
            file={fileUrl} 
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
          >
            <Page pageNumber={currentPage} />
          </Document>
        </div>
      )}
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          上一页
        </button>
        <span>
          第
          <input
            type="number"
            min={1}
            max={numPages || 1}
            value={inputPage}
            onChange={e => setInputPage(Number(e.target.value))}
            onBlur={() => goToPage(inputPage)}
            onKeyDown={e => {
              if (e.key === 'Enter') goToPage(inputPage);
            }}
            className="w-12 mx-1 text-center border rounded"
          />
          / {numPages || 1} 页
        </span>
        <button
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => goToPage(currentPage + 1)}
          disabled={numPages ? currentPage >= numPages : true}
        >
          下一页
        </button>
      </div>
    </div>
  );
}