// src/components/PdfViewer/PdfViewer.js
import React from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

export default function PdfViewer({ fileUrl }) {
  return (
    <div className="border rounded-xl bg-white p-4 shadow max-h-[700px] overflow-y-auto">
      <Worker workerUrl={`https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`}>
        <Viewer fileUrl={fileUrl} />
      </Worker>
    </div>
  );
}