import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';


// 设置 worker 路径
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PdfViewer({ fileUrl, page = 1 }) {
  const [numPages, setNumPages] = useState(null);

  return (
    <div className="border rounded-xl bg-white p-4 shadow max-w-3xl mx-auto">
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading="📄 正在加载 PDF..."
        error="❌ 加载失败，请检查文件路径"
      >
        <Page pageNumber={page} width={600} />
      </Document>
      <p className="text-sm text-gray-500 mt-2 text-center">
        第 {page} 页 / 共 {numPages || '-'} 页
      </p>
    </div>
  );
}