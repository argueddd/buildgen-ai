import React, { useState, useEffect } from 'react';
import SearchPanel from './components/SearchPanel/SearchPanel';
import ReportEditor from './components/SearchPanel/ReportEditor';
import PdfList from './components/PdfManager/PdfList';
import PdfPreview from './components/PdfManager/PdfPreview';
import axios from 'axios';
import { 
  LocalStorageKeys, 
  saveToLocalStorage, 
  getFromLocalStorage 
} from './utils/localStorage';

export default function App() {
  // 从localStorage恢复状态，如果没有则使用默认值
  const [currentPage, setCurrentPage] = useState(() => 
    getFromLocalStorage(LocalStorageKeys.CURRENT_PAGE, 'search')
  );
  
  const [globalSearchResults, setGlobalSearchResults] = useState(() => 
    getFromLocalStorage(LocalStorageKeys.SEARCH_RESULTS, [])
  );
  
  const [globalSelectedReports, setGlobalSelectedReports] = useState(() => 
    getFromLocalStorage(LocalStorageKeys.SELECTED_REPORTS, [])
  );
  
  const [searchKeyword, setSearchKeyword] = useState(() => 
    getFromLocalStorage(LocalStorageKeys.SEARCH_KEYWORD, '')
  );

  const [selectedPdf, setSelectedPdf] = useState(() => 
    getFromLocalStorage(LocalStorageKeys.SELECTED_PDF, null)
  );
  
  const [pdfList, setPdfList] = useState(() => 
    getFromLocalStorage(LocalStorageKeys.PDF_LIST, [])
  );
  
  const [deletingPdfs, setDeletingPdfs] = useState(new Set());

  // 监听状态变化并保存到localStorage
  useEffect(() => {
    saveToLocalStorage(LocalStorageKeys.CURRENT_PAGE, currentPage);
  }, [currentPage]);

  useEffect(() => {
    saveToLocalStorage(LocalStorageKeys.SEARCH_RESULTS, globalSearchResults);
  }, [globalSearchResults]);

  useEffect(() => {
    saveToLocalStorage(LocalStorageKeys.SELECTED_REPORTS, globalSelectedReports);
  }, [globalSelectedReports]);

  useEffect(() => {
    saveToLocalStorage(LocalStorageKeys.SEARCH_KEYWORD, searchKeyword);
  }, [searchKeyword]);

  useEffect(() => {
    saveToLocalStorage(LocalStorageKeys.SELECTED_PDF, selectedPdf);
  }, [selectedPdf]);

  useEffect(() => {
    saveToLocalStorage(LocalStorageKeys.PDF_LIST, pdfList);
  }, [pdfList]);

  // 统一的顶部导航栏 - 移动到组件内部
  const renderNavigation = () => (
    <div className="bg-white shadow-sm border-b">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <h1 className="text-2xl font-bold text-gray-900">AI辅助报告生成系统</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setCurrentPage('search')}
              className={`px-6 py-2 rounded-lg transition ${
                currentPage === 'search'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              检索文档
            </button>
            <button
              onClick={() => setCurrentPage('report-editor')}
              className={`px-6 py-2 rounded-lg transition ${
                currentPage === 'report-editor'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              编辑报告
            </button>
            <button
              onClick={() => setCurrentPage('pdf-management')}
              className={`px-6 py-2 rounded-lg transition ${
                currentPage === 'pdf-management'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              PDF管理
            </button>
            <button
              onClick={() => {
                if (window.confirm('确定要清空所有本地数据吗？这将清除所有搜索结果、聊天记录等数据。')) {
                  // 清空localStorage
                  Object.values(LocalStorageKeys).forEach(key => {
                    localStorage.removeItem(key);
                  });
                  // 重置所有状态
                  setCurrentPage('search');
                  setGlobalSearchResults([]);
                  setGlobalSelectedReports([]);
                  setSearchKeyword('');
                  setSelectedPdf(null);
                  setPdfList([]);
                  window.location.reload();
                }
              }}
              className="px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition text-sm"
            >
              清空数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSearchPage = () => (
    <div className="min-h-screen bg-gray-50">
      {renderNavigation()}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <SearchPanel 
          globalSearchResults={globalSearchResults}
          setGlobalSearchResults={setGlobalSearchResults}
          globalSelectedReports={globalSelectedReports}
          setGlobalSelectedReports={setGlobalSelectedReports}
          searchKeyword={searchKeyword}
          setSearchKeyword={setSearchKeyword}
        />
      </div>
    </div>
  );

  const renderReportEditorPage = () => (
    <div className="min-h-screen bg-gray-50">
      {renderNavigation()}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {globalSearchResults.length > 0 ? (
          <ReportEditor 
            searchResults={globalSearchResults}
            onBack={() => setCurrentPage('search')}
          />
        ) : (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-700 mb-4">报告编辑器</h2>
              <p className="text-gray-500 mb-6">请先进行文档检索，然后点击"编辑报告"按钮进入编辑界面</p>
              <button
                onClick={() => setCurrentPage('search')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                前往检索页面
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

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

  const handlePdfDelete = async (pdfId) => {
    try {
      // 确认删除
      const confirmed = window.confirm('确定要删除这个PDF文件吗？此操作将删除文件及所有相关数据，且无法恢复。');
      if (!confirmed) {
        return;
      }
  
      // 添加到删除中状态
      setDeletingPdfs(prev => new Set([...prev, pdfId]));
  
      // 调用后端删除API
      const response = await axios.delete(`http://aireportbackend.s7.tunnelfrp.com/delete-pdf/${pdfId}`);
      
      if (response.data.success) {
        // 从前端状态中删除
        setPdfList(prev => prev.filter(pdf => pdf.id !== pdfId));
        if (selectedPdf && selectedPdf.id === pdfId) {
          setSelectedPdf(null);
        }
        alert('PDF文件删除成功！');
      } else {
        alert('删除失败：' + response.data.error);
      }
    } catch (error) {
      console.error('删除PDF失败:', error);
      alert('删除失败：' + (error.response?.data?.error || error.message));
    } finally {
      // 从删除中状态移除
      setDeletingPdfs(prev => {
        const newSet = new Set(prev);
        newSet.delete(pdfId);
        return newSet;
      });
    }
  };

  const renderPdfManagementPage = () => (
    <div className="min-h-screen bg-gray-50">
      {renderNavigation()}
      {/* 主内容区域 */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：PDF列表 */}
          <div className="lg:col-span-1">
            <PdfList
              pdfList={pdfList}
              selectedPdf={selectedPdf}
              onPdfSelect={handlePdfSelect}
              onPdfUpload={handlePdfUpload}
              onPdfDelete={handlePdfDelete}
              deletingPdfs={deletingPdfs}
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

  // 初始化时从后端获取PDF列表
  useEffect(() => {
    const fetchPdfList = async () => {
      try {
        const response = await axios.get('http://aireportbackend.s7.tunnelfrp.com/pdf-list');
        if (response.data.pdfs) {
          setPdfList(response.data.pdfs);
        }
      } catch (error) {
        console.error('获取PDF列表失败:', error);
      }
    };

    fetchPdfList();
  }, []);

  // 根据当前页面渲染对应内容
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'search':
        return renderSearchPage();
      case 'report-editor':
        return renderReportEditorPage();
      case 'pdf-management':
        return renderPdfManagementPage();
      default:
        return renderSearchPage();
    }
  };

  return renderCurrentPage();
}