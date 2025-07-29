import React, { useState, useRef } from 'react';
import axios from 'axios';

export default function PdfUpload({ onClose, onUpload }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files) => {
    const file = files[0];
    if (file.type !== 'application/pdf') {
      alert('请选择PDF文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('准备上传...');

    try {
      // 创建FormData
      const formData = new FormData();
      formData.append('file', file);

      // 上传配置
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          setUploadStatus('上传中...');
        },
      };

      setUploadStatus('上传文件...');
      
      // 调用后端上传接口
      const response = await axios.post('http://localhost:8010/upload-pdf', formData, config);
      
      if (response.data.success) {
        setUploadProgress(100);
        setUploadStatus('处理完成！');
        
        // 创建新的PDF对象
        const newPdf = {
          id: Date.now(),
          name: file.name,
          date: new Date().toISOString().split('T')[0],
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          status: 'completed',
          fileUrl: `http://localhost:8010/uploads/${response.data.filename}`,
          chunksCount: response.data.chunks_count
        };

        // 延迟关闭，让用户看到完成状态
        setTimeout(() => {
          onUpload(newPdf);
          setUploading(false);
          onClose();
        }, 1500);

      } else {
        throw new Error(response.data.error || '上传失败');
      }

    } catch (error) {
      console.error('上传失败:', error);
      setUploadStatus('上传失败');
      
      let errorMessage = '上传失败，请重试';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
      setUploading(false);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">上传PDF文档</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={uploading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!uploading ? (
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                拖拽PDF文件到此处，或
                <button
                  type="button"
                  onClick={onButtonClick}
                  className="text-blue-600 hover:text-blue-500 font-medium"
                >
                  点击选择文件
                </button>
              </p>
              <p className="text-xs text-gray-500 mt-1">支持PDF格式，最大50MB</p>
              <p className="text-xs text-blue-600 mt-2">上传后将自动进行AI处理和存储</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="text-center">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-gray-600 mb-2">{uploadStatus}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">{uploadProgress}%</p>
            {uploadProgress === 100 && (
              <p className="text-xs text-green-600 mt-2">✅ 处理完成，正在保存...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 