import React, { useState } from 'react';
import SearchPanel from './components/SearchPanel/SearchPanel';

export default function App() {
  const [selectedReports, setSelectedReports] = useState([]);

  const handleSelectReport = (report) => {
    if (!selectedReports.find(r => r.content === report.content)) {
      setSelectedReports(prev => [...prev, report]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white text-gray-900 px-8 py-10 font-sans">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        📄 <span>RAG 标准报告前端</span>
      </h1>

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
}