import React, { useState } from 'react';
import PdfList from '../components/PdfManager/PdfList';
import PdfPreview from '../components/PdfManager/PdfPreview';

export default function PdfManagement() {
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfList, setPdfList] = useState([
    {
      id: 1,
      name: '木头盘子产品说明书',
      date: '2025-02-15',
      size: '2.3 MB',
      status: 'completed',
      fileUrl: '/api/pdfs/wooden-plate.pdf'
    },
    {
      id: 2,
      name: '钢制保温杯技术规格说明',
      date: '2025-02-14',
      size: '1.8 MB',
      status: 'completed',
      fileUrl: '/api/pdfs/steel-cup.pdf'
    },
    {
      id: 3,
      name: '保温木杯产品介绍',
      date: '2025-02-13',
      size: '3.1 MB',
      status: 'processing',
      fileUrl: '/api/pdfs/wooden-cup.pdf'
    },
    {
      id: 4,
      name: '竹制保温包设计说明',
      date: '2025-02-12',
      size: '2.7 MB',
      status: 'pending',
      fileUrl: '/api/pdfs/bamboo-bag.pdf'
    },
    {
      id: 5,
      name: '塑料保温盒产品手册',
      date: '2025-02-11',
      size: '1.5 MB',
      status: 'pending',
      fileUrl: '/api/pdfs/plastic-box.pdf'
    }
  ]);

  const handlePdfSelect = (pdf) => {
    setSelectedPdf(pdf);
  };

  const handlePdfUpload = (newPdf) => {
    setPdfList(prev => [newPdf, ...prev]);
  };

  const handlePdfDelete = (pdfId) => {
    setPdfList(prev => prev.filter(pdf => pdf.id !== pdfId));
    if (selectedPdf && selectedPdf.id === pdfId) {
      setSelectedPdf(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">AI辅助报告生成系统</h1>
            <div className="text-sm text-gray-500">PDF管理与数据提取</div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：PDF列表 */}
          <div className="lg:col-span-1">
            <PdfList
              pdfList={pdfList}
              selectedPdf={selectedPdf}
              onPdfSelect={handlePdfSelect}
              onPdfUpload={handlePdfUpload}
              onPdfDelete={handlePdfDelete}
            />
          </div>

          {/* 右侧：PDF预览和数据提取 */}
          <div className="lg:col-span-2">
            <PdfPreview selectedPdf={selectedPdf} />
          </div>
        </div>
      </div>
    </div>
  );
} 