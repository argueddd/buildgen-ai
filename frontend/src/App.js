import React, { useState, useEffect } from 'react';
import SearchPanel from './components/SearchPanel/SearchPanel';
import PdfList from './components/PdfManager/PdfList';
import PdfPreview from './components/PdfManager/PdfPreview';
import axios from 'axios';

export default function App() {
  const [selectedReports, setSelectedReports] = useState([]);
  const [currentPage, setCurrentPage] = useState('search'); // 'search' 或 'pdf-management'

  const handleSelectReport = (report) => {
    if (!selectedReports.find(r => r.content === report.content)) {
      setSelectedReports(prev => [...prev, report]);
    }
  };

  const renderSearchPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white text-gray-900 px-8 py-10 font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          📄 <span>RAG 标准报告前端</span>
        </h1>
        <button
          onClick={() => setCurrentPage('pdf-management')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          📁 PDF管理
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SearchPanel onSelectReport={handleSelectReport} />

        <div className="border border-gray-200 rounded-xl bg-white shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-700">✅ 已选报告</h2>
          <ul className="space-y-3">
            {selectedReports.map((r, i) => (
              <li
                key={i}
                className="bg-blue-50 border border-blue-200 p-3 rounded-lg hover:bg-blue-100 transition flex justify-between items-center"
              >
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-gray-500">章节：{r.section}</div>
                </div>
                <button
                  onClick={() =>
                    setSelectedReports(prev => prev.filter(item => item.content !== r.content))
                  }
                  className="text-xs text-red-500 hover:underline ml-4"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderPdfManagementPage = () => (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentPage('search')}
                className="px-3 py-1 text-gray-600 hover:text-gray-900 transition"
              >
                ← 返回搜索
              </button>
              <h1 className="text-2xl font-bold text-gray-900">AI辅助报告生成系统</h1>
            </div>
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

  // PDF管理页面的状态
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfList, setPdfList] = useState([]);

  const handlePdfSelect = (pdf) => {
    setSelectedPdf(pdf);
  };

  const handlePdfUpload = (newPdf) => {
    if (newPdf.type === 'refresh') {
      // 刷新列表
      setPdfList(newPdf.pdfs);
    } else {
      // 添加新PDF
      setPdfList(prev => [newPdf, ...prev]);
    }
  };

  const handlePdfDelete = (pdfId) => {
    setPdfList(prev => prev.filter(pdf => pdf.id !== pdfId));
    if (selectedPdf && selectedPdf.id === pdfId) {
      setSelectedPdf(null);
    }
  };

  // 初始化时从后端获取PDF列表
  useEffect(() => {
    const fetchPdfList = async () => {
      try {
        const response = await axios.get('http://localhost:8010/pdf-list');
        if (response.data.pdfs) {
          setPdfList(response.data.pdfs);
        }
      } catch (error) {
        console.error('获取PDF列表失败:', error);
      }
    };

    fetchPdfList();
  }, []);

  return currentPage === 'search' ? renderSearchPage() : renderPdfManagementPage();
}